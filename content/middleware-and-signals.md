Two of Django's extension points let you run code **without calling it from every view**:

- **Middleware** runs on *every request and response*, like a series of layers around your views.
- **Signals** run when *something happens*, such as a model being saved or a user logging in.

## Middleware

### How it works

Each middleware wraps the next one, like layers of an onion. A request passes inward through every layer to the view, and the response travels back out through them in reverse order:

```flow
SecurityMiddleware | Adds security headers, HTTPS redirect
SessionMiddleware | Loads request.session
CommonMiddleware | APPEND_SLASH and other conveniences
CsrfViewMiddleware | Checks the CSRF token on unsafe requests
AuthenticationMiddleware | Sets request.user from the session
MessageMiddleware | Enables the messages framework
XFrameOptionsMiddleware | Adds the X-Frame-Options header to the response
Your view | Runs, returns a response that travels back up through every layer
```

This order comes from the `MIDDLEWARE` list in `settings.py` (top = outermost). **Order matters**: `AuthenticationMiddleware` needs the session, so it must come after `SessionMiddleware`.

Any middleware can **short-circuit** by returning a response early. For example, `CsrfViewMiddleware` returns a 403 without ever calling your view.

### Writing your own

A middleware is a class with `__init__(get_response)` and `__call__(request)`:

```python title="core/middleware.py"
import logging
import time

logger = logging.getLogger(__name__)


class TimingMiddleware:
    """Logs how long each request took and adds an X-Response-Time header."""

    def __init__(self, get_response):
        self.get_response = get_response      # runs once, when the server starts

    def __call__(self, request):
        start = time.perf_counter()           # code here runs BEFORE the view

        response = self.get_response(request) # call the next layer (eventually the view)

        duration_ms = (time.perf_counter() - start) * 1000   # code here runs AFTER the view
        response["X-Response-Time"] = f"{duration_ms:.1f}ms"
        logger.info("%s %s took %.1fms", request.method, request.path, duration_ms)
        return response
```

Register it in settings:

```python title="settings.py"
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # ...
    "core.middleware.TimingMiddleware",
]
```

### Short-circuiting: a maintenance mode

```python title="core/middleware.py"
from django.conf import settings
from django.http import HttpResponse


class MaintenanceModeMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if getattr(settings, "MAINTENANCE_MODE", False) and not request.path.startswith("/admin/"):
            return HttpResponse("We'll be back soon!", status=503)   # the view never runs
        return self.get_response(request)
```

### Optional hooks

Class-based middleware can also define:

| Method | Called |
|---|---|
| `process_view(request, view_func, view_args, view_kwargs)` | Just before Django calls the view |
| `process_exception(request, exception)` | When the view raises an exception |
| `process_template_response(request, response)` | For responses with a `render()` method (e.g. `TemplateResponse`) |

```python
class BlockBadBotsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_view(self, request, view_func, view_args, view_kwargs):
        agent = request.headers.get("User-Agent", "")
        if "BadBot" in agent:
            return HttpResponse(status=403)
        return None          # None = carry on normally
```

### Good uses for middleware

- Request timing, logging, adding request ids
- Security headers, IP blocking, maintenance mode
- Setting per-request context (language, time zone, current tenant)

Bad uses: anything that applies to only a few views. Use a decorator or mixin for those, since middleware runs on *every* request, including static files in development and the admin.

## Signals

Signals let one part of your code say "this just happened" and other parts react, without the two knowing about each other.

### Built-in signals

| Signal | Sent |
|---|---|
| `pre_save` / `post_save` | Before / after `Model.save()` |
| `pre_delete` / `post_delete` | Before / after a model instance is deleted |
| `m2m_changed` | When a many-to-many relation changes |
| `user_logged_in` / `user_logged_out` / `user_login_failed` | Auth events |
| `request_started` / `request_finished` | Around every request |

### Auto-creating a profile

The classic example: every new `User` should get a `Profile`.

```python title="accounts/signals.py"
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile(sender, instance, created, **kwargs):
    if created:                                   # only for brand-new users
        Profile.objects.create(user=instance)
```

| Receiver argument | Meaning |
|---|---|
| `sender` | The model class |
| `instance` | The object that was saved |
| `created` | `True` on INSERT, `False` on UPDATE (`post_save` only) |
| `**kwargs` | Always accept these; Django may add arguments |

### Connecting signals: apps.py

Receivers only work if their module is imported. Do it in the app's `ready()` method:

```python title="accounts/apps.py"
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        from . import signals  # noqa: F401
```

> [!WARNING] A receiver that never fires?
> Nine times out of ten, the `signals` module was never imported. Check that `ready()` imports it and that the app is listed in `INSTALLED_APPS` as `"accounts"` (or `"accounts.apps.AccountsConfig"`).

### More examples

Clean up an uploaded file when its object is deleted:

```python
from django.db.models.signals import post_delete
from django.dispatch import receiver


@receiver(post_delete, sender=Document)
def delete_file(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)
```

Generate a slug before saving:

```python
from django.db.models.signals import pre_save
from django.utils.text import slugify


@receiver(pre_save, sender=Post)
def set_slug(sender, instance, **kwargs):
    if not instance.slug:
        instance.slug = slugify(instance.title)
```

Record logins:

```python
from django.contrib.auth.signals import user_logged_in


@receiver(user_logged_in)
def record_login(sender, request, user, **kwargs):
    LoginEvent.objects.create(user=user, ip=request.META.get("REMOTE_ADDR"))
```

### Custom signals

```python title="orders/signals.py"
from django.dispatch import Signal

order_placed = Signal()       # receivers get: sender, order, **kwargs
```

```python
# sending
order_placed.send(sender=Order, order=order)

# receiving (e.g. in an emails app)
@receiver(order_placed)
def send_confirmation(sender, order, **kwargs):
    ...
```

### When to use signals (and when not)

Signals are powerful but **hidden**: reading `order.save()` gives no hint that five other things happen. Use them:

- To react to models you don't own (e.g. `User` from `django.contrib.auth`)
- To keep apps decoupled (the `orders` app shouldn't import the `emails` app)

Prefer plain code when the logic belongs to your own model: overriding `save()`, a model method, or an explicit service function is easier to follow and test.

> [!NOTE]
> `QuerySet.update()` and `bulk_create()` don't call `save()`, so `pre_save` and `post_save` **don't fire** for them.

## Summary

| | Middleware | Signals |
|---|---|---|
| Runs | On every request / response | When a specific event happens |
| Defined as | A class with `__call__` | A function decorated with `@receiver` |
| Registered in | `settings.MIDDLEWARE` (order matters) | Imported in `AppConfig.ready()` |
| Typical uses | Logging, headers, security, maintenance mode | Profiles, cleanup, audit logs, notifications |

## Check yourself

<details>
<summary>In what order does middleware run for the request and for the response?</summary>

Top to bottom of the `MIDDLEWARE` list on the way in (request), bottom to top on the way out (response).
</details>

<details>
<summary>In a <code>post_save</code> receiver, how do you know if the object was just created?</summary>

The `created` argument is `True` for a new object and `False` for an update.
</details>

<details>
<summary>Why doesn't <code>Player.objects.filter(...).update(runs=0)</code> trigger your <code>post_save</code> receiver?</summary>

`QuerySet.update()` runs a single SQL UPDATE without calling each instance's `save()`, so save signals aren't sent.
</details>
