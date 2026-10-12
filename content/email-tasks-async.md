Real applications send email, generate reports, resize images and call slow external services. This chapter covers **sending email**, moving slow work into **background tasks**, and **async views** for handling many slow I/O operations at once.

## Sending email

### Configure a backend

During development, print emails to the terminal instead of sending them:

```python title="settings.py (development)"
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
DEFAULT_FROM_EMAIL = "Player Hub <noreply@example.com>"
```

In production, use SMTP (or an email service such as SendGrid, Mailgun, Amazon SES or Postmark):

```python title="settings.py (production)"
import os

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.environ["EMAIL_HOST_USER"]
EMAIL_HOST_PASSWORD = os.environ["EMAIL_HOST_PASSWORD"]   # e.g. a Gmail app password
DEFAULT_FROM_EMAIL = "Player Hub <noreply@example.com>"
```

| Backend | Use |
|---|---|
| `console.EmailBackend` | Print to the terminal (development) |
| `filebased.EmailBackend` | Write to files (`EMAIL_FILE_PATH`) |
| `locmem.EmailBackend` | Keep in memory: the default during tests (`django.core.mail.outbox`) |
| `smtp.EmailBackend` | Really send |
| `dummy.EmailBackend` | Do nothing |

### send_mail()

```python
from django.core.mail import send_mail

send_mail(
    subject="Welcome to Player Hub",
    message="Thanks for signing up!",
    from_email=None,                      # None = DEFAULT_FROM_EMAIL
    recipient_list=["asha@example.com"],
    fail_silently=False,
)
```

### HTML emails from templates

```python
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string


def send_welcome(user):
    context = {"user": user}
    text = render_to_string("emails/welcome.txt", context)
    html = render_to_string("emails/welcome.html", context)

    msg = EmailMultiAlternatives(
        subject="Welcome!",
        body=text,                         # plain-text version for every client
        to=[user.email],
    )
    msg.attach_alternative(html, "text/html")
    msg.send()
```

`EmailMessage` also supports `cc`, `bcc`, `reply_to` and attachments: `msg.attach_file("report.pdf")`.

### Testing emails

```python
from django.core import mail


def test_welcome_email(self):
    send_welcome(self.user)
    self.assertEqual(len(mail.outbox), 1)
    self.assertIn("Welcome", mail.outbox[0].subject)
```

## Background tasks

Sending an email can take a second or two. Generating a PDF report might take thirty. If a view does this work directly, the user waits, and the server process is tied up.

The fix: the view **queues** the work and returns immediately; a separate **worker** process does it in the background.

```flow
View | Saves the order and enqueues "send confirmation email"
Response | Returned to the user straight away
Queue | Stores the pending task (database, Redis...)
Worker | A separate process picks up the task and runs it
```

### Django's built-in tasks framework (Django 6.0+)

Django 6.0 introduced a standard API for defining and queuing tasks:

```python title="accounts/tasks.py"
from django.core.mail import send_mail
from django.tasks import task


@task
def send_welcome_email(email, username):
    send_mail(
        subject="Welcome!",
        message=f"Hi {username}, thanks for joining.",
        from_email=None,
        recipient_list=[email],
    )
```

```python title="accounts/views.py"
from .tasks import send_welcome_email

user = form.save()
send_welcome_email.enqueue(email=user.email, username=user.username)
```

```python title="settings.py"
TASKS = {
    "default": {
        "BACKEND": "django.tasks.backends.immediate.ImmediateBackend",
    }
}
```

