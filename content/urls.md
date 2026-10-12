When a request arrives, Django needs to decide which view should handle it. That's the job of the **URL dispatcher**, configured in `urls.py` files. Clean, readable URLs are a feature in themselves: `/blog/2025/django-tips/` is far nicer than `/index.php?id=4821`.

## How Django finds a view

1. Django reads `ROOT_URLCONF` from settings (e.g. `"mysite.urls"`) and loads its `urlpatterns` list.
2. It strips the domain and query string, leaving the path (e.g. `blog/7/`).
3. It walks through `urlpatterns` **in order** and stops at the **first** match.
4. It calls the matched view with the `request` and any captured values.
5. If nothing matches, it returns a **404**.

> [!NOTE]
> Patterns are written **without a leading slash**: `"blog/"`, not `"/blog/"`. The query string (`?page=2`) is never part of the match; read it from `request.GET`.

## path()

```python title="blog/urls.py"
from django.urls import path
from . import views

urlpatterns = [
    path("", views.post_list, name="post_list"),
    path("about/", views.about, name="about"),
    path("post/<int:pk>/", views.post_detail, name="post_detail"),
]
```

`path(route, view, kwargs=None, name=None)`

| Argument | Meaning |
|---|---|
| `route` | The URL pattern, possibly with converters like `<int:pk>` |
| `view` | A view function, or `SomeView.as_view()` for class-based views, or `include(...)` |
| `kwargs` | Optional extra keyword arguments passed to the view |
| `name` | A unique name used to build URLs with `reverse()` and `{% url %}` |

## Capturing values with path converters

Angle brackets capture part of the URL and pass it to the view as a **keyword argument**:

```python
path("post/<int:pk>/", views.post_detail)          # /post/7/   -> pk=7
path("tag/<slug:tag>/", views.posts_by_tag)        # /tag/django-tips/ -> tag="django-tips"
path("archive/<int:year>/<int:month>/", views.archive)
```

```python title="views.py"
def post_detail(request, pk):
    ...

def archive(request, year, month):
    ...
```

The built-in converters:

| Converter | Matches | Python type | Example |
|---|---|---|---|
| `str` | Any non-empty text without `/` (the default) | `str` | `<name>` or `<str:name>` |
| `int` | Zero or a positive whole number | `int` | `<int:pk>` → `42` |
| `slug` | Letters, numbers, hyphens, underscores | `str` | `<slug:slug>` → `my-first-post` |
| `uuid` | A formatted UUID | `uuid.UUID` | `<uuid:id>` |
| `path` | Any text **including** `/` | `str` | `<path:file_path>` → `docs/a/b.txt` |

Because `int` converts the value, `/post/abc/` simply doesn't match. Your view never receives bad input.

## re_path() for regular expressions

For patterns converters can't express, use a regular expression with named groups:

```python
from django.urls import re_path

urlpatterns = [
    re_path(r"^archive/(?P<year>[0-9]{4})/$", views.year_archive),
]
```

Values captured by `re_path` are always strings. Prefer `path()` whenever you can; it's more readable.

## include(): splitting URLs across apps

The project's `urls.py` should stay short and delegate to each app:

```python title="mysite/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("blog/", include("blog.urls")),
    path("shop/", include("shop.urls")),
    path("", include("pages.urls")),
]
```

`include()` chops off the part that matched (`blog/`) and passes the rest to `blog/urls.py`. So with `path("post/<int:pk>/", ...)` inside the blog app, the full URL becomes `/blog/post/7/`.

> [!TIP]
> Put a catch-all like `path("", include("pages.urls"))` **last**. Patterns are tried in order, so an empty prefix placed first would hand everything to `pages`.

## Naming URLs and reversing them

Never hard-code URLs. Give each pattern a `name`, then build URLs from the name. If you later change `post/<int:pk>/` to `articles/<int:pk>/`, every link updates automatically.

**In templates**, use the `{% url %}` tag:

```django
<a href="{% url 'about' %}">About</a>
<a href="{% url 'post_detail' pk=post.pk %}">{{ post.title }}</a>
<a href="{% url 'post_detail' post.pk %}">Same thing, positional</a>
```

