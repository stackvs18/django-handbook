Real data is connected. A post has an author, an order has many items, a student takes many courses. Relational databases model these connections with **keys**, and Django gives you three fields to express them:

| Relationship | Field | Example |
|---|---|---|
| **Many-to-one** | `ForeignKey` | Many players belong to one team |
| **One-to-one** | `OneToOneField` | One user has exactly one profile |
| **Many-to-many** | `ManyToManyField` | Students take many courses; courses have many students |

## ForeignKey: many-to-one

Put the `ForeignKey` on the **"many"** side:

```python title="cricket/models.py"
from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Player(models.Model):
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="players")

    def __str__(self):
        return self.name
```

In the database, `cricket_player` gets a `team_id` column holding the team's primary key.

### Using it

```python
india = Team.objects.create(name="India")

# Forward: from player to team
virat = Player.objects.create(name="Virat Kohli", team=india)
virat.team            # <Team: India>
virat.team.name       # "India"
virat.team_id         # 1  (the raw id, no extra query)

# Reverse: from team to its players (thanks to related_name="players")
india.players.all()                    # every player in India
india.players.count()
india.players.filter(name__startswith="V")
india.players.create(name="Rohit Sharma")   # creates with team=india automatically

# Query across the relationship with double underscores
Player.objects.filter(team__name="India")
Team.objects.filter(players__name="Virat Kohli")
```

Without `related_name`, the reverse accessor defaults to `modelname_set`, here `india.player_set.all()`.

### on_delete: what happens to players when a team is deleted?

`on_delete` is **required**. Choose deliberately:

| Option | Effect when the team is deleted |
|---|---|
| `CASCADE` | Delete its players too |
| `PROTECT` | Refuse: raises `ProtectedError` while players exist |
| `RESTRICT` | Like PROTECT, but allows deletion if it's part of a bigger cascade |
| `SET_NULL` | Set `player.team` to NULL (field needs `null=True`) |
| `SET_DEFAULT` | Set it to the field's default (field needs `default=`) |
| `SET(value)` | Set it to a value or the result of a function |
| `DO_NOTHING` | Do nothing in Django; the database may complain |

```python
# A player may be a free agent, so keep them when the team disappears:
team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True)
```

