Almost every application needs accounts. Django's `django.contrib.auth` app gives you a complete, secure system out of the box: a `User` model, password hashing, login sessions, permission checks and ready-made forms and views. This chapter shows how to use all of it: **sign up, log in, log out, and protect pages**.

## The User model

```python
from django.contrib.auth.models import User
```

| Field | Meaning |
|---|---|
| `username` | Unique login name (required) |
| `password` | A **hash** of the password, never the password itself |
| `email` | Email address (optional by default) |
| `first_name`, `last_name` | Optional |
| `is_active` | Can this account log in? Set `False` to disable instead of deleting |
| `is_staff` | Can this user log into the admin site? |
| `is_superuser` | Has every permission automatically |
| `last_login`, `date_joined` | Timestamps |
| `groups`, `user_permissions` | Permissions ([next chapter](/learn/permissions)) |

`django.contrib.auth` and `django.contrib.sessions` are in `INSTALLED_APPS` by default, and `migrate` creates the tables. Nothing to install.

> [!TIP]
> Starting a brand-new project that will last? Consider a **custom user model** from day one. It's easy at the start and painful to add later. See [Permissions & Custom Users](/learn/permissions#a-custom-user-model).

## Creating users

**1. From the command line** (for admins):

```bash
python manage.py createsuperuser
```

**2. In the admin site**, under *Authentication and Authorization → Users*.

**3. In code**: always with `create_user()`, which hashes the password:

```python
user = User.objects.create_user(username="asha", email="asha@example.com", password="S3cure-pass!")
admin = User.objects.create_superuser(username="boss", email="boss@example.com", password="...")
```

> [!CAUTION] Never set passwords directly
> `User(username="x", password="secret")` or `user.password = "secret"` stores the **plain text**, which can't be logged into and is a security disaster. Use `create_user()`, `set_password()` or a form like `UserCreationForm`.

## Managing users and passwords

```python
user = User.objects.get(username="asha")

user.email = "new@example.com"
user.save()

user.set_password("N3w-pass!")      # hashes it
user.save()

user.check_password("N3w-pass!")    # True / False

user.is_active = False              # disable the account but keep their data
user.save()

user.delete()                       # permanently remove
```

### How passwords are stored

Django never stores passwords. It stores a **salted hash** like:

```text
pbkdf2_sha256$1000000$Xk9a...salt...$Q2h1...hash...
```

`algorithm$iterations$salt$hash`. Hashing is one-way: you can check a guess against it, but you can't recover the password. PBKDF2 with SHA-256 is the default; Argon2 and bcrypt are supported via `PASSWORD_HASHERS`.

## authenticate(), login() and logout()

These three functions are the heart of authentication. Mixing them up is the most common mistake, so learn the difference:

| Function | What it does | Returns |
|---|---|---|
| `authenticate(request, username=..., password=...)` | **Checks** the credentials. Doesn't log anyone in | The `User`, or `None` |
| `login(request, user)` | **Starts a session** for a user you already have | Nothing |
| `logout(request)` | **Ends the session** and clears session data | Nothing |

```python
from django.contrib.auth import authenticate, login, logout

user = authenticate(request, username="asha", password="S3cure-pass!")
if user is not None:
    login(request, user)      # now request.user is asha on every following request
else:
    ...                       # wrong username/password, or account inactive
```

> [!EXAM] authenticate vs login
> `authenticate()` **verifies** the username and password and returns a `User` or `None`. `login()` **creates the session** so the user stays logged in. You usually call `authenticate()` first, then `login()` with its result.

## request.user

Thanks to `AuthenticationMiddleware`, every request has a `user`:

```python
def dashboard(request):
    if request.user.is_authenticated:
        name = request.user.username
    else:
        ...   # request.user is an AnonymousUser
```

And in every template (via the `auth` context processor):

```django
{% if user.is_authenticated %}
  Hello, {{ user.get_username }}!
{% else %}
  <a href="{% url 'login' %}">Log in</a>
{% endif %}
```

## Full example: sign up, log in, log out, dashboard

We'll add accounts to a project using function-based views and Django's built-in forms. Create an app for it:

```bash
python manage.py startapp accounts
```

Add `"accounts"` to `INSTALLED_APPS`.

### Settings

```python title="settings.py"
LOGIN_URL = "login"                 # where @login_required sends anonymous users
LOGIN_REDIRECT_URL = "dashboard"    # where LoginView sends users after logging in
LOGOUT_REDIRECT_URL = "login"       # where LogoutView sends users after logging out
```

These accept URL names or paths. Without `LOGIN_REDIRECT_URL`, Django's default destination is `/accounts/profile/`.

