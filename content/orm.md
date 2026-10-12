The **ORM (Object-Relational Mapper)** lets you work with your database using Python instead of SQL. You call methods on your models; Django writes the SQL, runs it, and hands you back Python objects.

```python
# Python
Player.objects.filter(runs__gte=5000).order_by("-runs")[:5]
```

```sql
-- the SQL Django generates
SELECT * FROM cricket_player WHERE runs >= 5000 ORDER BY runs DESC LIMIT 5;
```

We'll use these models throughout:

```python title="cricket/models.py"
from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=50)

    def __str__(self):
        return self.name


class Player(models.Model):
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="players")
    runs = models.PositiveIntegerField(default=0)
    innings = models.PositiveIntegerField(default=0)
    debut = models.DateField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
```

## Practise in the shell

The quickest way to learn the ORM is to experiment:

```bash
python manage.py shell
```

```python
>>> from cricket.models import Team, Player   # auto-imported in Django 5.2+
>>> Player.objects.count()
0
```

## Managers and QuerySets

- `Player.objects` is the **manager**: your entry point.
- Most methods return a **QuerySet**: a lazy, chainable description of a query.

```python
qs = Player.objects.filter(is_active=True)   # no database query yet!
qs = qs.exclude(runs=0)                      # still no query
qs = qs.order_by("-runs")                    # still no query
for p in qs:                                 # NOW the query runs, once
    print(p.name)
```

A QuerySet only hits the database when it's **evaluated**: when you iterate, slice with a step, call `len()`, `list()`, `bool()`, print it, or use methods like `.count()`, `.exists()`, `.first()`. This laziness lets you build queries step by step at no cost.

## Create

```python
# 1. create() builds and saves in one step
india = Team.objects.create(name="India", country="India")

# 2. Instantiate, then save()
p = Player(name="Virat Kohli", team=india, runs=8848, innings=191)
p.save()

# 3. Many rows in one query
Player.objects.bulk_create([
    Player(name="Rohit Sharma", team=india, runs=4301, innings=116),
    Player(name="Shubman Gill", team=india, runs=1893, innings=59),
])

# 4. Get it if it exists, otherwise create it
team, created = Team.objects.get_or_create(name="Australia", defaults={"country": "Australia"})

# 5. Update it if it exists, otherwise create it
player, created = Player.objects.update_or_create(
    name="Steve Smith", defaults={"team": team, "runs": 9685}
)
```

## Read

### Everything, one, first, last

```python
Player.objects.all()                  # every player
Player.objects.get(pk=1)              # exactly one (see warning below)
Player.objects.first()                # first by default ordering, or None
Player.objects.last()
Player.objects.order_by("-runs").first()
Player.objects.latest("debut")        # by a date field
```

> [!WARNING] get() is strict
> `get()` must find **exactly one** row. Zero rows raises `Player.DoesNotExist`; two or more raise `Player.MultipleObjectsReturned`. In views, use `get_object_or_404()`. Elsewhere, wrap it in `try/except` or use `.filter(...).first()` which returns `None` instead.

### filter() and exclude()

```python
Player.objects.filter(is_active=True)
Player.objects.filter(team=india, runs__gt=4000)       # AND
Player.objects.exclude(team__name="India")             # NOT
Player.objects.filter(is_active=True).exclude(runs=0)  # chain them
```

### Field lookups

Lookups use a **double underscore**: `field__lookup=value`.

| Lookup | Example | SQL idea |
|---|---|---|
| `exact` (default) | `name="Virat"` | `= 'Virat'` |
| `iexact` | `name__iexact="virat kohli"` | case-insensitive equals |
| `contains` / `icontains` | `name__icontains="kohli"` | `LIKE '%kohli%'` |
| `startswith` / `endswith` | `name__startswith="V"` | `LIKE 'V%'` |
| `gt`, `gte`, `lt`, `lte` | `runs__gte=5000` | `>=` |
| `in` | `pk__in=[1, 2, 3]` | `IN (1, 2, 3)` |
| `range` | `runs__range=(1000, 5000)` | `BETWEEN` |
| `isnull` | `debut__isnull=True` | `IS NULL` |
| `year`, `month`, `day`, `week_day` | `debut__year=2008` | date parts |
| `date` | `created_at__date=date.today()` | date of a datetime |
| `regex` / `iregex` | `name__regex=r"^[A-M]"` | regular expression |

Follow relationships with more double underscores:

```python
Player.objects.filter(team__country="India")
Team.objects.filter(players__runs__gt=8000).distinct()
```

