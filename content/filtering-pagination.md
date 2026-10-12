A list endpoint that returns every row works fine with ten players. With a hundred thousand it's slow, wasteful and useless to a client that only wanted "Indian batters, sorted by runs, first page". DRF has built-in tools for **filtering**, **searching**, **ordering**, **pagination** and **throttling**, all controlled through query parameters and settings.

```text
GET /api/players/?country=India&search=sharma&ordering=-runs&page=2
```

## Filtering by hand

The simplest approach: read query parameters in `get_queryset()`.

```python
class PlayerViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerSerializer

    def get_queryset(self):
        qs = Player.objects.select_related("team")
        country = self.request.query_params.get("country")
        min_runs = self.request.query_params.get("min_runs")
        if country:
            qs = qs.filter(country__iexact=country)
        if min_runs and min_runs.isdigit():
            qs = qs.filter(runs__gte=int(min_runs))
        return qs
```

This works, but becomes repetitive. That's what filter backends are for.

## django-filter: declarative filtering

```bash
pip install django-filter
```

```python title="settings.py"
INSTALLED_APPS = [
    # ...
    "django_filters",
]

REST_FRAMEWORK = {
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}
```

### Exact matches with filterset_fields

```python
class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    filterset_fields = ["country", "role", "team"]
```

```text
/api/players/?country=India
/api/players/?role=BAT&team=3
```

### Ranges and lookups

```python
filterset_fields = {
    "runs": ["gte", "lte"],
    "name": ["exact", "icontains"],
    "created_at": ["date__gte"],
}
```

```text
/api/players/?runs__gte=5000&runs__lte=9000
/api/players/?name__icontains=sharma
```

### A FilterSet class for full control

```python title="players/filters.py"
import django_filters
from .models import Player


class PlayerFilter(django_filters.FilterSet):
    min_runs = django_filters.NumberFilter(field_name="runs", lookup_expr="gte")
    max_runs = django_filters.NumberFilter(field_name="runs", lookup_expr="lte")
    team = django_filters.CharFilter(field_name="team__name", lookup_expr="iexact")
    debut_after = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")

    class Meta:
        model = Player
        fields = ["role", "country"]
```

```python
class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    filterset_class = PlayerFilter
```

```text
/api/players/?team=india&min_runs=4000&role=BAT
```

The browsable API shows a **Filters** button with a form for these.

## Search

`SearchFilter` adds a single `?search=` parameter that looks across several fields:

```python
class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    search_fields = ["name", "country", "team__name"]
```

```text
/api/players/?search=sharma
/api/players/?search=india sharma     # every word must match somewhere
```

Prefixes change the matching:

| Prefix | Lookup | Example |
|---|---|---|
| (none) | `icontains` | `"name"` |
| `^` | `istartswith` | `"^name"` |
| `=` | `iexact` | `"=country"` |
| `@` | full-text search (PostgreSQL) | `"@bio"` |
| `$` | regex | `"$name"` |

## Ordering

`OrderingFilter` adds `?ordering=`:

```python
class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    ordering_fields = ["runs", "name", "test_innings", "created_at"]
    ordering = ["-runs"]                       # default
```

```text
/api/players/?ordering=name
/api/players/?ordering=-runs                 # descending
/api/players/?ordering=-runs,name            # several fields
```

Always list `ordering_fields` explicitly. It stops clients sorting on fields you don't want exposed or that aren't indexed.

## Pagination

Without pagination a list endpoint returns everything. Turn it on globally:

```python title="settings.py"
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
}
```

The response is now wrapped:

```json
{
  "count": 137,
  "next": "http://127.0.0.1:8000/api/players/?page=3",
  "previous": "http://127.0.0.1:8000/api/players/?page=1",
  "results": [
    { "id": 11, "name": "..." }
  ]
}
```

> [!NOTE]
> Clients now read the list from `results` instead of the top level. Decide on pagination **before** clients depend on your API; adding it later is a breaking change.

### The three paginators

