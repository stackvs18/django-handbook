A **view** is where your application's logic lives. It receives a request, decides what to do, and returns a response. This chapter covers **function-based views**: plain Python functions, the clearest way to learn how views work.

## The simplest possible view

```python title="pages/views.py"
from django.http import HttpResponse


def hello(request):
    return HttpResponse("Hello, Django!")
```

```python title="pages/urls.py"
from django.urls import path
from . import views

urlpatterns = [path("hello/", views.hello, name="hello")]
```

Visit `/hello/` and you'll see the text. Every view, however complex, follows this contract: **take a request, return a response.**

## The request object

Django builds an `HttpRequest` for every incoming request and passes it as the first argument. The attributes you'll use most:

| Attribute | Contains | Example |
|---|---|---|
| `request.method` | `"GET"`, `"POST"`, `"PUT"`... | `if request.method == "POST":` |
| `request.GET` | Query-string parameters (a dict-like `QueryDict`) | `/search/?q=django` → `request.GET.get("q")` |
| `request.POST` | Submitted form data | `request.POST.get("email")` |
| `request.FILES` | Uploaded files | `request.FILES["avatar"]` |
| `request.user` | The logged-in `User`, or `AnonymousUser` | `request.user.is_authenticated` |
| `request.session` | The visitor's session (dict-like) | `request.session["cart"] = [...]` |
| `request.COOKIES` | Cookies sent by the browser | `request.COOKIES.get("theme")` |
| `request.headers` | HTTP headers (case-insensitive) | `request.headers.get("User-Agent")` |
| `request.path` | The path | `"/blog/7/"` |
| `request.body` | The raw request body (bytes) | JSON sent by `fetch()` |
| `request.META` | Server variables | `request.META.get("REMOTE_ADDR")` |

> [!TIP] `.get()` vs `[]`
> `request.GET["q"]` raises `MultiValueDictKeyError` (a 500 error page) if `q` is missing. `request.GET.get("q", "")` returns a default instead. Prefer `.get()`.

A `QueryDict` can hold several values for one key, as with checkboxes: `request.GET.getlist("tags")`.

## Response types

| Response | Use |
|---|---|
| `HttpResponse("text")` | Plain text or HTML you built yourself |
| `render(request, "x.html", context)` | HTML from a template (by far the most common) |
| `redirect("name")` | Send the browser to another URL (302) |
| `JsonResponse({...})` | JSON data |
| `HttpResponseNotFound`, `HttpResponseForbidden`... | Explicit error responses |
| `FileResponse(open(path, "rb"))` | Send a file download |
| `StreamingHttpResponse(...)` | Stream large content piece by piece |

You can also set a status code or headers on any response:

```python
response = HttpResponse("Created", status=201)
response["X-Custom"] = "hello"
return response
```

## Shortcut functions

The `django.shortcuts` module saves a lot of typing.

### render()

```python
from django.shortcuts import render


def post_list(request):
    posts = Post.objects.all()
    return render(request, "blog/post_list.html", {"posts": posts})
```

`render(request, template_name, context=None, status=200)` loads the template, fills it with the **context** dictionary, and returns an `HttpResponse`. The keys of the context become variable names in the template.

### redirect()

```python
from django.shortcuts import redirect

return redirect("post_list")                 # a URL name
return redirect("post_detail", pk=post.pk)   # a URL name with arguments
return redirect(post)                        # a model with get_absolute_url()
return redirect("https://djangoproject.com") # a full URL
```

### get_object_or_404()

```python
from django.shortcuts import get_object_or_404


def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk)
    return render(request, "blog/post_detail.html", {"post": post})
```

Without it you'd need:

```python
from django.http import Http404

try:
    post = Post.objects.get(pk=pk)
except Post.DoesNotExist:
    raise Http404("Post not found")
```

`get_list_or_404(Post, published=True)` is the same idea for lists: 404 if the list is empty.

## Handling GET and POST in one view

The classic pattern for any page with a form:

```python
def contact(request):
    if request.method == "POST":
        name = request.POST.get("name")
        message = request.POST.get("message")
        # ... save it, email it ...
        return redirect("thanks")          # always redirect after a successful POST
    return render(request, "pages/contact.html")
```

> [!IMPORTANT] Post/Redirect/Get
> After successfully handling a POST, **redirect** instead of rendering a page. Otherwise, if the user refreshes, the browser re-submits the form and you get duplicate orders, comments or payments. This pattern is called **PRG (Post/Redirect/Get)**.

## Returning JSON

