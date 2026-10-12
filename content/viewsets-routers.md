A list endpoint and a detail endpoint for the same model share almost everything: the queryset, the serializer, the permissions. A **ViewSet** puts all the actions for one resource into a **single class**, and a **Router** generates every URL for it automatically. Together they're the fastest way to build a CRUD API.

> [!EXAM] The big idea
> **ViewSet** = one class that handles list, create, retrieve, update, partial_update and destroy. **Router** = generates the URL patterns for a ViewSet with one `register()` call. You no longer write a separate view or `path()` for each action.

## ModelViewSet: full CRUD in one class

```python title="players/views.py"
from rest_framework import permissions, viewsets

from .models import Player
from .serializers import PlayerSerializer


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticated]
```

```python title="playerapi/urls.py"
from django.contrib import admin
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from players.views import PlayerViewSet

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
    path("api-auth/", include("rest_framework.urls")),   # login link in the browsable API
]
```

That's the whole API. The router generated these routes:

| HTTP method | URL | ViewSet action | URL name | Success |
|---|---|---|---|---|
| GET | `/api/players/` | `list()` | `player-list` | 200 |
| POST | `/api/players/` | `create()` | `player-list` | 201 |
| GET | `/api/players/{pk}/` | `retrieve()` | `player-detail` | 200 |
| PUT | `/api/players/{pk}/` | `update()` | `player-detail` | 200 |
| PATCH | `/api/players/{pk}/` | `partial_update()` | `player-detail` | 200 |
| DELETE | `/api/players/{pk}/` | `destroy()` | `player-detail` | 204 |

Plus, with `DefaultRouter`, an **API root** at `/api/` listing every registered endpoint.

> [!NOTE] Actions, not methods
> Unlike `APIView`, a ViewSet's methods are named after **actions** (`list`, `retrieve`, `create`...), not HTTP verbs. The router decides which action a request maps to based on the URL and the method.

## The ViewSet family

| Class | Actions included | Use for |
|---|---|---|
| `ViewSet` | None. You write `list()`, `retrieve()`... yourself | Custom logic with router convenience |
| `GenericViewSet` | None, but has `get_queryset()`, `get_object()`, `get_serializer()` | Pick-and-mix with mixins |
| `ReadOnlyModelViewSet` | `list`, `retrieve` | Public, read-only data |
| `ModelViewSet` | All six | Full CRUD |

### ReadOnlyModelViewSet

```python
class TeamViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Team.objects.all()
    serializer_class = TeamSerializer
```

POST, PUT, PATCH and DELETE return **405 Method Not Allowed**.

### Pick only the actions you want

```python
from rest_framework import mixins, viewsets


class CommentViewSet(mixins.ListModelMixin,
                     mixins.CreateModelMixin,
                     mixins.RetrieveModelMixin,
                     viewsets.GenericViewSet):
    """List, create and read comments, but never edit or delete them."""
    queryset = Comment.objects.all()
    serializer_class = CommentSerializer
```

### A plain ViewSet

```python
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.response import Response


class PlayerViewSet(viewsets.ViewSet):
    def list(self, request):
        serializer = PlayerSerializer(Player.objects.all(), many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk=None):
        player = get_object_or_404(Player, pk=pk)
        return Response(PlayerSerializer(player).data)
```

A plain `ViewSet` has no `queryset`, so you must pass `basename` when registering it.

## Customising a ModelViewSet

The same hooks as generic views work here.

```python title="players/views.py"
from rest_framework import permissions, viewsets

from .models import Player
from .serializers import PlayerSerializer


class PlayerViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Each user only sees and edits their own players
        return Player.objects.filter(owner=self.request.user).select_related("team")

    def perform_create(self, serializer):
        # Attach the logged-in user automatically
        serializer.save(owner=self.request.user)
```

| Hook | Called when | Typical use |
|---|---|---|
| `get_queryset()` | Every action | Filter by user, add `select_related` |
| `get_serializer_class()` | Every action | Different serializer for list vs detail |
| `get_permissions()` | Every action | Different permissions per action |
| `perform_create(serializer)` | `create` | `serializer.save(owner=...)` |
| `perform_update(serializer)` | `update`, `partial_update` | Record who edited |
| `perform_destroy(instance)` | `destroy` | Soft delete instead of real delete |

Inside a ViewSet, `self.action` tells you which action is running:

```python
def get_serializer_class(self):
    if self.action == "list":
        return PlayerSummarySerializer      # fewer fields for lists
    return PlayerSerializer

def get_permissions(self):
    if self.action in ("list", "retrieve"):
        return [permissions.AllowAny()]
    return [permissions.IsAdminUser()]
```