### A sign-up form with email

`UserCreationForm` asks for a username and the password twice, checks they match and runs the password validators. Let's extend it to require a unique email:

```python title="accounts/forms.py"
from django import forms
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User


class SignUpForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ["username", "email"]   # the password fields are added by UserCreationForm

    def clean_email(self):
        email = self.cleaned_data["email"].lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError("An account with this email already exists.")
        return email
```

### Views

```python title="accounts/views.py"
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.shortcuts import redirect, render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from .forms import SignUpForm


def signup_view(request):
    if request.method == "POST":
        form = SignUpForm(request.POST)
        if form.is_valid():
            user = form.save()           # creates the user with a hashed password
            login(request, user)         # log them straight in
            return redirect("dashboard")
    else:
        form = SignUpForm()
    return render(request, "accounts/signup.html", {"form": form})


def login_view(request):
    if request.method == "POST":
        form = AuthenticationForm(request, data=request.POST)   # note: request first, data=
        if form.is_valid():                                      # calls authenticate() for you
            login(request, form.get_user())
            next_url = request.GET.get("next")
            if next_url and url_has_allowed_host_and_scheme(next_url, {request.get_host()}):
                return redirect(next_url)                        # back to the page they wanted
            return redirect("dashboard")
    else:
        form = AuthenticationForm(request)
    return render(request, "accounts/login.html", {"form": form})


@require_POST
def logout_view(request):
    logout(request)
    return redirect("login")


@login_required
def dashboard_view(request):
    return render(request, "accounts/dashboard.html")
```

> [!WARNING] Why check the "next" URL?
> `@login_required` adds `?next=/the/page/` so users return where they were. But blindly redirecting to whatever is in `next` would let an attacker craft a login link that sends people to a fake site afterwards (an *open redirect*). `url_has_allowed_host_and_scheme()` only allows URLs on your own site. The built-in `LoginView` does this check for you.

### URLs

```python title="accounts/urls.py"
from django.urls import path
from . import views

urlpatterns = [
    path("signup/", views.signup_view, name="signup"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("dashboard/", views.dashboard_view, name="dashboard"),
]
```

```python title="mysite/urls.py"
urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls")),
]
```

### Templates

The same tiny form pattern works for both sign-up and login:

```django title="accounts/templates/accounts/signup.html"
{% extends "base.html" %}
{% block content %}
<h2>Create an account</h2>
<form method="post">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Sign up</button>
</form>
<p>Already registered? <a href="{% url 'login' %}">Log in</a></p>
{% endblock %}
```

```django title="accounts/templates/accounts/login.html"
{% extends "base.html" %}
{% block content %}
<h2>Log in</h2>
<form method="post">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Log in</button>
</form>
<p>New here? <a href="{% url 'signup' %}">Create an account</a></p>
{% endblock %}
```

```django title="accounts/templates/accounts/dashboard.html"
{% extends "base.html" %}
{% block content %}
<h2>Welcome, {{ user.username }}!</h2>
<p>You joined on {{ user.date_joined|date:"d M Y" }}.</p>

<form method="post" action="{% url 'logout' %}">
  {% csrf_token %}
  <button type="submit">Log out</button>
</form>
{% endblock %}
```

> [!IMPORTANT] Log out with POST
> Since **Django 5.0**, the built-in `LogoutView` only accepts **POST**. A plain `<a href="/logout/">` link returns *405 Method Not Allowed*. Use a small form with `{% csrf_token %}` as above. This also stops other websites from logging your users out with a hidden link.

### Try it

1. Visit `/accounts/dashboard/` while logged out: you're redirected to `/accounts/login/?next=/accounts/dashboard/`.
2. Sign up at `/accounts/signup/`: you land on the dashboard, logged in.
3. Click **Log out**, then log in again.

## Protecting views

### Function-based views: @login_required

```python
from django.contrib.auth.decorators import login_required

@login_required
def profile(request): ...

@login_required(login_url="/accounts/login/")   # override LOGIN_URL for one view
def settings_page(request): ...
```

An anonymous visitor is redirected to `LOGIN_URL` with `?next=<the page they wanted>` so they come back after logging in.

### Class-based views: LoginRequiredMixin

```python
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import TemplateView


class DashboardView(LoginRequiredMixin, TemplateView):
    template_name = "accounts/dashboard.html"
```

### Protect the whole site: LoginRequiredMiddleware (Django 5.1+)

For apps where *everything* needs a login (an internal tool), add the middleware and mark the few public views:

