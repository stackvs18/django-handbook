`startproject` and `startapp` generate a handful of files. This chapter explains every one of them, takes a guided tour through `settings.py`, and lists the `manage.py` commands you'll use most.

## What startproject creates

```bash
django-admin startproject mysite
```

```text
mysite/                  <- outer folder: just a container, rename it freely
├── manage.py
└── mysite/              <- the project package (its name matters)
    ├── __init__.py
    ├── settings.py
    ├── urls.py
    ├── asgi.py
    └── wsgi.py
```

| File | Purpose |
|---|---|
| `manage.py` | A command-line utility for *this* project. Same as `django-admin` but with your settings already loaded |
| `__init__.py` | An empty file that makes the folder a Python package |
| `settings.py` | All configuration: installed apps, database, templates, security, time zone... |
| `urls.py` | The root URL configuration (the *URLconf*). Every request starts here |
| `wsgi.py` | Entry point for WSGI servers such as Gunicorn (traditional, synchronous deployment) |
| `asgi.py` | Entry point for ASGI servers such as Uvicorn or Daphne (async, websockets) |

You'll edit `settings.py` and `urls.py` regularly. You'll rarely touch the others.

## What startapp creates

```bash
python manage.py startapp blog
```

```text
blog/
├── __init__.py
├── admin.py
├── apps.py
├── migrations/
│   └── __init__.py
├── models.py
├── tests.py
└── views.py
```

| File | Purpose |
|---|---|
| `admin.py` | Register models with the admin site |
| `apps.py` | The app's configuration class (`BlogConfig`). Used for app-level setup such as connecting signals |
| `migrations/` | Auto-generated files describing database changes. Commit them to Git |
| `models.py` | Your data models |
| `tests.py` | Automated tests |
| `views.py` | Your views |

Files you'll commonly **add yourself**:

| File / folder | Purpose |
|---|---|
| `urls.py` | The app's own URL patterns |
| `forms.py` | Form classes |
| `serializers.py` | DRF serializers |
| `templates/blog/` | The app's templates |
| `static/blog/` | The app's CSS, JS, images |
| `permissions.py`, `signals.py`, `services.py` | As your app grows |

## A tour of settings.py

`settings.py` is just a Python module full of UPPERCASE variables. Here are the important ones, in the order you'll find them.

### BASE_DIR

```python
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
```

The absolute path to the folder containing `manage.py`. Use it to build other paths: `BASE_DIR / "templates"`.

### SECRET_KEY

```python
SECRET_KEY = "django-insecure-..."
```

A long random string used to sign cookies, sessions, password-reset links and CSRF tokens (and, by default, JWTs). **Keep it secret.** In production, load it from an environment variable. Never commit a real one to Git.

### DEBUG

```python
DEBUG = True
```

When `True`, errors show a detailed yellow debug page with your code and settings. Brilliant in development, **dangerous in production**. It must be `False` on a live site.

### ALLOWED_HOSTS

```python
ALLOWED_HOSTS = []                                  # development
ALLOWED_HOSTS = ["example.com", "www.example.com"]  # production
```

Which domain names this site may serve. With `DEBUG = True` and an empty list, `localhost` and `127.0.0.1` are allowed automatically.

### INSTALLED_APPS

```python
INSTALLED_APPS = [
    "django.contrib.admin",         # the admin site
    "django.contrib.auth",          # users, groups, permissions
    "django.contrib.contenttypes",  # lets permissions refer to any model
    "django.contrib.sessions",      # server-side sessions
    "django.contrib.messages",      # one-time notification messages
    "django.contrib.staticfiles",   # managing CSS/JS/images
    "blog",                         # your apps go here
]
```

Every app, whether built-in, third-party (like `rest_framework`) or your own, must be listed here for Django to load its models, templates, static files and migrations.

### MIDDLEWARE

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]
```

Middleware are layers that process *every* request on the way in and every response on the way out. **Order matters.** For example, `AuthenticationMiddleware` needs the session, so it must come after `SessionMiddleware`. This is the middleware that gives you `request.user` and CSRF protection. See [Middleware & Signals](/learn/middleware-and-signals).

### ROOT_URLCONF

```python
ROOT_URLCONF = "mysite.urls"
```

Which module contains the root URL patterns: the front door of your site.

### TEMPLATES

```python
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],   # project-wide templates folder (optional)
        "APP_DIRS": True,                    # also look in each app's templates/ folder
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
```

- `DIRS`: extra folders to search for templates. Adding `BASE_DIR / "templates"` lets you keep shared templates (like a site-wide `base.html`) at the project root.
- `APP_DIRS: True`: search each installed app's `templates/` folder.
- `context_processors`: variables injected into every template automatically, such as `user`, `request` and `messages`.

### DATABASES

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}
```