Soft delete example:

```python
def perform_destroy(self, instance):
    instance.is_active = False
    instance.save(update_fields=["is_active"])
```

## Extra actions with @action

Need an endpoint beyond CRUD, like "the top 10 players" or "retire this player"? Add it to the ViewSet with `@action` and the router creates the URL:

```python
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer

    @action(detail=False, methods=["get"])
    def top(self, request):
        """GET /api/players/top/"""
        best = self.get_queryset().order_by("-runs")[:10]
        return Response(self.get_serializer(best, many=True).data)

    @action(detail=True, methods=["post"], url_path="add-runs")
    def add_runs(self, request, pk=None):
        """POST /api/players/{pk}/add-runs/  with {"runs": 120}"""
        player = self.get_object()
        try:
            runs = int(request.data.get("runs", 0))
        except (TypeError, ValueError):
            return Response({"runs": ["Must be a number."]}, status=status.HTTP_400_BAD_REQUEST)
        player.runs += runs
        player.test_innings += 1
        player.save()
        return Response(self.get_serializer(player).data)
```

| `@action` argument | Meaning |
|---|---|
| `detail=False` | Works on the collection: `/players/top/` |
| `detail=True` | Works on one object: `/players/{pk}/add-runs/` |
| `methods=[...]` | Allowed HTTP methods (default GET) |
| `url_path` | Custom URL segment (default: the method name) |
| `permission_classes`, `serializer_class` | Override for this action only |

## Routers

### Registering

```python
router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")
router.register("teams", TeamViewSet)            # basename taken from queryset: "team"
```

`register(prefix, viewset, basename=None)`:

- **prefix**: the URL segment (`players` → `/players/`)
- **viewset**: the class
- **basename**: used to name URLs (`player-list`, `player-detail`). Required if the ViewSet has no `queryset` attribute (for instance, when you only define `get_queryset()`).

### DefaultRouter vs SimpleRouter

| | `SimpleRouter` | `DefaultRouter` |
|---|---|---|
| list / detail routes | Yes | Yes |
| `@action` routes | Yes | Yes |
| API root view at `/` | No | **Yes**, a browsable index of all endpoints |
| Format suffixes (`.json`) | No | Yes |

### Including router URLs

```python
urlpatterns = [
    path("api/", include(router.urls)),
]
# or
urlpatterns += router.urls
```

Router URL names can be reversed like any other: `reverse("player-detail", kwargs={"pk": 1})`.

### Nested-looking URLs

Routers produce flat URLs (`/players/`, `/teams/`). For `/teams/3/players/` either filter with a query parameter (`/players/?team=3`, see [Filtering](/learn/filtering-pagination)), add an `@action(detail=True)` on `TeamViewSet`, or use the `drf-nested-routers` package.

## The three ways compared

The same CRUD API, three ways:

| | Function views | Generic views | ViewSet + Router |
|---|---|---|---|
| View code | ~40 lines | ~15 lines | ~5 lines |
| URL patterns | 2 `path()` | 2 `path()` | 1 `register()` |
| Control | Total | High | High, through hooks |
| Best for | One-off endpoints | Endpoints with unusual URLs | Standard resources |

## Summary

- `ModelViewSet` gives `list`, `create`, `retrieve`, `update`, `partial_update`, `destroy`.
- `ReadOnlyModelViewSet` gives only `list` and `retrieve`.
- Customise with `get_queryset()`, `perform_create()`, `get_serializer_class()`, `get_permissions()` and `self.action`.
- `@action(detail=True/False)` adds custom endpoints.
- `router.register(prefix, ViewSet, basename=...)` generates all URLs; `DefaultRouter` adds a browsable API root.

## Check yourself

<details>
<summary>Which ViewSet action handles <code>PATCH /api/players/5/</code>?</summary>

`partial_update()`.
</details>

<details>
<summary>Why use a ViewSet instead of separate views?</summary>

One class handles all the CRUD actions for a resource, sharing queryset, serializer and permissions, and a router generates every URL. Much less repeated code.
</details>

<details>
<summary>When must you pass <code>basename</code> to <code>router.register()</code>?</summary>

When the ViewSet has no `queryset` attribute (e.g. it only overrides `get_queryset()`), because the router can't derive the name from the model.
</details>

<details>
<summary>What does DefaultRouter add that SimpleRouter doesn't?</summary>

A browsable API root view listing all registered endpoints (and format suffix support).
</details>
