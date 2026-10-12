Time to put Parts 1 and 2 together. You'll build **Student Records**, a complete CRUD application: **C**reate, **R**ead, **U**pdate and **D**elete students, plus search, pagination, flash messages and validation. Every file is shown in full, so you can type it out and run it.

What you'll practise: models with choices and validation, a `ModelForm`, function-based views for every CRUD action, URL names, template inheritance, the messages framework and the admin.

## What we're building

| URL | Page |
|---|---|
| `/` | List of students with search and pagination |
| `/student/<id>/` | One student's details |
| `/student/new/` | Add a student |
| `/student/<id>/edit/` | Edit a student |
| `/student/<id>/delete/` | Confirm and delete |

## 1. Set up the project

```bash
mkdir student-records && cd student-records
python -m venv venv
venv\Scripts\activate            # macOS/Linux: source venv/bin/activate
pip install django
django-admin startproject config .
python manage.py startapp students
```

Naming the project package `config` is a popular convention: it makes clear that folder only holds configuration.

```python title="config/settings.py"
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "students",
]

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],      # project-wide base template
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
```

## 2. The model

```python title="students/models.py"
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.urls import reverse


class Student(models.Model):
    class Course(models.TextChoices):
        BCA = "BCA", "BCA"
        BSC_IT = "BSCIT", "B.Sc. IT"
        BTECH = "BTECH", "B.Tech"
        MCA = "MCA", "MCA"

    roll_number = models.CharField(max_length=12, unique=True)
    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    course = models.CharField(max_length=6, choices=Course, default=Course.BCA)
    semester = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)]
    )
    cgpa = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["roll_number"]

    def __str__(self):
        return f"{self.roll_number} · {self.name}"

    def get_absolute_url(self):
        return reverse("students:detail", kwargs={"pk": self.pk})
```

```bash
python manage.py makemigrations
python manage.py migrate
```

## 3. The admin

```python title="students/admin.py"
from django.contrib import admin
from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ("roll_number", "name", "course", "semester", "cgpa")
    list_filter = ("course", "semester")
    search_fields = ("roll_number", "name", "email")
```

```bash
python manage.py createsuperuser
```

## 4. The form

```python title="students/forms.py"
from django import forms
from .models import Student


class StudentForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = ["roll_number", "name", "email", "course", "semester", "cgpa"]
        labels = {"cgpa": "CGPA"}
        widgets = {
            "roll_number": forms.TextInput(attrs={"placeholder": "e.g. 23BCA041"}),
            "name": forms.TextInput(attrs={"placeholder": "Full name"}),
        }

    def clean_roll_number(self):
        return self.cleaned_data["roll_number"].strip().upper()

    def clean_name(self):
        name = self.cleaned_data["name"].strip()
        if len(name) < 2:
            raise forms.ValidationError("Please enter the full name.")
        return name.title()
```

The model already enforces uniqueness, choices, and the semester and CGPA ranges. The form adds clean-up rules: uppercase roll numbers and title-cased names.

## 5. The views

```python title="students/views.py"
from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render

from .forms import StudentForm
from .models import Student


def student_list(request):
    query = request.GET.get("q", "").strip()
    students = Student.objects.all()
    if query:
        students = students.filter(
            Q(name__icontains=query) | Q(roll_number__icontains=query) | Q(email__icontains=query)
        )
    page = Paginator(students, 10).get_page(request.GET.get("page"))
    return render(request, "students/student_list.html", {"page": page, "query": query})


def student_detail(request, pk):
    student = get_object_or_404(Student, pk=pk)
    return render(request, "students/student_detail.html", {"student": student})


def student_create(request):
    form = StudentForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        student = form.save()
        messages.success(request, f"{student.name} was added.")
        return redirect(student)                         # uses get_absolute_url()
    return render(request, "students/student_form.html", {"form": form})


def student_update(request, pk):
    student = get_object_or_404(Student, pk=pk)
    form = StudentForm(request.POST or None, instance=student)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Changes saved.")
        return redirect(student)
    return render(request, "students/student_form.html", {"form": form, "student": student})


def student_delete(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == "POST":
        student.delete()
        messages.success(request, f"{student.name} was deleted.")
        return redirect("students:list")
    return render(request, "students/student_confirm_delete.html", {"student": student})
```

Notice the pattern repeats: **fetch → (on POST) validate and save → redirect with a message**, otherwise render.

## 6. The URLs

```python title="students/urls.py"
from django.urls import path
from . import views

app_name = "students"

urlpatterns = [
    path("", views.student_list, name="list"),
    path("student/new/", views.student_create, name="create"),
    path("student/<int:pk>/", views.student_detail, name="detail"),
    path("student/<int:pk>/edit/", views.student_update, name="update"),
    path("student/<int:pk>/delete/", views.student_delete, name="delete"),
]
```

```python title="config/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("students.urls")),
]
```

## 7. The templates

A base layout with a little CSS and the messages block:

```django title="templates/base.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}Student Records{% endblock %}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: .5rem; border-bottom: 1px solid #ddd; }
    .messages li { background: #111; color: #fff; padding: .6rem 1rem; list-style: none; margin-bottom: .5rem; }
    .errorlist { color: #b00; }
    nav a { margin-right: 1rem; }
  </style>
</head>
<body>
  <nav>
    <a href="{% url 'students:list' %}">All students</a>
    <a href="{% url 'students:create' %}">Add student</a>
    <a href="{% url 'admin:index' %}">Admin</a>
  </nav>

  {% if messages %}
    <ul class="messages">
      {% for message in messages %}<li>{{ message }}</li>{% endfor %}
    </ul>
  {% endif %}

  {% block content %}{% endblock %}
</body>
</html>
```

