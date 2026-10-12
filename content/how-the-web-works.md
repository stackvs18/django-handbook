Before writing Django code it helps to understand the conversation Django takes part in. Every web framework, in every language, is built on the same small set of ideas: **clients, servers, requests and responses, spoken in HTTP.** Twenty minutes here will save you hours of confusion later.

## Client and server

- A **client** asks for things. Usually it's a web browser, but it could be a mobile app, Postman, or another program.
- A **server** is a program that listens for requests and answers them. Your Django project, once running, is a server.

```flow
Client (browser) | "Please give me /players/"
Server (Django) | Runs your code, builds a page
Client (browser) | Receives HTML and draws it on screen
```

The client always speaks first. A server never pushes a page to a browser that didn't ask.

## URLs

A **URL** (Uniform Resource Locator) is the address of a resource. Every part has a meaning:

```text
https://www.example.com:443/players/42/?tab=stats#bio
```

| Part | Example | Who uses it |
|---|---|---|
| Scheme | `https` | How to connect (HTTP, or HTTP with encryption) |
| Host | `www.example.com` | Which server. In development it's `127.0.0.1` (your own computer) |
| Port | `443` | Which "door" on the server. `runserver` uses `8000` |
| Path | `/players/42/` | **Django's `urls.py` matches this part** |
| Query string | `?tab=stats` | Extra parameters. Django gives them to you as `request.GET` |
| Fragment | `#bio` | Used only by the browser to jump within a page; never sent to the server |

## HTTP: the language of the web

**HTTP** (HyperText Transfer Protocol) is a simple text-based format for requests and responses. Here is a real request, exactly as a browser sends it:

```http
GET /players/?search=virat HTTP/1.1
Host: 127.0.0.1:8000
User-Agent: Mozilla/5.0 ...
Accept: text/html
Cookie: sessionid=abc123
```

And a response Django might send back:

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 1532