> [!NOTE]
> Django itself defines **how** tasks are declared and queued; it ships only simple backends (`ImmediateBackend` runs the task right away, `DummyBackend` stores it without running). To run tasks in the background in production you add a backend and worker from a third-party package (for example, the `django-tasks` project's database backend). Task arguments must be JSON-serialisable: pass ids and strings, not model instances.

### Celery: the long-standing standard

**Celery** is the most widely used task queue for Django, with retries, schedules, rate limits and monitoring. It needs a **message broker**, usually Redis.

```bash
pip install celery redis
```

```python title="config/celery.py"
import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("config")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
```

```python title="config/__init__.py"
from .celery import app as celery_app

__all__ = ("celery_app",)
```

```python title="settings.py"
CELERY_BROKER_URL = "redis://localhost:6379/0"
```

```python title="accounts/tasks.py"
from celery import shared_task
from django.core.mail import send_mail


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_welcome_email(self, email, username):
    try:
        send_mail("Welcome!", f"Hi {username}!", None, [email])
    except Exception as exc:
        raise self.retry(exc=exc)
```

```python
send_welcome_email.delay(user.email, user.username)
```

Run a worker in a second terminal:

```bash
celery -A config worker -l info
```

**Celery Beat** runs periodic tasks (every night, every hour). Lighter alternatives include **Django-Q2**, **Huey** and **RQ**.

### Queue tasks after the database commits

If a task needs data saved in the current transaction, queue it with `transaction.on_commit()`. The callback runs only once the transaction commits, so a worker never looks for an object that was rolled back or isn't visible yet:

```python
from django.db import transaction

transaction.on_commit(lambda: send_welcome_email.enqueue(email=user.email, username=user.username))
```

## Async views

A normal (sync) view occupies a worker thread for its whole run, including time spent **waiting** on a slow external API. An **async view** can pause while waiting, letting the server handle other requests in the meantime.

```python
import asyncio

import httpx
from django.http import JsonResponse


async def dashboard_data(request):
    async with httpx.AsyncClient(timeout=10) as client:
        weather, scores = await asyncio.gather(          # both requests run at the same time
            client.get("https://api.example.com/weather"),
            client.get("https://api.example.com/scores"),
        )
    return JsonResponse({"weather": weather.json(), "scores": scores.json()})
```

Key points:

- Define the view with `async def`. URLs don't change.
- Real concurrency needs an **ASGI** server (`uvicorn config.asgi:application`, Daphne, or Gunicorn with Uvicorn workers). Under WSGI, async views still work but with no benefit.
- Use the async ORM methods: `await Player.objects.aget(pk=1)`, `acount()`, `aexists()`, `async for p in qs`, `await obj.asave()`.
- Call sync-only code with `sync_to_async`, and async code from sync with `async_to_sync` (both from `asgiref.sync`).

```python
from asgiref.sync import sync_to_async


async def profile(request):
    user = await request.auser()                         # async version of request.user
    data = await sync_to_async(build_report)(user.id)    # wrap a sync function
    return JsonResponse(data)
```

> [!TIP] When to go async
> Async helps when views spend most of their time **waiting on the network** (external APIs, many simultaneous slow calls, long polling). It doesn't make CPU-heavy work or ordinary database CRUD faster. For those, use caching, better queries or background tasks.

### Real-time features

Websockets (live chat, notifications, live scores) need **Django Channels**, which adds websocket consumers and a channel layer (usually Redis) on top of ASGI. Server-Sent Events can be done with async streaming responses.

## Summary

| Need | Tool |
|---|---|
| Send an email | `send_mail()`, `EmailMultiAlternatives` |
| See emails in development | `console.EmailBackend` |
| Check emails in tests | `django.core.mail.outbox` |
| Slow work off the request | Django 6.0 tasks (`@task`, `.enqueue()`), Celery (`@shared_task`, `.delay()`) |
| Queue only after the DB commits | `transaction.on_commit()` |
| Many slow network calls in one view | `async def` view + ASGI server |
| Websockets | Django Channels |

## Check yourself

<details>
<summary>Why shouldn't a view send a slow email directly in production?</summary>

The user waits for the email to send and the server process is blocked. A background task lets the view return immediately.
</details>

<details>
<summary>Where do emails go during Django tests?</summary>

Into `django.core.mail.outbox`, because Django switches to the in-memory backend while testing.
</details>

<details>
<summary>Do async views make normal database-heavy pages faster?</summary>

Not by themselves. They improve concurrency when views wait on I/O such as external APIs, and need an ASGI server to help at all.
</details>
