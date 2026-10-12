In this chapter you will build a real, working Django application from an empty folder: a small **cricket player manager** where you can list players, search them, add new ones, edit them and delete them.

Don't worry about understanding every line yet. The goal here is to *see the whole picture once*. Every step links to a later chapter that explains it in depth.

## The 14 steps at a glance

Almost every Django project, big or small, is started in this order. Learn the order and you will never be lost.

| # | Step | Where |
|---|---|---|
| 1 | Install Django | Terminal |
| 2 | Create the project | `django-admin startproject` |
| 3 | Create an app | `python manage.py startapp` |
| 4 | Register the app | `settings.py` → `INSTALLED_APPS` |
| 5 | Define your model | `models.py` |
| 6 | Make migrations | `python manage.py makemigrations` |
| 7 | Apply migrations | `python manage.py migrate` |
| 8 | Register the model in admin | `admin.py` |
| 9 | Create a superuser | `python manage.py createsuperuser` |
| 10 | Create templates | `templates/` folder + HTML files |
| 11 | Write views | `views.py` |
| 12 | Create the app's URLs | `app/urls.py` (new file) |
| 13 | Include app URLs in the project | `project/urls.py` → `include()` |
| 14 | Run the server | `python manage.py runserver` |

> [!REMEMBER] Four phases
> **Setup** (steps 1–4) → **Data** (steps 5–9) → **Pages** (steps 10–13) → **Run** (step 14). Build the data first, then the pages that show it.

Here is what the finished project folder will look like:

```text
playerproject/                 <- outer folder (any name)
├── manage.py                  <- the command-line tool for this project
├── db.sqlite3                 <- the database (created by migrate)
├── playerproject/             <- project package: settings and root URLs
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   ├── asgi.py
│   └── wsgi.py
└── playerapp/                 <- our app: the actual feature
    ├── migrations/
    ├── templates/
    │   └── playerapp/
    │       ├── base.html
    │       ├── home.html
    │       ├── player_form.html
    │       └── welcome.html
    ├── admin.py
    ├── apps.py
    ├── models.py
    ├── urls.py                <- we create this one
    └── views.py
```

## Step 1 — Install Django