<!DOCTYPE html>
<html> ... the page ... </html>
```

Every request has a **method**, a **path**, **headers** and sometimes a **body**. Every response has a **status code**, **headers** and usually a **body**.

## HTTP methods

The method says *what the client wants to do*.

| Method | Meaning | Changes data? | Has a body? | Typical use |
|---|---|---|---|---|
| `GET` | Read something | No | No | Open a page, list players |
| `POST` | Create something / submit a form | Yes | Yes | Sign-up form, add a player |
| `PUT` | Replace something completely | Yes | Yes | API: update every field |
| `PATCH` | Change part of something | Yes | Yes | API: update one field |
| `DELETE` | Remove something | Yes | Usually no | API: delete a player |
| `HEAD` / `OPTIONS` | Ask about a resource without the body | No | No | Browsers and tools use these |

> [!IMPORTANT] The golden rule
> **GET must never change data.** Browsers pre-load links, search engines follow them and users bookmark them. Anything that creates, updates or deletes must use POST (or PUT/PATCH/DELETE in an API).

HTML forms can only send `GET` and `POST`. `PUT`, `PATCH` and `DELETE` are used by APIs, which you'll build with Django REST Framework.

## Status codes

The status code is a three-digit number that summarises the result. The first digit tells you the category:

| Range | Category | Mnemonic |
|---|---|---|
| `1xx` | Informational | "Hold on" |
| `2xx` | Success | "Here you go" |
| `3xx` | Redirection | "Go over there" |
| `4xx` | Client error | "You messed up" |
| `5xx` | Server error | "I messed up" |

The ones you will meet constantly:

| Code | Name | When you'll see it in Django |
|---|---|---|
| `200` | OK | A normal page or API response |
| `201` | Created | An API successfully created an object (POST) |
| `204` | No Content | An API successfully deleted something |
| `301` / `302` | Moved / Found | `redirect()` sends the browser elsewhere |
| `400` | Bad Request | Invalid data sent to an API |
| `401` | Unauthorized | Not logged in / missing or bad token |
| `403` | Forbidden | Logged in but not allowed, or CSRF check failed |
| `404` | Not Found | No URL matched, or `get_object_or_404` found nothing |
| `405` | Method Not Allowed | e.g. sending GET to a view that only accepts POST |
| `500` | Internal Server Error | An unhandled exception in your Python code |

## Headers

Headers are `Name: value` lines that carry extra information. A few you'll work with:

| Header | Direction | Purpose |
|---|---|---|
| `Content-Type` | Both | What the body contains: `text/html`, `application/json`, ... |
| `Authorization` | Request | Credentials, e.g. `Bearer <token>` for JWT |
| `Cookie` | Request | Cookies the browser stored for this site |
| `Set-Cookie` | Response | Asks the browser to store a cookie |
| `Location` | Response | Where to go next, sent with redirects |
| `Accept` | Request | What formats the client wants back |

## HTTP is stateless, so how do logins work?

Each request is independent: by default the server does **not** remember the previous one. So how does a site know you're logged in on the next page?

**Cookies.** After you log in, Django sends a `Set-Cookie: sessionid=...` header. Your browser stores it and sends it back automatically with every following request. Django looks up that session id and knows who you are. This is **session authentication**, covered in [Sessions, Cookies & Messages](/learn/sessions-and-messages).

APIs used by mobile apps often use **tokens** instead (such as JWT), sent in the `Authorization` header. See [JWT Authentication](/learn/jwt).

## HTML pages vs JSON APIs

A server can answer with different kinds of content:

```html title="HTML: for humans in a browser"
<h1>Virat Kohli</h1>
<p>Runs: 8848</p>
```

```json title="JSON: for programs"
{ "id": 1, "name": "Virat Kohli", "runs": 8848 }
```

Classic Django renders **HTML** with templates. **APIs** return **JSON** so any client (a React site, an Android app) can use the data however it likes. Django does both.

## Static vs dynamic

- A **static** page is a fixed file, the same for everyone: a CSS file, a logo, a PDF.
- A **dynamic** page is generated per request: your profile page, search results, your cart.

Django generates dynamic pages, and also has tools to manage the static files those pages use ([Static & Media Files](/learn/static-and-media)).

## Frontend and backend

- The **frontend** is what runs in the browser: HTML, CSS, JavaScript.
- The **backend** runs on the server: business logic, database, authentication.

Django is a **backend** framework. With templates it can also produce the frontend HTML (a *server-rendered* site). Or it can act purely as an API backend for a separate frontend.

## Where Django sits in production

During development `python manage.py runserver` does everything. In production the chain looks like this:

```flow
Browser | Sends the request over the internet
Web server (Nginx) | Handles HTTPS and serves static files quickly
App server (Gunicorn / Uvicorn) | Runs many copies of your Django code
Django (WSGI / ASGI) | Your project: URLs, views, models, templates
Database (PostgreSQL) | Stores the data
```

**WSGI** and **ASGI** are standard interfaces between Python web apps and servers. That's why every new project has `wsgi.py` and `asgi.py` files. More in [Deployment](/learn/deployment).

## Summary

| Concept | One-line meaning |
|---|---|
| Request / response | The client asks, the server answers |
| URL path | The part of the address Django routes on |
| GET vs POST | Read vs change. GET must never change data |
| Status code | Result in three digits: 2xx ok, 3xx redirect, 4xx your fault, 5xx server fault |
| Headers | Extra key–value information on requests and responses |
| Stateless | Each request stands alone; cookies or tokens carry identity |
| JSON | Data format used by APIs |

## Check yourself

<details>
<summary>Which part of <code>https://site.com/blog/7/?page=2</code> does Django's urls.py match against?</summary>

Only the path, `/blog/7/` (written without the leading slash in `urls.py` as `blog/7/`). The query string `?page=2` is available in the view as `request.GET["page"]`.
</details>

<details>
<summary>What's the difference between 401 and 403?</summary>

`401 Unauthorized` means "I don't know who you are" (not logged in, missing or invalid credentials). `403 Forbidden` means "I know who you are, but you're not allowed to do this".
</details>

<details>
<summary>If HTTP is stateless, how does a website remember that you are logged in?</summary>

The server gives the browser a session cookie after login. The browser sends it back with every request, and the server uses it to look up who you are.
</details>
