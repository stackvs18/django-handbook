You can test GET endpoints in a browser, but APIs also need POST, PUT, PATCH and DELETE requests with JSON bodies and auth headers. **Postman** is a free desktop and web app for sending any HTTP request, inspecting the response, saving requests into collections and even writing automated checks. It's the most common API testing tool, and an essential skill.

> [!TIP] Alternatives
> Thunder Client and REST Client (VS Code extensions), Insomnia, Bruno, HTTPie, and plain `curl` all do the same job. The ideas in this chapter apply to every one of them.

## Getting started

1. Download Postman from **postman.com/downloads** (or use the web version with the desktop agent so it can reach `localhost`).
2. Start your Django server: `python manage.py runserver`.
3. In Postman, click **New → HTTP Request**.

## Anatomy of a request in Postman

| Part of the screen | What you set |
|---|---|
| Method dropdown | GET, POST, PUT, PATCH, DELETE... |
| URL bar | `http://127.0.0.1:8000/api/players/` |
| **Params** tab | Query parameters (`?search=virat`), as a table |
| **Authorization** tab | Basic Auth, Bearer Token... |
| **Headers** tab | Custom headers (`Content-Type`, `Accept`...) |
| **Body** tab | The request body. For APIs choose **raw → JSON** |
| **Scripts** tab | JavaScript that runs before the request or after the response (tests) |
| Response panel | Status code, time, size, body (Pretty / Raw / Preview), headers, cookies |

## Testing a full CRUD API with JWT

Assume the API from the previous chapters, with SimpleJWT and `IsAuthenticated`.

### 1. Get a token

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `http://127.0.0.1:8000/api/token/` |
| Body | raw → JSON |

```json
{
  "username": "asha",
  "password": "S3cure-pass!"
}
```

Click **Send**. Expected: **200 OK** with `access` and `refresh` tokens. Copy the `access` value.

### 2. List players with the token

| Field | Value |
|---|---|
| Method | `GET` |
| URL | `http://127.0.0.1:8000/api/players/` |
| Authorization | Type **Bearer Token**, paste the access token |

Expected: **200 OK** and a JSON list. Try once *without* the token: **401 Unauthorized**.

Postman adds the header for you; you can see it under **Headers (hidden)**:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Create a player

`POST http://127.0.0.1:8000/api/players/`, same Bearer token, Body → raw → JSON:

```json
{
  "name": "Rohit Sharma",
  "country": "India",
  "test_innings": 116,
  "runs": 4301
}
```

Expected: **201 Created** with the new player, including its `id`. Send it with `"runs": -1` and you'll get **400 Bad Request** with the validation errors.

### 4. Retrieve, update, delete

| Action | Method & URL | Body | Expected |
|---|---|---|---|
| Retrieve | `GET /api/players/5/` | none | 200 |
| Full update | `PUT /api/players/5/` | every required field | 200 |
| Partial update | `PATCH /api/players/5/` | `{"runs": 4400}` | 200 |
| Delete | `DELETE /api/players/5/` | none | 204 |
| Retrieve again | `GET /api/players/5/` | none | 404 |

### 5. Refresh the token

When the access token expires you'll get 401. `POST /api/token/refresh/` with `{"refresh": "<refresh token>"}` returns a new access token.

## Reading responses

| Status | What it tells you | What to check |
|---|---|---|
| 200 / 201 / 204 | Success | Does the body match what you expected? |
| 400 | Your data is invalid | The JSON body lists field errors |
| 401 | Not authenticated | Token missing, expired, or `Bearer` misspelt |
| 403 | Authenticated but not allowed | Permission classes, or CSRF if using session auth |
| 404 | Wrong URL or object doesn't exist | Trailing slash! `/api/players/5` vs `/api/players/5/` |
| 405 | Method not allowed | The view doesn't support that method |
| 415 | Unsupported media type | Body type isn't JSON: choose raw → **JSON** |
| 500 | Server crashed | Look at the Django terminal for the traceback |

> [!WARNING] The trailing slash trap
> Django redirects `/api/players` to `/api/players/`, but a redirect can't carry a POST body. With `DEBUG = True` Django raises a *RuntimeError* explaining this; otherwise the data is simply lost. Always end API URLs with `/` in Postman.

## Environments and variables

