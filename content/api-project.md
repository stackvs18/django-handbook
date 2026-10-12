This project brings all of Part 5 together into one production-style REST API: **registration, JWT login with custom claims, refresh and logout, role-based permissions, owner-only editing, filtering, pagination, throttling and versioned URLs**. Every file is shown in full.

## What we're building

A **Cricket Squad API**. Three roles:

| Role | Can |
|---|---|
| `viewer` (default on sign-up) | Read teams and players |
| `coach` | Also create players, and edit or delete **their own** players |
| `admin` | Everything, including managing teams and anyone's players |

| Method | Endpoint | Who |
|---|---|---|
| POST | `/api/v1/auth/register/` | Anyone |
| POST | `/api/v1/auth/login/` | Anyone (returns tokens) |
| POST | `/api/v1/auth/refresh/` | Holder of a refresh token |
| POST | `/api/v1/auth/logout/` | Logged in |
| GET | `/api/v1/auth/me/` | Logged in |
| GET | `/api/v1/teams/`, `/api/v1/teams/{id}/` | Logged in |
| POST / PUT / PATCH / DELETE | `/api/v1/teams/...` | Admin |
| GET | `/api/v1/players/` (filter, search, order, paginate) | Logged in |
| POST | `/api/v1/players/` | Coach, admin |
| PUT / PATCH / DELETE | `/api/v1/players/{id}/` | The coach who created it, or admin |
| GET | `/api/v1/players/leaderboard/` | Logged in |

## 1. Setup

```bash
mkdir squad-api && cd squad-api
python -m venv venv
venv\Scripts\activate
pip install django djangorestframework djangorestframework-simplejwt django-filter django-cors-headers
pip freeze > requirements.txt
django-admin startproject config .
python manage.py startapp accounts
python manage.py startapp squad
```

## 2. Settings

```python title="config/settings.py (additions and changes)"
from datetime import timedelta

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    "corsheaders",
    # local
    "accounts",
    "squad",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
        "rest_framework.throttling.ScopedRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "60/hour",
        "user": "2000/day",
        "auth": "10/minute",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
    "TOKEN_OBTAIN_SERIALIZER": "accounts.serializers.LoginSerializer",
}

CORS_ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]
```

`ScopedRateThrottle` only affects views that set a `throttle_scope`, so it's safe to enable globally.

## 3. Accounts: roles, registration, login

### The Profile model

```python title="accounts/models.py"
from django.conf import settings
from django.db import models


class Profile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        COACH = "coach", "Coach"
        VIEWER = "viewer", "Viewer"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name="profile")
    role = models.CharField(max_length=10, choices=Role, default=Role.VIEWER)

    def __str__(self):
        return f"{self.user.username} ({self.role})"
```

### Create a profile for every new user

```python title="accounts/signals.py"
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Profile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_profile(sender, instance, created, **kwargs):
    if created:
        role = Profile.Role.ADMIN if instance.is_superuser else Profile.Role.VIEWER
        Profile.objects.create(user=instance, role=role)
```

```python title="accounts/apps.py"
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "accounts"

    def ready(self):
        from . import signals  # noqa: F401  (connects the receiver)
```

### Serializers

```python title="accounts/serializers.py"
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


def role_of(user):
    profile = getattr(user, "profile", None)
    return profile.role if profile else "viewer"


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "password2"]
        extra_kwargs = {"email": {"required": True}}

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value.lower()

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        return User.objects.create_user(**validated_data)


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "username", "email", "role", "date_joined"]

    def get_role(self, obj):
        return role_of(obj)


class LoginSerializer(TokenObtainPairSerializer):
    """Adds username and role to the token, and the user to the login response."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["role"] = role_of(user)
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
```

### Views

```python title="accounts/views.py"
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "auth"


class LogoutView(APIView):
    def post(self, request):
        refresh = request.data.get("refresh")
        if not refresh:
            return Response({"refresh": ["This field is required."]},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            RefreshToken(refresh).blacklist()
        except TokenError:
            return Response({"detail": "Invalid or expired refresh token."},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_205_RESET_CONTENT)


class MeView(generics.RetrieveAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
```

```python title="accounts/urls.py"
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", views.LoginView.as_view(), name="login"),
    path("refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("me/", views.MeView.as_view(), name="me"),
]
```

```python title="accounts/admin.py"
from django.contrib import admin
from .models import Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role")
    list_editable = ("role",)
    list_filter = ("role",)
```

Admins promote users to coach in the admin by changing their profile's role.

## 4. The squad app

### Models

