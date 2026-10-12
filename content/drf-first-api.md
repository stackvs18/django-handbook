Let's build a working API from scratch. By the end of this chapter you'll have endpoints to list, create, read, update and delete players, all returning JSON, written with DRF's simplest tool: **function-based API views** with the `@api_view` decorator. Later chapters will shrink this code dramatically, but writing it this way first shows you exactly what DRF does.

## 1. Install

```bash
pip install django djangorestframework
pip freeze > requirements.txt
django-admin startproject playerapi .
python manage.py startapp players
```

```python title="playerapi/settings.py"
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",     # Django REST Framework
    "players",            # our app
]
```

## 2. The model

```python title="players/models.py"
from django.db import models


class Player(models.Model):
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=50)
    test_innings = models.PositiveIntegerField(default=0)
    runs = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-runs"]

    def __str__(self):
        return self.name
```

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser
```

## 3. A serializer

A serializer describes how a `Player` becomes JSON and how incoming JSON is validated. The next chapter covers them in depth; for now, a `ModelSerializer` builds everything from the model:

```python title="players/serializers.py"
from rest_framework import serializers
from .models import Player


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["id", "name", "country", "test_innings", "runs", "created_at"]
        read_only_fields = ["created_at"]
```

Try it in `python manage.py shell`:

```python
>>> from players.models import Player
>>> from players.serializers import PlayerSerializer
>>> p = Player.objects.create(name="Virat Kohli", country="India", test_innings=191, runs=8848)
>>> PlayerSerializer(p).data
{'id': 1, 'name': 'Virat Kohli', 'country': 'India', 'test_innings': 191, 'runs': 8848, 'created_at': '2025-06-01T10:12:03.511Z'}
```

## 4. API views with @api_view

```python title="players/views.py"
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Player
from .serializers import PlayerSerializer


@api_view(["GET", "POST"])
def player_list(request):
    if request.method == "GET":
        players = Player.objects.all()
        serializer = PlayerSerializer(players, many=True)      # many=True for a list
        return Response(serializer.data)

    # POST: create
    serializer = PlayerSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET", "PUT", "PATCH", "DELETE"])
def player_detail(request, pk):
    player = get_object_or_404(Player, pk=pk)

    if request.method == "GET":
        return Response(PlayerSerializer(player).data)

    if request.method in ("PUT", "PATCH"):
        serializer = PlayerSerializer(
            player,
            data=request.data,
            partial=request.method == "PATCH",    # PATCH: only the fields sent
        )
        serializer.is_valid(raise_exception=True)  # invalid -> automatic 400 response
        serializer.save()
        return Response(serializer.data)

    # DELETE
    player.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)
```

What `@api_view` gives you:

- Only the listed methods are allowed; anything else gets **405** automatically.
- `request` becomes a DRF **`Request`**, with `request.data` already parsed from JSON or form data.
- You return a DRF **`Response`** with plain Python data; DRF renders it as JSON (or as the browsable HTML page).
- Authentication, permissions and throttling settings are applied.
- Exceptions like `Http404` and validation errors become proper JSON error responses.

## 5. URLs

```python title="players/urls.py"
from django.urls import path
from . import views

urlpatterns = [
    path("players/", views.player_list, name="player-list"),
    path("players/<int:pk>/", views.player_detail, name="player-detail"),
]
```

```python title="playerapi/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("players.urls")),
    path("api-auth/", include("rest_framework.urls")),   # login/logout links for the browsable API
]
```

## 6. Run it and explore the browsable API

```bash
python manage.py runserver
```

Open **http://127.0.0.1:8000/api/players/** in your browser. Instead of raw JSON you get DRF's **browsable API**: a readable page showing the response, the allowed methods, and a form at the bottom to POST new data. Add a player there and watch the `201 Created` response.

Open **/api/players/1/** to see the detail endpoint with forms for PUT, PATCH and DELETE.

> [!TIP]
> The browsable API appears when the client asks for HTML (a browser). Programs asking for JSON get JSON. Add `?format=json` to the URL to see the raw JSON in your browser.

## 7. Test from the command line

With **curl** (built into Windows 10+, macOS and Linux):

```bash
# list
curl http://127.0.0.1:8000/api/players/

