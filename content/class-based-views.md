Function-based views are explicit and easy to read. But many pages follow the same patterns: *show a list*, *show one object*, *show a form and save it*, *confirm and delete*. **Class-based views (CBVs)** package those patterns into reusable classes, so a full CRUD screen can take a handful of lines.

## The same page, both ways

```python title="Function-based"
def player_list(request):
    players = Player.objects.all()
    return render(request, "cricket/player_list.html", {"player_list": players})
```

```python title="Class-based"
from django.views.generic import ListView


class PlayerListView(ListView):
    model = Player
```

```python title="urls.py"
path("players/", PlayerListView.as_view(), name="player_list"),
```

The CBV figures out the queryset (`Player.objects.all()`), the template name (`cricket/player_list.html`) and the context variable (`player_list`, also `object_list`) by itself.

> [!NOTE]
> In `urls.py` you always call `.as_view()` on a class-based view. It turns the class into a function Django can call.

## The base View class

All CBVs derive from `View`, which dispatches each HTTP method to a method of the same name:

```python
from django.http import HttpResponse
from django.views import View


class HelloView(View):
    def get(self, request):
        return HttpResponse("You sent a GET")

    def post(self, request):
        return HttpResponse("You sent a POST")
```

A method you don't define (e.g. `put`) automatically returns **405 Method Not Allowed**. No more `if request.method == "POST"`.

## TemplateView: a static page

```python
from django.views.generic import TemplateView


class AboutView(TemplateView):
    template_name = "pages/about.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["team_size"] = 12
        return context
```

For a page with no extra context you can skip the class entirely:

```python
path("about/", TemplateView.as_view(template_name="pages/about.html"), name="about"),
```

## The generic CRUD views

| View | Does | Default template | Context name |
|---|---|---|---|
| `ListView` | List objects (with pagination) | `app/model_list.html` | `object_list`, `model_list` |
| `DetailView` | Show one object (by `pk` or `slug` in the URL) | `app/model_detail.html` | `object`, `model` |
| `CreateView` | Form to create an object | `app/model_form.html` | `form` |
| `UpdateView` | Form to edit an object | `app/model_form.html` | `form`, `object` |
| `DeleteView` | Confirm, then delete on POST | `app/model_confirm_delete.html` | `object` |
| `FormView` | Any form not tied to creating a model | (set `template_name`) | `form` |
| `RedirectView` | Redirect to another URL | none | none |

## A complete CRUD with CBVs

```python title="cricket/views.py"
from django.urls import reverse_lazy
from django.views.generic import CreateView, DeleteView, DetailView, ListView, UpdateView

from .models import Player


class PlayerListView(ListView):
    model = Player
    paginate_by = 10
    ordering = ["-runs"]

    def get_queryset(self):
        qs = super().get_queryset().select_related("team")
        q = self.request.GET.get("q")
        return qs.filter(name__icontains=q) if q else qs


class PlayerDetailView(DetailView):
    model = Player


class PlayerCreateView(CreateView):
    model = Player
    fields = ["name", "team", "runs", "innings"]
    success_url = reverse_lazy("player_list")


class PlayerUpdateView(UpdateView):
    model = Player
    fields = ["name", "team", "runs", "innings"]
    success_url = reverse_lazy("player_list")


class PlayerDeleteView(DeleteView):
    model = Player
    success_url = reverse_lazy("player_list")
```

```python title="cricket/urls.py"
from django.urls import path
from . import views

urlpatterns = [
    path("", views.PlayerListView.as_view(), name="player_list"),
    path("<int:pk>/", views.PlayerDetailView.as_view(), name="player_detail"),
    path("new/", views.PlayerCreateView.as_view(), name="player_create"),
    path("<int:pk>/edit/", views.PlayerUpdateView.as_view(), name="player_update"),
    path("<int:pk>/delete/", views.PlayerDeleteView.as_view(), name="player_delete"),
]
```

The templates:

```django title="cricket/templates/cricket/player_list.html"
{% extends "base.html" %}
{% block content %}
<a href="{% url 'player_create' %}">Add player</a>
<ul>
  {% for player in player_list %}
    <li><a href="{% url 'player_detail' player.pk %}">{{ player.name }}</a> ({{ player.runs }})</li>
  {% empty %}
    <li>No players.</li>
  {% endfor %}
</ul>

{% if is_paginated %}
  {% if page_obj.has_previous %}<a href="?page={{ page_obj.previous_page_number }}">Prev</a>{% endif %}
  Page {{ page_obj.number }} of {{ paginator.num_pages }}
  {% if page_obj.has_next %}<a href="?page={{ page_obj.next_page_number }}">Next</a>{% endif %}
{% endif %}
{% endblock %}
```

```django title="cricket/templates/cricket/player_form.html"
{% extends "base.html" %}
{% block content %}
<h2>{% if object %}Edit {{ object.name }}{% else %}New player{% endif %}</h2>
<form method="post">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Save</button>
</form>
{% endblock %}
```