```python title="settings.py"
MIDDLEWARE = [
    # ... after AuthenticationMiddleware:
    "django.contrib.auth.middleware.LoginRequiredMiddleware",
]
```

```python
from django.contrib.auth.decorators import login_not_required

@login_not_required
def signup_view(request): ...
```

Built-in views such as `LoginView` are already marked as public.

### Only some users

```python
from django.contrib.auth.decorators import user_passes_test

@user_passes_test(lambda u: u.is_staff)
def staff_report(request): ...
```

## The built-in authentication views

Instead of writing login and logout views, you can use Django's class-based ones:

```python title="accounts/urls.py"
from django.contrib.auth import views as auth_views
from django.urls import path
from . import views

urlpatterns = [
    path("signup/", views.signup_view, name="signup"),
    path("login/", auth_views.LoginView.as_view(template_name="accounts/login.html"), name="login"),
    path("logout/", auth_views.LogoutView.as_view(), name="logout"),
]
```

- `LoginView` uses `AuthenticationForm`, logs the user in, handles `?next=` **safely**, and redirects to `LOGIN_REDIRECT_URL`.
- `LogoutView` (POST only) logs out and redirects to `LOGOUT_REDIRECT_URL` (or `next_page=`).
- `LoginView(redirect_authenticated_user=True)` sends already-logged-in users away from the login page.

### All of them at once

```python title="mysite/urls.py"
path("accounts/", include("django.contrib.auth.urls")),
```

This single line provides:

| URL | Name | View |
|---|---|---|
| `accounts/login/` | `login` | `LoginView` |
| `accounts/logout/` | `logout` | `LogoutView` |
| `accounts/password_change/` | `password_change` | `PasswordChangeView` |
| `accounts/password_change/done/` | `password_change_done` | `PasswordChangeDoneView` |
| `accounts/password_reset/` | `password_reset` | `PasswordResetView` |
| `accounts/password_reset/done/` | `password_reset_done` | `PasswordResetDoneView` |
| `accounts/reset/<uidb64>/<token>/` | `password_reset_confirm` | `PasswordResetConfirmView` |
| `accounts/reset/done/` | `password_reset_complete` | `PasswordResetCompleteView` |

They look for templates in a `registration/` folder, e.g. `templates/registration/login.html`, `registration/password_reset_form.html`. Sign-up isn't included; you still write that view.

### Password reset by email

`PasswordResetView` emails a one-time link. In development, print emails to the terminal:

```python title="settings.py"
EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"
```

The link contains a token that expires (after `PASSWORD_RESET_TIMEOUT`, three days by default) and becomes invalid once the password changes.

## Password validation

`AUTH_PASSWORD_VALIDATORS` in settings enforces strength rules for `UserCreationForm`, `createsuperuser` and password changes:

```python
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 10}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]
```

## Extending the user with a profile

To store extra information (bio, avatar, phone), add a one-to-one `Profile`:

```python title="accounts/models.py"
from django.conf import settings
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
```

Create profiles automatically when users are created with a `post_save` signal (see [Middleware & Signals](/learn/middleware-and-signals#auto-creating-a-profile)).

## Summary

| Need | Use |
|---|---|
| Create a user safely | `User.objects.create_user()` or `UserCreationForm` |
| Change a password | `user.set_password()` then `save()` |
| Check credentials | `authenticate()` (returns User or None) |
| Start a session | `login(request, user)` |
| End a session | `logout(request)` (POST) |
| Current user | `request.user` / `{{ user }}` |
| Protect an FBV | `@login_required` |
| Protect a CBV | `LoginRequiredMixin` |
| Ready-made views | `LoginView`, `LogoutView`, `include("django.contrib.auth.urls")` |
| Redirect settings | `LOGIN_URL`, `LOGIN_REDIRECT_URL`, `LOGOUT_REDIRECT_URL` |

## Check yourself

<details>
<summary>What does <code>authenticate()</code> return if the password is wrong?</summary>

`None`. It also returns `None` for inactive users with the default backend.
</details>

<details>
<summary>What happens when an anonymous user opens a view protected by <code>@login_required</code>?</summary>

They're redirected to `LOGIN_URL` with `?next=<original path>`, so after logging in they can be sent back to the page they wanted.
</details>

<details>
<summary>Why does <code>user.password = "abc"</code> break login?</summary>

It stores the plain text where Django expects a hash, so `check_password()` can never match it. Use `set_password()` instead.
</details>

<details>
<summary>Why did a logout link that worked in old tutorials return 405 in your project?</summary>

From Django 5.0, `LogoutView` accepts only POST. Use a form with `method="post"` and `{% csrf_token %}`.
</details>
