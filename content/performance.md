Most slow Django pages are slow for one reason: **too many database queries, or queries that do too much**. This chapter shows how to find the problem, fix the common causes, and use Django's **cache framework** for work that's expensive to repeat.

> [!TIP] Measure first
> Don't guess. Install **django-debug-toolbar** in development: it shows every SQL query, its time and where it came from, for every page.

```bash
pip install django-debug-toolbar
```

```python title="settings.py (development only)"
INSTALLED_APPS += ["debug_toolbar"]
MIDDLEWARE.insert(0, "debug_toolbar.middleware.DebugToolbarMiddleware")
INTERNAL_IPS = ["127.0.0.1"]
```

```python title="urls.py"
from django.conf import settings

if settings.DEBUG:
    urlpatterns += [path("__debug__/", include("debug_toolbar.urls"))]
```

## 1. Kill the N+1 problem

```python
# 1 query for posts + 1 query per post for its author = N+1
for post in Post.objects.all():
    print(post.author.username)
```

| Relationship you touch | Fix |
|---|---|
| ForeignKey / OneToOne (forward) | `select_related("author")` → one JOIN |
| Reverse ForeignKey / ManyToMany | `prefetch_related("comments", "tags")` → one extra query each |

```python
posts = (
    Post.objects
    .select_related("author", "category")
    .prefetch_related("tags")
)
```

In DRF, put this in `get_queryset()`; in class-based views, in `queryset` or `get_queryset()`; in the admin, use `list_select_related`.

## 2. Let the database do the work

```python
# Slow: loads every row into Python
total = sum(p.runs for p in Player.objects.all())
count = len(Player.objects.all())
exists = Player.objects.filter(name="Asha") != []    # also wrong!

# Fast: one small query each
from django.db.models import Sum
total = Player.objects.aggregate(total=Sum("runs"))["total"]
count = Player.objects.count()
exists = Player.objects.filter(name="Asha").exists()
```

```python
# Slow: loads every object, saves each one separately
for p in Player.objects.filter(team=india):
    p.runs += 10
    p.save()

# Fast: one UPDATE
from django.db.models import F
Player.objects.filter(team=india).update(runs=F("runs") + 10)
```

Use `bulk_create()` and `bulk_update()` for many rows at once.

## 3. Fetch only what you need

```python
Player.objects.values_list("name", flat=True)    # just names, no model objects
Player.objects.only("id", "name")                # model objects with only these columns
Player.objects.defer("biography")                # everything except a large column
```

