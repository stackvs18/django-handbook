**JWT (JSON Web Token)** is the most popular way to authenticate API clients such as mobile apps and single-page web apps. After logging in, the client receives a signed token and sends it with every request. The server checks the signature, with no database lookup and no session storage needed. This chapter explains how JWTs work and how to use them in Django with **djangorestframework-simplejwt**.

## Why not sessions?

Session authentication works well for browsers on the same site, but it struggles elsewhere:

| | Session authentication | JWT authentication |
|---|---|---|
| Where state lives | Server stores each session (database or cache) | **Nothing stored**: the token carries the data (*stateless*) |
| Client sends | `Cookie: sessionid=...` (automatic in browsers) | `Authorization: Bearer <token>` (added by the app) |
| Mobile / native apps | Awkward: cookie handling | Natural: just a header |
| Different domains / microservices | Hard: cookies are tied to one domain | Easy: any service with the key can verify |
| CSRF risk | Yes, needs CSRF tokens | Not via headers |
| Logging out | Delete the session: instant | Token stays valid until it expires (unless blacklisted) |

> [!EXAM] Why JWT?
> JWT is **stateless**: the server doesn't store sessions, because the signed token itself proves who the user is. It works across domains, for mobile apps and for multiple servers, and is sent in the header `Authorization: Bearer <access_token>`.

## Anatomy of a JWT

A JWT is three Base64URL-encoded parts joined by dots: **header.payload.signature**

```text
header     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
payload   .eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzM1NzEyNDAwLCJ1c2VyX2lkIjoxfQ
signature .Wq2b9lE0lJ8wZ3hXr1kP4sQm0V7y2cTn5uFh8Jd6aXo
```

In a real token the three parts sit on one line with no spaces or labels. They're split here so you can see them.

**1. Header**: which algorithm signed it.

```json
{ "alg": "HS256", "typ": "JWT" }
```

**2. Payload**: the **claims**, statements about the user and the token.

```json
{
  "token_type": "access",
  "exp": 1735712400,
  "iat": 1735712100,
  "jti": "4f1c2a9e8b7d4c3e9f0a1b2c3d4e5f60",
  "user_id": 1
}
```

| Claim | Meaning |
|---|---|
| `exp` | Expiry time (Unix timestamp). After this, the token is rejected |
| `iat` | Issued-at time |
| `jti` | Unique token id (used for blacklisting) |
| `token_type` | `access` or `refresh` (SimpleJWT) |
| `user_id` | Who the token belongs to |
| Custom claims | Anything you add, such as `username` or `role` |

**3. Signature**: `HMACSHA256(base64(header) + "." + base64(payload), SECRET_KEY)`. If anyone changes a single character of the header or payload, the signature no longer matches and the server rejects the token.

> [!CAUTION] Signed, not encrypted
> Anyone can decode a JWT's payload (paste one into jwt.io and see). The signature only prevents **tampering**. Never put passwords or private data in a token.

## Access tokens and refresh tokens

SimpleJWT issues a **pair** of tokens at login:

| | Access token | Refresh token |
|---|---|---|
| Purpose | Sent with **every** API request | Used **only** to get a new access token |
| Lifetime (default) | **5 minutes** | **1 day** |
| Sent to | Every protected endpoint | Only `/api/token/refresh/` |
| If stolen | Usable briefly | Dangerous: keep it safe, rotate it |

Why two? A short-lived access token limits the damage if it leaks. The refresh token avoids making the user log in again every five minutes.

## The complete flow

```flow
Log in | POST /api/token/ with {"username", "password"}
Receive tokens | Server verifies the password and returns {"access": "...", "refresh": "..."}
Call the API | GET /api/players/ with header Authorization: Bearer <access>
Server verifies | Checks signature and expiry, loads request.user from user_id: no session lookup
Access expires | API answers 401 "Token is invalid or expired"
Refresh | POST /api/token/refresh/ with {"refresh": "..."} returns a new access token
Refresh expires | The user logs in again (step 1)
```

## Setting up SimpleJWT

### 1. Install

```bash
pip install djangorestframework-simplejwt
```

### 2. Settings

