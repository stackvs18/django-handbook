In this project you'll build **Private Notes**: people sign up, log in, and manage notes that **only they** can see. It's the pattern behind almost every real app (to-do lists, expense trackers, journals, dashboards) and it combines authentication with ownership-aware CRUD.

What you'll practise: a sign-up view with `UserCreationForm`, Django's built-in `LoginView` and `LogoutView`, `@login_required`, `ForeignKey` to the user, and filtering every query by `request.user` so nobody can read or edit someone else's data.

## The plan

| URL | Who | Page |
|---|---|---|
| `/accounts/signup/` | Anyone | Create an account |
| `/accounts/login/` | Anyone | Log in |
| `/accounts/logout/` | Logged in (POST) | Log out |
| `/` | Logged in | My notes, with search |
| `/notes/new/` | Logged in | Write a note |
| `/notes/<id>/edit/` | The note's owner | Edit |
| `/notes/<id>/delete/` | The note's owner | Delete |

## 1. Project and apps

```bash
mkdir private-notes && cd private-notes
python -m venv venv
venv\Scripts\activate
pip install django
django-admin startproject config .
python manage.py startapp accounts
python manage.py startapp notes
```

```python title="config/settings.py"
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "accounts",
    "notes",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "notes:list"
LOGOUT_REDIRECT_URL = "login"
```

## 2. The Note model

Each note belongs to one user through a `ForeignKey`:

```python title="notes/models.py"
from django.conf import settings
from django.db import models


class Note(models.Model):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True)
    pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pinned", "-updated_at"]

    def __str__(self):
        return self.title
```

```python title="notes/admin.py"
from django.contrib import admin
from .models import Note


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "pinned", "updated_at")
    list_filter = ("pinned",)
    search_fields = ("title", "body", "owner__username")
```

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## 3. Accounts: sign up, log in, log out

### The sign-up form

```python title="accounts/forms.py"
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User


class SignUpForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ["username", "email"]

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("That email is already registered.")
        return email
```

### The sign-up view

Login and logout use Django's built-in views, so sign-up is the only view we write:

```python title="accounts/views.py"
from django.contrib import messages
from django.contrib.auth import login
from django.shortcuts import redirect, render

from .forms import SignUpForm


def signup(request):
    if request.user.is_authenticated:
        return redirect("notes:list")

    form = SignUpForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        user = form.save()
        login(request, user)
        messages.success(request, f"Welcome, {user.username}! Your account is ready.")
        return redirect("notes:list")
    return render(request, "accounts/signup.html", {"form": form})
```

### Account URLs

```python title="accounts/urls.py"
from django.contrib.auth import views as auth_views
from django.urls import path

from . import views

urlpatterns = [
    path("signup/", views.signup, name="signup"),
    path(
        "login/",
        auth_views.LoginView.as_view(
            template_name="accounts/login.html",
            redirect_authenticated_user=True,
        ),
        name="login",
    ),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
]
```

These URL names (`signup`, `login`, `logout`) aren't namespaced, which keeps them matching the `LOGIN_URL = "login"` setting.

## 4. Notes: CRUD that respects ownership

### The form

```python title="notes/forms.py"
from django import forms
from .models import Note


class NoteForm(forms.ModelForm):
    class Meta:
        model = Note
        fields = ["title", "body", "pinned"]          # NOT owner: we set that ourselves
        widgets = {"body": forms.Textarea(attrs={"rows": 8})}
```

> [!IMPORTANT] Never let the client choose the owner
> `owner` is deliberately missing from `fields`. If it were there, a user could submit someone else's id. The owner always comes from `request.user`.

### The views

```python title="notes/views.py"
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render

from .forms import NoteForm
from .models import Note


@login_required
def note_list(request):
    notes = request.user.notes.all()                     # only MY notes
    query = request.GET.get("q", "").strip()
    if query:
        notes = notes.filter(Q(title__icontains=query) | Q(body__icontains=query))
    return render(request, "notes/note_list.html", {"notes": notes, "query": query})


@login_required
def note_create(request):
    form = NoteForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        note = form.save(commit=False)
        note.owner = request.user                         # attach the owner
        note.save()
        messages.success(request, "Note created.")
        return redirect("notes:list")
    return render(request, "notes/note_form.html", {"form": form})


@login_required
def note_update(request, pk):
    note = get_object_or_404(Note, pk=pk, owner=request.user)   # someone else's? 404
    form = NoteForm(request.POST or None, instance=note)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Note updated.")
        return redirect("notes:list")
    return render(request, "notes/note_form.html", {"form": form, "note": note})


@login_required
def note_delete(request, pk):
    note = get_object_or_404(Note, pk=pk, owner=request.user)
    if request.method == "POST":
        note.delete()
        messages.success(request, "Note deleted.")
        return redirect("notes:list")
    return render(request, "notes/note_confirm_delete.html", {"note": note})
```

The three lines that make data private:

| Line | Protects |
|---|---|
| `request.user.notes.all()` | The list only contains your notes |
| `note.owner = request.user` | New notes always belong to you |
| `get_object_or_404(Note, pk=pk, owner=request.user)` | Guessing another note's id returns **404** |

Returning 404 rather than 403 for other people's notes is intentional: it doesn't even confirm the note exists.

### Notes URLs

```python title="notes/urls.py"
from django.urls import path
from . import views

app_name = "notes"

urlpatterns = [
    path("", views.note_list, name="list"),
    path("notes/new/", views.note_create, name="create"),
    path("notes/<int:pk>/edit/", views.note_update, name="update"),
    path("notes/<int:pk>/delete/", views.note_delete, name="delete"),
]
```

