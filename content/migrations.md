Your models live in Python; your data lives in a database. **Migrations** keep the two in sync. Each migration is a small Python file describing one set of changes ("add a column", "create a table"), and Django applies them in order, like version control for your database schema.

## The two commands

```bash
python manage.py makemigrations   # 1. detect model changes, WRITE migration files
python manage.py migrate          # 2. APPLY unapplied migration files to the database
```

| | `makemigrations` | `migrate` |
|---|---|---|
| Reads | Your `models.py` files and existing migrations | Migration files and the `django_migrations` table |
| Writes | New files in `app/migrations/` | Changes to the actual database |
| Touches data? | No | Yes |
| Run it when | You changed a model | You (or a teammate, or a deploy) have new migration files |

> [!EXAM] Remember the order
> Change model → `makemigrations` → `migrate`. The first *plans*, the second *executes*.

## What a migration file looks like

```python title="library/migrations/0001_initial.py"
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Book",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("pages", models.PositiveIntegerField()),
            ],
        ),
    ]
```

Add a field to the model and run `makemigrations` again:

```python title="library/migrations/0002_book_isbn.py"
class Migration(migrations.Migration):

    dependencies = [("library", "0001_initial")]

    operations = [
        migrations.AddField(
            model_name="book",
            name="isbn",
            field=models.CharField(blank=True, max_length=13),
        ),
    ]
```

- Files are numbered and each **depends on** the one before, forming a chain.
- `operations` lists what to do: `CreateModel`, `AddField`, `RemoveField`, `AlterField`, `RenameField`, `DeleteModel`, `AddIndex`, `RunPython`...
- Django records each applied migration in a table called `django_migrations`, so it never applies one twice.

> [!IMPORTANT]
> **Commit migration files to Git.** They are part of your code. Every developer and every server must run the same migrations to end up with the same database.

## Useful migration commands

| Command | What it does |
|---|---|
| `makemigrations` | Create migrations for all apps with changes |
| `makemigrations library` | Only for one app |
| `makemigrations --name add_isbn` | Give the file a readable name |
| `makemigrations --empty library` | Create an empty migration (for data migrations) |
| `makemigrations --check --dry-run` | Exit with an error if migrations are missing (great in CI) |
| `migrate` | Apply all unapplied migrations |
| `migrate library` | Apply migrations for one app |
| `migrate library 0001` | Move one app to a specific migration (forwards **or backwards**) |
| `migrate library zero` | Unapply all of an app's migrations |
| `showmigrations` | List migrations with `[X]` for applied |
| `sqlmigrate library 0002` | Print the SQL a migration would run |
| `migrate --fake library 0002` | Mark as applied without running it (advanced; use with care) |
| `squashmigrations library 0001 0010` | Combine many migrations into one |

```bash
python manage.py showmigrations library
```

```text
library
 [X] 0001_initial
 [X] 0002_book_isbn
 [ ] 0003_book_price
```

```bash
python manage.py sqlmigrate library 0002
```

```sql
BEGIN;
--
-- Add field isbn to book
--
ALTER TABLE "library_book" ADD COLUMN "isbn" varchar(13) DEFAULT '' NOT NULL;
COMMIT;
```

## Rolling back

To undo migration `0003`, migrate to the one before it:

```bash
python manage.py migrate library 0002
```

Django runs the *reverse* operation (e.g. removes the column). Then you can delete or edit `0003_...py`. Never delete migration files that have already been applied on a shared or production database.

## Adding a required field to a table with data

If `Book` already has rows and you add `price = models.DecimalField(max_digits=7, decimal_places=2)`, Django asks:

```text
It is impossible to add a non-nullable field 'price' to book without specifying a default.
Please select a fix:
 1) Provide a one-off default now (will be set on all existing rows)
 2) Quit and manually define a default value in models.py.
```

Options:

1. Type `1` and give a value such as `0`. Existing rows get it once.
2. Add `default=0` to the field.
3. Make the field optional: `null=True, blank=True`.

## Renaming

If you rename a field, `makemigrations` asks: *Did you rename book.name to book.title (a CharField)? [y/N]*. Answer **y** so Django generates a `RenameField` that keeps your data, instead of deleting one column and adding another.

## Data migrations

Migrations can also change **data**, not just structure. Example: fill a new `slug` field for existing posts.

```bash
python manage.py makemigrations --empty blog --name fill_slugs
```

```python title="blog/migrations/0005_fill_slugs.py"
from django.db import migrations
from django.utils.text import slugify


def fill_slugs(apps, schema_editor):
    Post = apps.get_model("blog", "Post")   # use the historical model, not an import
    for post in Post.objects.filter(slug=""):
        post.slug = slugify(post.title)
        post.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [("blog", "0004_post_slug")]

    operations = [
        migrations.RunPython(fill_slugs, migrations.RunPython.noop),
    ]
```

> [!WARNING]
> In a data migration, always get models with `apps.get_model(...)`. Importing your current model class would break when the model changes later, because the migration must run against the schema *as it was at that point in history*.

## Team workflow and conflicts

If two developers both create `0004_...` in the same app, `migrate` complains about **conflicting migrations**. Fix it with:

```bash
python manage.py makemigrations --merge
```

This creates a small merge migration that depends on both branches.

## Starting over (development only)

When a learning project's migrations get into a mess and **the data doesn't matter**:

1. Delete `db.sqlite3`.
2. Delete every file in each app's `migrations/` folder **except** `__init__.py`.
3. Run `makemigrations` then `migrate`.
4. Recreate your superuser.

> [!CAUTION]
> Never do this on a production database. Write a proper migration instead.

## Troubleshooting

| Message | Meaning and fix |
|---|---|
| `No changes detected` | App missing from `INSTALLED_APPS`, or file not saved |
| `no such table: app_model` | Migrations not applied: run `migrate` |
| `no such column` | Model changed but `makemigrations` / `migrate` not run |
| `Conflicting migrations detected` | Run `makemigrations --merge` |
| `InconsistentMigrationHistory` | Migrations applied out of order, often after adding a custom user model late. In development, reset the database |
| `table already exists` | Database and migration history disagree. Inspect with `showmigrations`; `--fake` can help in careful hands |

## Check yourself

<details>
<summary>Does <code>makemigrations</code> change the database?</summary>

No. It only writes migration files. `migrate` changes the database.
</details>

<details>
<summary>How do you see the SQL that a migration will execute?</summary>

`python manage.py sqlmigrate <app_label> <migration_number>`, e.g. `sqlmigrate library 0002`.
</details>

<details>
<summary>How do you undo the most recent migration of an app?</summary>

Migrate the app back to the previous migration: `python manage.py migrate <app> <previous_number>`.
</details>

<details>
<summary>Should migration files be committed to version control?</summary>

Yes. They're part of the codebase and must be identical on every machine and server.
</details>