```python title="squad/models.py"
from django.conf import settings
from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100, unique=True)
    country = models.CharField(max_length=50)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Player(models.Model):
    class Role(models.TextChoices):
        BATTER = "BAT", "Batter"
        BOWLER = "BOWL", "Bowler"
        ALL_ROUNDER = "AR", "All-rounder"
        KEEPER = "WK", "Wicket-keeper"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="players")
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="players")
    name = models.CharField(max_length=100)
    role = models.CharField(max_length=4, choices=Role, default=Role.BATTER)
    matches = models.PositiveIntegerField(default=0)
    runs = models.PositiveIntegerField(default=0)
    wickets = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-runs"]
        indexes = [models.Index(fields=["runs"]), models.Index(fields=["name"])]

    def __str__(self):
        return self.name
```

```python title="squad/admin.py"
from django.contrib import admin
from .models import Player, Team

admin.site.register(Team)


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
    list_display = ("name", "team", "role", "runs", "wickets", "owner")
    list_filter = ("role", "team")
    search_fields = ("name",)
```

### Serializers

```python title="squad/serializers.py"
from rest_framework import serializers
from .models import Player, Team


class TeamSerializer(serializers.ModelSerializer):
    player_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Team
        fields = ["id", "name", "country", "player_count"]


class PlayerSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.username")
    team = serializers.StringRelatedField()
    team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), source="team", write_only=True,
        required=False, allow_null=True,
    )
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    batting_average = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = ["id", "name", "role", "role_label", "team", "team_id", "matches",
                  "runs", "wickets", "batting_average", "owner", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at"]

    def get_batting_average(self, obj):
        return round(obj.runs / obj.matches, 2) if obj.matches else None

    def validate_name(self, value):
        value = value.strip()
        if len(value) < 3:
            raise serializers.ValidationError("Name must be at least 3 characters.")
        return value

    def validate(self, attrs):
        matches = attrs.get("matches", getattr(self.instance, "matches", 0))
        runs = attrs.get("runs", getattr(self.instance, "runs", 0))
        wickets = attrs.get("wickets", getattr(self.instance, "wickets", 0))
        if (runs or wickets) and not matches:
            raise serializers.ValidationError("Runs or wickets require at least one match.")
        return attrs
```

### Permissions

```python title="squad/permissions.py"
from rest_framework.permissions import SAFE_METHODS, BasePermission


def role_of(user):
    profile = getattr(user, "profile", None)
    return profile.role if profile else None


class IsAdminRoleOrReadOnly(BasePermission):
    """Read for any authenticated user; write only for admins."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or role_of(request.user) == "admin"


class PlayerPermission(BasePermission):
    """
    Read: any authenticated user.
    Create: coaches and admins.
    Update/delete: the owner (coach) or an admin.
    """

    message = "You don't have permission to modify this player."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return role_of(request.user) in ("coach", "admin")

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return role_of(request.user) == "admin" or obj.owner_id == request.user.id
```

### Views

```python title="squad/views.py"
from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Player, Team
from .permissions import IsAdminRoleOrReadOnly, PlayerPermission
from .serializers import PlayerSerializer, TeamSerializer


class TeamViewSet(viewsets.ModelViewSet):
    serializer_class = TeamSerializer
    permission_classes = [IsAdminRoleOrReadOnly]
    search_fields = ["name", "country"]
    ordering_fields = ["name", "player_count"]

    def get_queryset(self):
        return Team.objects.annotate(player_count=Count("players"))


class PlayerViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerSerializer
    permission_classes = [PlayerPermission]
    filterset_fields = {
        "role": ["exact"],
        "team": ["exact"],
        "team__country": ["iexact"],
        "runs": ["gte", "lte"],
    }
    search_fields = ["name", "team__name"]
    ordering_fields = ["runs", "wickets", "matches", "name", "created_at"]

    def get_queryset(self):
        return Player.objects.select_related("team", "owner")

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @action(detail=False)
    def leaderboard(self, request):
        """Top 5 run scorers and top 5 wicket takers."""
        qs = self.get_queryset()
        return Response({
            "most_runs": PlayerSerializer(qs.order_by("-runs")[:5], many=True).data,
            "most_wickets": PlayerSerializer(qs.order_by("-wickets")[:5], many=True).data,
        })
```

`TeamViewSet` and `PlayerViewSet` only define `get_queryset()`, so the router needs a `basename` for each.

### URLs

```python title="squad/urls.py"
from rest_framework.routers import DefaultRouter
from .views import PlayerViewSet, TeamViewSet

router = DefaultRouter()
router.register("teams", TeamViewSet, basename="team")
router.register("players", PlayerViewSet, basename="player")

urlpatterns = router.urls
```

```python title="config/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/", include("squad.urls")),
]
```

## 5. Migrate and run

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser        # gets the admin role through the signal
python manage.py runserver
```

## 6. Try it

Register a user:

```http
POST /api/v1/auth/register/
Content-Type: application/json

