Everything from this handbook on one page: commands, code patterns and the facts people most often need to look up. Each section links to the chapter with the full explanation.

## Project setup

```bash
python -m venv venv
venv\Scripts\activate                 # Windows
source venv/bin/activate              # macOS / Linux
pip install django
python -m django --version
django-admin startproject mysite .    # "." = no extra outer folder
python manage.py startapp blog
pip freeze > requirements.txt
pip install -r requirements.txt
```

After `startapp`: add `"blog"` to `INSTALLED_APPS`. [Setup](/learn/setup) · [First project](/learn/first-project)

## The 14 steps

| # | Step | Command / file |
|---|---|---|
| 1 | Install Django | `pip install django` |
| 2 | Create project | `django-admin startproject name` |
| 3 | Create app | `python manage.py startapp app` |
| 4 | Register app | `INSTALLED_APPS` in `settings.py` |
| 5 | Model | `models.py` |
| 6 | Make migrations | `python manage.py makemigrations` |
| 7 | Migrate | `python manage.py migrate` |
| 8 | Admin | `admin.site.register(Model)` in `admin.py` |
| 9 | Superuser | `python manage.py createsuperuser` |
| 10 | Templates | `app/templates/app/*.html` |
| 11 | Views | `views.py` |
| 12 | App URLs | `app/urls.py` (create it) |
| 13 | Project URLs | `path("", include("app.urls"))` |
| 14 | Run | `python manage.py runserver` |

## manage.py commands

| Command | Purpose |
|---|---|
| `runserver [port]` | Development server |
| `startapp name` | New app |
| `makemigrations [app]` | Create migration files |
| `migrate [app] [number\|zero]` | Apply / roll back migrations |
| `showmigrations` | List migrations |
| `sqlmigrate app 0001` | Show SQL for a migration |
| `createsuperuser` | Admin account |
| `changepassword user` | Reset a password |
| `shell` / `dbshell` | Python shell / database shell |
| `check [--deploy]` | System checks / production checklist |
| `test [app]` | Run tests |
| `collectstatic` | Gather static files |
| `dumpdata` / `loaddata` | Export / import data |
| `flush` | Delete all data |
| `clearsessions` | Remove expired sessions |

## Models

```python
from django.conf import settings
from django.db import models


class Post(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "pub", "Published"

    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts")
    category = models.ForeignKey("Category", on_delete=models.SET_NULL, null=True, blank=True)
    tags = models.ManyToManyField("Tag", blank=True)
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    body = models.TextField(blank=True)
    status = models.CharField(max_length=5, choices=Status, default=Status.DRAFT)
    views = models.PositiveIntegerField(default=0)
    price = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
```

| Option | Meaning |
|---|---|
| `null=True` | DB may store NULL |
| `blank=True` | Form may be empty |
| `default=` | Default value |
| `unique=True` | No duplicates |
| `choices=` | Fixed values; `get_FOO_display()` |
| `on_delete=` | `CASCADE`, `PROTECT`, `SET_NULL`, `SET_DEFAULT`, `RESTRICT`, `DO_NOTHING` |

[Models](/learn/models) · [Relationships](/learn/relationships)

## ORM

```python
Post.objects.all()
Post.objects.get(pk=1)                              # DoesNotExist / MultipleObjectsReturned
Post.objects.filter(status="pub").exclude(views=0)
Post.objects.filter(title__icontains="django", views__gte=100)
Post.objects.filter(author__username="asha")        # across relationships
Post.objects.order_by("-created_at")[:10]
Post.objects.first() / .last() / .count() / .exists()
Post.objects.values("title") / .values_list("title", flat=True)
Post.objects.create(title="Hi", author=user, slug="hi")
Post.objects.get_or_create(slug="hi", defaults={...})
Post.objects.filter(status="draft").update(status="pub")
Post.objects.filter(views=0).delete()
Post.objects.filter(Q(title__icontains="a") | Q(body__icontains="a"))
Post.objects.update(views=F("views") + 1)
Post.objects.aggregate(total=Sum("views"), avg=Avg("views"))
Category.objects.annotate(n=Count("post"))
Post.objects.select_related("author").prefetch_related("tags")
```

| Lookup | Meaning |
|---|---|
| `exact`, `iexact` | Equals (case-insensitive) |
| `contains`, `icontains` | Contains |
| `startswith`, `endswith` | Starts / ends with |
| `gt`, `gte`, `lt`, `lte` | Comparisons |
| `in`, `range`, `isnull` | In a list, between, is NULL |
| `year`, `month`, `day`, `date` | Date parts |

[The ORM](/learn/orm)

## URLs

