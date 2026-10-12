A **model** is the single, definitive description of your data. You write a Python class; Django creates the database table, gives you a powerful API to query it, builds admin pages and forms from it, and validates values against it.

## Your first model

```python title="library/models.py"
from django.db import models


class Book(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=100)
    pages = models.PositiveIntegerField()
    published_on = models.DateField()
    price = models.DecimalField(max_digits=7, decimal_places=2)
    in_stock = models.BooleanField(default=True)

    def __str__(self):
        return self.title
```

After `makemigrations` and `migrate`, Django creates this table (shown for SQLite):

```sql
CREATE TABLE "library_book" (
    "id" integer NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" varchar(200) NOT NULL,
    "author" varchar(100) NOT NULL,
    "pages" integer unsigned NOT NULL CHECK ("pages" >= 0),
    "published_on" date NOT NULL,
    "price" decimal NOT NULL,
    "in_stock" bool NOT NULL
);
```

Things Django did for you:

- **Table name**: `appname_modelname` in lowercase (`library_book`).
- **Primary key**: an auto-incrementing `id` column. Access it as `book.id` or `book.pk`.
- **NOT NULL** by default: every field is required unless you say otherwise.

## Common field types

### Text

| Field | Use | Notes |
|---|---|---|
| `CharField(max_length=...)` | Short text: names, titles | `max_length` is required |
| `TextField()` | Long text: descriptions, posts | No length limit |
| `EmailField()` | Email addresses | CharField that validates the format |
| `URLField()` | Web addresses | Validates the URL |
| `SlugField()` | URL-friendly text like `my-first-post` | Indexed by default |

### Numbers

| Field | Use |
|---|---|
| `IntegerField()` | Whole numbers |
| `PositiveIntegerField()` | Whole numbers ≥ 0 |
| `BigIntegerField()` / `SmallIntegerField()` | Larger / smaller ranges |
| `FloatField()` | Approximate decimals (scientific values) |
| `DecimalField(max_digits, decimal_places)` | **Exact** decimals: money, always use this for prices |

### Dates and times

| Field | Python type |
|---|---|
| `DateField()` | `datetime.date` |
| `TimeField()` | `datetime.time` |
| `DateTimeField()` | `datetime.datetime` |
| `DurationField()` | `datetime.timedelta` |

Two very handy options:

```python
created_at = models.DateTimeField(auto_now_add=True)  # set once, on creation
updated_at = models.DateTimeField(auto_now=True)      # updated on every save()
```

### Others

| Field | Use |
|---|---|
| `BooleanField()` | True / False |
| `FileField(upload_to=...)` / `ImageField(...)` | Uploaded files ([Static & Media](/learn/static-and-media)) |
| `JSONField()` | Arbitrary JSON data |
| `UUIDField()` | Universally unique ids |
| `GenericIPAddressField()` | IPv4 / IPv6 addresses |
| `ForeignKey`, `OneToOneField`, `ManyToManyField` | Relationships ([next chapter](/learn/relationships)) |

## Field options

These work on (almost) every field:

| Option | Meaning |
|---|---|
| `null=True` | The **database** column may store `NULL` |
| `blank=True` | **Forms and validation** allow the field to be empty |
| `default=...` | Default value (a value or a callable like `timezone.now`) |
| `unique=True` | No two rows may share this value |
| `choices=...` | Restrict to a fixed set of values |
| `verbose_name="..."` | Human-readable name for admin and forms |
| `help_text="..."` | Hint shown under form fields |
| `db_index=True` | Create a database index for faster lookups |
| `editable=False` | Hide from admin and ModelForms |
| `validators=[...]` | Extra validation functions |
| `primary_key=True` | Use this field instead of the automatic `id` |

> [!IMPORTANT] null vs blank
> `null` is about the **database**; `blank` is about **validation**. For text fields, avoid `null=True`: an empty value is stored as `""`, so you'd otherwise have two kinds of "empty". Use `blank=True` alone. For non-text optional fields (dates, numbers, foreign keys) use **both** `null=True, blank=True`.

```python
nickname = models.CharField(max_length=50, blank=True)            # optional text
retired_on = models.DateField(null=True, blank=True)              # optional date
```

## Choices

Limit a field to a fixed set of options. The modern way is an enumeration class:

```python
class Player(models.Model):
    class Role(models.TextChoices):
        BATTER = "BAT", "Batter"
        BOWLER = "BOWL", "Bowler"
        ALL_ROUNDER = "AR", "All-rounder"
        KEEPER = "WK", "Wicket-keeper"

    name = models.CharField(max_length=100)
    role = models.CharField(max_length=4, choices=Role, default=Role.BATTER)
```

- The first value (`"BAT"`) is stored in the database; the second (`"Batter"`) is the label.
- `player.get_role_display()` returns the label: `"Batter"`.
- Compare with `player.role == Player.Role.BOWLER`.
- Use `models.IntegerChoices` for numeric codes.

The older tuple style still works everywhere:

```python
STATUS_CHOICES = [("draft", "Draft"), ("published", "Published")]
status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="draft")
```

## The Meta class

Model-wide options go in an inner `Meta` class:

```python
class Book(models.Model):
    title = models.CharField(max_length=200)
    author = models.CharField(max_length=100)
    published_on = models.DateField()

    class Meta:
        ordering = ["-published_on", "title"]   # default sort: newest first
        verbose_name = "book"
        verbose_name_plural = "books"
        db_table = "books"                      # custom table name (rarely needed)
        indexes = [models.Index(fields=["author"])]
        constraints = [
            models.UniqueConstraint(fields=["title", "author"], name="unique_title_per_author"),
        ]
```

| Option | Purpose |
|---|---|
| `ordering` | Default order for queries. `-` means descending |
| `verbose_name(_plural)` | Names shown in the admin |
| `db_table` | Override the table name |
| `indexes` | Database indexes for speed |
| `constraints` | `UniqueConstraint`, `CheckConstraint` enforced by the database |
| `unique_together` | Older way to make a combination unique |
| `abstract = True` | A base class that doesn't get its own table |
| `get_latest_by` | Field used by `.latest()` |
| `permissions` | Extra custom permissions |

## Model methods

Models are normal Python classes, so add methods for anything about a single object:

```python
from django.urls import reverse


class Player(models.Model):
    name = models.CharField(max_length=100)
    runs = models.PositiveIntegerField(default=0)
    innings = models.PositiveIntegerField(default=0)
    not_outs = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name

    @property
    def average(self):
        dismissals = self.innings - self.not_outs
        return round(self.runs / dismissals, 2) if dismissals else None

    def get_absolute_url(self):
        return reverse("player_detail", kwargs={"pk": self.pk})
```

- **`__str__`**: always define it. Used by the admin, the shell and templates.
- **`get_absolute_url`**: the canonical URL of an object. The admin shows a "View on site" button, and `redirect(player)` uses it.
- **Properties**: computed values used like attributes: `{{ player.average }}`.

## Overriding save() and validation

```python
from django.core.exceptions import ValidationError
from django.utils.text import slugify


class Article(models.Model):
    title = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, blank=True)
    starts = models.DateField()
    ends = models.DateField()

    def clean(self):
        # cross-field validation, run by ModelForms and the admin
        if self.ends < self.starts:
            raise ValidationError("End date must be after the start date.")

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title)
        super().save(*args, **kwargs)   # never forget this line
```

> [!WARNING]
> `Model.save()` does **not** call `clean()` or validate fields automatically. ModelForms and the admin call validation for you (`full_clean()`). If you create objects in your own code and want validation, call `obj.full_clean()` before `obj.save()`.

## Validators

```python
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator


class Student(models.Model):
    roll_number = models.CharField(
        max_length=10,
        validators=[RegexValidator(r"^[A-Z]{2}\d{4}$", "Format: two capitals then 4 digits")],
    )
    marks = models.PositiveIntegerField(validators=[MinValueValidator(0), MaxValueValidator(100)])
```

## Abstract base classes

Share common fields between models without creating an extra table:

```python
class TimeStamped(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class Post(TimeStamped):
    title = models.CharField(max_length=200)


class Comment(TimeStamped):
    text = models.TextField()
```

Both `Post` and `Comment` get `created_at` and `updated_at` columns.

> [!NOTE] Other kinds of inheritance
> **Multi-table inheritance** (subclassing a concrete model) creates a table per class joined by a hidden one-to-one link. **Proxy models** (`class Meta: proxy = True`) share the parent's table but can change behaviour, such as default ordering or extra methods. Abstract classes are the most common of the three.

## Model managers

`Book.objects` is a **manager**, the gateway to database queries. You can add your own:

```python
class PublishedManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(status="published")


class Post(models.Model):
    title = models.CharField(max_length=200)
    status = models.CharField(max_length=10, default="draft")

    objects = models.Manager()        # the default manager
    published = PublishedManager()    # Post.published.all()
```

## Workflow when you change a model

Every time you add, remove or change a field:

```bash
python manage.py makemigrations
python manage.py migrate
```

When you add a non-nullable field to a table that already has rows, Django asks for a default. Either provide one in the prompt, or add `default=...` / `null=True` to the field. See [Migrations](/learn/migrations).

## Summary

| Concept | Remember |
|---|---|
| One model | One table |
| One field | One column |
| One instance | One row |
| `id` / `pk` | Added automatically |
| `null` | Database may store NULL |
| `blank` | Form may be left empty |
| `choices` | Fixed list of allowed values, `get_FOO_display()` for labels |
| `Meta` | Ordering, names, indexes, constraints |
| `__str__` | Always define it |

## Check yourself

<details>
<summary>Which field type should you use for prices, and why not FloatField?</summary>

`DecimalField(max_digits=..., decimal_places=...)`. Floats are approximate (0.1 + 0.2 ≠ 0.3), which causes rounding errors with money. Decimals are exact.
</details>

<details>
<summary>What's the difference between <code>auto_now</code> and <code>auto_now_add</code>?</summary>

`auto_now_add` sets the value once when the object is created. `auto_now` updates it every time the object is saved.
</details>

<details>
<summary>For an optional CharField, should you use <code>null=True</code>, <code>blank=True</code> or both?</summary>

Just `blank=True`. Empty text is stored as an empty string, so there's no need for NULL as well.
</details>