### Ordering, slicing, distinct

```python
Player.objects.order_by("name")            # A → Z
Player.objects.order_by("-runs", "name")   # most runs first, ties by name
Player.objects.order_by("?")               # random (slow on big tables)

Player.objects.all()[:10]                  # LIMIT 10
Player.objects.all()[10:20]                # OFFSET 10 LIMIT 10 (page 2)

Player.objects.values("team").distinct()
```

Negative indexing (`qs[-1]`) isn't supported. Use `.last()` or reverse the order.

### values() and values_list()

Fetch plain dictionaries or tuples instead of model objects: lighter, faster for read-only data.

```python
Player.objects.values("name", "runs")
# <QuerySet [{'name': 'Virat Kohli', 'runs': 8848}, ...]>

Player.objects.values_list("name", "runs")
# <QuerySet [('Virat Kohli', 8848), ...]>

Player.objects.values_list("name", flat=True)
# <QuerySet ['Virat Kohli', 'Rohit Sharma', ...]>
```

### Checking and counting

```python
Player.objects.filter(team=india).count()     # SELECT COUNT(*)
Player.objects.filter(name="Dhoni").exists()  # fastest way to ask "any?"
```

## Update

```python
# One object
p = Player.objects.get(pk=1)
p.runs += 100
p.save()                                   # saves every field
p.save(update_fields=["runs"])             # saves only this column

# Many rows in ONE query, without loading them
Player.objects.filter(team=india).update(is_active=True)
```

> [!NOTE]
> `QuerySet.update()` runs a single SQL `UPDATE`. It's fast, but it does **not** call each object's `save()` method or send `pre_save`/`post_save` signals, and `auto_now` fields aren't touched.

## Delete

```python
Player.objects.get(pk=5).delete()                   # one
Player.objects.filter(is_active=False).delete()     # many
# Player.objects.all().delete()                     # everything (careful!)
```

`delete()` returns a count of what was removed, including cascaded rows: `(3, {'cricket.Player': 3})`.

## Q objects: OR and NOT

Keyword arguments to `filter()` are always ANDed. For OR, use `Q`:

```python
from django.db.models import Q

# name contains "sharma" OR runs > 8000
Player.objects.filter(Q(name__icontains="sharma") | Q(runs__gt=8000))

# AND (&), OR (|), NOT (~)
Player.objects.filter(Q(team__name="India") & ~Q(is_active=False))

# Mix Q with normal keyword arguments: Q objects must come first
Player.objects.filter(Q(runs__gt=5000) | Q(innings__gt=150), team=india)
```

Building a search across several fields:

```python
def search_players(term):
    return Player.objects.filter(
        Q(name__icontains=term) | Q(team__name__icontains=term)
    ).distinct()
```

## F expressions: refer to other fields

`F()` lets the **database** use a field's current value, avoiding race conditions and extra queries:

```python
from django.db.models import F

# Add 50 runs to everyone in a single UPDATE (safe even if two requests run at once)
Player.objects.filter(team=india).update(runs=F("runs") + 50)

# Compare two fields of the same row
Player.objects.filter(runs__gt=F("innings") * 50)
```

## Aggregation: one number from many rows

```python
from django.db.models import Avg, Count, Max, Min, Sum

Player.objects.aggregate(Sum("runs"))
# {'runs__sum': 24727}

Player.objects.aggregate(total=Sum("runs"), best=Max("runs"), avg=Avg("runs"))
# {'total': 24727, 'best': 9685, 'avg': 6181.75}
```

## Annotation: a value per row

`annotate()` adds a computed value to **each** object:

```python
teams = Team.objects.annotate(
    player_count=Count("players"),
    total_runs=Sum("players__runs"),
).order_by("-total_runs")

for t in teams:
    print(t.name, t.player_count, t.total_runs)

# Filter on an annotation
Team.objects.annotate(n=Count("players")).filter(n__gte=11)
```

### Group by

`values()` followed by `annotate()` groups rows, like SQL `GROUP BY`:

```python
Player.objects.values("team__name").annotate(total=Sum("runs")).order_by("-total")
# [{'team__name': 'India', 'total': 15042}, {'team__name': 'Australia', 'total': 9685}]
```

## select_related and prefetch_related

The most important performance tool in the ORM. Consider:

```python
players = Player.objects.all()
for p in players:
    print(p.name, p.team.name)   # p.team triggers a query EVERY time
```

With 100 players that's **101 queries**: 1 for players, 100 for teams. This is the **N+1 problem**.