```django title="cricket/templates/cricket/player_confirm_delete.html"
{% extends "base.html" %}
{% block content %}
<form method="post">
  {% csrf_token %}
  <p>Delete <strong>{{ object.name }}</strong>?</p>
  <button type="submit">Yes, delete</button>
  <a href="{% url 'player_list' %}">Cancel</a>
</form>
{% endblock %}
```

> [!TIP] get_absolute_url
> If the model defines `get_absolute_url()`, you can drop `success_url` from `CreateView` and `UpdateView`: they'll redirect to the new or edited object automatically.

## Customising CBVs: attributes and methods

You customise a CBV by setting **attributes** for simple cases and overriding **methods** for dynamic ones.

| Attribute | Purpose |
|---|---|
| `model` | The model to work with |
| `queryset` | A specific queryset instead of `model.objects.all()` |
| `template_name` | Override the default template |
| `context_object_name` | Rename `object` / `object_list` in templates |
| `fields` or `form_class` | Which form to use (Create/Update) |
| `success_url` | Where to go after success |
| `paginate_by` | Page size (ListView) |
| `ordering` | Default ordering (ListView) |
| `slug_field`, `slug_url_kwarg`, `pk_url_kwarg` | How DetailView finds the object |

| Method | Override to... |
|---|---|
| `get_queryset()` | Filter by user, search terms, etc. |
| `get_context_data()` | Add extra variables to the template |
| `get_object()` | Customise how one object is fetched |
| `form_valid(form)` | Do something before or after saving |
| `get_success_url()` | Compute the redirect dynamically |
| `dispatch()` | Run code before any method handler |

Setting the owner of a new object:

```python
class PostCreateView(LoginRequiredMixin, CreateView):
    model = Post
    fields = ["title", "body"]

    def form_valid(self, form):
        form.instance.author = self.request.user
        return super().form_valid(form)
```

Showing only the current user's objects:

```python
class MyPostsView(LoginRequiredMixin, ListView):
    template_name = "blog/my_posts.html"

    def get_queryset(self):
        return Post.objects.filter(author=self.request.user)
```

## Mixins

**Mixins** are small classes that add one behaviour. List them **to the left** of the main view class:

```python
from django.contrib.auth.mixins import LoginRequiredMixin, PermissionRequiredMixin, UserPassesTestMixin
from django.contrib.messages.views import SuccessMessageMixin


class PostUpdateView(LoginRequiredMixin, UserPassesTestMixin, SuccessMessageMixin, UpdateView):
    model = Post
    fields = ["title", "body"]
    success_message = "Post updated!"

    def test_func(self):
        return self.get_object().author == self.request.user   # only the author may edit
```

| Mixin | Effect |
|---|---|
| `LoginRequiredMixin` | Redirect anonymous users to login (CBV version of `@login_required`) |
| `PermissionRequiredMixin` | Require `permission_required = "app.codename"` |
| `UserPassesTestMixin` | Require `test_func()` to return `True` |
| `SuccessMessageMixin` | Flash `success_message` after a successful form |

> [!WARNING] Order matters
> Mixins must come **before** the generic view in the class definition, e.g. `class V(LoginRequiredMixin, UpdateView)`. Python resolves methods left to right, so the access check must run first.

## FormView

For forms that don't create a model object:

```python
from django.views.generic.edit import FormView
from .forms import ContactForm


class ContactView(FormView):
    template_name = "pages/contact.html"
    form_class = ContactForm
    success_url = reverse_lazy("contact_thanks")

    def form_valid(self, form):
        send_message(**form.cleaned_data)
        return super().form_valid(form)
```

## FBV or CBV?

| Choose function-based views when... | Choose class-based views when... |
|---|---|
| You're learning, or the logic is unusual | The page is standard CRUD |
| You want everything visible in one place | You want reuse via mixins and inheritance |
| The view does several unrelated things | Several views share behaviour |

Both are first-class in Django. Many projects mix them. Django REST Framework uses the same idea with `APIView`, generic views and viewsets ([API views](/learn/api-views)).

## Summary

- CBVs are classes; wire them up with `.as_view()`
- `View` maps HTTP methods to `get()`, `post()`...
- Generic views: `ListView`, `DetailView`, `CreateView`, `UpdateView`, `DeleteView`, `FormView`, `TemplateView`
- Customise with attributes (`model`, `fields`, `success_url`) and methods (`get_queryset`, `form_valid`, `get_context_data`)
- Add behaviour with mixins on the left: `LoginRequiredMixin`, `UserPassesTestMixin`...

## Check yourself

<details>
<summary>Which template does <code>DetailView</code> with <code>model = Book</code> in the <code>library</code> app look for?</summary>

`library/book_detail.html`
</details>

<details>
<summary>How do you set <code>author = request.user</code> in a <code>CreateView</code>?</summary>

Override `form_valid()`: set `form.instance.author = self.request.user`, then `return super().form_valid(form)`.
</details>

<details>
<summary>Why must <code>LoginRequiredMixin</code> be listed before <code>ListView</code>?</summary>

Python's method resolution order goes left to right, so the mixin's `dispatch()` must run first to block anonymous users before the view does its work.
</details>