```django title="students/templates/students/student_list.html"
{% extends "base.html" %}

{% block content %}
<h1>Students</h1>

<form method="get">
  <input type="search" name="q" value="{{ query }}" placeholder="Search name, roll no. or email">
  <button type="submit">Search</button>
  {% if query %}<a href="{% url 'students:list' %}">Clear</a>{% endif %}
</form>

<table>
  <tr><th>Roll no.</th><th>Name</th><th>Course</th><th>Sem</th><th>CGPA</th></tr>
  {% for s in page %}
    <tr>
      <td>{{ s.roll_number }}</td>
      <td><a href="{{ s.get_absolute_url }}">{{ s.name }}</a></td>
      <td>{{ s.get_course_display }}</td>
      <td>{{ s.semester }}</td>
      <td>{{ s.cgpa|default:"—" }}</td>
    </tr>
  {% empty %}
    <tr><td colspan="5">No students found.</td></tr>
  {% endfor %}
</table>

{% if page.paginator.num_pages > 1 %}
  <p>
    {% if page.has_previous %}<a href="?q={{ query|urlencode }}&page={{ page.previous_page_number }}">← Prev</a>{% endif %}
    Page {{ page.number }} of {{ page.paginator.num_pages }}
    {% if page.has_next %}<a href="?q={{ query|urlencode }}&page={{ page.next_page_number }}">Next →</a>{% endif %}
  </p>
{% endif %}
{% endblock %}
```

```django title="students/templates/students/student_detail.html"
{% extends "base.html" %}

{% block title %}{{ student.name }}{% endblock %}

{% block content %}
<h1>{{ student.name }}</h1>
<dl>
  <dt>Roll number</dt><dd>{{ student.roll_number }}</dd>
  <dt>Email</dt><dd>{{ student.email }}</dd>
  <dt>Course</dt><dd>{{ student.get_course_display }}, semester {{ student.semester }}</dd>
  <dt>CGPA</dt><dd>{{ student.cgpa|default:"Not recorded" }}</dd>
  <dt>Last updated</dt><dd>{{ student.updated_at|timesince }} ago</dd>
</dl>
<a href="{% url 'students:update' student.pk %}">Edit</a> ·
<a href="{% url 'students:delete' student.pk %}">Delete</a>
{% endblock %}
```

```django title="students/templates/students/student_form.html"
{% extends "base.html" %}

{% block content %}
<h1>{% if student %}Edit {{ student.name }}{% else %}Add a student{% endif %}</h1>

<form method="post" novalidate>
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Save</button>
  <a href="{% if student %}{{ student.get_absolute_url }}{% else %}{% url 'students:list' %}{% endif %}">Cancel</a>
</form>
{% endblock %}
```

```django title="students/templates/students/student_confirm_delete.html"
{% extends "base.html" %}

{% block content %}
<h1>Delete student</h1>
<p>Are you sure you want to delete <strong>{{ student }}</strong>? This can't be undone.</p>
<form method="post">
  {% csrf_token %}
  <button type="submit">Yes, delete</button>
  <a href="{{ student.get_absolute_url }}">Cancel</a>
</form>
{% endblock %}
```

`novalidate` on the form switches off the browser's own checks so you can see Django's server-side validation messages while testing. Remove it in production if you like the instant browser feedback.

## 8. Run it

```bash
python manage.py runserver
```

Test every path:

1. Add a student. Try a semester of `12` and see the validation error.
2. Add another with the same roll number: *"Student with this Roll number already exists."*
3. Edit a student, then search for them.
4. Add 11+ students (or use the admin) and check pagination.
5. Delete one: you get a confirmation page, then a message.

## How the pieces connect

```flow
GET /student/new/ | student_create builds an empty StudentForm and renders student_form.html
POST /student/new/ | The form is bound to request.POST and validated (model rules + clean_ methods)
Invalid? | The same template is rendered again with the user's input and error messages
Valid | form.save() INSERTs the row, messages.success() queues a notice
Redirect | redirect(student) sends the browser to /student/<id>/ (Post/Redirect/Get)
Detail page | Renders the student; base.html shows the queued message once
```

## Challenges

Try extending the project on your own:

1. Add a `photo = models.ImageField(...)` and show it on the detail page ([Static & Media](/learn/static-and-media)).
2. Rewrite the five views as class-based views ([Class-Based Views](/learn/class-based-views)). It should take about 30 lines.
3. Add a `Course` model and turn `course` into a `ForeignKey` ([Relationships](/learn/relationships)).
4. Add an *Export to CSV* view using Python's `csv` module and `HttpResponse(content_type="text/csv")`.
5. Require login for create, edit and delete ([Authentication](/learn/authentication)).
6. Write tests for each view ([Testing](/learn/testing)).

## Check yourself

<details>
<summary>Why does <code>student_delete</code> render a confirmation page on GET instead of deleting immediately?</summary>

GET requests must not change data. The confirmation page shows a POST form with a CSRF token, so deletion only happens through a deliberate, protected submission.
</details>

<details>
<summary>How does <code>redirect(student)</code> know where to go?</summary>

It calls the model's `get_absolute_url()` method, which reverses the `students:detail` URL with the student's pk.
</details>

<details>
<summary>Where does the error for a duplicate roll number come from?</summary>

From the model field's `unique=True`. `ModelForm` validation checks uniqueness against the database during `is_valid()`.
</details>
