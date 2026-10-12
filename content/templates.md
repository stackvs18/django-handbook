Templates turn data into HTML. Django's template engine, the **Django Template Language (DTL)**, is deliberately simple: it can display values, loop and branch, but it can't run arbitrary Python. That keeps your logic in views and your HTML readable.

## Where templates live

With `APP_DIRS: True` (the default), Django looks in a `templates/` folder inside each installed app:

```text
blog/
└── templates/
    └── blog/              <- namespace folder (same name as the app)
        ├── post_list.html
        └── post_detail.html
```

You reference them as `"blog/post_list.html"`. For templates shared by the whole site, add a project-level folder:

```python title="settings.py"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        # ...
    }
]
```

```text
mysite/
├── templates/
│   └── base.html          <- shared layout
├── blog/
└── manage.py
```

Django searches `DIRS` first, then each app's `templates/` folder in `INSTALLED_APPS` order.

## The three building blocks

| Syntax | Name | Purpose |
|---|---|---|
| `{{ ... }}` | Variable | Output a value |
| `{% ... %}` | Tag | Logic: loops, conditions, inheritance, URLs |
| `{{ value\|filter }}` | Filter | Transform a value before output |
| `{# ... #}` | Comment | Single-line comment, not sent to the browser |

## Variables

Whatever you put in the context dictionary becomes available:

```python
return render(request, "blog/post_detail.html", {"post": post, "related": related})
```

```django
<h1>{{ post.title }}</h1>
<p>By {{ post.author.username }} on {{ post.created_at }}</p>
<p>{{ post.comments.count }} comments</p>
<p>First tag: {{ post.tags.all.0 }}</p>
```

The **dot** is clever. For `{{ post.title }}` Django tries, in order:

1. Dictionary lookup: `post["title"]`
2. Attribute or method: `post.title` (methods are *called* with no arguments, so no parentheses)
3. List index: `post[0]` for `{{ items.0 }}`

Missing variables print as an empty string instead of crashing.

> [!NOTE] Automatic escaping
> Every `{{ variable }}` is **HTML-escaped** by default: `<script>` becomes `&lt;script&gt;`. This protects you from cross-site scripting (XSS). Only mark content as safe (`|safe`) when you're certain it contains no user input.

## Tags

### if / elif / else

```django
{% if user.is_authenticated %}
  <p>Welcome back, {{ user.username }}!</p>
{% elif show_signup %}
  <a href="{% url 'signup' %}">Create an account</a>
{% else %}
  <a href="{% url 'login' %}">Log in</a>
{% endif %}
```

Supports `and`, `or`, `not`, `==`, `!=`, `<`, `>`, `<=`, `>=`, `in`, `not in`, `is`.

```django
{% if post.likes > 100 and not post.is_archived %}Popular!{% endif %}
{% if "django" in post.tags_text %}...{% endif %}
```

### for

```django
<ul>
{% for post in posts %}
  <li class="{% cycle 'odd' 'even' %}">
    {{ forloop.counter }}. {{ post.title }}
  </li>
{% empty %}
  <li>No posts yet.</li>
{% endfor %}
</ul>
```

`{% empty %}` renders when the list is empty. Inside a loop, `forloop` gives you:

| Variable | Value |
|---|---|
| `forloop.counter` | 1, 2, 3... |
| `forloop.counter0` | 0, 1, 2... |
| `forloop.revcounter` | Counts down to 1 |
| `forloop.first` / `forloop.last` | `True` on the first / last iteration |
| `forloop.parentloop` | The outer loop in nested loops |

Looping over a dictionary:

```django
{% for key, value in stats.items %}
  {{ key }}: {{ value }}
{% endfor %}
```

### url

```django
<a href="{% url 'post_detail' pk=post.pk %}">Read more</a>
<a href="{% url 'blog:list' %}">All posts</a>

{% url 'post_detail' pk=post.pk as detail_url %}
<a href="{{ detail_url }}">Saved to a variable</a>
```

### Other useful tags

