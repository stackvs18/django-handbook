An API is a promise to everyone who uses it. Once a mobile app ships with your endpoints baked in, you can't simply rename a field. This chapter covers how to evolve an API safely (**versioning**), how to let browser apps on other domains use it (**CORS**), how to **document** it, and a checklist of **best practices** for production.

## Why version an API?

Imagine `GET /api/players/` returns `"name": "Virat Kohli"`, and you decide to split it into `first_name` and `last_name`. Every existing client that reads `name` breaks. Versioning lets old and new behaviour live side by side:

```text
/api/v1/players/   ->  { "name": "Virat Kohli" }                           (old apps keep working)
/api/v2/players/   ->  { "first_name": "Virat", "last_name": "Kohli" }     (new apps use this)
```

You can then announce a deprecation date for v1 and remove it later.

**Non-breaking** changes don't need a new version: adding a new endpoint, adding an optional field to a response, or accepting a new optional input. **Breaking** changes do: removing or renaming fields, changing types or meanings, making an optional input required, changing URLs or status codes.

## Versioning strategies

| Strategy | Example | Pros / cons |
|---|---|---|
| **URL path** | `/api/v1/players/` | Explicit, easy to test and cache. **The most common** |
| Query parameter | `/api/players/?version=1` | Simple, but easy to forget |
| Accept header | `Accept: application/json; version=1.0` | Clean URLs, harder to test in a browser |
| Hostname | `v1.api.example.com` | Clear separation, needs DNS setup |
| Namespace | URL namespaces `v1`, `v2` in Django | Like URL path, using Django namespaces |

DRF supports them all through a **versioning class**. The current version is available in views as `request.version`.

### URL path versioning in DRF

```python title="settings.py"
REST_FRAMEWORK = {
    "DEFAULT_VERSIONING_CLASS": "rest_framework.versioning.URLPathVersioning",
    "DEFAULT_VERSION": "v1",
    "ALLOWED_VERSIONS": ["v1", "v2"],
    "VERSION_PARAM": "version",
}
```

The URL must capture a keyword argument called `version`:

```python title="playerapi/urls.py"
from django.urls import include, re_path
from rest_framework.routers import DefaultRouter

from players.views import PlayerViewSet

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")

urlpatterns = [
    re_path(r"^api/(?P<version>(v1|v2))/", include(router.urls)),
]
```

Then adapt behaviour per version:

```python title="players/views.py"
class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()

    def get_serializer_class(self):
        if self.request.version == "v2":
            return PlayerSerializerV2
        return PlayerSerializerV1
```

A request for an unlisted version (e.g. `/api/v3/...`) gets **404 Not Found**.

### Simpler: separate URL includes

Many teams skip the versioning class and give each version its own router and views:

```python
urlpatterns = [
    path("api/v1/", include("players.api.v1.urls")),
    path("api/v2/", include("players.api.v2.urls")),
]
```

Either way, the important part is putting a version in the URL **from day one**, even if `v1` is all you ever have.

### Other DRF versioning classes

```python
"rest_framework.versioning.QueryParameterVersioning"    # ?version=v1
"rest_framework.versioning.AcceptHeaderVersioning"      # Accept: application/json; version=v1
"rest_framework.versioning.HostNameVersioning"          # v1.example.com
"rest_framework.versioning.NamespaceVersioning"         # include(..., namespace="v1")
```

## CORS: letting other websites call your API

Browsers block JavaScript on `https://myfrontend.com` from reading responses from `https://api.example.com` unless the API explicitly allows it. That rule is the **Same-Origin Policy**; the opt-in mechanism is **CORS (Cross-Origin Resource Sharing)**. Without it, your React app sees errors like:

```text
Access to fetch at 'http://127.0.0.1:8000/api/players/' from origin 'http://localhost:5173'
has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present.
```

> [!NOTE]
> CORS is enforced by **browsers** only. Postman, curl and mobile apps don't care, which is why "it works in Postman but not in my React app" usually means CORS.

The standard fix is the `django-cors-headers` package:

```bash
pip install django-cors-headers
```

```python title="settings.py"
INSTALLED_APPS = [
    # ...
    "corsheaders",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",      # as high as possible, before CommonMiddleware
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    # ...
]

CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",          # Vite dev server
    "http://localhost:3000",          # Next.js / CRA dev server
    "https://myfrontend.com",
]

# Only if the frontend sends cookies (session auth):
# CORS_ALLOW_CREDENTIALS = True
# CSRF_TRUSTED_ORIGINS = ["https://myfrontend.com"]
```

