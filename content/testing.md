Every time you change code you risk breaking something that used to work. **Automated tests** check your application for you in seconds, every time. Django has a testing framework built in, based on Python's `unittest`, with extras for databases, requests and templates. DRF adds tools for APIs.

## Your first test

```python title="cricket/tests.py"
from django.test import TestCase

from .models import Player


class PlayerModelTests(TestCase):
    def test_str_returns_name(self):
        player = Player.objects.create(name="Virat Kohli", runs=8848, innings=191)
        self.assertEqual(str(player), "Virat Kohli")
```

```bash
python manage.py test
```

```text
Creating test database for alias 'default'...
.
----------------------------------------------------------------------
Ran 1 test in 0.004s

OK
Destroying test database for alias 'default'...
```

What Django did for you:

1. Found every file named `test*.py` in your apps.
2. Created a **separate, empty test database** (your real data is never touched).
3. Ran each method whose name starts with `test`.
4. Wrapped each test in a transaction and **rolled it back** afterwards, so tests can't affect each other.

```bash
python manage.py test cricket                                  # one app
python manage.py test cricket.tests.PlayerModelTests           # one class
python manage.py test cricket.tests.PlayerModelTests.test_str_returns_name   # one test
python manage.py test --parallel                               # use several CPU cores
python manage.py test -v 2                                     # more detail
```

## Arrange, act, assert

A good test has three parts:

```python
def test_average_ignores_not_outs(self):
    # Arrange: set up the data
    player = Player.objects.create(name="Test", runs=300, innings=10, not_outs=4)
    # Act: do the thing being tested
    avg = player.average
    # Assert: check the result
    self.assertEqual(avg, 50.0)
```

## Useful assertions

| Assertion | Checks |
|---|---|
| `assertEqual(a, b)` / `assertNotEqual` | `a == b` |
| `assertTrue(x)` / `assertFalse(x)` | Truthiness |
| `assertIn(a, b)` | `a in b` |
| `assertIsNone(x)` | `x is None` |
| `assertRaises(Error)` | Code raises an exception (use as a context manager) |
| `assertContains(response, text)` | Response is 200 and contains text |
| `assertNotContains(response, text)` | Text isn't in the response |
| `assertRedirects(response, url)` | Response redirects to url |
| `assertTemplateUsed(response, name)` | That template was rendered |
| `assertFormError(form, field, errors)` | A form has that error |
| `assertQuerySetEqual(qs, values)` | QuerySet matches expected values |
| `assertNumQueries(n)` | Code runs exactly n queries (context manager) |

## setUp and setUpTestData

```python
class PlayerViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        # runs ONCE for the whole class: fast, for data tests only read
        cls.team = Team.objects.create(name="India", country="India")
        cls.player = Player.objects.create(name="Rohit", team=cls.team, runs=4301)

    def setUp(self):
        # runs before EVERY test
        self.url = "/players/"
```

Use `setUpTestData` when you can; it's much faster for big test suites.

## Testing models

```python
from django.core.exceptions import ValidationError


class StudentModelTests(TestCase):
    def test_semester_out_of_range_is_invalid(self):
        s = Student(roll_number="23BCA001", name="Asha", email="a@x.com", semester=12)
        with self.assertRaises(ValidationError):
            s.full_clean()

    def test_absolute_url(self):
        s = Student.objects.create(roll_number="23BCA001", name="Asha",
                                   email="a@x.com", semester=3)
        self.assertEqual(s.get_absolute_url(), f"/student/{s.pk}/")
```

## Testing views with the test client

`self.client` is a fake browser. It sends requests straight to Django, with no server needed:

```python
from django.urls import reverse


class StudentViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.student = Student.objects.create(
            roll_number="23BCA001", name="Asha", email="a@x.com", semester=3
        )

    def test_list_page_shows_students(self):
        response = self.client.get(reverse("students:list"))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Asha")
        self.assertTemplateUsed(response, "students/student_list.html")

    def test_search_filters_results(self):
        Student.objects.create(roll_number="23BCA002", name="Ravi", email="r@x.com", semester=3)
        response = self.client.get(reverse("students:list"), {"q": "ravi"})
        self.assertContains(response, "Ravi")
        self.assertNotContains(response, "Asha")

    def test_missing_student_is_404(self):
        response = self.client.get(reverse("students:detail", args=[999]))
        self.assertEqual(response.status_code, 404)

    def test_create_student(self):
        data = {"roll_number": "23bca050", "name": "meera", "email": "m@x.com",
                "course": "BCA", "semester": 2, "cgpa": ""}
        response = self.client.post(reverse("students:create"), data)
        student = Student.objects.get(roll_number="23BCA050")   # cleaned to uppercase
        self.assertRedirects(response, student.get_absolute_url())
        self.assertEqual(student.name, "Meera")

    def test_invalid_post_shows_errors(self):
        response = self.client.post(reverse("students:create"), {"name": ""})
        self.assertEqual(response.status_code, 200)              # re-rendered, not redirected
        self.assertFalse(Student.objects.filter(name="").exists())
        self.assertFormError(response.context["form"], "name", "This field is required.")
```