> [!TIP] How to choose
> **Comments on a post** → `CASCADE` (they're meaningless without it). **Orders of a customer** → `PROTECT` (never lose financial records by accident). **Posts by an author who leaves** → `SET_NULL`.

### Linking to the User model

Always refer to the user model through settings, never import `User` directly in models. That way your code still works if the project uses a [custom user model](/learn/permissions):

```python
from django.conf import settings


class Post(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="posts",
    )
    title = models.CharField(max_length=200)
```

Now `request.user.posts.all()` gives the current user's posts.

### Self-referencing ForeignKey

A model can point at itself, for example replies to comments or employees and managers:

```python
class Comment(models.Model):
    text = models.TextField()
    parent = models.ForeignKey("self", null=True, blank=True,
                               on_delete=models.CASCADE, related_name="replies")
```

## OneToOneField: one-to-one

Like a `ForeignKey` with `unique=True`: each row on one side matches at most one row on the other. The classic use is **extending the user** with extra information:

```python title="accounts/models.py"
from django.conf import settings
from django.db import models


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    bio = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    birth_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Profile of {self.user.username}"
```

```python
profile.user          # the User
user.profile          # the Profile (reverse accessor = lowercase model name)
user.profile.city
```

If a user has no profile yet, `user.profile` raises `Profile.DoesNotExist` (technically `RelatedObjectDoesNotExist`). A common fix is to create profiles automatically with a [signal](/learn/middleware-and-signals), or use `Profile.objects.get_or_create(user=user)`.

## ManyToManyField: many-to-many

Put it on either side (whichever reads more naturally). Django creates a hidden **join table** with two foreign keys.

```python title="school/models.py"
from django.db import models


class Course(models.Model):
    title = models.CharField(max_length=100)

    def __str__(self):
        return self.title


class Student(models.Model):
    name = models.CharField(max_length=100)
    courses = models.ManyToManyField(Course, related_name="students", blank=True)

    def __str__(self):
        return self.name
```

```python
python_course = Course.objects.create(title="Python")
django_course = Course.objects.create(title="Django")
asha = Student.objects.create(name="Asha")

asha.courses.add(python_course, django_course)   # enrol
asha.courses.remove(python_course)               # drop one
asha.courses.set([django_course])                # replace the whole set
asha.courses.clear()                             # remove all
asha.courses.all()

django_course.students.all()                     # reverse direction
Student.objects.filter(courses__title="Django")
```

> [!NOTE]
> A many-to-many relation can only be added *after* both objects are saved (they need ids for the join table). `null=True` has no effect on `ManyToManyField`; use `blank=True` to make it optional in forms.

### Extra data on the relationship: through models

If the relationship itself has information (the date someone enrolled, their grade), create the join table yourself and point to it with `through`:

```python
class Student(models.Model):
    name = models.CharField(max_length=100)
    courses = models.ManyToManyField("Course", through="Enrollment", related_name="students")


class Course(models.Model):
    title = models.CharField(max_length=100)


class Enrollment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE)
    course = models.ForeignKey(Course, on_delete=models.CASCADE)
    enrolled_on = models.DateField(auto_now_add=True)
    grade = models.CharField(max_length=2, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["student", "course"], name="one_enrollment_per_course")
        ]
```

```python
Enrollment.objects.create(student=asha, course=django_course, grade="A")
asha.courses.add(python_course, through_defaults={"grade": "B"})
Enrollment.objects.filter(course=django_course, grade="A")
```

## A complete example: a small blog

```python title="blog/models.py"
from django.conf import settings
from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=50, unique=True)

    class Meta:
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Tag(models.Model):
    name = models.CharField(max_length=30, unique=True)

    def __str__(self):
        return self.name


class Post(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name="posts")
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True,
                                 blank=True, related_name="posts")
    tags = models.ManyToManyField(Tag, blank=True, related_name="posts")
    title = models.CharField(max_length=200)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
```

Queries that cross relationships:

```python
# All posts in the "Django" category, with the tag "beginner"
Post.objects.filter(category__name="Django", tags__name="beginner")

# Posts by a given user with at least one comment
Post.objects.filter(author__username="asha", comments__isnull=False).distinct()

# In a template
# {% for comment in post.comments.all %} {{ comment.author }}: {{ comment.text }} {% endfor %}
```

> [!TIP] Performance
> Looping over posts and touching `post.author` or `post.tags.all()` runs one extra query per post (the **N+1 problem**). Fix it with `select_related("author", "category")` for foreign keys and `prefetch_related("tags")` for many-to-many. See [The ORM](/learn/orm#select_related-and-prefetch_related).

## Choosing the right relationship

Ask two questions:

1. *Can one A have many B?*
2. *Can one B have many A?*

| Answers | Relationship | Put the field on |
|---|---|---|
| Yes / No | One-to-many | `ForeignKey` on **B** |
| No / No | One-to-one | `OneToOneField` on either (usually the "extension") |
| Yes / Yes | Many-to-many | `ManyToManyField` on either |

## Summary

| Field | Database | Forward | Reverse (default) |
|---|---|---|---|
| `a = ForeignKey(A)` on B | `a_id` column on B | `b.a` | `a.b_set.all()` |
| `a = OneToOneField(A)` on B | unique `a_id` column on B | `b.a` | `a.b` |
| `items = ManyToManyField(A)` on B | separate join table | `b.items.all()` | `a.b_set.all()` |

`related_name` replaces the default reverse name. Double underscores (`team__name`) follow relationships in queries.

## Check yourself

<details>
<summary>A Book has one Publisher, and a Publisher has many Books. Which model gets the ForeignKey?</summary>

`Book`, the "many" side: `publisher = models.ForeignKey(Publisher, on_delete=...)`.
</details>

<details>
<summary>What happens with <code>on_delete=models.PROTECT</code> if you delete a parent that still has children?</summary>

Django raises `ProtectedError` and nothing is deleted.
</details>

<details>
<summary>Why use <code>settings.AUTH_USER_MODEL</code> instead of importing <code>User</code>?</summary>

So the relationship keeps working if the project swaps in a custom user model.
</details>