**In Python**, use `reverse()`, or pass the name straight to `redirect()`:

```python
from django.shortcuts import redirect
from django.urls import reverse

url = reverse("post_detail", kwargs={"pk": 7})   # "/blog/post/7/"
return redirect("post_detail", pk=7)               # redirect() reverses for you
```

`reverse_lazy()` does the same but waits until the value is actually needed. Use it in class attributes and settings, where the URLconf might not be loaded yet:

```python
from django.urls import reverse_lazy

class PostCreateView(CreateView):
    success_url = reverse_lazy("post_list")
```

## Namespaces: avoiding name clashes

Two apps might both have a URL named `index` or `detail`. Give each app a **namespace** with `app_name`:

```python title="blog/urls.py"
app_name = "blog"

urlpatterns = [
    path("", views.post_list, name="list"),
    path("<int:pk>/", views.post_detail, name="detail"),
]
```

Then refer to URLs as `namespace:name`:

```django
<a href="{% url 'blog:detail' pk=post.pk %}">Read</a>
```

```python
return redirect("blog:list")
```

> [!WARNING]
> Once you set `app_name`, plain `{% url 'list' %}` no longer works for that app. You must use `blog:list`. This is a common cause of `NoReverseMatch`.

## Passing extra options to a view

```python
path("featured/", views.post_list, {"featured": True}, name="featured")
```

```python
def post_list(request, featured=False):
    ...
```

## Custom path converters

You can register your own converter. Here's one for 4-digit years:

```python title="blog/converters.py"
class FourDigitYearConverter:
    regex = "[0-9]{4}"

    def to_python(self, value):
        return int(value)

    def to_url(self, value):
        return f"{value:04d}"
```

```python title="blog/urls.py"
from django.urls import path, register_converter
from . import converters, views

register_converter(converters.FourDigitYearConverter, "yyyy")

urlpatterns = [
    path("archive/<yyyy:year>/", views.year_archive),
]
```

## Custom error pages

When `DEBUG = False`, Django shows plain error pages. Provide your own by creating templates named `404.html`, `500.html`, `403.html` or `400.html` in a templates directory. Django uses them automatically.

For full control you can also point to your own views in the **root** `urls.py`:

```python
handler404 = "pages.views.not_found"
handler500 = "pages.views.server_error"
```

## Trailing slashes

By default `APPEND_SLASH = True` (with `CommonMiddleware`): if `/about` doesn't match but `/about/` does, Django redirects to the version with a slash. The convention is to end every pattern with `/`.

## Debugging URLs

- `NoReverseMatch`: a `{% url %}` or `reverse()` used a name (or arguments) that doesn't exist. Check spelling, namespace and required arguments.
- `Page not found (404)` with `DEBUG = True` lists every pattern Django tried, in order. Read it carefully: it usually shows the mistake.

## Summary

| Tool | Use |
|---|---|
| `path()` | Map a URL pattern to a view |
| `<int:pk>`, `<slug:slug>`... | Capture and convert URL parts |
| `re_path()` | Regex patterns when converters aren't enough |
| `include()` | Delegate a prefix to an app's `urls.py` |
| `name=` | Name a URL so you can reverse it |
| `{% url 'name' %}` | Build a URL in a template |
| `reverse()` / `reverse_lazy()` | Build a URL in Python |
| `app_name` | Namespace an app's URL names |

## Check yourself

<details>
<summary>For <code>path("post/&lt;int:pk&gt;/", views.detail)</code> included under <code>"blog/"</code>, which URL calls the view with pk=5?</summary>

`/blog/post/5/`
</details>

<details>
<summary>Why use <code>{% url 'post_detail' pk=post.pk %}</code> instead of writing <code>/post/{{ post.pk }}/</code>?</summary>

Named URLs are reversed from your URLconf, so if the URL pattern changes, every link updates automatically. Hard-coded paths break silently.
</details>

<details>
<summary>When should you use <code>reverse_lazy</code> instead of <code>reverse</code>?</summary>

When the URL is needed at import time, such as class attributes like `success_url` on class-based views, because the URLconf may not be loaded yet.
</details>
