Authentication answers *who are you?* **Authorization** answers *what are you allowed to do?* Django's auth system includes a flexible permission model with **users, groups and permissions**, and lets you replace the built-in `User` model with your own.

## Three levels of access

| Flag / mechanism | Effect |
|---|---|
| `is_active` | `False` = can't log in at all |
| `is_staff` | Can log into the admin site |
| `is_superuser` | Has every permission without them being assigned |
| **Permissions** | Fine-grained rights such as "can add post" |
| **Groups** | Named bundles of permissions ("Editors", "Moderators") |

## Default model permissions

For every model, `migrate` automatically creates four permissions:

| Codename | Meaning |
|---|---|
| `add_post` | Can add |
| `change_post` | Can change |
| `delete_post` | Can delete |
| `view_post` | Can view |

They're referred to as `"<app_label>.<codename>"`, e.g. `"blog.add_post"`.

## Checking permissions

```python
user.has_perm("blog.add_post")                              # True / False
user.has_perms(["blog.add_post", "blog.change_post"])      # all of them
user.has_module_perms("blog")                               # any permission in the app
user.get_all_permissions()                                  # a set of strings
```

Superusers always get `True`. Inactive users always get `False`.

### In views

```python
from django.contrib.auth.decorators import permission_required


@permission_required("blog.add_post", raise_exception=True)
def new_post(request):
    ...
```

`raise_exception=True` returns **403 Forbidden** instead of redirecting to the login page.

```python
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.views.generic import CreateView


class PostCreateView(PermissionRequiredMixin, CreateView):
    permission_required = "blog.add_post"     # or a tuple of several
    model = Post
    fields = ["title", "body"]
```

### In templates

The `perms` variable is available in every template:

```django
{% if perms.blog.add_post %}
  <a href="{% url 'post_create' %}">Write a post</a>
{% endif %}

{% if perms.blog %}
  You have some permission in the blog app.
{% endif %}
```

## Granting permissions

In the admin (*Users → a user → User permissions*), or in code:

```python
from django.contrib.auth.models import Permission

perm = Permission.objects.get(codename="add_post", content_type__app_label="blog")
user.user_permissions.add(perm)
user.user_permissions.remove(perm)
```

> [!NOTE] Permission caching
> Django caches a user's permissions on the user object after the first check. After changing them in code, re-fetch the user (`User.objects.get(pk=user.pk)`) to see the update.

## Groups

Assign permissions to a **group**, then put users in groups. It's far easier than managing permissions per person.

```python
from django.contrib.auth.models import Group, Permission

editors, created = Group.objects.get_or_create(name="Editors")
editors.permissions.add(
    Permission.objects.get(codename="add_post"),
    Permission.objects.get(codename="change_post"),
)

user.groups.add(editors)
user.groups.filter(name="Editors").exists()   # is the user an editor?
```

A user's effective permissions are their own plus all of their groups'.

Using groups as simple **roles**:

```python
from django.contrib.auth.decorators import user_passes_test


def is_editor(user):
    return user.is_authenticated and user.groups.filter(name="Editors").exists()


@user_passes_test(is_editor)
def editor_dashboard(request):
    ...
```

## Custom permissions

Add your own in a model's `Meta`:

```python
class Post(models.Model):
    title = models.CharField(max_length=200)
    is_published = models.BooleanField(default=False)

    class Meta:
        permissions = [
            ("publish_post", "Can publish posts"),
            ("feature_post", "Can feature posts on the home page"),
        ]
```

After `makemigrations` and `migrate`, check them like any other: `user.has_perm("blog.publish_post")`.

## Object-level rules ("only the author can edit")

Django's built-in permissions are **per model**, not per object: `change_post` means "can change posts", not "can change *this* post". For ownership rules, check in the view:

```python
from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404


@login_required
def edit_post(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if post.author != request.user and not request.user.has_perm("blog.change_post"):
        raise PermissionDenied          # 403
    ...
```

Or simply include the owner in the lookup, so other people's objects return 404:

```python
post = get_object_or_404(Post, pk=pk, author=request.user)
```

For CBVs, use `UserPassesTestMixin` with `test_func()` (see [Class-Based Views](/learn/class-based-views#mixins)). Packages such as `django-guardian` add true per-object permissions if you need them.

## A custom user model

The default `User` uses a username to log in and has a fixed set of fields. Many apps want **email login** or extra fields. Django lets you swap in your own user model, and recommends doing it **at the very start** of every new project, even if it's identical to the default for now.

> [!WARNING] Do it before the first migrate
> Changing `AUTH_USER_MODEL` after tables exist is difficult, because foreign keys everywhere point at the old user table. Set it up before running `migrate` for the first time.

### Option 1: AbstractUser (keep everything, add fields)

```python title="accounts/models.py"
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        STUDENT = "student", "Student"
        TEACHER = "teacher", "Teacher"
        ADMIN = "admin", "Admin"

    phone = models.CharField(max_length=15, blank=True)
    role = models.CharField(max_length=10, choices=Role, default=Role.STUDENT)
```

```python title="settings.py"
AUTH_USER_MODEL = "accounts.User"
```

```python title="accounts/admin.py"
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (("Extra", {"fields": ("phone", "role")}),)
    list_display = ("username", "email", "role", "is_staff")
```

### Option 2: log in with email instead of username

```python title="accounts/models.py"
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError("Email is required")
        user = self.model(email=self.normalize_email(email), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    username = None                         # remove the username field
    email = models.EmailField(unique=True)

    USERNAME_FIELD = "email"                # log in with email
    REQUIRED_FIELDS = []                    # asked by createsuperuser besides email/password

    objects = UserManager()
```

`AbstractBaseUser` (with `PermissionsMixin`) gives total control but you write more yourself. `AbstractUser` is the right choice for most projects.

### Referring to the user model

| Where | Use |
|---|---|
| Model fields (`ForeignKey`, `OneToOneField`) | `settings.AUTH_USER_MODEL` |
| Everywhere else (views, forms, scripts) | `from django.contrib.auth import get_user_model` then `User = get_user_model()` |

```python
from django.contrib.auth import get_user_model

User = get_user_model()
User.objects.filter(role="teacher")
```

And when extending `UserCreationForm` with a custom model, set `model = get_user_model()` in its `Meta`.

## Summary

| Task | How |
|---|---|
| Check a permission | `user.has_perm("app.codename")` |
| Require one (FBV / CBV) | `@permission_required` / `PermissionRequiredMixin` |
| In templates | `{% if perms.app.codename %}` |
| Bundle permissions | `Group` + `user.groups.add()` |
| Custom permission | `Meta.permissions` |
| Ownership checks | Compare `obj.owner` with `request.user`, or filter by owner |
| Custom user | Subclass `AbstractUser`, set `AUTH_USER_MODEL` early |
| Reference the user | `settings.AUTH_USER_MODEL` in models, `get_user_model()` elsewhere |

## Check yourself

<details>
<summary>Which four permissions does Django create for every model?</summary>

`add_<model>`, `change_<model>`, `delete_<model>` and `view_<model>`.
</details>

<details>
<summary>Does having <code>blog.change_post</code> mean a user can edit only their own posts?</summary>

No. Model permissions apply to all objects of that model. Ownership rules must be checked separately (e.g. compare `post.author` to `request.user`).
</details>

<details>
<summary>When should you set up a custom user model?</summary>

At the start of the project, before the first `migrate`, because changing it later is difficult.
</details>
