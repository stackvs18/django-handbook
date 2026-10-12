So far your Django views have returned **HTML pages** for people to look at. But many clients don't want HTML: a mobile app, a React frontend, another company's server or a smart TV want **raw data** they can display their own way. A **web API** provides that data, and **REST** is the most common style for designing one.

## What is an API?

An **API (Application Programming Interface)** is a contract that lets one program talk to another. A **web API** does it over HTTP: a client sends a request to a URL, and the server replies with data, usually as **JSON**.

```http
GET /api/players/7/ HTTP/1.1
Host: example.com
Accept: application/json
```

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": 7,
  "name": "Virat Kohli",
  "country": "India",
  "runs": 8848
}
```

One backend can now serve many frontends:

```flow
Django + DRF backend | One source of truth: data, rules, authentication
React / Vue / Angular website | Fetches JSON and renders it in the browser
Android & iOS apps | Fetch the same JSON
Other servers & scripts | Integrate with your system automatically
```

## JSON in two minutes

**JSON (JavaScript Object Notation)** is the format APIs speak. It maps neatly onto Python:

| JSON | Python | Example |
|---|---|---|
| object `{}` | `dict` | `{"name": "Rohit"}` |
| array `[]` | `list` | `[1, 2, 3]` |
| string | `str` | `"hello"` (double quotes only) |
| number | `int` / `float` | `42`, `3.14` |
| `true` / `false` | `True` / `False` | |
| `null` | `None` | |

```python
import json

json.dumps({"name": "Rohit", "active": True})   # Python -> JSON text
json.loads('{"name": "Rohit", "active": true}')  # JSON text -> Python
```

JSON has no dates, decimals or model objects, so something must convert those. That's exactly what a **serializer** does.

## REST: the rules of the road

**REST (Representational State Transfer)** is a set of design principles. An API that follows them is called **RESTful**.

**1. Everything is a resource with a URL.** Use **nouns**, usually plural:

```text
/api/players/          the collection of players
/api/players/7/        one player
/api/players/7/matches/ the matches of player 7
```

**2. HTTP methods are the verbs.** Don't put actions in URLs (`/getPlayer`, `/deletePlayer?id=7`):

| Method | URL | Action | Success code |
|---|---|---|---|
| `GET` | `/api/players/` | List players | `200 OK` |
| `POST` | `/api/players/` | Create a player | `201 Created` |
| `GET` | `/api/players/7/` | Retrieve player 7 | `200 OK` |
| `PUT` | `/api/players/7/` | Replace player 7 (all fields) | `200 OK` |
| `PATCH` | `/api/players/7/` | Update some fields of player 7 | `200 OK` |
| `DELETE` | `/api/players/7/` | Delete player 7 | `204 No Content` |

**3. Stateless.** Each request carries everything needed to understand it, including credentials (a token in the `Authorization` header). The server keeps no conversation memory between requests, which makes APIs easy to scale.

**4. Representations.** The client receives a *representation* of the resource (JSON), not the database row itself.

**5. Use status codes honestly.** The client relies on them:

| Code | When |
|---|---|
| `200 OK` | Successful GET, PUT, PATCH |
| `201 Created` | Successful POST |
| `204 No Content` | Successful DELETE |
| `400 Bad Request` | Validation failed (the body explains which fields) |
| `401 Unauthorized` | No credentials, or invalid/expired token |
| `403 Forbidden` | Authenticated but not allowed |
| `404 Not Found` | No such resource |
| `405 Method Not Allowed` | e.g. DELETE on a read-only endpoint |
| `429 Too Many Requests` | Rate limit hit |
| `500 Internal Server Error` | A bug on the server |

### Safe and idempotent methods

| Method | Safe (no changes)? | Idempotent (same result if repeated)? |
|---|---|---|
| GET | Yes | Yes |
| PUT | No | Yes: setting the same values twice leaves the same state |
| PATCH | No | Usually |
| DELETE | No | Yes: deleting twice leaves it deleted (second call may 404) |
| POST | No | **No**: posting twice creates two objects |

## Could plain Django do this?

Yes, with `JsonResponse`, but look how much you'd write for one endpoint:

```python
import json

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .models import Player