```python
# ForeignKey / OneToOne -> select_related (SQL JOIN, 1 query total)
players = Player.objects.select_related("team")

# Reverse FK / ManyToMany -> prefetch_related (2 queries total)
teams = Team.objects.prefetch_related("players")
for t in teams:
    print(t.name, [p.name for p in t.players.all()])   # no extra queries
```

| | `select_related` | `prefetch_related` |
|---|---|---|
| Works on | `ForeignKey`, `OneToOneField` (forward) | Many-to-many, reverse foreign keys (and FKs too) |
| How | One SQL query with a JOIN | One extra query per relation, joined in Python |
| Example | `Post.objects.select_related("author")` | `Post.objects.prefetch_related("tags", "comments")` |

Use `Prefetch` to filter or order the prefetched items:

```python
from django.db.models import Prefetch

Team.objects.prefetch_related(
    Prefetch("players", queryset=Player.objects.filter(is_active=True).order_by("-runs"))
)
```

## Loading fewer columns

```python
Player.objects.only("name", "runs")    # load just these (others load lazily if touched)
Player.objects.defer("bio")            # load everything except this
```

## Transactions

Group several changes so that either **all** succeed or **none** do:

```python
from django.db import transaction

with transaction.atomic():
    sender.balance = F("balance") - 500
    sender.save()
    receiver.balance = F("balance") + 500
    receiver.save()
# If any line raises an exception, everything inside is rolled back.
```

`@transaction.atomic` also works as a decorator on a view or function. Setting `ATOMIC_REQUESTS = True` in a database's settings wraps every request in a transaction.

## Raw SQL (when you really need it)

```python
# Map raw SQL results onto model objects
Player.objects.raw("SELECT * FROM cricket_player WHERE runs > %s", [5000])

# Or skip models entirely
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT name, runs FROM cricket_player WHERE team_id = %s", [1])
    rows = cursor.fetchall()
```

> [!CAUTION] SQL injection
> Always pass values as **parameters** (`%s` plus a list). Never build SQL with f-strings or `+`: `f"... WHERE name = '{name}'"` lets an attacker inject their own SQL. The ORM parameterises everything for you, which is one of the best reasons to use it.

## Seeing the SQL

```python
qs = Player.objects.filter(runs__gt=5000)
print(qs.query)          # the SQL Django will run
qs.explain()             # the database's query plan
```

With `DEBUG = True`, `from django.db import connection; connection.queries` lists every query made. The **Django Debug Toolbar** package shows this in your browser.

## Async ORM

Most QuerySet methods have async versions prefixed with `a`, for use inside `async def` views:

```python
player = await Player.objects.aget(pk=1)
count = await Player.objects.filter(is_active=True).acount()
async for p in Player.objects.filter(team=india):
    ...
```

## Cheat sheet

| Goal | Code |
|---|---|
| All rows | `Model.objects.all()` |
| Filter / exclude | `.filter(a=1)` / `.exclude(a=1)` |
| Exactly one | `.get(pk=1)` |
| First or None | `.filter(...).first()` |
| Sort | `.order_by("-field")` |
| Limit | `[:10]` |
| Count / exists | `.count()` / `.exists()` |
| OR / NOT | `Q(a=1) \| Q(b=2)` / `~Q(a=1)` |
| Compare fields | `F("field")` |
| Totals | `.aggregate(Sum("f"))` |
| Per-row totals | `.annotate(n=Count("rel"))` |
| Avoid N+1 | `select_related()` / `prefetch_related()` |
| Bulk update | `.update(field=value)` |
| Bulk delete | `.filter(...).delete()` |
| All-or-nothing | `with transaction.atomic():` |

## Check yourself

<details>
<summary>When does <code>Player.objects.filter(is_active=True)</code> actually query the database?</summary>

Only when the QuerySet is evaluated: iterated, sliced with a step, converted to a list, counted, printed, etc. Creating and chaining it costs nothing.
</details>

<details>
<summary>How do you find players named "Rohit" OR with more than 8000 runs?</summary>

`Player.objects.filter(Q(name="Rohit") | Q(runs__gt=8000))`
</details>

<details>
<summary>What's the difference between <code>aggregate()</code> and <code>annotate()</code>?</summary>

`aggregate()` returns one dictionary summarising the whole QuerySet. `annotate()` adds a computed value to each object in the QuerySet.
</details>

<details>
<summary>A page lists 50 posts with their author names and runs 51 queries. What's the fix?</summary>

`Post.objects.select_related("author")`, which fetches authors with a JOIN in a single query.
</details>