And always paginate long lists ([Views](/learn/views#a-complete-example-search-with-pagination), [DRF](/learn/filtering-pagination#pagination)).

## 4. Index what you filter and sort on

Without an index, the database scans every row. Add indexes to fields that appear in `filter()`, `order_by()` and lookups:

```python
class Player(models.Model):
    name = models.CharField(max_length=100, db_index=True)
    runs = models.PositiveIntegerField()

    class Meta:
        indexes = [
            models.Index(fields=["runs"]),
            models.Index(fields=["team", "-runs"]),   # composite index for "team's top scorers"
        ]
```

Primary keys, `ForeignKey`s, `unique=True` and `SlugField` are indexed automatically. Use `qs.explain()` to see whether the database uses your index.

## 5. Understand QuerySet caching

A QuerySet caches its results after being evaluated once:

```python
players = Player.objects.all()
list(players)      # query runs
list(players)      # uses the cache, no query

Player.objects.all()[0]   # a NEW query every time you write the expression
```

In templates, `{% with %}` or assigning to a variable in the view avoids repeating expensive lookups.

## The cache framework

When a result is expensive to compute and doesn't change every second, compute it once and keep it.

### Configure a cache backend

```python title="settings.py"
# Development: in-process memory (the default if you set nothing)
CACHES = {
    "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}
}

# Production: Redis, shared by all server processes
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/1",
    }
}
```

Other backends: `db.DatabaseCache` (needs `createcachetable`), `filebased.FileBasedCache`, `memcached.PyMemcacheCache`, `dummy.DummyCache` (caches nothing, for testing).

### Low-level cache API

```python
from django.core.cache import cache

cache.set("leaderboard", data, timeout=300)        # seconds
data = cache.get("leaderboard")                     # None if missing or expired
data = cache.get_or_set("leaderboard", compute_leaderboard, timeout=300)
cache.delete("leaderboard")
cache.incr("page_views")                            # atomic counter (key must exist)
cache.set_many({"a": 1, "b": 2}); cache.get_many(["a", "b"])
cache.clear()
```

A typical pattern:

```python
def leaderboard(request):
    data = cache.get("leaderboard")
    if data is None:
        data = list(Player.objects.order_by("-runs").values("name", "runs")[:10])
        cache.set("leaderboard", data, timeout=60 * 5)
    return render(request, "cricket/leaderboard.html", {"top": data})
```

### Invalidating

Stale data is the hard part of caching. Delete the key when the underlying data changes, for example with a signal:

```python
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver


@receiver([post_save, post_delete], sender=Player)
def clear_leaderboard(sender, **kwargs):
    cache.delete("leaderboard")
```

### Per-view caching

Cache a whole response:

```python
from django.views.decorators.cache import cache_page


@cache_page(60 * 15)          # 15 minutes
def about(request): ...
```

```python
path("stats/", cache_page(60)(StatsView.as_view())),
```

Careful: don't cache pages that differ per user unless you vary the cache key (e.g. `@vary_on_cookie`). For DRF list endpoints, combine `cache_page` with `method_decorator` on `list()`.

### Template fragment caching

```django
{% load cache %}
{% cache 600 sidebar %}
  ... expensive sidebar ...
{% endcache %}

{% cache 600 user_menu request.user.id %}   {# a separate copy per user #}
  ...
{% endcache %}
```

### Whole-site cache

`UpdateCacheMiddleware` + `FetchFromCacheMiddleware` cache every anonymous GET page. Rarely the right tool, but simple for mostly static sites.

## Other wins

| Technique | Benefit |
|---|---|
| `CONN_MAX_AGE = 60` in `DATABASES` | Reuse database connections instead of reconnecting per request |
| Connection pooling (PostgreSQL, Django 5.1+: `"OPTIONS": {"pool": True}`) | Faster connections under load |
| WhiteNoise with compressed, hashed static files | Long browser caching for CSS/JS |
| A CDN for static and media files | Faster delivery worldwide |
| Background tasks for slow work | Responses don't wait for emails, reports, image processing ([next chapter](/learn/email-tasks-async)) |
| `GZipMiddleware` (or compression at the web server) | Smaller responses |
| Async views for slow external APIs | More concurrent requests under ASGI |

## Summary

| Problem | Fix |
|---|---|
| Hundreds of similar queries | `select_related` / `prefetch_related` |
| Python loops over rows | `aggregate`, `annotate`, `update`, `F()`, `exists()`, `count()` |
| Big rows, few fields used | `values()`, `only()`, `defer()` |
| Slow filters / sorting | Database indexes |
| Expensive repeated results | `cache.get_or_set()`, `@cache_page`, `{% cache %}` |
| Long lists | Pagination |

## Check yourself

<details>
<summary>Which is faster for checking whether any matching rows exist: <code>if qs:</code>, <code>len(qs) > 0</code> or <code>qs.exists()</code>?</summary>

`qs.exists()` (unless you're going to use the results anyway). It asks the database a tiny `SELECT ... LIMIT 1` instead of loading all rows.
</details>

<details>
<summary>Why is LocMemCache a poor choice in production with several server processes?</summary>

Each process has its own memory, so caches aren't shared or consistently invalidated. Use a shared cache like Redis.
</details>

<details>
<summary>What does <code>@cache_page(60)</code> do?</summary>

It caches the view's entire response for 60 seconds, serving repeat requests from the cache without running the view.
</details>
