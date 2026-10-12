The **Django admin** is a complete web interface for managing your data, generated automatically from your models. With two lines of code you get list pages, search, add/edit/delete forms and a permission system. It's one of Django's best-loved features.

> [!NOTE] Who is the admin for?
> The admin is for **trusted staff**: you, your team, content editors. It isn't meant to be the public face of your site. Build normal views for regular users.

## Getting in

1. `django.contrib.admin` is in `INSTALLED_APPS` and `path("admin/", admin.site.urls)` is in your root `urls.py` (both are there by default).
2. Run `migrate` so the auth tables exist.
3. Create a superuser:

```bash
python manage.py createsuperuser
```

4. Run the server and visit **http://127.0.0.1:8000/admin/**.

## Registering a model

```python title="library/admin.py"
from django.contrib import admin
from .models import Book

admin.site.register(Book)
```

Book now appears in the admin with list, add, change and delete pages. What's shown for each row comes from the model's `__str__`.

## Customising with ModelAdmin

For anything beyond the basics, create a `ModelAdmin` class. The `@admin.register` decorator is the tidy way to connect it:

```python title="library/admin.py"
from django.contrib import admin
from .models import Author, Book


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    # The list page
    list_display = ("title", "author", "price", "in_stock", "published_on")
    list_display_links = ("title",)
    list_filter = ("in_stock", "published_on", "author")
    search_fields = ("title", "author__name")
    ordering = ("-published_on",)
    list_per_page = 25
    list_editable = ("price", "in_stock")
    date_hierarchy = "published_on"

    # The edit page
    fields = ("title", "author", ("price", "in_stock"), "published_on", "created_at")
    readonly_fields = ("created_at",)
    autocomplete_fields = ("author",)


@admin.register(Author)
class AuthorAdmin(admin.ModelAdmin):
    search_fields = ("name",)   # required for autocomplete_fields to point here
```

### List page options

| Option | Effect |
|---|---|
| `list_display` | Columns to show (fields, methods or properties) |
| `list_display_links` | Which columns link to the edit page |
| `list_filter` | Filter sidebar (booleans, choices, dates, foreign keys) |
| `search_fields` | Adds a search box. Use `__` to search related fields |
| `ordering` | Default sort |
| `list_per_page` | Pagination size |
| `list_editable` | Edit these columns directly in the list |
| `date_hierarchy` | Drill-down navigation by year/month/day |
| `list_select_related` | Use `select_related` to avoid extra queries |

### Edit page options

| Option | Effect |
|---|---|
| `fields` | Which fields to show and in what order (a tuple groups fields on one line) |
| `exclude` | Fields to hide |
| `fieldsets` | Grouped sections with headings |
| `readonly_fields` | Shown but not editable |
| `prepopulated_fields` | Auto-fill, e.g. `{"slug": ("title",)}` |
| `autocomplete_fields` | Searchable dropdown for foreign keys |
| `raw_id_fields` | Plain id input for foreign keys with huge tables |
| `filter_horizontal` | Two-box picker for many-to-many fields |
| `inlines` | Edit related objects on the same page |

### Fieldsets

```python
@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    fieldsets = (
        (None, {"fields": ("title", "author", "summary")}),
        ("Pricing", {"fields": ("price", "in_stock")}),
        ("Advanced", {"fields": ("isbn", "published_on"), "classes": ("collapse",)}),
    )
```

## Custom columns

Any method on the `ModelAdmin` (or the model) can be a column:

```python
@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "price_in_rupees", "is_long")

    @admin.display(description="Price", ordering="price")
    def price_in_rupees(self, obj):
        return f"₹{obj.price:,.2f}"

    @admin.display(boolean=True, description="Long read?")
    def is_long(self, obj):
        return obj.pages > 400
```

`boolean=True` shows a tick or cross icon; `ordering` makes the column sortable.

## Inlines: edit related objects together

Edit a team's players on the team's own page:

```python title="cricket/admin.py"
from django.contrib import admin
from .models import Player, Team


class PlayerInline(admin.TabularInline):   # or admin.StackedInline for a taller layout
    model = Player
    extra = 1                              # number of empty rows for new players
    fields = ("name", "runs", "is_active")


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "country", "player_count")
    inlines = [PlayerInline]

    @admin.display(description="Players")
    def player_count(self, obj):
        return obj.players.count()
```

## Admin actions

Actions run on several selected rows from the list page. "Delete selected" is built in; add your own:

```python
from django.contrib import admin, messages


@admin.register(Book)
class BookAdmin(admin.ModelAdmin):
    actions = ["mark_out_of_stock"]

    @admin.action(description="Mark selected books as out of stock")
    def mark_out_of_stock(self, request, queryset):
        updated = queryset.update(in_stock=False)
        self.message_user(request, f"{updated} book(s) updated.", messages.SUCCESS)
```

## Controlling what staff can see and do

Override `ModelAdmin` methods to customise behaviour per user:

```python
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ("title", "author", "created_at")

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(author=request.user)       # authors only see their own posts

    def save_model(self, request, obj, form, change):
        if not change:                              # on creation
            obj.author = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
```

Staff users (`is_staff=True`) only see models they have permissions for. Assign permissions or groups in **Authentication and Authorization → Users**. See [Permissions](/learn/permissions).

## Branding the admin

```python title="mysite/urls.py"
from django.contrib import admin

admin.site.site_header = "Player Hub Administration"   # top banner
admin.site.site_title = "Player Hub Admin"             # browser tab
admin.site.index_title = "Dashboard"                   # home page heading
```

> [!TIP] Security
> Bots constantly probe `/admin/`. Consider a less obvious path in production, e.g. `path("manage-7f3a/", admin.site.urls)`, and always use strong passwords. It's not real security on its own, but it cuts noise.

## Summary

| Task | Code |
|---|---|
| Show a model | `admin.site.register(Model)` |
| Customise it | `@admin.register(Model)` + `class ModelAdmin` |
| Columns | `list_display` |
| Filters / search | `list_filter`, `search_fields` |
| Edit related rows inline | `TabularInline` / `StackedInline` |
| Bulk operations | `actions` + `@admin.action` |
| Per-user rules | override `get_queryset`, `save_model`, `has_*_permission` |

## Check yourself

<details>
<summary>What two things does a user need to log into the admin?</summary>

An active account with `is_staff=True` (superusers have it automatically). They then see only the models they have permissions for.
</details>

<details>
<summary>How do you add a search box to an admin list page?</summary>

Set `search_fields` on the `ModelAdmin`, e.g. `search_fields = ("title", "author__name")`.
</details>

<details>
<summary>What's an inline?</summary>

A way to edit related objects (e.g. a team's players) on the parent object's edit page, using `TabularInline` or `StackedInline`.
</details>
