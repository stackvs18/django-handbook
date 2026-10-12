**Authentication** is how an API figures out *who* is making a request. In a browser-based Django site, a session cookie does that. API clients such as mobile apps, scripts and other servers often can't (or shouldn't) use cookies, so DRF supports several **authentication schemes**.

> [!REMEMBER] Authentication vs permissions
> **Authentication** identifies the user (sets `request.user`). **Permissions** decide whether that user may do this ([next-but-one chapter](/learn/api-permissions)). Authentication alone never blocks a request: an unknown caller simply becomes `AnonymousUser`.

## How DRF authenticates a request

```flow
Request arrives | With a cookie, an Authorization header, or nothing
Authentication classes | DRF tries each configured class in order
First success wins | request.user and request.auth are set
None succeed | request.user = AnonymousUser, request.auth = None
Permission classes | Now decide: allowed (continue), 401 or 403
```

## Configuring authentication

Globally in settings:

```python title="settings.py"
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
}
```

Or per view, overriding the global setting:

```python
from rest_framework.authentication import TokenAuthentication
from rest_framework.permissions import IsAuthenticated


class PlayerViewSet(viewsets.ModelViewSet):
    authentication_classes = [TokenAuthentication]
    permission_classes = [IsAuthenticated]
    ...
```

## The built-in schemes

| Scheme | Client sends | Good for | Watch out |
|---|---|---|---|
| `SessionAuthentication` | Django session cookie | Browsable API, JavaScript on the same site | CSRF token required for unsafe methods |
| `BasicAuthentication` | `Authorization: Basic base64(user:pass)` | Quick testing | Password on every request; HTTPS only |
| `TokenAuthentication` | `Authorization: Token 9944b0...` | Simple apps, scripts | One token per user, never expires by itself |
| JWT (SimpleJWT package) | `Authorization: Bearer eyJhbGci...` | Mobile apps, SPAs, microservices | Covered in [the next chapter](/learn/jwt) |

## Session authentication

Uses Django's normal login session. After logging in through `/api-auth/login/` (the browsable API's login link) or your own login view, the browser sends the `sessionid` cookie and DRF knows the user.

- Perfect for the **browsable API** and a JavaScript frontend served by the same Django site.
- Because cookies are sent automatically by browsers, DRF **enforces CSRF** for session-authenticated requests. JavaScript must send the `X-CSRFToken` header ([Security](/learn/security#csrf-with-javascript-fetch--ajax)).

## Basic authentication

The client sends the username and password, base64-encoded (**not encrypted**), with every request:

```http
GET /api/players/ HTTP/1.1
Authorization: Basic YWRtaW46c2VjcmV0MTIz
```

In Postman: *Authorization → Basic Auth → username and password*. Handy while developing; avoid in production unless it's over HTTPS and for machine-to-machine use.

## Token authentication

DRF's built-in token system gives each user one random token, stored in the database.

### Setup

```python title="settings.py"
INSTALLED_APPS = [
    # ...
    "rest_framework",
    "rest_framework.authtoken",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",   # keep for the browsable API
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}
```

```bash
python manage.py migrate      # creates the authtoken_token table
```

### A login endpoint that returns a token

DRF ships one:

```python title="urls.py"
from rest_framework.authtoken.views import obtain_auth_token

urlpatterns = [
    # ...
    path("api/token-auth/", obtain_auth_token, name="api-token-auth"),
]
```

```http
POST /api/token-auth/
Content-Type: application/json

{"username": "asha", "password": "S3cure-pass!"}
```

```json
{ "token": "9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b" }
```

### Using the token

```http
GET /api/players/
Authorization: Token 9944b09199c62bcf9418ad846dd0e4bbdfc6ee4b
```

Note the keyword is `Token`, not `Bearer`.

### Creating tokens yourself

```python
from rest_framework.authtoken.models import Token

token, created = Token.objects.get_or_create(user=user)
print(token.key)
```

Or from the terminal: `python manage.py drf_create_token asha`.

### Logout = delete the token

```python
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.auth.delete()           # request.auth is the Token object
        return Response(status=204)
```

### Limitations

- Tokens never expire unless you delete them.
- One token per user, so logging out on one device logs out every device.
- A database lookup on every request.

These are exactly the problems **JWT** solves, which is why it's the most popular choice for modern APIs.

## A registration endpoint

Authentication schemes log users in; you still need a way to sign up. Reuse the `RegisterSerializer` from [Serializers](/learn/serializers#example-a-user-registration-serializer):

```python title="accounts/views.py"
from rest_framework import generics, permissions
from .serializers import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]      # anyone can sign up
```

```python title="accounts/urls.py"
urlpatterns = [path("register/", RegisterView.as_view(), name="register")]
```

## A "who am I?" endpoint

Useful for any frontend after login:

```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    u = request.user
    return Response({"id": u.id, "username": u.username, "email": u.email, "is_staff": u.is_staff})
```

## 401 or 403?

| Situation | Status |
|---|---|
| No credentials, or bad credentials, and the scheme can send a challenge (Token, Basic, JWT) | **401 Unauthorized** with a `WWW-Authenticate` header |
| No credentials with only Session auth configured | **403 Forbidden** (sessions have no challenge header) |
| Valid user, but a permission check fails | **403 Forbidden** |

So if you expected a 401 and see a 403, check whether the first authentication class is `SessionAuthentication`.

## Which should I use?

| Client | Recommended |
|---|---|
| Browsable API, admin-like tools | Session |
| JavaScript frontend on the **same domain** as Django | Session (+ CSRF header) |
| Mobile app, SPA on another domain, third-party clients | **JWT** |
| Internal scripts and simple integrations | Token |

## Summary

| Scheme | Header | Setup |
|---|---|---|
| Session | Cookie `sessionid` | Default; log in via `/api-auth/login/` |
| Basic | `Authorization: Basic <base64>` | Default; testing only |
| Token | `Authorization: Token <key>` | `rest_framework.authtoken` + migrate + `obtain_auth_token` |
| JWT | `Authorization: Bearer <access>` | `djangorestframework-simplejwt` ([next](/learn/jwt)) |

## Check yourself

<details>
<summary>Does authentication by itself reject requests from anonymous users?</summary>

No. Failed or missing authentication just leaves `request.user` as `AnonymousUser`. Permission classes like `IsAuthenticated` are what reject the request.
</details>

<details>
<summary>What header does DRF's TokenAuthentication expect?</summary>

`Authorization: Token <key>`
</details>

<details>
<summary>Why does SessionAuthentication require a CSRF token but TokenAuthentication doesn't?</summary>

Browsers attach cookies automatically, so cookie-based sessions are vulnerable to CSRF. Tokens in an `Authorization` header are added deliberately by the client's code, which another site can't do.
</details>