> [!WARNING]
> `CORS_ALLOW_ALL_ORIGINS = True` is fine for a quick local experiment, never for production. List exactly the origins you trust.

## Documenting your API

An undocumented API is a guessing game. Generate an **OpenAPI** schema automatically with `drf-spectacular`:

```bash
pip install drf-spectacular
```

```python title="settings.py"
INSTALLED_APPS = [
    # ...
    "drf_spectacular",
]

REST_FRAMEWORK = {
    # ...
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Player API",
    "DESCRIPTION": "Manage cricket players and teams.",
    "VERSION": "1.0.0",
}
```

```python title="urls.py"
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

urlpatterns += [
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
```

Visit `/api/docs/` for interactive **Swagger UI** documentation, generated from your serializers and views, where you can authorise with a JWT and try every endpoint. Docstrings and `@extend_schema` decorators add descriptions and examples.

## Consistent errors

DRF already returns structured errors. Keep them consistent and predictable:

```json
{ "detail": "Authentication credentials were not provided." }
```

```json
{ "runs": ["Ensure this value is greater than or equal to 0."] }
```

To change the format globally, write a custom exception handler:

```python title="core/exceptions.py"
from rest_framework.views import exception_handler


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        response.data = {"status": response.status_code, "errors": response.data}
    return response
```

```python title="settings.py"
REST_FRAMEWORK = {
    # ...
    "EXCEPTION_HANDLER": "core.exceptions.api_exception_handler",
}
```

## The best-practices checklist

### Design

- [x] Nouns for resources, plural: `/players/`, `/teams/3/`
- [x] HTTP methods for actions: GET, POST, PUT, PATCH, DELETE
- [x] Correct status codes: 201 for create, 204 for delete, 400 for validation, 401/403 for auth
- [x] Consistent naming: pick `snake_case` (DRF's default) or `camelCase` and use it everywhere
- [x] Filtering, search, ordering and pagination through query parameters
- [x] A version in the URL from day one: `/api/v1/`
- [x] ISO 8601 dates (`2025-06-01T10:12:03Z`), DRF's default

### Security

- [x] Safe default permission (`IsAuthenticated`), opened up deliberately
- [x] Object-level checks **and** filtered querysets for user-owned data
- [x] Explicit serializer `fields`: never `"__all__"`; secrets `write_only`
- [x] Validate everything server-side: types, ranges, ownership, business rules
- [x] HTTPS only in production; short-lived JWT access tokens
- [x] Throttle anonymous traffic and login endpoints
- [x] Restrictive CORS: explicit `CORS_ALLOWED_ORIGINS`
- [x] Secrets (`SECRET_KEY`, database passwords) in environment variables, never in Git
- [x] Disable the browsable API in production if you don't need it (`DEFAULT_RENDERER_CLASSES`)

### Performance

- [x] `select_related` / `prefetch_related` in `get_queryset()` to avoid N+1 queries
- [x] Paginate every list endpoint
- [x] Lighter serializers for list views (fewer fields, no deep nesting)
- [x] Database indexes on fields you filter and order by
- [x] Cache expensive, rarely changing responses ([Caching & Performance](/learn/performance))

### Operations

- [x] Automated tests for every endpoint ([Testing](/learn/testing)), plus a Postman collection
- [x] OpenAPI documentation that's generated, not hand-written
- [x] Logging and error monitoring (e.g. Sentry)
- [x] A deprecation policy for old versions

## Summary

| Topic | Key point |
|---|---|
| Versioning | Protects existing clients from breaking changes; URL path `/api/v1/` is most common |
| DRF versioning | `DEFAULT_VERSIONING_CLASS`, `ALLOWED_VERSIONS`, `request.version` |
| CORS | Browser rule; allow your frontend's origin with `django-cors-headers` |
| Docs | `drf-spectacular` generates OpenAPI + Swagger UI |
| Best practices | Correct methods and status codes, safe permissions, validation, pagination, throttling, HTTPS |

## Check yourself

<details>
<summary>Name two API versioning strategies and say which is most common.</summary>

URL path (`/api/v1/`), query parameter (`?version=1`), Accept header, hostname. URL path versioning is the most common because it's explicit and easy to route and test.
</details>

<details>
<summary>Your React app can't read API responses but Postman can. Why?</summary>

CORS. Browsers block cross-origin responses unless the server sends `Access-Control-Allow-Origin`. Configure `django-cors-headers` with the frontend's origin.
</details>

<details>
<summary>Is adding a new optional field to a response a breaking change?</summary>

No. Existing clients ignore fields they don't know. Removing or renaming a field, or changing its type, is breaking.
</details>
