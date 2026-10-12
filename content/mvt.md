Django organises every application into three kinds of code: **Models**, **Views** and **Templates**. This is called the **MVT architecture**. Once you understand who does what, you'll always know which file to open.

## The three parts

| Part | File | Job | Analogy (a restaurant) |
|---|---|---|---|
| **Model** | `models.py` | Defines the data and talks to the database | The kitchen's storeroom and its inventory list |
| **View** | `views.py` | Receives a request, runs the logic, returns a response | The waiter: takes your order, fetches food, brings it back |
| **Template** | `templates/*.html` | Decides how the data *looks* | The plate and presentation |

And one more piece ties them together:

| Part | File | Job |
|---|---|---|
| **URL dispatcher** | `urls.py` | Decides which view handles which URL (the restaurant's host, seating you at the right table) |

## How a request flows through MVT

Suppose a visitor opens `/players/`:

```flow
Request | The browser sends GET /players/ to Django
URL dispatcher | urls.py matches "players/" and picks views.player_list
View | player_list(request) runs and asks the model for data
Model | Player.objects.order_by("-runs") becomes SQL; the database returns rows as Player objects
Template | The view passes the players to player_list.html, which builds the HTML
Response | The view returns an HttpResponse containing that HTML
```

Here is all of that in code. It's small:

```python title="players/models.py: the Model"
from django.db import models


class Player(models.Model):
    name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)
```

```python title="players/urls.py: the URL map"
from django.urls import path
from . import views

urlpatterns = [
    path("players/", views.player_list, name="player_list"),
]
```

```python title="players/views.py: the View"
from django.shortcuts import render
from .models import Player


def player_list(request):
    players = Player.objects.order_by("-runs")          # ask the Model
    return render(request, "players/player_list.html",   # hand data to the Template
                  {"players": players})
```

```django title="players/templates/players/player_list.html: the Template"
<h1>Top run scorers</h1>
<ul>
  {% for p in players %}
    <li>{{ p.name }}: {{ p.runs }}</li>
  {% empty %}
    <li>No players yet.</li>
  {% endfor %}
</ul>
```

Notice how each file has exactly one responsibility. The template doesn't know about the database. The model doesn't know about HTML. The view connects them.

## The Model in more detail

A model is a Python class that subclasses `models.Model`. Each class becomes a **database table**, each attribute a **column** and each instance a **row**.

| Python | Database |
|---|---|
| `class Player(models.Model)` | Table `players_player` |
| `name = models.CharField(...)` | Column `name VARCHAR(100)` |
| `Player(name="Rohit", runs=4301)` | One row |
| `Player.objects.filter(runs__gt=5000)` | `SELECT ... WHERE runs > 5000` |

The model is also where **business rules about data** belong: validation, default values, computed properties, ordering. See [Models & Fields](/learn/models) and [The ORM](/learn/orm).

## The View in more detail

A view is any Python callable that:

1. takes an `HttpRequest` object as its first argument, and
2. returns an `HttpResponse` object (or raises an exception like `Http404`).

That's the entire contract. Inside, you can do anything Python can do: query the database, call an API, send an email, check permissions.

Views come in two styles:

- **Function-based views** (FBVs), simple functions, covered in [Views](/learn/views)
- **Class-based views** (CBVs), reusable classes such as `ListView`, covered in [Class-Based Views](/learn/class-based-views)

## The Template in more detail

A template is a text file (usually HTML) containing the **Django Template Language (DTL)**:

- `{{ variable }}` prints a value
- `{% tag %}` runs logic: loops, conditions, inheritance
- `{{ value|filter }}` transforms a value: `{{ name|upper }}`, `{{ date|date:"d M Y" }}`

Templates are deliberately limited. You can't run arbitrary Python in them, which keeps logic in the view where it belongs. See [Templates](/learn/templates).

## MVT vs MVC

You may have heard of **MVC (Model–View–Controller)**, used by frameworks like Ruby on Rails, Laravel and Spring. The ideas are the same, but the names are shuffled:

| Responsibility | MVC name | Django (MVT) name |
|---|---|---|
| Data and database | Model | **Model** |
| Presentation / what the user sees | View | **Template** |
| Logic that handles the request | Controller | **View** |
| Routing requests to the logic | Part of the controller | **URLconf** (and Django itself) |

So Django's **View** plays the role of MVC's **Controller**, and Django's **Template** plays MVC's **View**. Django's documentation explains that the "controller" is really the framework itself: the machinery that reads `urls.py` and calls the right view.

> [!EXAM] One-line answer
> In MVT, the **Model** handles data, the **View** handles logic (the "controller" in MVC terms), and the **Template** handles presentation. Django itself acts as the controller by routing URLs to views.

## Where does everything else go?

| You want to... | Put it in |
|---|---|
| Describe data, its fields and rules | `models.py` |
| Decide what happens for a URL | `views.py` |
| Map URLs to views | `urls.py` |
| Control HTML output | `templates/` |
| Define and validate user input | `forms.py` ([Forms](/learn/forms)) |
| Configure the admin | `admin.py` |
| Convert data to and from JSON for an API | `serializers.py` ([Serializers](/learn/serializers)) |
| CSS, JS, images | `static/` |
| Project-wide configuration | `settings.py` |

## MVT in API projects

When you build a REST API with Django REST Framework, nobody looks at HTML, so the **Template** step disappears. Its place is taken by a **Serializer**, which turns model objects into JSON instead of into HTML:

```flow
URL / Router | Matches /api/players/ to a ViewSet
View / ViewSet | Handles GET, POST, PUT, DELETE
Model | Reads or writes the database
Serializer | Converts model objects ⇄ JSON and validates input
Response | JSON goes back to the client
```

You'll sometimes see this described informally as **Model–Serializer–View**. The model and view keep exactly the same jobs; only the presentation layer changes. [APIs & REST](/learn/rest-apis) picks this up.

## Summary

- **Model**: data structure and database access (`models.py`)
- **View**: request-handling logic (`views.py`)
- **Template**: presentation, HTML (`templates/`)
- **URLconf**: maps URLs to views (`urls.py`)
- Django's View ≈ MVC's Controller; Django's Template ≈ MVC's View
- In DRF, a Serializer replaces the Template and outputs JSON

## Check yourself

<details>
<summary>In MVT, which component corresponds to the Controller in MVC?</summary>

The **View** (together with Django's URL dispatcher, which routes requests to it).
</details>

<details>
<summary>What two things must every Django view do?</summary>

Accept an `HttpRequest` as its first argument and return an `HttpResponse` (or raise an exception such as `Http404`).
</details>

<details>
<summary>Why can't you write arbitrary Python inside a Django template?</summary>

By design: keeping logic out of templates forces it into views and models, where it can be tested and reused. Templates stay focused on presentation and are safer to hand to designers.
</details>