```python
from django.http import JsonResponse


def player_stats(request, pk):
    player = get_object_or_404(Player, pk=pk)
    return JsonResponse({"name": player.name, "runs": player.runs})
```

To return a list, pass `safe=False`:

```python
def player_names(request):
    names = list(Player.objects.values_list("name", flat=True))
    return JsonResponse(names, safe=False)
```

Fine for a quick endpoint. For real APIs with validation, authentication and browsable docs, use [Django REST Framework](/learn/drf-first-api).

## View decorators

Decorators wrap a view to add behaviour.

```python
from django.contrib.auth.decorators import login_required, permission_required
from django.views.decorators.http import require_GET, require_POST, require_http_methods


@require_GET
def about(request): ...


@require_POST
def delete_post(request, pk): ...


@require_http_methods(["GET", "POST"])
def edit_post(request, pk): ...


@login_required
def dashboard(request): ...


@permission_required("blog.add_post", raise_exception=True)
def new_post(request): ...
```

| Decorator | Effect |
|---|---|
| `@require_GET` / `@require_POST` | Other methods get **405 Method Not Allowed** |
| `@require_http_methods([...])` | Allow only the listed methods |
| `@login_required` | Anonymous users are redirected to `LOGIN_URL` |
| `@permission_required("app.codename")` | Only users with that permission |
| `@csrf_exempt` | Turn off CSRF checking (avoid unless you know why) |
| `@cache_page(60 * 15)` | Cache the response for 15 minutes |

You can stack decorators; they apply from the bottom up.

## A complete example: search with pagination

```python title="blog/views.py"
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import render

from .models import Post


def post_list(request):
    query = request.GET.get("q", "").strip()
    posts = Post.objects.filter(published=True).order_by("-created_at")

    if query:
        posts = posts.filter(Q(title__icontains=query) | Q(body__icontains=query))

    paginator = Paginator(posts, 10)                 # 10 posts per page
    page = paginator.get_page(request.GET.get("page"))

    return render(request, "blog/post_list.html", {"page": page, "query": query})
```

```django title="blog/templates/blog/post_list.html"
<form method="get">
  <input name="q" value="{{ query }}" placeholder="Search posts">
  <button>Search</button>
</form>

{% for post in page %}
  <h2><a href="{% url 'post_detail' post.pk %}">{{ post.title }}</a></h2>
{% empty %}
  <p>No posts found.</p>
{% endfor %}

{% if page.has_previous %}
  <a href="?q={{ query|urlencode }}&page={{ page.previous_page_number }}">Previous</a>
{% endif %}
<span>Page {{ page.number }} of {{ page.paginator.num_pages }}</span>
{% if page.has_next %}
  <a href="?q={{ query|urlencode }}&page={{ page.next_page_number }}">Next</a>
{% endif %}
```

`get_page()` is forgiving: a missing, non-numeric or too-large page number returns a sensible page instead of an error.

## Where should logic go?

A view should **coordinate**, not do everything itself. A healthy split:

- **Data rules** (validation, computed values) → the model or a form
- **Reusable business logic** (e.g. "place an order") → a function in `services.py` or a model method
- **The view** → read the request, call those, choose the response

Small, readable views are easier to test and change.

## Async views

Django also supports `async def` views, useful when a view waits on slow external services:

```python
import httpx
from django.http import JsonResponse


async def weather(request):
    async with httpx.AsyncClient() as client:
        r = await client.get("https://api.example.com/weather")
    return JsonResponse(r.json())
```

They give real benefits only under an ASGI server. See [Email, Tasks & Async](/learn/email-tasks-async).

## Summary

- A view takes an `HttpRequest` and returns an `HttpResponse`
- Read input from `request.GET`, `request.POST`, `request.FILES`, `request.user`
- Use `render`, `redirect` and `get_object_or_404` from `django.shortcuts`
- Branch on `request.method` to handle forms
- Redirect after a successful POST (PRG)
- Decorators add rules: allowed methods, login, permissions, caching

## Check yourself

<details>
<summary>What is the difference between <code>request.GET</code> and <code>request.POST</code>?</summary>

`request.GET` holds parameters from the URL's query string. `request.POST` holds form data sent in the body of a POST request. (The names describe where the data comes from, not the request method you're in. A POST request can still have a query string.)
</details>

<details>
<summary>Why should you redirect after successfully processing a POST?</summary>

To prevent duplicate submissions when the user refreshes the page. This is the Post/Redirect/Get pattern.
</details>

<details>
<summary>What does <code>get_object_or_404</code> do if no object matches?</summary>

It raises `Http404`, and Django returns a 404 Not Found response instead of crashing with `DoesNotExist`.
</details>