SQLite is a file-based database that needs no setup, perfect for learning. For production you'd typically switch to PostgreSQL:

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "mydb",
        "USER": "myuser",
        "PASSWORD": "secret",
        "HOST": "localhost",
        "PORT": "5432",
    }
}
```

Built-in backends: `sqlite3`, `postgresql`, `mysql`, `oracle`. MariaDB uses the `mysql` backend.

### AUTH_PASSWORD_VALIDATORS

Rules for password strength (minimum length, not too similar to the username, not a common password, not all numbers). They're used by `createsuperuser`, `UserCreationForm` and password-change forms.

### Internationalisation

```python
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"          # e.g. "Asia/Kolkata"
USE_I18N = True            # translation system on
USE_TZ = True              # store datetimes as timezone-aware UTC
```

Keep `USE_TZ = True`. Django stores times in UTC and converts to `TIME_ZONE` for display.

### Static files

```python
STATIC_URL = "static/"
```

The URL prefix for CSS/JS/images. See [Static & Media Files](/learn/static-and-media) for `STATICFILES_DIRS`, `STATIC_ROOT` and `MEDIA_*`.

### DEFAULT_AUTO_FIELD

```python
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
```

The type of the automatic `id` primary key. `BigAutoField` (64-bit) is the modern default.

### Settings you'll add later

| Setting | Chapter |
|---|---|
| `LOGIN_URL`, `LOGIN_REDIRECT_URL`, `LOGOUT_REDIRECT_URL` | [Authentication](/learn/authentication) |
| `AUTH_USER_MODEL` | [Permissions & Custom Users](/learn/permissions) |
| `MEDIA_URL`, `MEDIA_ROOT` | [Static & Media Files](/learn/static-and-media) |
| `REST_FRAMEWORK`, `SIMPLE_JWT` | [DRF](/learn/drf-first-api), [JWT](/learn/jwt) |
| `EMAIL_BACKEND` | [Email, Tasks & Async](/learn/email-tasks-async) |
| `CSRF_TRUSTED_ORIGINS`, `SECURE_*` | [Security](/learn/security), [Deployment](/learn/deployment) |

> [!TIP] Reading settings in your own code
> Always import settings like this, never import your `settings.py` module directly:
> `from django.conf import settings` then `settings.DEBUG`.

## manage.py commands you'll use

| Command | What it does |
|---|---|
| `python manage.py runserver` | Start the development server (default port 8000) |
| `python manage.py startapp name` | Create a new app |
| `python manage.py makemigrations` | Create migration files from model changes |
| `python manage.py migrate` | Apply migrations to the database |
| `python manage.py showmigrations` | List migrations and whether they're applied |
| `python manage.py sqlmigrate app 0001` | Show the SQL a migration will run |
| `python manage.py createsuperuser` | Create an admin user |
| `python manage.py changepassword username` | Change a user's password |
| `python manage.py shell` | Python shell with Django loaded (models auto-imported in Django 5.2+) |
| `python manage.py dbshell` | Open the database's own command-line client |
| `python manage.py check` | Look for common problems |
| `python manage.py check --deploy` | Production security checklist |
| `python manage.py test` | Run automated tests |
| `python manage.py collectstatic` | Gather static files into `STATIC_ROOT` for deployment |
| `python manage.py dumpdata app > data.json` | Export data as JSON |
| `python manage.py loaddata data.json` | Import data |
| `python manage.py flush` | Delete all data (keeps tables) |
| `python manage.py help` | List every available command |

## Projects with many apps

Real projects split features into several apps:

```text
shop/
├── manage.py
├── shop/              <- settings, root urls
├── accounts/          <- sign up, login, profiles
├── catalog/           <- products, categories
├── orders/            <- cart, checkout, orders
└── api/               <- DRF endpoints
```

A good rule: **an app should do one thing and be describable in one sentence.** If you need "and" to describe it, consider splitting it.

## Check yourself

<details>
<summary>What's the difference between wsgi.py and asgi.py?</summary>

Both are entry points for production servers. `wsgi.py` is for synchronous WSGI servers (e.g. Gunicorn); `asgi.py` is for asynchronous ASGI servers (e.g. Uvicorn, Daphne), needed for async views and websockets.
</details>

<details>
<summary>Why must DEBUG be False in production?</summary>

With `DEBUG = True`, error pages reveal source code, settings and other sensitive details to anyone, and Django keeps extra data in memory. It's a security risk.
</details>

<details>
<summary>What does APP_DIRS: True do in the TEMPLATES setting?</summary>

It tells Django to look for templates inside a `templates/` folder in every installed app.
</details>