```python
from django.urls import include, path

app_name = "blog"                                   # namespace
urlpatterns = [
    path("", views.post_list, name="list"),
    path("<int:pk>/", views.post_detail, name="detail"),
    path("<slug:slug>/", views.post_by_slug, name="by_slug"),
    path("new/", views.PostCreateView.as_view(), name="create"),
]
# project urls.py:  path("blog/", include("blog.urls")),
```

Converters: `str`, `int`, `slug`, `uuid`, `path`. Reverse: `{% url 'blog:detail' pk=1 %}`, `reverse("blog:detail", kwargs={"pk": 1})`, `redirect("blog:list")`. [URLs](/learn/urls)

## Views

```python
from django.shortcuts import get_object_or_404, redirect, render


def post_edit(request, pk):
    post = get_object_or_404(Post, pk=pk)
    form = PostForm(request.POST or None, instance=post)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Saved.")
        return redirect("blog:detail", pk=post.pk)
    return render(request, "blog/post_form.html", {"form": form})
```

| Request attribute | Holds |
|---|---|
| `request.method` | `"GET"`, `"POST"`... |
| `request.GET` / `request.POST` / `request.FILES` | Query string / form data / uploads |
| `request.user` | Logged-in user or `AnonymousUser` |
| `request.session` / `request.COOKIES` | Session / cookies |

[Views](/learn/views) · [Class-based views](/learn/class-based-views)

## Class-based views

```python
class PostList(ListView):            model = Post; paginate_by = 10
class PostDetail(DetailView):        model = Post
class PostCreate(LoginRequiredMixin, CreateView):
    model = Post; fields = ["title", "body"]; success_url = reverse_lazy("blog:list")
    def form_valid(self, form):
        form.instance.author = self.request.user
        return super().form_valid(form)
class PostUpdate(UpdateView):        model = Post; fields = ["title", "body"]
class PostDelete(DeleteView):        model = Post; success_url = reverse_lazy("blog:list")
```

Default templates: `app/model_list.html`, `model_detail.html`, `model_form.html`, `model_confirm_delete.html`.

## Templates

```django
{% extends "base.html" %}
{% load static %}
{% block content %}
  {{ post.title|upper }} · {{ post.created_at|date:"d M Y" }} · {{ post.body|truncatewords:30 }}
  {% if user.is_authenticated %}...{% else %}...{% endif %}
  {% for p in posts %}{{ forloop.counter }}. {{ p }}{% empty %}None{% endfor %}
  <a href="{% url 'blog:detail' post.pk %}">Read</a>
  <img src="{% static 'img/logo.png' %}">
  {% include "blog/_card.html" with post=p %}
  <form method="post">{% csrf_token %}{{ form.as_p }}<button>Save</button></form>
{% endblock %}
```

[Templates](/learn/templates)

## Forms

```python
class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ["title", "body", "status"]

    def clean_title(self):                 # one field: return the value
        title = self.cleaned_data["title"]
        if len(title) < 5:
            raise forms.ValidationError("Too short")
        return title

    def clean(self):                       # several fields
        data = super().clean()
        return data
```

`form = PostForm(request.POST, request.FILES, instance=obj)` → `form.is_valid()` → `form.cleaned_data` / `form.errors` → `form.save(commit=False)`. [Forms](/learn/forms)

## Authentication

```python
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, permission_required
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.mixins import LoginRequiredMixin

User.objects.create_user(username, email, password)   # hashes the password
user.set_password("new"); user.save()
user = authenticate(request, username=u, password=p)  # User or None
login(request, user)                                  # start session
logout(request)                                       # end session (POST in Django 5+)
```

```python
# settings.py
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "home"
LOGOUT_REDIRECT_URL = "login"
# urls.py
path("accounts/", include("django.contrib.auth.urls")),   # login, logout, password change/reset
```

[Authentication](/learn/authentication) · [Permissions](/learn/permissions)

## Admin

```python
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "status", "created_at")
    list_filter = ("status", "created_at")
    search_fields = ("title", "body")
    prepopulated_fields = {"slug": ("title",)}
    list_editable = ("status",)
```

[Admin](/learn/admin)

## Django REST Framework

```bash
pip install djangorestframework djangorestframework-simplejwt django-filter django-cors-headers
```

```python
# serializers.py
class PostSerializer(serializers.ModelSerializer):
    author = serializers.ReadOnlyField(source="author.username")

    class Meta:
        model = Post
        fields = ["id", "title", "body", "author", "created_at"]
        read_only_fields = ["created_at"]

    def validate_title(self, value):
        if len(value) < 5:
            raise serializers.ValidationError("Too short")
        return value

# views.py
class PostViewSet(viewsets.ModelViewSet):
    serializer_class = PostSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    search_fields = ["title"]
    ordering_fields = ["created_at"]

    def get_queryset(self):
        return Post.objects.select_related("author")

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

# urls.py
router = DefaultRouter()
router.register("posts", PostViewSet, basename="post")
urlpatterns = [path("api/v1/", include(router.urls))]
```