@csrf_exempt
def players(request):
    if request.method == "GET":
        data = [{"id": p.id, "name": p.name, "runs": p.runs} for p in Player.objects.all()]
        return JsonResponse(data, safe=False)

    if request.method == "POST":
        try:
            body = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        if not body.get("name"):
            return JsonResponse({"name": ["This field is required."]}, status=400)
        # ... validate every other field by hand, check types, check permissions,
        # authenticate tokens, paginate, throttle, document...
        player = Player.objects.create(name=body["name"], runs=body.get("runs", 0))
        return JsonResponse({"id": player.id, "name": player.name, "runs": player.runs}, status=201)

    return JsonResponse({"error": "Method not allowed"}, status=405)
```

Now multiply that by every model and every method. That's the gap **Django REST Framework** fills.

## Django REST Framework (DRF)

**DRF** is the standard toolkit for building APIs with Django. It's a separate package (`pip install djangorestframework`) used by thousands of companies. It gives you:

| Feature | What it replaces |
|---|---|
| **Serializers** | Hand-written conversion and validation of JSON |
| **`Request` / `Response`** | Parsing `request.body`, picking a content type |
| **APIView, generic views, ViewSets** | Repetitive method handling and CRUD code |
| **Routers** | Writing URL patterns for every action |
| **Authentication** | Session, Basic, Token, JWT (with SimpleJWT) |
| **Permissions** | `IsAuthenticated`, `IsAdminUser`, custom rules, object-level checks |
| **Throttling** | Rate limiting |
| **Pagination, filtering, ordering** | Query-string handling for lists |
| **Browsable API** | A clickable HTML interface to explore and test your API in the browser |

The same endpoint in DRF (explained over the next chapters):

```python
class PlayerViewSet(viewsets.ModelViewSet):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
```

Six actions, validation, authentication checks and correct status codes, in four lines.

## From MVT to Model–Serializer–View

In a classic Django site, the **Template** turns model objects into HTML. In an API, nobody needs HTML, so the **Serializer** takes the template's place and turns model objects into JSON (and validates JSON coming back in).

| Layer | Classic Django (MVT) | Django REST Framework |
|---|---|---|
| Data | Model | Model (unchanged) |
| Logic | View | APIView / ViewSet |
| Presentation | Template → HTML | **Serializer → JSON** |
| URLs | `path()` | `path()` or a **Router** |
| Input validation | Form | **Serializer** |

```flow
Client | Sends GET /api/players/7/ with Authorization: Bearer <token>
Router / urls.py | Matches the URL to PlayerViewSet, action "retrieve"
Authentication & permissions | DRF identifies the user and checks they're allowed
ViewSet | Fetches the Player from the database through the Model
Serializer | Converts the Player into a Python dict ready for JSON
Response | DRF renders JSON with status 200
```

> [!NOTE] Serializer ≈ Form
> If you understand Django forms, you already understand half of serializers. Both declare fields, validate input with `is_valid()`, expose `errors`, and `ModelSerializer` is to serializers what `ModelForm` is to forms.

## Designing a good API: a checklist

- Plural nouns for collections: `/api/players/`, not `/api/player/` or `/api/getPlayers/`
- Nest only one level for clear ownership: `/api/teams/3/players/`
- Use query strings for filtering, searching, sorting and paging: `/api/players/?country=India&ordering=-runs&page=2`
- Return the created object (with its `id`) and `201` after POST
- Return field-level error messages with `400`
- Version your API (`/api/v1/`) before outside clients depend on it
- Never return secrets such as password hashes
- Document it ([Versioning & Best Practices](/learn/api-best-practices))

## Summary

| Term | Meaning |
|---|---|
| API | A contract for programs to talk to each other |
| REST | Design style: resources at URLs, HTTP verbs, stateless, proper status codes |
| Endpoint | A URL + method the API supports, e.g. `POST /api/players/` |
| JSON | The data format most APIs use |
| DRF | Django REST Framework, the standard way to build APIs with Django |
| Serializer | Converts model objects ⇄ JSON and validates input (DRF's "template" and "form") |

## Check yourself

<details>
<summary>Which method and URL would create a new player in a RESTful API, and what status should a success return?</summary>

`POST /api/players/` with the player's data as JSON in the body. Success returns `201 Created`, usually with the new object in the response.
</details>

<details>
<summary>What's the difference between PUT and PATCH?</summary>

`PUT` replaces the whole resource, so you send every field. `PATCH` updates only the fields you send.
</details>

<details>
<summary>In a DRF project, which component takes over the job of the Template?</summary>

The **Serializer**: it turns model instances into JSON-ready data (and validates incoming data), where a template would have produced HTML.
</details>

<details>
<summary>What does "stateless" mean for a REST API?</summary>

The server doesn't remember previous requests. Each request must include everything needed, including authentication such as a token in the `Authorization` header.
</details>