```python title="settings.py"
from datetime import timedelta

INSTALLED_APPS = [
    # ...
    "rest_framework",
    "rest_framework_simplejwt",                     # optional: for translations
    "rest_framework_simplejwt.token_blacklist",     # optional: for logout / rotation
    "players",
]

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",   # keeps the browsable API usable
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=15),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,          # refreshing also returns a NEW refresh token
    "BLACKLIST_AFTER_ROTATION": True,       # and the old refresh token stops working
    "UPDATE_LAST_LOGIN": True,              # update user.last_login when tokens are issued
    "AUTH_HEADER_TYPES": ("Bearer",),
}
```

If you added `token_blacklist`, run `python manage.py migrate`.

### 3. URLs

```python title="playerapi/urls.py"
from django.urls import include, path
from rest_framework_simplejwt.views import (
    TokenBlacklistView,
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

urlpatterns = [
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),
    path("api/token/blacklist/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("api/", include("players.urls")),
]
```

| Endpoint | Send | Get back |
|---|---|---|
| `POST /api/token/` | `{"username", "password"}` | `{"access", "refresh"}` |
| `POST /api/token/refresh/` | `{"refresh"}` | `{"access"}` (+ new `refresh` if rotating) |
| `POST /api/token/verify/` | `{"token"}` | `{}` with 200 if valid, 401 if not |
| `POST /api/token/blacklist/` | `{"refresh"}` | `{}`: that refresh token is revoked (logout) |

Your existing views and viewsets need **no changes**. `IsAuthenticated` works because `JWTAuthentication` sets `request.user` from the token.

## Using it

### Log in

```http
POST /api/token/
Content-Type: application/json

{ "username": "asha", "password": "S3cure-pass!" }
```

```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIs...",
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwi..."
}
```

Wrong credentials give `401` with `{"detail": "No active account found with the given credentials"}`.

### Call a protected endpoint

```http
GET /api/players/
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwi...
```

Without the header, or with an expired token:

```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid",
  "messages": [{ "token_class": "AccessToken", "token_type": "access", "message": "Token is invalid or expired" }]
}
```

### Refresh

```http
POST /api/token/refresh/
Content-Type: application/json

{ "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIs..." }
```

```json
{ "access": "eyJ...new access...", "refresh": "eyJ...new refresh (when ROTATE_REFRESH_TOKENS is on)..." }
```

### With curl

```bash
curl -X POST http://127.0.0.1:8000/api/token/ -H "Content-Type: application/json" -d "{\"username\":\"asha\",\"password\":\"S3cure-pass!\"}"

curl http://127.0.0.1:8000/api/players/ -H "Authorization: Bearer <paste access token>"
```

In Postman, use *Authorization → Bearer Token* (step by step in [Testing APIs with Postman](/learn/postman)).

## Logging out

A JWT can't be "deleted" from the server, because the server never stored it. Logging out means:

1. The client **throws away** both tokens.
2. The server **blacklists** the refresh token so it can't mint new access tokens.

The access token stays technically valid until it expires, which is why it should be short-lived.

```javascript
await fetch("/api/token/blacklist/", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ refresh: refreshToken }),
});
```

## Adding custom claims

Put extra information in the token, such as the username and role, so the frontend doesn't need another request:

```python title="accounts/tokens.py"
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        token["role"] = getattr(getattr(user, "profile", None), "role", "viewer")
        return token

    def validate(self, attrs):
        data = super().validate(attrs)            # {"refresh": ..., "access": ...}
        data["user"] = {"id": self.user.id, "username": self.user.username}
        return data                               # login response now includes the user
```

Use it everywhere with one setting:

```python title="settings.py"
SIMPLE_JWT = {
    # ...
    "TOKEN_OBTAIN_SERIALIZER": "accounts.tokens.MyTokenObtainPairSerializer",
}
```

Or wire a view explicitly: `TokenObtainPairView.as_view(serializer_class=MyTokenObtainPairSerializer)`.

## Issuing tokens yourself

For example, log a user straight in after they register:

```python title="accounts/views.py"
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": {"id": user.id, "username": user.username},
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )
```

## Using JWTs from a JavaScript frontend

