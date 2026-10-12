`python manage.py runserver` is for development only: it's single-process, unoptimised and not security-hardened. **Deploying** means running your project on a real server, on the internet, safely. This chapter walks through preparing a project for production and putting it online.

## What changes in production

```flow
Browser | https://players.example.com
Reverse proxy / platform | Terminates HTTPS, may serve static files
Gunicorn (WSGI) or Uvicorn (ASGI) | Runs several worker processes of your Django app
Django | DEBUG = False, real SECRET_KEY, ALLOWED_HOSTS set
PostgreSQL | A real database server instead of the SQLite file
Static & media storage | WhiteNoise or a CDN for static; S3-style storage for uploads
```

| Development | Production |
|---|---|
| `runserver` | Gunicorn / Uvicorn |
| `DEBUG = True` | `DEBUG = False` |
| SQLite file | PostgreSQL (usually) |
| Secrets in `settings.py` | Secrets in environment variables |
| Django serves static files | WhiteNoise / web server / CDN |
| HTTP | HTTPS only |

## Step 1: Settings from environment variables

Never hard-code secrets. Read them from the environment:

```python title="config/settings.py"
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key")
DEBUG = os.environ.get("DJANGO_DEBUG", "0") == "1"
ALLOWED_HOSTS = os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
CSRF_TRUSTED_ORIGINS = [
    o for o in os.environ.get("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if o
]
```

Locally, put the values in a `.env` file (and add `.env` to `.gitignore`), loaded by a package such as `python-dotenv` or `django-environ`:

```dotenv title=".env (never commit this)"
DJANGO_SECRET_KEY=change-me-to-a-long-random-string
DJANGO_DEBUG=1
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgres://user:password@localhost:5432/players
```

Generate a strong secret key:

```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

## Step 2: A production database

SQLite is fine for small, low-traffic sites, but PostgreSQL handles many simultaneous writers, has richer features and is what most hosts provide.

```bash
pip install "psycopg[binary]" dj-database-url
```

```python title="config/settings.py"
import dj_database_url

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",   # fallback for local dev
        conn_max_age=600,
    )
}
```

Now a single `DATABASE_URL` environment variable configures the database everywhere.

## Step 3: Static files with WhiteNoise

```bash
pip install whitenoise
```

```python title="config/settings.py"
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    # ... the rest
]

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
```

```bash
python manage.py collectstatic --noinput
```

**User uploads (media)** shouldn't live on the app server's disk on most platforms, because it's often wiped on every deploy. Use object storage (Amazon S3, Cloudflare R2, Google Cloud Storage) via `django-storages`.

## Step 4: An application server

```bash
pip install gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

A common rule of thumb is `2 × CPU cores + 1` workers. For async views or websockets, use an ASGI server instead:

```bash
pip install uvicorn
uvicorn config.asgi:application --host 0.0.0.0 --port 8000 --workers 3
```

## Step 5: Security settings

```python title="config/settings.py"
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 3600            # raise to 31536000 once everything works over HTTPS
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")   # most platforms need this
```

Then let Django audit you:

```bash
DJANGO_DEBUG=0 python manage.py check --deploy
```

## Step 6: Requirements and a start command

```bash
pip freeze > requirements.txt
```

Most platforms read a **Procfile** or a start command:

```text title="Procfile"
release: python manage.py migrate --noinput
web: gunicorn config.wsgi:application --bind 0.0.0.0:$PORT
```

A **build script** typically runs:

```bash
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
```

## Choosing where to host