| Serializer call | Result |
|---|---|
| `S(obj).data` / `S(qs, many=True).data` | Output |
| `S(data=d)` → `.is_valid()` → `.validated_data` / `.errors` | Input |
| `.save()` without instance | `create()` |
| `S(obj, data=d, partial=True).save()` | `update()` (PATCH) |

| ViewSet action | Method & URL | Status |
|---|---|---|
| `list` | GET `/posts/` | 200 |
| `create` | POST `/posts/` | 201 |
| `retrieve` | GET `/posts/{id}/` | 200 |
| `update` | PUT `/posts/{id}/` | 200 |
| `partial_update` | PATCH `/posts/{id}/` | 200 |
| `destroy` | DELETE `/posts/{id}/` | 204 |

[Serializers](/learn/serializers) · [ViewSets & Routers](/learn/viewsets-routers) · [API views](/learn/api-views)

## JWT (SimpleJWT)

```python
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
}
SIMPLE_JWT = {"ACCESS_TOKEN_LIFETIME": timedelta(minutes=15), "REFRESH_TOKEN_LIFETIME": timedelta(days=7)}

path("api/token/", TokenObtainPairView.as_view()),           # {username, password} -> {access, refresh}
path("api/token/refresh/", TokenRefreshView.as_view()),      # {refresh} -> {access}
```

Header: `Authorization: Bearer <access>` · Structure: `header.payload.signature` · Default lifetimes: access 5 min, refresh 1 day. [JWT](/learn/jwt)

## DRF permissions

| Class | Allows |
|---|---|
| `AllowAny` | Everyone (DRF default) |
| `IsAuthenticated` | Logged-in users |
| `IsAdminUser` | `is_staff` users |
| `IsAuthenticatedOrReadOnly` | Read for all, write for logged-in |
| `DjangoModelPermissions` | Django's add/change/delete permissions |

```python
class IsOwnerOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        return request.method in SAFE_METHODS or obj.owner == request.user
```

`has_permission` → whole view; `has_object_permission` → one object (not called for `list`). [Permissions & roles](/learn/api-permissions)

## Filtering, pagination, throttling

```python
REST_FRAMEWORK = {
    "DEFAULT_FILTER_BACKENDS": ["django_filters.rest_framework.DjangoFilterBackend",
                                "rest_framework.filters.SearchFilter",
                                "rest_framework.filters.OrderingFilter"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_THROTTLE_CLASSES": ["rest_framework.throttling.AnonRateThrottle",
                                 "rest_framework.throttling.UserRateThrottle"],
    "DEFAULT_THROTTLE_RATES": {"anon": "100/hour", "user": "1000/day"},
}
```

`?country=India` · `?search=sharma` · `?ordering=-runs` · `?page=2` · 429 when throttled. [Filtering & pagination](/learn/filtering-pagination)

## HTTP status codes

| Code | Meaning | Code | Meaning |
|---|---|---|---|
| 200 | OK | 400 | Bad Request (validation) |
| 201 | Created | 401 | Unauthorized (not logged in) |
| 204 | No Content (deleted) | 403 | Forbidden (not allowed / CSRF) |
| 301/302 | Redirect | 404 | Not Found |
| 405 | Method Not Allowed | 429 | Too Many Requests |
| 500 | Server Error | 415 | Unsupported Media Type |

## sqlite3 module

```python
import sqlite3
conn = sqlite3.connect("db.sqlite3")
cur = conn.cursor()
cur.execute("SELECT * FROM t WHERE id = ?", (1,))
cur.executemany("INSERT INTO t (name) VALUES (?)", [("a",), ("b",)])
cur.executescript("CREATE TABLE x (id INTEGER); INSERT INTO x VALUES (1);")
cur.fetchone(); cur.fetchmany(5); cur.fetchall()
conn.commit(); conn.rollback(); conn.total_changes; conn.close()
```

[sqlite3](/learn/sqlite3)

## Security essentials

| Rule | How |
|---|---|
| CSRF | `{% csrf_token %}` in every POST form |
| XSS | Don't use `\|safe` on user input |
| SQL injection | ORM or parameterised SQL (`%s` / `?`) |
| Secrets | `SECRET_KEY` from environment |
| Production | `DEBUG = False`, `ALLOWED_HOSTS`, HTTPS, `check --deploy` |

[Security](/learn/security) · [Deployment](/learn/deployment)