The response object also exposes `response.context` (template context) and `response.json()` for JSON views.

> [!NOTE]
> The test client skips CSRF checks by default, so you don't need tokens in test POSTs.

## Testing logged-in views

```python
from django.contrib.auth import get_user_model

User = get_user_model()


class NoteViewTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = User.objects.create_user("alice", password="pass12345!")
        cls.bob = User.objects.create_user("bob", password="pass12345!")
        cls.note = Note.objects.create(owner=cls.alice, title="Alice's secret")

    def test_login_required(self):
        response = self.client.get(reverse("notes:list"))
        self.assertRedirects(response, f"{reverse('login')}?next={reverse('notes:list')}")

    def test_owner_sees_note(self):
        self.client.force_login(self.alice)              # no password check: fast
        self.assertContains(self.client.get(reverse("notes:list")), "Alice&#x27;s secret")

    def test_other_user_gets_404(self):
        self.client.force_login(self.bob)
        response = self.client.get(reverse("notes:update", args=[self.note.pk]))
        self.assertEqual(response.status_code, 404)
```

`self.client.login(username=..., password=...)` also works and goes through real authentication. Notice the apostrophe is HTML-escaped in the page, so the assertion looks for `&#x27;`: auto-escaping at work.

## Testing forms directly

```python
class StudentFormTests(TestCase):
    def test_name_is_title_cased(self):
        form = StudentForm(data={"roll_number": "x1", "name": "asha rao", "email": "a@x.com",
                                 "course": "BCA", "semester": 1})
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.cleaned_data["name"], "Asha Rao")
```

## Testing APIs with DRF

`APITestCase` gives you `self.client` as an `APIClient`, which speaks JSON and can authenticate easily:

```python
from rest_framework import status
from rest_framework.test import APITestCase


class PlayerAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user("coach", password="pass12345!")

    def test_list_requires_auth(self):
        response = self.client.get("/api/players/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_player(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            "/api/players/", {"name": "Test Player", "test_innings": 3, "runs": 120}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Test Player")
        self.assertEqual(Player.objects.get().owner, self.user)

    def test_validation_error(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post("/api/players/", {"name": "X"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("name", response.data)
```

### Testing with a real JWT

```python
def test_jwt_flow(self):
    res = self.client.post("/api/token/", {"username": "coach", "password": "pass12345!"}, format="json")
    self.assertEqual(res.status_code, 200)
    self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
    self.assertEqual(self.client.get("/api/players/").status_code, 200)
```

`force_authenticate()` skips authentication entirely (fast, for testing permissions). `credentials()` sends a real header (for testing authentication itself).

## Checking query counts

Catch N+1 problems with a test:

```python
def test_list_uses_constant_queries(self):
    for i in range(20):
        Player.objects.create(name=f"P{i}", team=self.team)
    with self.assertNumQueries(2):
        self.client.get("/players/")
```

## Factories for test data

Creating objects by hand gets repetitive. Libraries such as **factory_boy** and **model_bakery** generate valid objects for you:

```python
from model_bakery import baker

players = baker.make("cricket.Player", _quantity=10)
```

## pytest (optional)

Many teams prefer **pytest** with the `pytest-django` plugin: shorter tests, plain `assert`, powerful fixtures. Your `TestCase` classes keep working under it.

```python
import pytest


@pytest.mark.django_db
def test_str_returns_name():
    assert str(Player.objects.create(name="Asha")) == "Asha"
```

## Coverage

```bash
pip install coverage
coverage run manage.py test
coverage report -m      # which lines were never run by any test
coverage html           # browsable report in htmlcov/
```

## What to test first

1. **Permissions and ownership**: the bugs that leak data.
2. **Validation and business rules**: the bugs that corrupt data.
3. **Happy paths** of each view and endpoint.
4. **Edge cases**: empty lists, missing objects (404), invalid input.

Don't test Django itself (that `CharField` stores text). Test **your** code.

## Summary

| Need | Tool |
|---|---|
| Run tests | `python manage.py test` |
| Test class with database | `django.test.TestCase` |
| API tests | `rest_framework.test.APITestCase` |
| Fake browser | `self.client.get/post` |
| Log in | `force_login(user)` / `force_authenticate(user)` (DRF) |
| Shared data | `setUpTestData` (once) / `setUp` (each test) |
| Check pages | `assertContains`, `assertRedirects`, `assertTemplateUsed` |
| Check queries | `assertNumQueries` |

## Check yourself

<details>
<summary>Does running tests touch your real database?</summary>

No. Django creates a separate test database, and rolls back each test's changes.
</details>

<details>
<summary>What's the difference between <code>setUp</code> and <code>setUpTestData</code>?</summary>

`setUp` runs before every test method. `setUpTestData` runs once per test class, which is much faster for data the tests only read.
</details>

<details>
<summary>How do you make DRF's test client act as a logged-in user without a password or token?</summary>

`self.client.force_authenticate(user=some_user)`.
</details>
