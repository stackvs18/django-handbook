Plain-English definitions of the terms used throughout this handbook, in alphabetical order.

## A–C

**Access token**: A short-lived JWT sent with every API request in the `Authorization: Bearer` header. See [JWT](/learn/jwt).

**Admin site**: Django's automatically generated interface for managing data, at `/admin/`. See [The Admin Site](/learn/admin).

**AnonymousUser**: The object `request.user` holds when nobody is logged in. Its `is_authenticated` is `False`.

**API (Application Programming Interface)**: A contract that lets programs talk to each other; a web API exchanges data (usually JSON) over HTTP.

**App**: A Python package inside a Django project that provides one feature (blog, accounts, shop). Created with `startapp`.

**ASGI**: Asynchronous Server Gateway Interface. The standard connecting async Python servers (Uvicorn, Daphne) to Django; needed for async views and websockets.

**Authentication**: Verifying *who* a user is (login, tokens).

**Authorization**: Deciding *what* an authenticated user may do (permissions).

**Batteries included**: Django's philosophy of shipping most things a web app needs (ORM, admin, auth, forms) out of the box.

**Browsable API**: DRF's HTML interface for exploring and testing an API in a browser.

**Cache**: Storage for results that are expensive to compute, so they can be reused. See [Caching & Performance](/learn/performance).

**CBV (Class-Based View)**: A view written as a class (`ListView`, `CreateView`...) rather than a function.

**Claim**: A piece of information inside a JWT's payload, such as `user_id` or `exp`.

**Context**: The dictionary of variables passed to a template by a view.

**Context processor**: A function that adds variables (like `user` or `messages`) to every template's context.

**CORS (Cross-Origin Resource Sharing)**: The browser mechanism that lets a page from one domain read responses from an API on another. Configured with `django-cors-headers`.

**CRUD**: Create, Read, Update, Delete: the four basic operations on data.

**CSRF (Cross-Site Request Forgery)**: An attack that tricks a logged-in user's browser into submitting an unwanted request. Prevented with `{% csrf_token %}`. See [Security](/learn/security).

**Cursor**: In database APIs, the object that executes SQL and holds results. See [sqlite3](/learn/sqlite3).

## D–H

**Decorator**: A function that wraps another to add behaviour, e.g. `@login_required`.

**Deserialization**: Converting incoming data (JSON) into validated Python data or model instances.

**DRF (Django REST Framework)**: The standard toolkit for building REST APIs with Django.

