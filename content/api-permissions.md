Once DRF knows **who** is calling ([authentication](/learn/api-authentication)), **permissions** decide **what they may do**. This is where you implement rules like "anyone can read, only logged-in users can write", "only admins can delete", or "only the owner can edit this player". When different kinds of users get different rights, you have a **role-based API**.

## How permission checks work

```flow
Request authenticated | request.user is set (maybe AnonymousUser)
has_permission(request, view) | Runs for EVERY request. Can this user use this view at all?
get_object() | For detail actions (retrieve, update, destroy) the object is loaded
has_object_permission(request, view, obj) | Runs for that object. Can this user touch THIS one?
All checks pass | The action runs. Any check fails: 401 (not logged in) or 403 (not allowed)
```

Every class in `permission_classes` must allow the request (logical AND).

## Setting permissions

Globally:

```python title="settings.py"
REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
```

> [!WARNING]
> DRF's default is `AllowAny`: every endpoint is open unless you change it. Set a safe global default like `IsAuthenticated` and open up individual views deliberately.

Per view or viewset (overrides the global setting):

```python
from rest_framework import permissions, viewsets


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
```

For function views:

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_stats(request): ...
```

## Built-in permission classes

| Class | Allows |
|---|---|
| `AllowAny` | Everyone (DRF's default) |
| `IsAuthenticated` | Any logged-in user |
| `IsAdminUser` | Users with `is_staff=True` |
| `IsAuthenticatedOrReadOnly` | Everyone can read (GET, HEAD, OPTIONS); only logged-in users can write |
| `DjangoModelPermissions` | Requires Django's model permissions: `add_` for POST, `change_` for PUT/PATCH, `delete_` for DELETE |
| `DjangoModelPermissionsOrAnonReadOnly` | Same, plus anonymous read access |
| `DjangoObjectPermissions` | Per-object Django permissions (needs a backend like django-guardian) |

`DjangoModelPermissions` connects your API to the same users, groups and permissions you manage in the admin ([Permissions](/learn/permissions)).

## Writing custom permissions

Subclass `BasePermission` and implement one or both methods, returning `True` to allow:

```python title="players/permissions.py"
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOwnerOrReadOnly(BasePermission):
    """Anyone can read; only the owner can modify."""

    message = "You can only modify players you created."

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:          # GET, HEAD, OPTIONS
            return True
        return obj.owner == request.user


class IsStaffOrReadOnly(BasePermission):
    """Everyone authenticated can read; only staff can write."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)
```

```python title="players/views.py"
from rest_framework import permissions, viewsets
from .permissions import IsOwnerOrReadOnly


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly, IsOwnerOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
```

### has_permission vs has_object_permission

| | `has_permission(request, view)` | `has_object_permission(request, view, obj)` |
|---|---|---|
| Runs | Every request, before anything else | Only when `get_object()` is called |
| Knows about | The request and the view | The request, view **and the specific object** |
| Typical rule | "Must be staff to POST" | "Must be the owner to edit this one" |
| Runs on `list`? | Yes | **No** |

> [!IMPORTANT] Object permissions don't filter lists
> `has_object_permission()` isn't called for `list` (there's no single object). If users must only **see** their own data, filter in `get_queryset()` as well:
> `return Player.objects.filter(owner=self.request.user)`

> [!EXAM] One-line answer
> Custom permissions subclass `BasePermission`. `has_permission()` controls access to the **whole view**; `has_object_permission()` controls access to a **specific object** (e.g. owner-only edits) and runs only for detail actions.

## Different permissions per action

```python
class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            classes = [permissions.AllowAny]
        elif self.action == "destroy":
            classes = [permissions.IsAdminUser]
        else:                                        # create, update, partial_update
            classes = [permissions.IsAuthenticated, IsOwnerOrReadOnly]
        return [cls() for cls in classes]
```

Or on a single extra action: `@action(detail=True, methods=["post"], permission_classes=[IsAdminUser])`.

## Combining permissions with & | ~

```python
permission_classes = [IsAuthenticated & (IsOwner | IsAdminUser)]
permission_classes = [~IsBanned]
```

## Role-based APIs

"Role-based" means users get different abilities based on a **role**. There are three common ways to store roles.

### Approach 1: is_staff / is_superuser

Fine for two roles (regular user and admin):

```python
class IsAdminOrReadOnly(BasePermission):
    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or (request.user and request.user.is_staff)
```

### Approach 2: a role field

Store the role on a profile or custom user model:

```python title="accounts/models.py"
from django.conf import settings
from django.db import models


class Profile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        COACH = "coach", "Coach"
        VIEWER = "viewer", "Viewer"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    role = models.CharField(max_length=10, choices=Role, default=Role.VIEWER)
```

A reusable permission that accepts a list of roles:

```python title="accounts/permissions.py"
from rest_framework.permissions import SAFE_METHODS, BasePermission


def user_role(user):
    profile = getattr(user, "profile", None)
    return profile.role if profile else None


class HasRole(BasePermission):
    """Set allowed_roles on the view: allowed_roles = ["admin", "coach"]"""

    def has_permission(self, request, view):
        allowed = getattr(view, "allowed_roles", [])
        return request.user.is_authenticated and user_role(request.user) in allowed


class ReadOnlyOrRole(HasRole):
    """Anyone authenticated can read; writing needs one of allowed_roles."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return request.user.is_authenticated
        return super().has_permission(request, view)