Make a folder for your work, create a **virtual environment** inside it (a private box for this project's packages), activate it, and install Django. [Chapter 3](/learn/setup) explains all of this in detail.

```bash title="Windows (PowerShell)"
mkdir django-work
cd django-work
python -m venv venv
venv\Scripts\activate
pip install django
```

```bash title="macOS / Linux"
mkdir django-work
cd django-work
python3 -m venv venv
source venv/bin/activate
pip install django
```

Check that it worked:

```bash
python -m django --version
```

You should see a version number such as `5.2.7` or `6.0`. If you see `No module named django`, your virtual environment is probably not activated. Look for `(venv)` at the start of your terminal prompt.

## Step 2 — Create the project

A **project** is the whole website: its settings, its root URL list and all its apps.

```bash
django-admin startproject playerproject
cd playerproject
```

`python -m django startproject playerproject` does exactly the same thing if `django-admin` is not found.

> [!TIP]
> You can also run `django-admin startproject playerproject .` (note the dot). That puts `manage.py` in the *current* folder instead of creating an extra outer folder. Both are fine; just be consistent.

From now on, every `python manage.py ...` command must be run from the folder that contains `manage.py`.

## Step 3 — Create an app

An **app** is one feature of your website: a blog, a shop, user accounts. A project can contain many apps. Our only feature is managing players:

```bash
python manage.py startapp playerapp
```

This creates the `playerapp/` folder with `models.py`, `views.py`, `admin.py` and friends. [Chapter 6](/learn/project-structure) tours every file.

> [!NOTE] Project vs app
> The **project** is the website. An **app** is a reusable piece of it. `playerproject` holds settings; `playerapp` holds the player feature. You could copy `playerapp` into another project and it would still work.

## Step 4 — Register the app in INSTALLED_APPS

Django doesn't know your app exists until you tell it. Open `playerproject/settings.py`, find `INSTALLED_APPS`, and add your app at the end:

```python title="playerproject/settings.py"
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "playerapp",  # <- our app
]
```

> [!WARNING]
> Forgetting this step is the number one beginner mistake. Symptoms: `makemigrations` says *No changes detected*, or Django says `TemplateDoesNotExist`.

## Step 5 — Define your model

A **model** is a Python class that describes one table in your database. Each attribute is a column.

```python title="playerapp/models.py"
from django.db import models


class Player(models.Model):
    name = models.CharField(max_length=100)
    test_innings = models.IntegerField()
    runs = models.IntegerField()

    def __str__(self):
        return self.name
```

- `CharField` stores short text and needs a `max_length`.
- `IntegerField` stores whole numbers.
- `__str__` decides how a player is displayed (in the admin, in the shell). Without it you would see `Player object (1)`.
- You never write an `id` column. Django adds an auto-incrementing primary key called `id` (also available as `pk`) for you.

Models are covered fully in [Models & Fields](/learn/models).

## Step 6 — Make migrations

A **migration** is a file that describes a change to your database: "create a table called `playerapp_player` with these columns".

```bash
python manage.py makemigrations
```

```text
Migrations for 'playerapp':
  playerapp/migrations/0001_initial.py
    + Create model Player
```

`makemigrations` only **writes the plan**. Nothing has touched the database yet.

## Step 7 — Apply migrations

```bash
python manage.py migrate
```

`migrate` **executes the plan**. It creates `db.sqlite3` (if it doesn't exist) and builds every table, including the built-in ones for users, sessions and the admin.

> [!EXAM] makemigrations vs migrate
> `makemigrations` → *creates* migration files from your model changes. `migrate` → *applies* those files to the database. Run them in this order every time you change a model.

## Step 8 — Register the model in admin

Django comes with a ready-made admin website. Tell it about your model:

```python title="playerapp/admin.py"
from django.contrib import admin
from .models import Player

admin.site.register(Player)
```

## Step 9 — Create a superuser

A **superuser** is an account that can log into the admin and do everything.

```bash
python manage.py createsuperuser
```

```text
Username: admin
Email address: admin@example.com
Password: ********
Password (again): ********
Superuser created successfully.
```

The password is not shown while you type. That's normal. Later, at `http://127.0.0.1:8000/admin/` you can log in and add players with a point-and-click interface. [The Admin Site](/learn/admin) shows how to customise it.

## Step 10 — Create templates

**Templates** are HTML files with special Django tags in them. Create this folder structure inside your app:

```text
playerapp/
└── templates/
    └── playerapp/
        ├── base.html
        ├── home.html
        ├── player_form.html
        └── welcome.html
```

> [!TIP] Why `templates/playerapp/` and not just `templates/`?
> Django searches the `templates` folder of *every* app. If two apps both had a `home.html`, Django would pick whichever it found first. The extra `playerapp/` folder *namespaces* the templates, so you refer to them as `"playerapp/home.html"` and there is never a clash. It's the convention the official Django tutorial uses.

First a **base template** that every page shares. The `{% block content %}` tag is a hole that each page fills in:

```django title="playerapp/templates/playerapp/base.html"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{% block title %}Player App{% endblock %}</title>
</head>
<body>
    <nav>
        <a href="{% url 'home' %}">Players</a> |
        <a href="{% url 'add_player' %}">Add player</a> |
        <a href="{% url 'welcome' %}">Welcome</a>
    </nav>
    <hr>
    {% block content %}{% endblock %}
</body>
</html>
```

The list page. It loops over players, shows a search box and an edit/delete pair for each row:

```django title="playerapp/templates/playerapp/home.html"
{% extends "playerapp/base.html" %}

{% block content %}
<h2>All players</h2>

<form method="get" action="{% url 'home' %}">
    <input type="text" name="search" value="{{ search_query }}" placeholder="Search by name">
    <button type="submit">Search</button>
</form>

{% if players %}
<table border="1" cellpadding="6">
    <tr>
        <th>Name</th><th>Test innings</th><th>Runs</th><th>Actions</th>
    </tr>
    {% for player in players %}
    <tr>
        <td>{{ player.name }}</td>
        <td>{{ player.test_innings }}</td>
        <td>{{ player.runs }}</td>
        <td>
            <a href="{% url 'edit_player' player.pk %}">Edit</a>
            <form method="post" action="{% url 'delete_player' player.pk %}" style="display:inline">
                {% csrf_token %}
                <button type="submit" onclick="return confirm('Delete {{ player.name|escapejs }}?')">Delete</button>
            </form>
        </td>
    </tr>
    {% endfor %}
</table>
{% else %}
<p>No players found.</p>
{% endif %}
{% endblock %}
```

One form page used for both *adding* and *editing*. When editing, the inputs are pre-filled with the player's current values:

```django title="playerapp/templates/playerapp/player_form.html"
{% extends "playerapp/base.html" %}

{% block content %}
<h2>{% if player %}Edit {{ player.name }}{% else %}Add a player{% endif %}</h2>

<form method="post">
    {% csrf_token %}
    <p><input type="text" name="name" placeholder="Name" value="{{ player.name|default:'' }}" required></p>
    <p><input type="number" name="innings" placeholder="Test innings" value="{{ player.test_innings|default:'' }}" required></p>
    <p><input type="number" name="runs" placeholder="Runs" value="{{ player.runs|default:'' }}" required></p>
    <button type="submit">Save</button>
</form>
{% endblock %}
```

And a tiny static page:

```django title="playerapp/templates/playerapp/welcome.html"
{% extends "playerapp/base.html" %}

{% block content %}
<h1>Welcome to the Player App</h1>
<p>Built with Django in 14 steps.</p>
{% endblock %}
```

The template features you just used:

| Syntax | Meaning |
|---|---|
| `{{ player.name }}` | Print a value |
| `{% for %}`, `{% if %}`, `{% url %}`, `{% extends %}` | Tags: logic and helpers |
| `{% csrf_token %}` | Required inside every `method="post"` form (security, see [Chapter 21](/learn/security)) |
| `{{ player.name\|escapejs }}` | Makes a value safe inside a JavaScript string, like the `confirm()` message |

## Step 11 — Write views

A **view** is a Python function that receives a request and returns a response. Usually it fetches data with the model and hands it to a template.

```python title="playerapp/views.py"
from django.shortcuts import get_object_or_404, redirect, render

from .models import Player


def home(request):
    # READ: list every player, or only those matching the search box
    search_query = request.GET.get("search", "")
    if search_query:
        players = Player.objects.filter(name__icontains=search_query)
    else:
        players = Player.objects.all()
    return render(
        request,
        "playerapp/home.html",
        {"players": players, "search_query": search_query},
    )


def welcome(request):
    return render(request, "playerapp/welcome.html")


def add_player(request):
    # CREATE: show an empty form (GET) or save the submitted one (POST)
    if request.method == "POST":
        Player.objects.create(
            name=request.POST.get("name"),
            test_innings=request.POST.get("innings"),
            runs=request.POST.get("runs"),
        )
        return redirect("home")
    return render(request, "playerapp/player_form.html")


def edit_player(request, pk):
    # UPDATE: load one player, change its fields, save
    player = get_object_or_404(Player, pk=pk)
    if request.method == "POST":
        player.name = request.POST.get("name")
        player.test_innings = request.POST.get("innings")
        player.runs = request.POST.get("runs")
        player.save()
        return redirect("home")
    return render(request, "playerapp/player_form.html", {"player": player})


def delete_player(request, pk):
    # DELETE: only on POST, so a stray link click can never delete data
    player = get_object_or_404(Player, pk=pk)
    if request.method == "POST":
        player.delete()
    return redirect("home")
```

Read it slowly. Each view follows the same rhythm:

1. **Look at the request.** Is it a `GET` (just show me the page) or a `POST` (a form was submitted)?
2. **Talk to the model.** `Player.objects.all()`, `.filter()`, `.create()`, `.save()`, `.delete()`.
3. **Return a response.** `render()` fills a template, `redirect()` sends the browser to another URL.

The useful helpers:

- `render(request, template, context)` combines a template with a dictionary of data (the **context**).
- `redirect("home")` sends the browser to the URL named `home`.
- `get_object_or_404(Player, pk=pk)` fetches one player, or shows a *404 Not Found* page if that id doesn't exist.
- `name__icontains=...` means "name contains this text, ignoring upper/lower case".

> [!NOTE]
> These views read raw values from `request.POST` with no validation. That keeps this first project small. In [Forms & Validation](/learn/forms) you'll replace them with a `ModelForm`, which checks every value and shows friendly error messages.

## Step 12 — Create the app's urls.py

`startapp` doesn't create a `urls.py` for the app. Create the file yourself:

```python title="playerapp/urls.py"
from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("welcome/", views.welcome, name="welcome"),
    path("add/", views.add_player, name="add_player"),
    path("edit/<int:pk>/", views.edit_player, name="edit_player"),
    path("delete/<int:pk>/", views.delete_player, name="delete_player"),
]
```

Each `path()` connects a URL pattern to a view:

- `""` is the app's root, `"add/"` is `/add/` and so on.
- `<int:pk>` captures a number from the URL and passes it to the view as the `pk` argument. `/edit/3/` calls `edit_player(request, pk=3)`.
- `name="home"` gives the URL a name, so templates can write `{% url 'home' %}` and views can write `redirect("home")` instead of hard-coding paths.

## Step 13 — Include app URLs in the project

The project's `urls.py` is the front door. Every request arrives here first. Hand everything that isn't the admin over to your app:

```python title="playerproject/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("playerapp.urls")),
]
```

`include("playerapp.urls")` means "for anything else, look in `playerapp/urls.py`". [URLs & Routing](/learn/urls) covers prefixes, namespaces and more.

## Step 14 — Run the server

```bash
python manage.py runserver
```

```text
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).
Django version 5.2, using settings 'playerproject.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

Open **http://127.0.0.1:8000/** in your browser. You have a working Django application. The server restarts automatically when you save a Python file. Stop it with <kbd>Ctrl</kbd> + <kbd>C</kbd>.

> [!TIP]
> Port 8000 busy? Use another one: `python manage.py runserver 8080`. To open the site from your phone on the same Wi-Fi, run `python manage.py runserver 0.0.0.0:8000` and add your computer's IP address to `ALLOWED_HOSTS` in `settings.py`.

## Try it out

1. Visit `/` and you see *No players found*.
2. Click **Add player**, enter `Virat Kohli`, `113`, `8848` and save. You're redirected back to the list.
3. Add a few more, then search for part of a name.
4. Click **Edit**, change the runs, save.
5. Click **Delete** and confirm.
6. Visit `/admin/`, log in with your superuser, and you'll see the same players under **Playerapp → Players**.

## What just happened?

When you clicked **Edit** on player 3, this is the journey your request took:

```flow
Browser | Sends GET /edit/3/ to the development server
playerproject/urls.py | No match for admin/, so the request is handed to playerapp.urls
playerapp/urls.py | "edit/<int:pk>/" matches and captures pk = 3
views.edit_player | Runs get_object_or_404(Player, pk=3) to fetch the row
Model → Database | The ORM turns that into SQL: SELECT ... WHERE id = 3
Template | player_form.html is filled with the player's values
Response | Finished HTML travels back and the browser displays it
```

That journey **is** Django. The pattern is called **MVT (Model, View, Template)** and [the MVT chapter](/learn/mvt) walks through it in detail.

## Common errors and fixes

| Error | Usual cause | Fix |
|---|---|---|
| `No module named django` | Virtual environment not active | Activate `venv`, then retry |
| `TemplateDoesNotExist` | Wrong folder or name, or app not in `INSTALLED_APPS` | Check the path matches `playerapp/templates/playerapp/home.html` |
| `NoReverseMatch` | `{% url 'x' %}` uses a name that doesn't exist | Check `name=` in `urls.py` |
| `no such table: playerapp_player` | Migrations not applied | Run `makemigrations` then `migrate` |
| `Forbidden (403) CSRF verification failed` | `{% csrf_token %}` missing in a POST form | Add it inside the `<form>` |
| `No changes detected` | App not registered, or model not saved | Check `INSTALLED_APPS` and save `models.py` |
| `That port is already in use` | Another server is running | Stop it, or use `runserver 8080` |

## Check yourself

<details>
<summary>Which two commands turn a model into a real table, and in which order?</summary>

`python manage.py makemigrations` (writes the migration file), then `python manage.py migrate` (applies it to the database).
</details>

<details>
<summary>Why does <code>playerapp/urls.py</code> need to be included in <code>playerproject/urls.py</code>?</summary>

Django only reads the project's root URL file (set by `ROOT_URLCONF` in settings). App URL files are invisible until the root file pulls them in with `include()`.
</details>

<details>
<summary>What does <code>&lt;int:pk&gt;</code> in a URL pattern do?</summary>

It captures a whole number from that position in the URL and passes it to the view as a keyword argument named `pk`.
</details>

<details>
<summary>Why is delete done with a POST form instead of a simple link?</summary>

GET requests should never change data. Links can be followed by browsers pre-loading pages, by search engine crawlers, or by a malicious page. A POST form with `{% csrf_token %}` makes deletion deliberate and protected.
</details>
