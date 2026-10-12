HTTP is stateless: each request arrives with no memory of the last. Yet websites remember your cart, your login and your preferences. They do it with **cookies** and **sessions**. Django also has a **messages framework** for one-time notices like *"Your profile was saved."*

## Cookies

A **cookie** is a small piece of text the server asks the browser to store. The browser sends it back with every request to that site.

```python
def set_theme(request, theme):
    response = redirect("home")
    response.set_cookie("theme", theme, max_age=60 * 60 * 24 * 365, samesite="Lax")
    return response


def home(request):
    theme = request.COOKIES.get("theme", "light")
    ...


def forget_theme(request):
    response = redirect("home")
    response.delete_cookie("theme")
    return response
```

| `set_cookie` option | Meaning |
|---|---|
| `max_age` / `expires` | Lifetime. Without them, it's deleted when the browser closes |
| `httponly=True` | JavaScript can't read it (protects against XSS theft) |
| `secure=True` | Only sent over HTTPS |
| `samesite="Lax"` | Not sent with most cross-site requests (helps against CSRF) |

> [!WARNING]
> Users can read and edit their cookies. Never store anything sensitive or trusted (like "is_admin=true") in a plain cookie. Use `response.set_signed_cookie()` / `request.get_signed_cookie()` to detect tampering, or better, use sessions.

## Sessions

A **session** stores data on the **server**. The browser only holds a random **session id** in a cookie called `sessionid`. Django uses that id to load the right data on every request.

```flow
First visit | Django creates a session and sends Set-Cookie: sessionid=k3j9...
Server | Stores {"cart": [3, 7]} under key k3j9... in the django_session table
Next request | Browser sends Cookie: sessionid=k3j9...
Django | Loads the data into request.session before your view runs
```

`SessionMiddleware` and `django.contrib.sessions` are enabled by default. `request.session` behaves like a dictionary:

```python
def add_to_cart(request, product_id):
    cart = request.session.get("cart", [])
    if product_id not in cart:
        cart.append(product_id)
    request.session["cart"] = cart          # reassign so Django notices the change
    return redirect("cart")


def cart(request):
    ids = request.session.get("cart", [])
    products = Product.objects.filter(pk__in=ids)
    return render(request, "shop/cart.html", {"products": products})


def clear_cart(request):
    request.session.pop("cart", None)
    return redirect("cart")
```

Useful methods:

```python
request.session["key"] = value
request.session.get("key", default)
del request.session["key"]
"key" in request.session
request.session.set_expiry(300)          # expire after 5 minutes of inactivity
request.session.set_expiry(0)            # expire when the browser closes
request.session.flush()                  # delete the session and the cookie
request.session.modified = True          # force a save after mutating a nested object
```

> [!TIP] When does Django save the session?
> Only when you **assign** or **delete** a key. If you mutate a list in place (`request.session["cart"].append(5)`), Django can't see it. Reassign the value or set `request.session.modified = True`.

Values must be JSON-serialisable: strings, numbers, lists, dicts, booleans. Store a model's `pk`, not the model instance.

### A simple visit counter

```python
def home(request):
    visits = request.session.get("visits", 0) + 1
    request.session["visits"] = visits
    return render(request, "pages/home.html", {"visits": visits})
```

### Session settings

| Setting | Default | Meaning |
|---|---|---|
| `SESSION_ENGINE` | `"django.contrib.sessions.backends.db"` | Where data is stored: `db`, `cache`, `cached_db`, `file`, `signed_cookies` |
| `SESSION_COOKIE_AGE` | `1209600` (2 weeks) | Lifetime in seconds |
| `SESSION_EXPIRE_AT_BROWSER_CLOSE` | `False` | End the session when the browser closes |
| `SESSION_COOKIE_SECURE` | `False` | Only send over HTTPS (set `True` in production) |
| `SESSION_COOKIE_HTTPONLY` | `True` | Hide the cookie from JavaScript |
| `SESSION_SAVE_EVERY_REQUEST` | `False` | Refresh the expiry on every request |

Expired sessions pile up in the database; clean them periodically with `python manage.py clearsessions`.

### Sessions and login

Logging in is just a session: `login()` stores the user's id in `request.session`, and `AuthenticationMiddleware` reads it on every request to set `request.user`. `logout()` calls `flush()`. Django also changes the session id at login to prevent *session fixation* attacks.

## Cookies vs sessions

| | Cookie | Session |
|---|---|---|
| Data stored | In the browser | On the server (by default) |
| User can read / edit it | Yes | No (they only see a random id) |
| Size limit | About 4 KB | Practically none |
| Good for | Non-sensitive preferences (theme, language) | Cart, login state, multi-step forms |

## The messages framework

Messages are one-time notifications shown on the **next** page the user sees, perfect after a redirect.

```python
from django.contrib import messages


def player_create(request):
    form = PlayerForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        player = form.save()
        messages.success(request, f"{player.name} was added.")
        return redirect("player_list")
    if request.method == "POST":
        messages.error(request, "Please fix the errors below.")
    return render(request, "cricket/player_form.html", {"form": form})
```

| Function | Level / tag |
|---|---|
| `messages.debug(request, "...")` | `debug` (hidden by default) |
| `messages.info(request, "...")` | `info` |
| `messages.success(request, "...")` | `success` |
| `messages.warning(request, "...")` | `warning` |
| `messages.error(request, "...")` | `error` |

Display them once, in your base template, so every page gets them:

```django title="templates/base.html"
{% if messages %}
  <ul class="messages">
    {% for message in messages %}
      <li class="message {{ message.tags }}">{{ message }}</li>
    {% endfor %}
  </ul>
{% endif %}
```

Iterating over `messages` marks them as read, so they disappear on the next page. With class-based views, `SuccessMessageMixin` and `success_message = "Saved!"` do the same thing automatically.

## Summary

| Need | Tool |
|---|---|
| Remember a small, non-sensitive preference | Cookie: `response.set_cookie()` / `request.COOKIES` |
| Remember data per visitor safely | Session: `request.session["key"]` |
| End a session | `request.session.flush()` or `logout()` |
| Show a one-time notice after redirect | `messages.success(request, "...")` + loop in base template |

## Check yourself

<details>
<summary>Where is session data stored by default, and what does the browser hold?</summary>

In the `django_session` database table. The browser only holds a random session id in the `sessionid` cookie.
</details>

<details>
<summary>You append to <code>request.session["cart"]</code> but the change is lost on the next request. Why?</summary>

Mutating a list in place doesn't mark the session as modified. Reassign it (`request.session["cart"] = cart`) or set `request.session.modified = True`.
</details>

<details>
<summary>Why are messages useful after a redirect?</summary>

They're stored between requests, so a view can add a message, redirect (Post/Redirect/Get), and the next page displays it once.
</details>