```python title="config/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
    path("", include("notes.urls")),
]
```

## 5. Templates

```django title="templates/base.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}Private Notes{% endblock %}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
    header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    header form { display: inline; }
    .messages li { background: #111; color: #fff; padding: .6rem 1rem; list-style: none; margin: .5rem 0; }
    .note { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin: .75rem 0; }
    .errorlist { color: #b00; }
  </style>
</head>
<body>
  <header>
    <strong><a href="{% url 'notes:list' %}">Private Notes</a></strong>
    <nav>
      {% if user.is_authenticated %}
        {{ user.username }} ·
        <a href="{% url 'notes:create' %}">New note</a> ·
        <form method="post" action="{% url 'logout' %}">
          {% csrf_token %}
          <button type="submit">Log out</button>
        </form>
      {% else %}
        <a href="{% url 'login' %}">Log in</a> · <a href="{% url 'signup' %}">Sign up</a>
      {% endif %}
    </nav>
  </header>

  {% if messages %}
    <ul class="messages">{% for m in messages %}<li>{{ m }}</li>{% endfor %}</ul>
  {% endif %}

  {% block content %}{% endblock %}
</body>
</html>
```

```django title="accounts/templates/accounts/signup.html"
{% extends "base.html" %}
{% block content %}
<h1>Create an account</h1>
<form method="post">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Sign up</button>
</form>
<p>Already have an account? <a href="{% url 'login' %}">Log in</a></p>
{% endblock %}
```

```django title="accounts/templates/accounts/login.html"
{% extends "base.html" %}
{% block content %}
<h1>Log in</h1>
<form method="post">
  {% csrf_token %}
  {{ form.as_p }}
  <input type="hidden" name="next" value="{{ next }}">
  <button type="submit">Log in</button>
</form>
<p>New here? <a href="{% url 'signup' %}">Create an account</a></p>
{% endblock %}
```

`LoginView` puts the `next` value in the context; the hidden input carries it through the POST so users land back on the page they originally wanted.

```django title="notes/templates/notes/note_list.html"
{% extends "base.html" %}
{% block content %}
<h1>My notes</h1>

<form method="get">
  <input type="search" name="q" value="{{ query }}" placeholder="Search my notes">
  <button>Search</button>
</form>

{% for note in notes %}
  <article class="note">
    <h3>{% if note.pinned %}📌 {% endif %}{{ note.title }}</h3>
    <p>{{ note.body|linebreaksbr|truncatewords_html:40 }}</p>
    <small>Updated {{ note.updated_at|timesince }} ago ·
      <a href="{% url 'notes:update' note.pk %}">Edit</a> ·
      <a href="{% url 'notes:delete' note.pk %}">Delete</a>
    </small>
  </article>
{% empty %}
  <p>No notes yet. <a href="{% url 'notes:create' %}">Write your first one.</a></p>
{% endfor %}
{% endblock %}
```

```django title="notes/templates/notes/note_form.html"
{% extends "base.html" %}
{% block content %}
<h1>{% if note %}Edit note{% else %}New note{% endif %}</h1>
<form method="post">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Save</button>
  <a href="{% url 'notes:list' %}">Cancel</a>
</form>
{% endblock %}
```

```django title="notes/templates/notes/note_confirm_delete.html"
{% extends "base.html" %}
{% block content %}
<h1>Delete “{{ note.title }}”?</h1>
<form method="post">
  {% csrf_token %}
  <button type="submit">Delete</button>
  <a href="{% url 'notes:list' %}">Cancel</a>
</form>
{% endblock %}
```

## 6. Test the security yourself

```bash
python manage.py runserver
```

1. Visit `/` while logged out. You're sent to `/accounts/login/?next=/`.
2. Sign up as **alice**, create two notes. Note their ids in the edit URLs (e.g. `/notes/1/edit/`).
3. Log out, sign up as **bob**. Bob's list is empty.
4. As bob, visit `/notes/1/edit/` directly. You get **404**, not alice's note.
5. Log in as admin at `/admin/` and you can see everyone's notes there, because superusers can.

## What happens at login

```flow
POST /accounts/login/ | LoginView validates the form with AuthenticationForm
authenticate() | Checks the username and password hash; returns the User
login() | Stores the user's id in the session and rotates the session key
Set-Cookie | The browser receives a sessionid cookie
Every next request | AuthenticationMiddleware reads the session and sets request.user
@login_required | Lets the request through because request.user.is_authenticated is True
```

## Challenges

1. Add a **password change** page using `PasswordChangeView` (see [Authentication](/learn/authentication#all-of-them-at-once)).
2. Rewrite the notes views as class-based views with `LoginRequiredMixin` and a `get_queryset()` that filters by owner.
3. Add **sharing**: a `ManyToManyField` called `shared_with` so owners can let specific users read a note.
4. Add tags with a `ManyToManyField` and filter notes by tag.
5. Turn it into an API with DRF and JWT. You'll do exactly that in [Project: A JWT-Secured API](/learn/api-project).

## Check yourself

<details>
<summary>Why is <code>owner</code> excluded from <code>NoteForm.Meta.fields</code>?</summary>

So users can't choose or forge the owner by submitting another user's id. The view sets it from `request.user`.
</details>

<details>
<summary>What does <code>get_object_or_404(Note, pk=pk, owner=request.user)</code> do when bob requests alice's note?</summary>

No note matches both the pk and owner=bob, so it raises Http404 and bob sees a 404 page.
</details>

<details>
<summary>Why is logout a POST form in the base template?</summary>

Django's `LogoutView` only accepts POST (since Django 5.0), and POST with a CSRF token stops other sites from logging users out.
</details>