| Platform | Type | Notes |
|---|---|---|
| **Render** | Platform as a service | Git push to deploy, managed PostgreSQL, free tier for experiments |
| **Railway** | PaaS | Very quick setup, usage-based pricing |
| **Fly.io** | Containers close to users | Dockerfile-based, global regions |
| **PythonAnywhere** | Python-focused hosting | Beginner-friendly, web-based console, free tier |
| **Heroku** | PaaS | The original Procfile workflow, paid |
| **A VPS** (DigitalOcean, Hetzner, Linode, AWS Lightsail) | Your own Linux server | Full control: you set up Nginx, Gunicorn, PostgreSQL, systemd and HTTPS (Let's Encrypt) |

Free tiers and prices change often; check each provider's current offer.

### Example: deploying on Render

1. Push your project to GitHub, including `requirements.txt` and a `build.sh`:

```bash title="build.sh"
#!/usr/bin/env bash
set -o errexit
pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate --noinput
```

2. On Render, create a **PostgreSQL** database and copy its internal URL.
3. Create a **Web Service** from your repository:
   - Build command: `./build.sh`
   - Start command: `gunicorn config.wsgi:application`
4. Add environment variables: `DATABASE_URL`, `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=0`, `DJANGO_ALLOWED_HOSTS=your-app.onrender.com`, `DJANGO_CSRF_TRUSTED_ORIGINS=https://your-app.onrender.com`.
5. Deploy. Create an admin through the platform's shell: `python manage.py createsuperuser`.

### Docker (optional)

Containers package your app with its exact environment:

```dockerfile title="Dockerfile"
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN python manage.py collectstatic --noinput

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
```

## Deploying a DRF API

Everything above applies, plus:

- Set `CORS_ALLOWED_ORIGINS` to your real frontend domain(s).
- Consider removing `BrowsableAPIRenderer` from `DEFAULT_RENDERER_CLASSES`.
- Use a strong `SECRET_KEY` (it signs your JWTs) and short access-token lifetimes.
- Turn on throttling with a shared cache (Redis).

## Logging and monitoring

With `DEBUG = False`, errors no longer appear in the browser. Make sure you hear about them:

```python title="config/settings.py"
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}

ADMINS = [("Site Admin", "admin@example.com")]   # emailed on server errors (needs email set up)
```

An error tracker such as **Sentry** (`pip install sentry-sdk`) gives you stack traces, alerts and context for every exception.

## The deployment checklist

- [x] `DEBUG = False`
- [x] `SECRET_KEY` from the environment, long and random
- [x] `ALLOWED_HOSTS` and `CSRF_TRUSTED_ORIGINS` set to your domain(s)
- [x] Production database configured; `migrate` runs on every deploy
- [x] `collectstatic` runs on every deploy; static files served by WhiteNoise or a CDN
- [x] Media files in object storage
- [x] Gunicorn / Uvicorn, not `runserver`
- [x] HTTPS everywhere; secure cookies; HSTS
- [x] `python manage.py check --deploy` passes
- [x] Error monitoring and logs
- [x] Database backups scheduled
- [x] Custom `404.html` and `500.html` templates

## Summary

| Task | Tool / command |
|---|---|
| Secrets and config | Environment variables (`os.environ`) |
| Database | PostgreSQL + `dj-database-url` |
| Static files | `STATIC_ROOT` + `collectstatic` + WhiteNoise |
| Run the app | `gunicorn config.wsgi:application` |
| Security audit | `python manage.py check --deploy` |
| Hosting | Render, Railway, Fly.io, PythonAnywhere, or a VPS |

## Check yourself

<details>
<summary>Why must you never use <code>runserver</code> in production?</summary>

It's a lightweight development server: not designed for performance, many concurrent users or security. Use Gunicorn or Uvicorn.
</details>

<details>
<summary>What does <code>collectstatic</code> do, and when should it run?</summary>

It copies all static files into `STATIC_ROOT` so they can be served efficiently. Run it on every deployment.
</details>

<details>
<summary>Name three settings that must change between development and production.</summary>

`DEBUG` (to `False`), `SECRET_KEY` (a secret from the environment), and `ALLOWED_HOSTS` (your domain). Also the database, `CSRF_TRUSTED_ORIGINS` and the HTTPS security settings.
</details>