| Class | Query params | Good for |
|---|---|---|
| `PageNumberPagination` | `?page=3` | Classic numbered pages |
| `LimitOffsetPagination` | `?limit=20&offset=40` | Clients that want flexible windows |
| `CursorPagination` | `?cursor=cD0yMDI1...` | Huge or fast-changing data, infinite scroll; no page jumps, very efficient |

### Customising

```python title="players/pagination.py"
from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"   # client may ask ?page_size=50
    max_page_size = 100                   # ...but never more than 100
```

```python
class PlayerViewSet(viewsets.ModelViewSet):
    pagination_class = StandardPagination      # per view
    # pagination_class = None                  # turn it off for this view
```

```python title="CursorPagination needs an ordering"
from rest_framework.pagination import CursorPagination


class FeedPagination(CursorPagination):
    page_size = 25
    ordering = "-created_at"
```

### Paginating in an APIView

Generic views and viewsets paginate automatically. In an `APIView`, call the paginator yourself:

```python
class PlayerList(APIView):
    def get(self, request):
        paginator = StandardPagination()
        page = paginator.paginate_queryset(Player.objects.all(), request, view=self)
        serializer = PlayerSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
```

## Throttling (rate limiting)

Throttling limits how many requests a client can make, protecting you from abuse, brute-force login attempts and accidental loops.

```python title="settings.py"
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",       # by IP address
        "user": "1000/day",       # by user id
    },
}
```

Rates use `second`, `minute`, `hour` or `day`. When exceeded, the client gets:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 2591

{"detail": "Request was throttled. Expected available in 2591 seconds."}
```

### Different limits for different endpoints

```python
REST_FRAMEWORK = {
    "DEFAULT_THROTTLE_RATES": {
        "anon": "100/hour",
        "user": "1000/day",
        "login": "5/minute",
    },
}
```

```python
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView


class ThrottledLoginView(TokenObtainPairView):
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"            # 5 login attempts per minute
```

> [!TIP]
> Throttle counts live in Django's **cache**. The default local-memory cache is per process, so with several server processes each keeps its own count. In production, use a shared cache such as Redis ([Caching & Performance](/learn/performance)).

## Putting it together

```python title="players/views.py"
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, permissions, viewsets

from .filters import PlayerFilter
from .models import Player
from .pagination import StandardPagination
from .serializers import PlayerSerializer


class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.select_related("team", "owner")
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = PlayerFilter
    search_fields = ["name", "team__name"]
    ordering_fields = ["runs", "name", "created_at"]
    ordering = ["-runs"]
    pagination_class = StandardPagination

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)
```

```text
GET /api/players/?team=india&min_runs=3000&search=sharma&ordering=-runs&page=1&page_size=5
```

## Summary

| Feature | Setting / attribute | Query param |
|---|---|---|
| Exact filters | `filterset_fields` (django-filter) | `?country=India` |
| Custom filters | `filterset_class` | `?min_runs=5000` |
| Search | `search_fields` + `SearchFilter` | `?search=sharma` |
| Ordering | `ordering_fields`, `ordering` + `OrderingFilter` | `?ordering=-runs` |
| Pagination | `DEFAULT_PAGINATION_CLASS`, `PAGE_SIZE` | `?page=2` / `?limit=&offset=` / `?cursor=` |
| Throttling | `DEFAULT_THROTTLE_CLASSES`, `DEFAULT_THROTTLE_RATES` | (none: returns 429 when exceeded) |

## Check yourself

<details>
<summary>What does a paginated DRF response contain?</summary>

With `PageNumberPagination`: `count` (total items), `next` and `previous` (URLs or null) and `results` (the items on this page).
</details>

<details>
<summary>How would a client sort players by runs, highest first?</summary>

`?ordering=-runs` (with `OrderingFilter` enabled and `runs` in `ordering_fields`).
</details>

<details>
<summary>What status code does a throttled request receive?</summary>

`429 Too Many Requests`, usually with a `Retry-After` header.
</details>