**DRY (Don't Repeat Yourself)**: The principle of defining each piece of knowledge once.

**DTL (Django Template Language)**: The syntax used in Django templates: `{{ }}`, `{% %}` and filters.

**Endpoint**: A specific URL and method in an API, e.g. `POST /api/players/`.

**F expression**: `F("field")`, a reference to a field's value inside the database, used in updates and comparisons.

**Field lookup**: The part after a double underscore in a query, like `__icontains` or `__gte`.

**Filter (template)**: A transformation applied with a pipe, like `{{ name|upper }}`.

**Fixture**: A file of data (JSON/YAML) loaded with `loaddata`, often for tests.

**ForeignKey**: A many-to-one relationship field. See [Relationships](/learn/relationships).

**Form**: A class that renders inputs, validates submitted data and produces `cleaned_data`.

**Generic view**: A ready-made class-based view for a common pattern (list, detail, create...).

**Hashing (passwords)**: One-way transformation; Django stores password hashes, never passwords.

**HTTP**: The protocol browsers and servers use to exchange requests and responses.

**HttpRequest / HttpResponse**: The objects representing an incoming request and the outgoing reply.

## I–M

**Idempotent**: Repeating the request gives the same result (GET, PUT, DELETE are; POST isn't).

**INSTALLED_APPS**: The settings list of apps Django loads.

**JSON**: JavaScript Object Notation, a text format for data used by most APIs.

**JWT (JSON Web Token)**: A signed token (`header.payload.signature`) used for stateless authentication.

**Lazy evaluation**: QuerySets don't run their query until the results are actually needed.

**LTS (Long-Term Support)**: A Django release that receives security fixes for about three years.

**Manager**: The interface to database queries on a model, usually `Model.objects`.

**Many-to-many**: A relationship where each side can relate to many of the other (`ManyToManyField`).

**Media files**: Files uploaded by users, stored under `MEDIA_ROOT`.

**Message (framework)**: A one-time notification shown on the next page, e.g. "Saved!".

**Middleware**: Code that processes every request and response, configured in `MIDDLEWARE`. See [Middleware & Signals](/learn/middleware-and-signals).

**Migration**: A file describing a change to the database schema, created by `makemigrations` and applied by `migrate`.

**Mixin**: A small class that adds one behaviour to a class-based view (e.g. `LoginRequiredMixin`).

**Model**: A Python class describing a database table.

**ModelForm / ModelSerializer**: A form / serializer whose fields are generated automatically from a model.

**MVT (Model–View–Template)**: Django's architecture: models handle data, views handle logic, templates handle presentation. See [MVT](/learn/mvt).

## N–R

**N+1 problem**: Running one query for a list and then one more per item to fetch related data. Fixed with `select_related` / `prefetch_related`.

**Namespace (URL)**: A prefix (`app_name`) that keeps URL names unique across apps: `blog:detail`.

**ORM (Object-Relational Mapper)**: The layer that lets you query and modify the database using Python objects. See [The ORM](/learn/orm).

**Pagination**: Splitting a long list into pages.

**Permission**: A right such as `blog.add_post`, or a DRF permission class deciding access.

**Primary key (pk)**: The unique identifier of a row, `id` by default.

**Project**: The whole Django site: settings, root URLs and apps. Created with `startproject`.

**PRG (Post/Redirect/Get)**: Redirecting after a successful POST so refreshing doesn't resubmit the form.

**Q object**: `Q(...)`, used to build OR / NOT conditions in queries.

**QuerySet**: A lazy, chainable collection of database rows returned by the ORM.

**Refresh token**: A longer-lived JWT used only to obtain new access tokens.

**Related name**: The name of the reverse relationship accessor, set with `related_name=`.

**REST**: An API design style built on resources, URLs, HTTP methods and statelessness. See [APIs & REST](/learn/rest-apis).

**reverse()**: Builds a URL from its name and arguments.

**Router**: A DRF class that generates URL patterns for ViewSets.

## S–Z

**Serializer**: A DRF class that converts model instances to JSON-ready data and validates incoming data. See [Serializers](/learn/serializers).

**Session**: Server-side storage for one visitor's data, identified by a `sessionid` cookie.

**Settings**: The configuration module (`settings.py`) of a project.

**Signal**: A notification Django sends when something happens (e.g. `post_save`), which receivers can react to.

**Slug**: A short, URL-friendly label like `my-first-post`.

**Stateless**: Each request carries everything needed to process it; the server keeps no conversation memory (JWT APIs).

**Static files**: CSS, JavaScript, images and fonts shipped with your code.

**Superuser**: A user with every permission, created with `createsuperuser`.

**Tag (template)**: Logic in a template such as `{% for %}`, `{% if %}`, `{% url %}`.

**Template**: A text file (usually HTML) with DTL tags that a view renders into a response.

**Template inheritance**: Sharing a layout with `{% extends %}` and `{% block %}`.

**Throttling**: Limiting how many requests a client can make in a period.

**Transaction**: A group of database changes that succeed or fail together (`transaction.atomic()`).

**URLconf**: A module containing `urlpatterns` that maps URLs to views.

**Validation**: Checking that input is complete, correct and safe before using it.

**Versioning (API)**: Running multiple API versions side by side (e.g. `/api/v1/`) so changes don't break existing clients.

**View**: A function or class that takes a request and returns a response.

**ViewSet**: A DRF class that bundles all CRUD actions for a resource. See [ViewSets & Routers](/learn/viewsets-routers).

**Virtual environment (venv)**: An isolated folder of Python packages for one project.

**WSGI**: Web Server Gateway Interface, the standard connecting synchronous Python web apps to servers like Gunicorn.

**XSS (Cross-Site Scripting)**: Injecting malicious scripts into pages viewed by others. Prevented by template auto-escaping.