```

```python title="players/views.py"
class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [ReadOnlyOrRole]
    allowed_roles = ["admin", "coach"]       # viewers can only read
```

The resulting rules:

| Role | GET | POST / PUT / PATCH | DELETE |
|---|---|---|---|
| Anonymous | 401 | 401 | 401 |
| Viewer | ✓ | 403 | 403 |
| Coach | ✓ | ✓ | ✓ |
| Admin | ✓ | ✓ | ✓ |

To let only admins delete, combine with `get_permissions()` as shown earlier.

### Approach 3: Django groups

Use groups as roles and manage membership in the admin:

```python
class InGroup(BasePermission):
    def has_permission(self, request, view):
        groups = getattr(view, "allowed_groups", [])
        return request.user.is_authenticated and request.user.groups.filter(name__in=groups).exists()
```

Or use `DjangoModelPermissions` and give each group the right add/change/delete permissions, with no custom code at all.

### Roles in the JWT

Add the role as a custom claim so the frontend can show or hide buttons without an extra request ([JWT: custom claims](/learn/jwt#adding-custom-claims)). The **server must still check permissions**: a client could edit its own UI, but it can't forge a signed token or bypass your permission classes.

## Field-level rules

Sometimes everyone may edit a player, but only staff may change a particular field. Handle that in the serializer:

```python
class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["id", "name", "runs", "is_verified"]

    def get_fields(self):
        fields = super().get_fields()
        request = self.context.get("request")
        if not (request and request.user.is_staff):
            fields["is_verified"].read_only = True
        return fields
```

## Summary

| Need | Use |
|---|---|
| Logged in only | `IsAuthenticated` |
| Public read, private write | `IsAuthenticatedOrReadOnly` |
| Staff only | `IsAdminUser` |
| Owner-only edits | Custom `has_object_permission` + filter `get_queryset` |
| Rules per action | `get_permissions()` with `self.action` |
| Roles | Role field / groups + a custom `BasePermission` |
| Combine | `&`, `\|`, `~` |

## Check yourself

<details>
<summary>What's DRF's default permission class, and why is that risky?</summary>

`AllowAny`. Every endpoint is fully open unless you set `DEFAULT_PERMISSION_CLASSES` or per-view `permission_classes`.
</details>

<details>
<summary>Why doesn't <code>IsOwnerOrReadOnly</code> stop other users' players from appearing in the list endpoint?</summary>

`has_object_permission()` only runs when a single object is fetched with `get_object()`. Lists must be restricted by filtering in `get_queryset()`.
</details>

<details>
<summary>Which permission should a custom role check go in: <code>has_permission</code> or <code>has_object_permission</code>?</summary>

A role check ("is this user a coach?") doesn't depend on a specific object, so `has_permission()`. Ownership checks go in `has_object_permission()`.
</details>