```javascript
async function login(username, password) {
  const res = await fetch("/api/token/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json(); // { access, refresh }
}

async function api(path, tokens, options = {}) {
  const call = (access) =>
    fetch(path, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${access}` },
    });

  let res = await call(tokens.access);
  if (res.status === 401) {
    // access expired: try once to refresh
    const r = await fetch("/api/token/refresh/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: tokens.refresh }),
    });
    if (!r.ok) throw new Error("Session expired, please log in again");
    Object.assign(tokens, await r.json());
    res = await call(tokens.access);
  }
  return res;
}
```

> [!WARNING] Where should the browser keep tokens?
> `localStorage` is easy but any XSS bug on your site can read it. Safer patterns keep the access token **in memory** and the refresh token in an **HttpOnly, Secure cookie**. Whatever you choose: keep access tokens short-lived, always use HTTPS, and protect your site against XSS.

## SimpleJWT settings reference

| Setting | Default | Meaning |
|---|---|---|
| `ACCESS_TOKEN_LIFETIME` | 5 minutes | How long access tokens work |
| `REFRESH_TOKEN_LIFETIME` | 1 day | How long refresh tokens work |
| `ROTATE_REFRESH_TOKENS` | `False` | Return a new refresh token on every refresh |
| `BLACKLIST_AFTER_ROTATION` | `False` | Blacklist the old refresh token after rotation (needs the blacklist app) |
| `UPDATE_LAST_LOGIN` | `False` | Update `last_login` when a token is obtained |
| `ALGORITHM` | `"HS256"` | Signing algorithm (`RS256` uses a private/public key pair) |
| `SIGNING_KEY` | `SECRET_KEY` | The key that signs tokens |
| `AUTH_HEADER_TYPES` | `("Bearer",)` | The word before the token in the header |
| `USER_ID_FIELD` / `USER_ID_CLAIM` | `"id"` / `"user_id"` | How the user is identified in the payload |

> [!IMPORTANT]
> Tokens are signed with `SECRET_KEY` by default. If it leaks, anyone can forge tokens for any user. If you change it, every existing token becomes invalid (everyone is logged out).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `401 Authentication credentials were not provided` | Header missing, or misspelt (`Authorization`, not `Authorisation`) |
| `401 Given token not valid for any token type` | Access token expired or malformed, or you sent the refresh token |
| Works in the browser but not Postman | The browser used the session; Postman needs the Bearer header |
| `Bearer` vs `Token` mismatch | `JWTAuthentication` expects `Bearer`; DRF's `TokenAuthentication` expects `Token` |
| Refresh returns 401 "Token is blacklisted" | Rotation is on and an old refresh token was reused. Use the newest one |

## Summary

| Concept | Key fact |
|---|---|
| JWT | `header.payload.signature`, Base64URL-encoded, signed with a secret |
| Stateless | Server stores nothing; the signature proves authenticity |
| Access token | Short-lived, sent as `Authorization: Bearer <access>` |
| Refresh token | Longer-lived, exchanged for new access tokens |
| `TokenObtainPairView` | Login: username + password → access + refresh |
| `TokenRefreshView` | refresh → new access |
| `TokenVerifyView` | Check a token is valid |
| Logout | Discard tokens + blacklist the refresh token |
| Custom claims | Subclass `TokenObtainPairSerializer.get_token()` |

## Check yourself

<details>
<summary>What are the three parts of a JWT?</summary>

Header (algorithm and type), payload (claims such as `user_id` and `exp`), and signature (proves the first two weren't changed).
</details>

<details>
<summary>Why is the access token short-lived and the refresh token long-lived?</summary>

The access token is sent with every request, so it's more exposed; a short life limits damage if it leaks. The refresh token is used rarely and lets the user stay logged in without re-entering their password.
</details>

<details>
<summary>Exactly how do you send a JWT with a request?</summary>

In the HTTP header: `Authorization: Bearer <access_token>`.
</details>

<details>
<summary>Can a user read the data inside their JWT? Can they change it?</summary>

They can read it (the payload is only Base64-encoded). They can't change it without invalidating the signature, because they don't know the secret key.
</details>

<details>
<summary>Do you need to change your ViewSets to switch from session auth to JWT?</summary>

No. Add `JWTAuthentication` to `DEFAULT_AUTHENTICATION_CLASSES` and the token URLs. Views keep using `request.user` and their permission classes as before.
</details>
