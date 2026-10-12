Websites need more than HTML: stylesheets, JavaScript, logos, and files that users upload such as profile pictures. Django separates these into two kinds:

| | Static files | Media files |
|---|---|---|
| What | Files **you** ship with the code: CSS, JS, icons, fonts | Files **users** upload: avatars, documents, product photos |
| Change when? | When you deploy new code | Any time, at runtime |
| Settings | `STATIC_URL`, `STATICFILES_DIRS`, `STATIC_ROOT` | `MEDIA_URL`, `MEDIA_ROOT` |
| In Git? | Yes | No |

## Static files

### Where to put them

Like templates, each app can have its own `static/` folder, namespaced by app name:

```text
blog/
└── static/
    └── blog/
        ├── css/blog.css
        └── js/blog.js
```

Site-wide assets can live in a project-level folder that you register:

```python title="settings.py"
STATIC_URL = "static/"
STATICFILES_DIRS = [BASE_DIR / "static"]
```

```text
mysite/
├── static/
│   ├── css/site.css
│   └── img/logo.png
└── manage.py
```

`django.contrib.staticfiles` must be in `INSTALLED_APPS` (it is by default).

### Using them in templates

```django
{% load static %}
<link rel="stylesheet" href="{% static 'css/site.css' %}">
<script src="{% static 'blog/js/blog.js' %}" defer></script>
<img src="{% static 'img/logo.png' %}" alt="Logo">
```

`{% load static %}` must appear in every template that uses `{% static %}`, including child templates, because loads are not inherited.

During development (`DEBUG = True`), `runserver` serves static files automatically.

### In production: collectstatic

On a real server, Django itself shouldn't serve static files; a web server or CDN does it much faster. Before deploying you gather all static files from every app into one folder:

```python title="settings.py"
STATIC_ROOT = BASE_DIR / "staticfiles"
```

```bash
python manage.py collectstatic
```

The simplest way to serve them is **WhiteNoise**, which lets your Django app serve its own static files efficiently:

```bash
pip install whitenoise
```

```python title="settings.py"
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",   # right after SecurityMiddleware
    # ...
]

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
```

> [!NOTE] STATICFILES_DIRS vs STATIC_ROOT
> `STATICFILES_DIRS` = extra folders Django *reads from*. `STATIC_ROOT` = the single folder `collectstatic` *writes to*. They must never be the same folder.

## Media files (user uploads)

### Settings

```python title="settings.py"
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
```

### Model fields for files

```python title="profiles/models.py"
from django.conf import settings
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    avatar = models.ImageField(upload_to="avatars/", blank=True)
    resume = models.FileField(upload_to="resumes/%Y/%m/", blank=True)
```

- `FileField` stores any file. `ImageField` additionally checks that it's a valid image and requires the **Pillow** package: `pip install pillow`.
- `upload_to` is the sub-folder inside `MEDIA_ROOT`. `%Y/%m/` are replaced with the year and month.
- The database stores only the **path** (e.g. `avatars/me.jpg`); the file itself lives on disk (or in cloud storage).

`upload_to` can also be a function for full control:

```python
def avatar_path(instance, filename):
    return f"avatars/user_{instance.user_id}/{filename}"

avatar = models.ImageField(upload_to=avatar_path, blank=True)
```

### Serving media in development

```python title="mysite/urls.py"
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # ... your patterns ...
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
```

### An upload form

The form **must** use `method="post"` and `enctype="multipart/form-data"`, otherwise the file is never sent:

```django title="profiles/templates/profiles/edit.html"
<form method="post" enctype="multipart/form-data">
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Save</button>
</form>
```

```python title="profiles/forms.py"
from django import forms
from .models import Profile


class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ["avatar", "resume"]
```

In the view, pass **both** `request.POST` and `request.FILES`:

```python title="profiles/views.py"
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from .forms import ProfileForm


@login_required
def edit_profile(request):
    profile = request.user.profile
    if request.method == "POST":
        form = ProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            return redirect("profile")
    else:
        form = ProfileForm(instance=profile)
    return render(request, "profiles/edit.html", {"form": form})
```

### Displaying uploaded files

```django
{% if profile.avatar %}
  <img src="{{ profile.avatar.url }}" alt="Avatar" width="120">
{% endif %}
<a href="{{ profile.resume.url }}">Download résumé</a>
```

| Attribute | Value |
|---|---|
| `.url` | Public URL, e.g. `/media/avatars/me.jpg` |
| `.path` | Absolute path on disk |
| `.name` | Path relative to `MEDIA_ROOT` |
| `.size` | Size in bytes |

> [!WARNING] Uploaded files are untrusted
> Validate type and size (see [Forms](/learn/forms)), never execute uploaded files, and in production store them on a dedicated service such as Amazon S3 or Cloudflare R2 (via the `django-storages` package) rather than on the app server's disk.

### Validating size and type

```python
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator


def max_2mb(file):
    if file.size > 2 * 1024 * 1024:
        raise ValidationError("File must be under 2 MB.")


resume = models.FileField(
    upload_to="resumes/",
    validators=[FileExtensionValidator(["pdf"]), max_2mb],
)
```

## Summary

| Task | How |
|---|---|
| Ship CSS/JS/images | `app/static/app/...` or `STATICFILES_DIRS` |
| Link them | `{% load static %}` + `{% static 'path' %}` |
| Prepare for production | `STATIC_ROOT` + `collectstatic` + WhiteNoise |
| Accept uploads | `FileField` / `ImageField` + `MEDIA_ROOT` / `MEDIA_URL` |
| Upload form | `enctype="multipart/form-data"` + `request.FILES` |
| Show an upload | `{{ obj.field.url }}` |

## Check yourself

<details>
<summary>What two things must an HTML form have for file uploads to work?</summary>

`method="post"` and `enctype="multipart/form-data"`. The view must also pass `request.FILES` to the form.
</details>

<details>
<summary>What does <code>collectstatic</code> do?</summary>

It copies static files from every app and from `STATICFILES_DIRS` into the single `STATIC_ROOT` folder, ready to be served in production.
</details>

<details>
<summary>Does an <code>ImageField</code> store the image inside the database?</summary>

No. It stores the file's path as text. The file itself is saved to `MEDIA_ROOT` (or a configured storage backend).
</details>