{ "username": "rahul", "email": "rahul@example.com", "password": "Cover-drive-2025", "password2": "Cover-drive-2025" }
```

```json
{
  "user": { "id": 2, "username": "rahul", "email": "rahul@example.com", "role": "viewer", "date_joined": "..." },
  "refresh": "eyJ...",
  "access": "eyJ..."
}
```

As a **viewer**, try to create a player:

```http
POST /api/v1/players/
Authorization: Bearer <rahul's access token>
Content-Type: application/json

{ "name": "Shubman Gill", "role": "BAT", "matches": 32, "runs": 1893 }
```

```http
HTTP/1.1 403 Forbidden

{"detail": "You don't have permission to modify this player."}
```

Log into `/admin/` as the superuser and change rahul's profile role to **coach**. Repeat the POST: **201 Created**, with `"owner": "rahul"`. Permissions read the role from the database, so the change applies immediately; only the `role` claim inside rahul's existing tokens stays out of date until he logs in again.

Explore the list features:

```text
GET /api/v1/players/?role=BAT&ordering=-runs
GET /api/v1/players/?search=gill
GET /api/v1/players/?runs__gte=1000&page=2
GET /api/v1/players/leaderboard/
```

Create a second coach and try to `PATCH` rahul's player: **403**. As the superuser: **200**.

Log out:

```http
POST /api/v1/auth/logout/
Authorization: Bearer <access>
Content-Type: application/json

{ "refresh": "<refresh token>" }
```

Using that refresh token again at `/api/v1/auth/refresh/` now returns 401: *Token is blacklisted*.

## 7. Automated tests

```python title="squad/tests.py"
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Player

User = get_user_model()


class PlayerAPITests(APITestCase):
    def setUp(self):
        self.viewer = User.objects.create_user("viewer", "v@example.com", "pass12345!")
        self.coach = User.objects.create_user("coach", "c@example.com", "pass12345!")
        self.coach.profile.role = "coach"
        self.coach.profile.save()
        self.url = "/api/v1/players/"

    def test_anonymous_gets_401(self):
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_viewer_can_read_but_not_create(self):
        self.client.force_authenticate(self.viewer)
        self.assertEqual(self.client.get(self.url).status_code, status.HTTP_200_OK)
        res = self.client.post(self.url, {"name": "Test Player"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_coach_creates_and_owns_player(self):
        self.client.force_authenticate(self.coach)
        res = self.client.post(self.url, {"name": "Test Player", "matches": 1, "runs": 50}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Player.objects.get().owner, self.coach)

    def test_coach_cannot_edit_someone_elses_player(self):
        other = User.objects.create_user("other", "o@example.com", "pass12345!")
        other.profile.role = "coach"
        other.profile.save()
        player = Player.objects.create(owner=other, name="Not Mine")
        self.client.force_authenticate(self.coach)
        res = self.client.patch(f"{self.url}{player.id}/", {"runs": 1}, format="json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
```

```bash
python manage.py test squad
```

## How a request is processed

```flow
PATCH /api/v1/players/7/ | Arrives with Authorization: Bearer <access>
JWTAuthentication | Verifies signature and expiry, loads the user from user_id
Throttling | UserRateThrottle checks this user's request count
PlayerPermission.has_permission | Unsafe method, so the user must be a coach or admin
get_object() | Loads player 7 (404 if missing)
PlayerPermission.has_object_permission | Must be the owner or an admin, otherwise 403
PlayerSerializer | Validates the partial data (validate_name, validate)
perform_update / save | Writes to the database
Response | 200 with the updated player as JSON
```

## Challenges

1. Add API documentation with `drf-spectacular` at `/api/docs/` ([Best Practices](/learn/api-best-practices#documenting-your-api)).
2. Add a `Match` model with a many-to-many `players` field and a nested read serializer.
3. Let admins change a user's role through an endpoint (`PATCH /api/v1/users/{id}/role/`) restricted to admins.
4. Add an `@action(detail=True, methods=["post"])` to record a match performance (runs and wickets) for a player.
5. Build a small React or plain-JavaScript frontend that logs in and lists players, refreshing the token on 401 ([JWT](/learn/jwt#using-jwts-from-a-javascript-frontend)).
6. Deploy it ([Deployment](/learn/deployment)).

## Check yourself

<details>
<summary>Why does a newly registered user get a 403 when creating a player?</summary>

New users get the `viewer` role, and `PlayerPermission.has_permission()` only lets coaches and admins use unsafe methods (POST, PUT, PATCH, DELETE).
</details>

<details>
<summary>Where is the owner of a new player set, and why not in the request body?</summary>

In `perform_create()` via `serializer.save(owner=self.request.user)`. The serializer makes `owner` read-only so clients can't create players on someone else's behalf.
</details>

<details>
<summary>Why do <code>TeamViewSet</code> and <code>PlayerViewSet</code> need a <code>basename</code> when registered?</summary>

They define `get_queryset()` instead of a `queryset` attribute, so the router can't work out the model name to build URL names like `player-list`.
</details>