Retyping `http://127.0.0.1:8000` and tokens gets old fast. Create an **environment** (top right → *Environments → +*), e.g. "Local":

| Variable | Value |
|---|---|
| `base_url` | `http://127.0.0.1:8000` |
| `access_token` | (empty for now) |
| `refresh_token` | (empty for now) |

Use them with double curly braces:

```text
{{base_url}}/api/players/
```

And in the Authorization tab: Bearer Token → `{{access_token}}`. Make a second environment "Production" with your live URL, then switch between them in one click.

## Saving tokens automatically

In the token request's **Scripts → Post-response** tab:

```javascript
const data = pm.response.json();
pm.environment.set("access_token", data.access);
pm.environment.set("refresh_token", data.refresh);
```

Now logging in once fills `{{access_token}}` for every other request.

## Collections

A **collection** is a folder of saved requests, such as "Player API" with sub-folders for Auth and Players. Benefits:

- Set **Authorization at the collection level** (Bearer `{{access_token}}`) and let each request *inherit auth from parent*.
- Run every request in order with the **Collection Runner**, a quick regression test.
- Export as JSON and commit it to your repository so teammates can import it.
- Generate documentation from it.

## Writing tests

Post-response scripts can make assertions. Postman shows passes and failures in the **Test Results** tab.

```javascript
pm.test("Status is 201 Created", function () {
  pm.response.to.have.status(201);
});

pm.test("Response has an id and the right name", function () {
  const body = pm.response.json();
  pm.expect(body).to.have.property("id");
  pm.expect(body.name).to.eql("Rohit Sharma");
});

pm.test("Responds in under 500ms", function () {
  pm.expect(pm.response.responseTime).to.be.below(500);
});

// keep the new id for the next request (e.g. GET {{base_url}}/api/players/{{player_id}}/)
pm.environment.set("player_id", pm.response.json().id);
```

A pre-request script runs before sending, for instance to generate unique test data:

```javascript
pm.variables.set("player_name", "Test Player " + Date.now());
```

```json
{ "name": "{{player_name}}", "country": "India", "runs": 100, "test_innings": 3 }
```

## Command-line runs

The **Postman CLI** (or the older **Newman**) runs exported collections in a terminal or a CI pipeline:

```bash
npm install -g newman
newman run player-api.postman_collection.json -e local.postman_environment.json
```

## Testing session-authenticated endpoints

If your API uses `SessionAuthentication` instead of tokens, Postman must log in through the site, keep the `sessionid` cookie, and send the CSRF token as an `X-CSRFToken` header on POST/PUT/PATCH/DELETE. It's fiddly, which is one more reason token or JWT auth is easier for API clients. For quick tests, **Basic Auth** (Authorization → Basic Auth) works if `BasicAuthentication` is enabled.

## A testing checklist for every endpoint

- **Happy path**: valid data → correct status and body
- **Validation**: missing fields, wrong types, out-of-range values → 400 with clear messages
- **Authentication**: no token → 401; expired token → 401
- **Authorization**: another user's object → 403 or 404; viewer role writing → 403
- **Not found**: a non-existent id → 404
- **Methods**: an unsupported method → 405
- **Filters and pagination**: `?search=`, `?ordering=`, `?page=` behave as documented

## Summary

| Task | In Postman |
|---|---|
| Send JSON | Body → raw → JSON |
| Use a JWT | Authorization → Bearer Token |
| Avoid retyping URLs | Environment variable `{{base_url}}` |
| Store tokens automatically | Post-response script: `pm.environment.set(...)` |
| Group requests | Collections (with inherited auth) |
| Assert results | `pm.test(...)` with `pm.response` and `pm.expect` |
| Run everything | Collection Runner, Postman CLI, Newman |

## Check yourself

<details>
<summary>Your POST from Postman returns 415 Unsupported Media Type. What's wrong?</summary>

The body isn't being sent as JSON. In the Body tab choose raw and set the type to JSON (which sets `Content-Type: application/json`).
</details>

<details>
<summary>How do you send a JWT access token in Postman?</summary>

Authorization tab → Type: Bearer Token → paste the access token (or `{{access_token}}`). Postman sends `Authorization: Bearer <token>`.
</details>

<details>
<summary>What is a Postman environment used for?</summary>

Storing variables such as `base_url` and tokens, so the same requests can run against different servers (local, staging, production) without editing each one.
</details>