| Tag | Example | Purpose |
|---|---|---|
| `{% csrf_token %}` | inside `<form method="post">` | CSRF protection, required for POST forms |
| `{% with %}` | `{% with total=order.items.count %}...{% endwith %}` | Store a value under a short name |
| `{% now %}` | `{% now "Y" %}` | Current date/time |
| `{% include %}` | `{% include "blog/_card.html" with post=p %}` | Insert another template |
| `{% load %}` | `{% load static %}` | Load a tag library |
| `{% spaceless %}` | | Remove whitespace between tags |
| `{% verbatim %}` | | Output `{{ }}` literally (for Vue/Alpine templates) |
| `{% comment %}` | `{% comment %}...{% endcomment %}` | Multi-line comment |
| `{% firstof %}` | `{% firstof nickname name "Guest" %}` | First truthy value |
| `{% lorem %}` | `{% lorem 2 p %}` | Placeholder text |

## Filters

Filters transform values with a pipe `|`, and can be chained:

```django
{{ post.title|upper }}
{{ post.body|truncatewords:30 }}
{{ post.created_at|date:"d M Y, H:i" }}
{{ user.first_name|default:"friend" }}
{{ price|floatformat:2 }}
{{ items|length }} item{{ items|length|pluralize }}
{{ post.body|linebreaks }}
{{ title|lower|capfirst }}
```

The filters you'll use most:

| Filter | Example | Result |
|---|---|---|
| `default` | `{{ x\|default:"—" }}` | Fallback for empty or falsy values |
| `length` | `{{ list\|length }}` | Number of items |
| `lower` / `upper` / `title` / `capfirst` | `{{ "hi there"\|title }}` | `Hi There` |
| `truncatechars` / `truncatewords` | `{{ text\|truncatewords:10 }}` | Shortened text with "…" |
| `date` / `time` | `{{ d\|date:"D, d M Y" }}` | `Mon, 06 Jan 2025` |
| `timesince` / `timeuntil` | `{{ post.created_at\|timesince }}` | `3 days, 2 hours` |
| `floatformat` | `{{ 3.14159\|floatformat:2 }}` | `3.14` |
| `pluralize` | `comment{{ n\|pluralize }}` | `comment` / `comments` |
| `join` | `{{ tags\|join:", " }}` | `a, b, c` |
| `linebreaks` / `linebreaksbr` | | Newlines → `<p>` / `<br>` |
| `slugify` | `{{ "Hello World"\|slugify }}` | `hello-world` |
| `urlencode` | `?q={{ q\|urlencode }}` | Safe for URLs |
| `yesno` | `{{ active\|yesno:"On,Off" }}` | `On` / `Off` |
| `safe` | `{{ trusted_html\|safe }}` | Don't escape (careful!) |
| `escape` / `striptags` | | Force escaping / remove HTML tags |
| `first` / `last` / `slice` | `{{ list\|slice:":3" }}` | Parts of a list |
| `add` | `{{ count\|add:1 }}` | Add numbers |
| `filesizeformat` | `{{ 123456\|filesizeformat }}` | `120.6 KB` |

## Template inheritance

This is the most powerful feature of DTL. Write the page skeleton **once** in a base template, with **blocks** that child templates fill in.

```django title="templates/base.html"
{% load static %}
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}My Site{% endblock %}</title>
  <link rel="stylesheet" href="{% static 'css/site.css' %}">
  {% block extra_head %}{% endblock %}
</head>
<body>
  <header>
    <a href="{% url 'home' %}">Home</a>
    {% if user.is_authenticated %}
      <span>Hi, {{ user.username }}</span>
    {% else %}
      <a href="{% url 'login' %}">Log in</a>
    {% endif %}
  </header>

  <main>
    {% block content %}{% endblock %}
  </main>

  <footer>&copy; {% now "Y" %} My Site</footer>
</body>
</html>
```

```django title="blog/templates/blog/post_detail.html"
{% extends "base.html" %}

{% block title %}{{ post.title }} | {{ block.super }}{% endblock %}

{% block content %}
  <article>
    <h1>{{ post.title }}</h1>
    {{ post.body|linebreaks }}
  </article>
{% endblock %}
```

Rules:

- `{% extends %}` must be the **first tag** in the child template.
- The child can only put content inside blocks. Anything outside blocks is ignored.
- Blocks the child doesn't override keep the parent's default content.
- `{{ block.super }}` inserts the parent's content for that block.
- Inheritance can go several levels deep: `base.html` → `blog/base_blog.html` → `blog/post_detail.html`.

## include: reusable fragments

```django title="blog/templates/blog/_post_card.html"
<div class="card">
  <h3><a href="{% url 'post_detail' post.pk %}">{{ post.title }}</a></h3>
  <p>{{ post.body|truncatewords:25 }}</p>
</div>
```

```django
{% for p in posts %}
  {% include "blog/_post_card.html" with post=p %}
{% endfor %}
```

Add `only` (`with post=p only`) to pass *just* those variables and nothing else from the context.

> [!TIP] Template partials (Django 6.0+)
> Django 6.0 adds `{% partialdef name %}...{% endpartialdef %}` and `{% partial name %}`, letting you define small reusable fragments *inside* one template file and render one directly with `"template.html#name"`. Handy with htmx. On older versions, use `{% include %}`.

## Static files in templates

```django
{% load static %}
<link rel="stylesheet" href="{% static 'css/site.css' %}">
<img src="{% static 'img/logo.png' %}" alt="Logo">
```

Details in [Static & Media Files](/learn/static-and-media).

## Context processors: variables everywhere

Some variables are available in every template without passing them, thanks to **context processors** in settings: `user`, `perms`, `request`, `messages`, `csrf_token`. You can write your own:

```python title="core/context_processors.py"
from django.conf import settings


def site_info(request):
    return {"SITE_NAME": "Player Hub", "SUPPORT_EMAIL": settings.DEFAULT_FROM_EMAIL}
```

```python title="settings.py"
TEMPLATES[0]["OPTIONS"]["context_processors"].append("core.context_processors.site_info")
```

Now `{{ SITE_NAME }}` works in any template.

## Custom filters and tags

When built-ins aren't enough, create a `templatetags` package in your app:

```text
blog/
└── templatetags/
    ├── __init__.py
    └── blog_extras.py
```

```python title="blog/templatetags/blog_extras.py"
from django import template

register = template.Library()


@register.filter
def initials(value):
    """'Virat Kohli' -> 'VK'"""
    return "".join(word[0].upper() for word in str(value).split())


@register.simple_tag
def multiply(a, b):
    return a * b


@register.inclusion_tag("blog/_latest.html")
def latest_posts(count=5):
    from blog.models import Post
    return {"posts": Post.objects.order_by("-created_at")[:count]}
```

```django
{% load blog_extras %}
{{ player.name|initials }}
{% multiply 4 5 %}
{% latest_posts 3 %}
```

Restart the development server after creating a new `templatetags` module.

## Keep logic out of templates

If a template needs a complicated condition, compute it in the view or as a model property:

```python title="models.py"
class Player(models.Model):
    runs = models.IntegerField()
    innings = models.IntegerField()

    @property
    def average(self):
        return round(self.runs / self.innings, 2) if self.innings else 0
```

```django
Average: {{ player.average }}
```

## Summary

| You want to... | Use |
|---|---|
| Print a value | `{{ value }}` |
| Transform it | `{{ value\|filter:arg }}` |
| Branch or loop | `{% if %}`, `{% for %}...{% empty %}` |
| Link to a page | `{% url 'name' args %}` |
| Share a layout | `{% extends %}` + `{% block %}` |
| Reuse a fragment | `{% include %}` |
| Link CSS/JS/images | `{% load static %}` + `{% static 'path' %}` |
| Protect a POST form | `{% csrf_token %}` |

## Check yourself

<details>
<summary>Where must <code>{% extends %}</code> appear in a child template?</summary>

It must be the first template tag in the file.
</details>

<details>
<summary>Why does <code>{{ comment.text }}</code> not execute a <code>&lt;script&gt;</code> a user typed into a comment?</summary>

Django auto-escapes variable output, converting `<` and `>` into HTML entities, so the browser displays the text instead of running it.
</details>

<details>
<summary>How do you show "No results" when a list passed to a for loop is empty?</summary>

Use `{% empty %}` inside the `{% for %}` block.
</details>