# create
curl -X POST http://127.0.0.1:8000/api/players/ -H "Content-Type: application/json" -d "{\"name\": \"Rohit Sharma\", \"country\": \"India\", \"test_innings\": 116, \"runs\": 4301}"

# partial update
curl -X PATCH http://127.0.0.1:8000/api/players/2/ -H "Content-Type: application/json" -d "{\"runs\": 4400}"

# delete
curl -X DELETE http://127.0.0.1:8000/api/players/2/
```

A validation error looks like this:

```bash
curl -X POST http://127.0.0.1:8000/api/players/ -H "Content-Type: application/json" -d "{\"runs\": -5}"
```

```json
{
  "name": ["This field is required."],
  "country": ["This field is required."],
  "runs": ["Ensure this value is greater than or equal to 0."]
}
```

DRF built those messages from the model: required fields and the `PositiveIntegerField` minimum. For a friendlier tool, use Postman ([Testing APIs with Postman](/learn/postman)).

> [!NOTE] Why no CSRF error?
> DRF views are CSRF-exempt unless you're authenticated with **session** authentication. Here no one is logged in, so curl works. If you log in through the browsable API, your browser session is used and DRF enforces CSRF for it, which the browsable API's forms handle for you.

## The DRF Request object

| Attribute | Contents |
|---|---|
| `request.data` | Parsed body for POST/PUT/PATCH: JSON, form data or files |
| `request.query_params` | Query string (same as Django's `request.GET`, better name) |
| `request.user` | The authenticated user (or `AnonymousUser`) |
| `request.auth` | Extra auth info, e.g. the token object |
| `request.method` | `"GET"`, `"POST"`... |

## The Response object and status codes

```python
from rest_framework import status
from rest_framework.response import Response

return Response({"detail": "Created"}, status=status.HTTP_201_CREATED)
return Response(status=status.HTTP_204_NO_CONTENT)
return Response({"error": "Not allowed"}, status=status.HTTP_403_FORBIDDEN)
```

The `status` module has readable names for every code: `HTTP_200_OK`, `HTTP_201_CREATED`, `HTTP_204_NO_CONTENT`, `HTTP_400_BAD_REQUEST`, `HTTP_401_UNAUTHORIZED`, `HTTP_403_FORBIDDEN`, `HTTP_404_NOT_FOUND`...

## Global settings

All of DRF's configuration lives in one dictionary in `settings.py`. You'll fill it in over the coming chapters:

```python title="playerapi/settings.py"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.AllowAny",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",   # remove to disable the HTML UI
    ],
}
```

Those are DRF's defaults. Notice that by default **anyone may do anything** (`AllowAny`). We'll lock that down in [Permissions & Role-Based APIs](/learn/api-permissions).

## What's next

You just wrote about 40 lines of view code for one model. Next you'll learn:

1. [Serializers](/learn/serializers): custom fields, validation, nested data.
2. [APIView & Generic Views](/learn/api-views): the same endpoints in 10 lines.
3. [ViewSets & Routers](/learn/viewsets-routers): in 4 lines, with URLs generated for you.

## Check yourself

<details>
<summary>Why do you pass <code>many=True</code> to the serializer in the list view?</summary>

Because you're serializing a queryset (many objects), not a single instance. The result is a list of dictionaries.
</details>

<details>
<summary>What does <code>serializer.is_valid(raise_exception=True)</code> do on invalid data?</summary>

It raises a `ValidationError`, which DRF turns into a `400 Bad Request` response containing `serializer.errors`. No manual `if` needed.
</details>

<details>
<summary>What's the difference between <code>request.data</code> and <code>request.query_params</code>?</summary>

`request.data` is the parsed request body (JSON/form data sent with POST, PUT, PATCH). `request.query_params` is the URL query string, like `?search=virat`.
</details>
