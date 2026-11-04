You will build an **Inventory Management System** step by step, the same way you built the Player project in class:

**project → app → settings → models → migrations → admin → serializers → viewsets → router → JWT → Postman → web pages**

Every file is shown **in full**. Click **Copy**, paste it into VS Code, save. After every block there is a short note on **what the code does** and **how it is used**, so you can explain it to the interviewer.

> [!TIP] How to use this page in a practical test
> Go top to bottom. Every step ends with something you can run.
> - **Part A (Steps 1–6):** project, models, admin. You can already add data in `/admin/`.
> - **Part B (Steps 7–11):** REST API with serializers, viewsets, router and JWT. Test it in Postman.
> - **Part C (Steps 12–17):** normal Django web pages (MVT) with ModelForms, signup, login, products and stock in/out.
>
> If the test only asks for an API, stop after Part B. If it only asks for web pages, do Part A and then Part C.

> [!NOTE] Can't remember an import?
> Every import line used here is explained, file by file, on the [Import cheat sheet](/imports), along with simple rules to rebuild any import you forget.

> [!NOTE] Where the idea comes from
> Open-source inventory apps (for example [munuhee/sales-and-inventory-management](https://github.com/munuhee/sales-and-inventory-management)) have categories, items, vendors, and stock that goes up on a purchase and down on a sale. We kept only those basic ideas and wrote everything in the simple style from class: plain `models.Model`, choices written by hand, function-based web views and `ModelViewSet` for the API.

## 0. What we're building

**Who uses the system.** Anyone with a login. No custom user model and no roles: every page and API needs a login, and then every user can do everything. New users sign up on the web page, or the superuser adds them in `/admin/`.

**Tables (models)**

```flow
Category | Electronics, Stationery… one category has many products
Supplier | who we buy from: name, phone, email
Product | name, SKU code, price, quantity in stock, reorder level
StockTransaction | product + in/out + quantity, who did it and when
```

**The one rule that makes it an inventory system:** a product's `quantity` is **never typed in by hand**. It only changes through a stock transaction:

```flow
Stock IN (50) | quantity 0 → 50 (goods arrived from the supplier)
Stock OUT (46) | quantity 50 → 4 (goods sold / used)
Stock OUT (10) | rejected: only 4 left in stock
Low stock | quantity 4 ≤ reorder level 5, so it shows up as LOW
```

**API endpoints you will have at the end of Part B**

| Method | URL | What it does |
|---|---|---|
| POST | `/api/token/` | Log in and get JWT `access` + `refresh` tokens |
| POST | `/api/token/refresh/` | Get a new access token |
| GET / POST | `/api/categories/` | List / create categories |
| GET / POST | `/api/suppliers/` | List / create suppliers |
| GET / POST | `/api/products/` | List / create products |
| GET / POST | `/api/stock/` | List / record stock in or out |
| GET / PUT / PATCH / DELETE | `/api/<name>/<id>/` | One record: read, update, delete |

## 1. Install packages and create the project

Open an empty folder in VS Code and open the terminal (`` Ctrl+` ``). Make a virtual environment and install three packages:

```bash
python -m venv venv
venv\Scripts\activate
pip install django djangorestframework djangorestframework-simplejwt
```

**What it does**
- `python -m venv venv` creates a private Python folder called `venv` just for this project.
- `venv\Scripts\activate` switches the terminal to use it. You will see `(venv)` at the start of the line.
- `pip install` downloads the packages into that venv.

| Package | Why we need it |
|---|---|
| `django` | The web framework |
| `djangorestframework` | DRF: serializers, viewsets, routers, the browsable API |
| `djangorestframework-simplejwt` | JWT login (`access` and `refresh` tokens) |

> [!NOTE]
> On macOS or Linux, activate with `source venv/bin/activate`. If PowerShell blocks activation, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then try again.

Now create the project and the app:

```bash
django-admin startproject inventoryproject
cd inventoryproject
python manage.py startapp inventoryapp
mkdir templates
```

**What it does**
- `startproject inventoryproject` creates the project folder with `manage.py` and the settings package.
- `cd inventoryproject` moves into it. **Run every command from here on inside this folder** (the one that has `manage.py`).
- `startapp inventoryapp` creates our app. All models, views and serializers go in here.
- `mkdir templates` creates one folder for all HTML files. We tell Django about it in Step 2.

Your folder now looks like this. The files marked *new* are ones you will create yourself later:

```text
inventoryproject/             ← you are here (has manage.py)
├── manage.py
├── templates/                ← all HTML files (Part C)
├── inventoryproject/         ← project settings
│   ├── settings.py
│   └── urls.py
└── inventoryapp/             ← our app
    ├── models.py
    ├── admin.py
    ├── serializers.py        ← new (Part B)
    ├── api_views.py          ← new (Part B)
    ├── forms.py              ← new (Part C)
    ├── views.py              ← web pages (Part C)
    └── urls.py               ← new (Part C)
```

## 2. settings.py (only two changes)

Open `inventoryproject/settings.py`. You change **only two things** here: `INSTALLED_APPS` and the templates folder. Leave everything else (database, time zone, middleware) exactly as Django created it.

**Change 1.** Find `INSTALLED_APPS` and add the two marked lines:

```python title="inventoryproject/settings.py — INSTALLED_APPS"
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',   # <--- ADDED (Django REST Framework)
    'inventoryapp',     # <--- ADDED (our app)
]
```

**What it does**
- `INSTALLED_APPS` is the list of apps Django loads.
- `'rest_framework'` turns on DRF. It also gives us the browsable API pages and the `api-auth/` login page.
- `'inventoryapp'` tells Django our app exists. Without it, `makemigrations` will not see your models.

**Change 2.** Find `TEMPLATES` and change `'DIRS': []` to the line below:

```python title="inventoryproject/settings.py — TEMPLATES"
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],   # <--- CHANGED (was [])
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]
```

**What it does**
- `DIRS` is the list of extra folders where Django looks for HTML files.
- `BASE_DIR` is the folder that has `manage.py`, so `BASE_DIR / 'templates'` points to the `templates` folder we just made.
- Now `render(request, 'dashboard.html')` will find `templates/dashboard.html`.

> [!NOTE] What about the big REST_FRAMEWORK block?
> You don't need a block of extra settings for pagination, filters, time zone or login URLs. The defaults are fine. There is **one** small extra block you do need, and it comes in **Step 10** when we switch on JWT. That step explains why.

## 3. models.py

Open `inventoryapp/models.py` and replace everything with:

```python title="inventoryapp/models.py"
from django.db import models
from django.contrib.auth.models import User


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Supplier(models.Model):
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Product(models.Model):
    UNIT_CHOICES = [
        ('pcs', 'Pieces'),
        ('kg', 'Kilogram'),
        ('ltr', 'Litre'),
        ('box', 'Box'),
    ]

    name = models.CharField(max_length=100)
    sku = models.CharField(max_length=50, unique=True)   # product code, e.g. USB-01
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='pcs')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.IntegerField(default=0)        # changes ONLY through stock transactions
    reorder_level = models.IntegerField(default=10)  # at or below this = low stock
    created_at = models.DateTimeField(auto_now_add=True)

    def is_low_stock(self):
        return self.quantity <= self.reorder_level

    def stock_value(self):
        return self.quantity * self.price

    def __str__(self):
        return self.name + ' (' + self.sku + ')'


class StockTransaction(models.Model):
    TYPE_CHOICES = [
        ('in', 'Stock In'),
        ('out', 'Stock Out'),
    ]

    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    transaction_type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    quantity = models.IntegerField()
    note = models.CharField(max_length=200, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)   # who recorded it
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.transaction_type.upper() + ' ' + str(self.quantity) + ' x ' + self.product.name
```

**What it does.** Each class becomes one table in the database. Each line inside a class becomes one column.

| Model | What it stores | Links |
|---|---|---|
| `Category` | Product groups | Has many products |
| `Supplier` | Who we buy from | Has many products |
| `Product` | One item in the store | `category` → one Category. `supplier` → one Supplier |
| `StockTransaction` | One stock movement (in or out) | `product` → one Product. `created_by` → the user who recorded it |

### The link lines, explained slowly

These two lines in `Product` are the only "hard" part of the models:

```python
category = models.ForeignKey(Category, on_delete=models.CASCADE)
supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
```

Both mean the same thing: **"this column points to one row in another table."** Read the `category` line left to right:

| Piece | Read it as |
|---|---|
| `category =` | the name of the column |
| `models.ForeignKey(` | "this points to a row in another table" |
| `Category` | which table it points to |
| `on_delete=models.CASCADE` | "if that category is deleted, delete this product too" |

**What the database really stores is just a number.** Django adds `_id` to the name:

| Product: id | name | category_id | supplier_id |
|---|---|---|---|
| 1 | USB Cable | 1 | 1 |
| 2 | Notebook | 2 | 1 |

| Category: id | name |
|---|---|
| 1 | Electronics |
| 2 | Stationery |

USB Cable has `category_id = 1`, so it's in Electronics. In code you never look up the number yourself. Write `product.category.name` and Django follows the link and gives you `'Electronics'`.

**Why `ForeignKey`?** Many products can point to the **same** category (`category_id = 1` many times), just like many students belong to one class. In `/admin/` it shows as a dropdown.

**`on_delete` is required** on every link, because Django must know what to do with the product if its category is deleted. In this project we always use `models.CASCADE` ("delete this one too").

> [!TIP] The template line to remember
> Every link field is the same line. Only the name and the model change:
> ```python
> name = models.ForeignKey(OtherModel, on_delete=models.CASCADE)
> name = models.OneToOneField(OtherModel, on_delete=models.CASCADE)
> ```
> Use `ForeignKey` almost always. `OneToOneField` is for "exactly one each", like one user account = one doctor (see the hospital project).

### Choices, explained slowly

Why does every choice have **two** words, like `('pcs', 'Pieces')`?

```python
UNIT_CHOICES = [
    ('pcs', 'Pieces'),
    ('kg', 'Kilogram'),
    ('ltr', 'Litre'),
    ('box', 'Box'),
]
unit = models.CharField(max_length=10, choices=UNIT_CHOICES, default='pcs')
```

| | Left: `'pcs'` | Right: `'Pieces'` |
|---|---|---|
| Name | the **value** | the **label** |
| Where it goes | **saved in the database** | **shown to people** |
| Who uses it | your Python code, the API JSON, `request.POST` | the admin dropdown, `get_unit_display` in templates |

- The **value** is for the computer. Keep it short, lowercase and never change it, because your code compares it: `if product.unit == 'kg':`.
- The **label** is for humans. You can change it any time (for example to `'Pieces (nos)'` or Hindi) without touching the database.

**What you actually see in this project**

| Where | Shows | Example |
|---|---|---|
| `/admin/` dropdown | the **label** | You pick **Kilogram**, but `'kg'` is saved |
| Database row | the **value** | `unit = 'kg'` |
| API JSON (Postman) | the **value** | `"unit": "kg"` |
| Sending JSON to the API | must be the **value** | `"unit": "Kilogram"` gives 400 *"Kilogram" is not a valid choice* |
| Template `{{ product.unit }}` | the **value** | `kg` |
| Template `{{ product.get_unit_display }}` | the **label** | `Kilogram` |

It's exactly like an HTML dropdown: `<option value="kg">Kilogram</option>`. The `value="kg"` part is sent to the server, and the text `Kilogram` is what the user sees.

### All field types used

| Field | Meaning |
|---|---|
| `CharField(max_length=100)` | Short text. `max_length` is required |
| `TextField()` | Long text with no limit |
| `IntegerField()` | Whole number (quantity) |
| `DecimalField(max_digits=10, decimal_places=2)` | Exact money values like `199.50`. Use it for prices, never `FloatField` |
| `EmailField()` | Text that must look like an email |
| `DateTimeField(auto_now_add=True)` | Filled in automatically when the row is created |
| `ForeignKey(Category, ...)` | **Many-to-one.** Many products belong to one category |

### All options and methods used

- `choices=UNIT_CHOICES` gives a fixed list of allowed values (see *Choices, explained slowly* above).
- `unique=True` on `sku` means two products can't have the same code.
- `default=0` means a new product starts with 0 in stock.
- `blank=True` means the field may be left empty in forms and in the API (description, email, address, note).
- `on_delete=models.CASCADE` means: delete a category (or supplier), and its products are deleted too.
- `is_low_stock()` and `stock_value()` are **normal Python methods** on the model. Use them anywhere: `product.is_low_stock()` in views, `{% if product.is_low_stock %}` in templates.
- `__str__` is the text Django shows for a row (in admin dropdowns, for example `USB Cable (USB-01)`).

## 4. Make and run migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

**What it does**
- `makemigrations` reads `models.py` and writes a migration file (`inventoryapp/migrations/0001_initial.py`). It's a plan for creating the tables.
- `migrate` runs that plan on the database (`db.sqlite3`). It also creates Django's built-in tables (users, sessions, admin).
- **Every time you change `models.py`, run both commands again.**

## 5. admin.py

Open `inventoryapp/admin.py` and replace everything with:

```python title="inventoryapp/admin.py"
from django.contrib import admin
from .models import Category, Supplier, Product, StockTransaction

admin.site.register(Category)
admin.site.register(Supplier)
admin.site.register(Product)
admin.site.register(StockTransaction)
```

**What it does**
- `admin.site.register(Model)` adds that table to the admin panel at `/admin/`, with add, edit, delete and list pages for free.

> [!WARNING]
> Adding a stock transaction **inside the admin panel** does not change the product's quantity, because that logic lives in our views (Steps 8 and 13). Use the admin for categories, suppliers and products. Record stock through the API or the Stock page.

## 6. Create the admin and some test data

Create the superuser. You'll use it to log in everywhere:

```bash
python manage.py createsuperuser
python manage.py runserver
```

**What it does**
- `createsuperuser` asks for a username, email (you can leave it empty) and password.
- `runserver` starts the site at `http://127.0.0.1:8000/`. Keep this terminal running and open a second terminal for other commands.

Open `http://127.0.0.1:8000/admin/`, log in, and add this data **in this order**:

1. **Categories** → add `Electronics` and `Stationery`.
2. **Suppliers** → add `ABC Traders`, phone `9876543210`.
3. **Products** → add `USB Cable`: SKU `USB-01`, category Electronics, supplier ABC Traders, price `199`, reorder level `5`. Leave quantity at `0`.
4. **Products** → add `Notebook`: SKU `NB-01`, category Stationery, supplier ABC Traders, price `45`, reorder level `20`.

> [!TIP] Checkpoint
> If you can see all four tables in `/admin/` and add rows, **Part A is done**. You already have something to show.

## Part B — REST API

The API sends and receives **JSON** instead of HTML. Three pieces work together:

```flow
Serializer | converts a model object ↔ JSON and checks incoming data (like a ModelForm)
ViewSet | one class that does list, create, read, update and delete
Router | builds all the URLs for a ViewSet automatically
```

## 7. serializers.py

Create a **new file** `inventoryapp/serializers.py`:

```python title="inventoryapp/serializers.py"
from rest_framework import serializers
from .models import Category, Supplier, Product, StockTransaction


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'
        read_only_fields = ['quantity']   # quantity only changes through stock transactions


class StockTransactionSerializer(serializers.ModelSerializer):
    quantity = serializers.IntegerField(min_value=1)

    class Meta:
        model = StockTransaction
        fields = '__all__'
        read_only_fields = ['created_by']   # filled in with the logged-in user

    def validate(self, data):
        # Can't take out more than what is in stock
        product = data['product']
        if data['transaction_type'] == 'out' and data['quantity'] > product.quantity:
            raise serializers.ValidationError('Not enough stock. Only ' + str(product.quantity) + ' left.')
        return data
```

**In one line:** a serializer turns a model row into JSON, and checks JSON before saving it. It's a `ModelForm` for APIs.

- **`class Meta`** is a settings box, the same as in a `ModelForm`. `model` says which table. `fields = '__all__'` means "every column".
- `read_only_fields` → shown in the JSON but can't be sent. Nobody can type a quantity, and `created_by` is set by the view.
- `quantity = serializers.IntegerField(min_value=1)` → stock moves must be at least 1.
- **`validate(self, data)`** is the inventory's one rule: no stock out bigger than the stock. `raise serializers.ValidationError(...)` sends back **400**.
- `sku` is `unique=True` in the model, so a duplicate SKU gives a 400 error **automatically**.

## 8. api_views.py (ViewSets)

We keep API views in their own file so they don't mix with the web views. Create a **new file** `inventoryapp/api_views.py`:

```python title="inventoryapp/api_views.py"
from rest_framework import viewsets
from .models import Category, Supplier, Product, StockTransaction
from .serializers import CategorySerializer, SupplierSerializer, ProductSerializer, StockTransactionSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer


class StockTransactionViewSet(viewsets.ModelViewSet):
    queryset = StockTransaction.objects.all()
    serializer_class = StockTransactionSerializer
    http_method_names = ['get', 'post']   # stock history can't be edited or deleted

    def perform_create(self, serializer):
        # 1. save the transaction with the logged-in user
        stock = serializer.save(created_by=self.request.user)

        # 2. update the product quantity
        product = stock.product
        if stock.transaction_type == 'in':
            product.quantity = product.quantity + stock.quantity
        else:
            product.quantity = product.quantity - stock.quantity
        product.save()
```

**In one line:** each `ModelViewSet` gives list, create, read, update and delete for one table, from just two lines:

- `queryset` → which rows. `serializer_class` → which serializer from Step 7.

| HTTP | URL | Does |
|---|---|---|
| GET / POST | `/api/products/` | list all / create one |
| GET / PUT / PATCH / DELETE | `/api/products/1/` | read / update / update some fields / delete |

**StockTransactionViewSet**
- `http_method_names = ['get', 'post']` switches off edit and delete (**405**). Changing old history would make the quantities wrong.
- `perform_create` runs **after** the serializer's checks pass. It saves the transaction with `created_by`, then adds or subtracts the quantity on the product.

> [!NOTE] What about permissions?
> We don't write a `permissions.py`. One setting in Step 10 makes the whole API **login only**, so any logged-in user can use every endpoint.

## 9. Project urls.py (router + JWT URLs)

Open `inventoryproject/urls.py` and replace everything with:

```python title="inventoryproject/urls.py"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from inventoryapp import api_views

router = DefaultRouter()
router.register('categories', api_views.CategoryViewSet)
router.register('suppliers', api_views.SupplierViewSet)
router.register('products', api_views.ProductViewSet)
router.register('stock', api_views.StockTransactionViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view()),           # JWT login
    path('api/token/refresh/', TokenRefreshView.as_view()),      # new access token
    path('api/', include(router.urls)),                          # all ViewSet URLs
    path('api-auth/', include('rest_framework.urls')),           # Log in link on browser API pages
]
```

**In one line:** the router writes the API URLs for you.

- Each `router.register('products', api_views.ProductViewSet)` makes `/api/products/` and `/api/products/<id>/`.
- `from inventoryapp import api_views` imports the whole file, so we write `api_views.ProductViewSet`.
- `api/token/` is the **login** (username + password → tokens). `api/token/refresh/` gives a new access token.

## 10. Switch on JWT and "login only" (the one extra setting)

Open `inventoryproject/settings.py` again and add this block **at the very end of the file**:

```python title="inventoryproject/settings.py — add at the end"
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

**In one line:** accept a JWT token (Postman) or the normal login cookie (browser), and block anyone who isn't logged in.

- `JWTAuthentication` reads the `Authorization: Bearer <token>` header that Postman sends.
- `SessionAuthentication` reads the login cookie after you log in through `api-auth/`.
- `IsAuthenticated` applies to **every** ViewSet, so you don't write `permission_classes` anywhere. No token → **401**.

> [!IMPORTANT] Don't skip it
> Without this block, Postman always gets *"Authentication credentials were not provided"*, even with a valid token. And without `IsAuthenticated`, **anyone** could add or delete data. The access token lasts 5 minutes and the refresh token lasts 1 day.

## 11. Test the API

Restart the server if it isn't running (`python manage.py runserver`).

### In the browser

1. Open `http://127.0.0.1:8000/api/`. You'll see the router's list of endpoints.
2. Click **Log in** (top right) and log in as your superuser.
3. Open `/api/products/`, fill in the form at the bottom and click **POST**.

### In Postman (with JWT)

**Step 1: log in.** `POST http://127.0.0.1:8000/api/token/` with your superuser, Body → raw → JSON:

```json
{
    "username": "admin",
    "password": "your-password"
}
```

You get back `"refresh"` and `"access"` tokens.

**Step 2: use the token.** In every other request: **Authorization** tab → **Bearer Token** → paste the `access` value.

**Step 3: try these requests**

| Request | Body (raw JSON) | Expected |
|---|---|---|
| `GET /api/products/` | | 200, list of products |
| `POST /api/products/` | `{"name": "Mouse", "sku": "MS-01", "category": 1, "supplier": 1, "unit": "pcs", "price": "499.00", "reorder_level": 5}` | 201, `quantity` is 0 |
| same POST again | same body | 400, *product with this sku already exists* |
| `POST /api/stock/` | `{"product": 1, "transaction_type": "in", "quantity": 50, "note": "From ABC Traders"}` | 201, USB Cable quantity becomes 50 |
| `POST /api/stock/` | `{"product": 1, "transaction_type": "out", "quantity": 70}` | 400, *Not enough stock. Only 50 left.* |
| `POST /api/stock/` | `{"product": 1, "transaction_type": "out", "quantity": 46, "note": "Sold"}` | 201, quantity becomes 4 |
| `POST /api/stock/` | `{"product": 1, "transaction_type": "in", "quantity": 0}` | 400, quantity must be at least 1 |
| `PUT /api/stock/1/` | any | 405 Method Not Allowed |
| *(no token)* `GET /api/products/` | | 401 Unauthorized |

**Step 4: token expired?** (401 *"Token is invalid or expired"* after 5 minutes) `POST /api/token/refresh/` with `{"refresh": "<your refresh token>"}` and paste the new `access` token.

> [!REMEMBER] Status codes to say in the interview
> **200** OK · **201** Created · **204** Deleted (No Content) · **400** validation error · **401** not logged in / bad token · **404** not found · **405** method not allowed

> [!TIP] Checkpoint
> If stock in, stock out and the "not enough stock" error all work in Postman, **Part B is done**.

## Part C — Web pages (MVT)

Now the normal Django side: HTML pages with signup, login, products and stock in/out. We use **ModelForms**, so Django builds the HTML inputs and checks them for us. One `form.html` template is shared by every form page.

## 12. forms.py

Create a **new file** `inventoryapp/forms.py`:

```python title="inventoryapp/forms.py"
from django import forms
from .models import Product, StockTransaction


class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ['name', 'sku', 'category', 'supplier', 'unit', 'price', 'reorder_level']


class StockForm(forms.ModelForm):
    quantity = forms.IntegerField(min_value=1)

    class Meta:
        model = StockTransaction
        fields = ['product', 'transaction_type', 'quantity', 'note']

    def clean(self):
        data = super().clean()
        product = data.get('product')
        quantity = data.get('quantity')
        # Can't take out more than what is in stock
        if product and quantity and data.get('transaction_type') == 'out':
            if quantity > product.quantity:
                raise forms.ValidationError('Not enough stock. Only ' + str(product.quantity) + ' left.')
        return data
```

**In one line:** a `ModelForm` is the web-page twin of a `ModelSerializer`: same `class Meta`, but it makes HTML inputs instead of JSON.

- `ProductForm` lists every field **except `quantity`**. Quantity only changes on the Stock page.
- A duplicate SKU is caught **automatically** because `sku` is `unique=True` in the model.
- `StockForm` leaves out `created_by`. The view fills it in with the logged-in user.
- `clean()` is the same "not enough stock" rule as the serializer's `validate()`. We use `.get()` because a field with an error is missing from `data`.

## 13. views.py (web pages)

Open `inventoryapp/views.py` and replace everything with:

```python title="inventoryapp/views.py"
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.decorators import login_required

from .models import Product, StockTransaction
from .forms import ProductForm, StockForm


# ---------------- Signup / Login / Logout ----------------

def signup_view(request):
    form = UserCreationForm(request.POST or None)
    if form.is_valid():
        user = form.save()
        login(request, user)
        return redirect('dashboard')
    return render(request, 'form.html', {'form': form, 'title': 'Sign up'})


def login_view(request):
    form = AuthenticationForm(request, data=request.POST or None)
    if form.is_valid():
        login(request, form.get_user())
        return redirect('dashboard')
    return render(request, 'form.html', {'form': form, 'title': 'Login'})


def logout_view(request):
    logout(request)
    return redirect('login')


# ---------------- Dashboard ----------------

@login_required(login_url='login')
def dashboard(request):
    products = Product.objects.all()

    total_value = 0
    low_stock_products = []
    for product in products:
        total_value = total_value + product.stock_value()
        if product.is_low_stock():
            low_stock_products.append(product)

    context = {
        'total_products': products.count(),
        'total_value': total_value,
        'low_stock_products': low_stock_products,
    }
    return render(request, 'dashboard.html', context)


# ---------------- Products ----------------

@login_required(login_url='login')
def product_list(request):
    search = request.GET.get('search', '')
    products = Product.objects.filter(name__icontains=search)
    return render(request, 'product_list.html', {'products': products, 'search': search})


@login_required(login_url='login')
def add_product(request):
    form = ProductForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect('product_list')
    return render(request, 'form.html', {'form': form, 'title': 'Add Product'})


@login_required(login_url='login')
def edit_product(request, id):
    product = get_object_or_404(Product, id=id)
    form = ProductForm(request.POST or None, instance=product)
    if form.is_valid():
        form.save()
        return redirect('product_list')
    return render(request, 'form.html', {'form': form, 'title': 'Edit Product'})


@login_required(login_url='login')
def delete_product(request, id):
    product = get_object_or_404(Product, id=id)
    if request.method == 'POST':
        product.delete()
    return redirect('product_list')


# ---------------- Stock In / Out ----------------

@login_required(login_url='login')
def stock_entry(request):
    form = StockForm(request.POST or None)
    if form.is_valid():
        # 1. save the transaction with the logged-in user
        stock = form.save(commit=False)
        stock.created_by = request.user
        stock.save()

        # 2. update the product quantity
        product = stock.product
        if stock.transaction_type == 'in':
            product.quantity = product.quantity + stock.quantity
        else:
            product.quantity = product.quantity - stock.quantity
        product.save()
        return redirect('transaction_list')
    return render(request, 'form.html', {'form': form, 'title': 'Stock In / Out'})


@login_required(login_url='login')
def transaction_list(request):
    transactions = StockTransaction.objects.all().order_by('-created_at')
    return render(request, 'transaction_list.html', {'transactions': transactions})
```

**In one line:** every form view is the same 5 lines: **make the form → if valid, save and redirect → otherwise show the page.**

- `request.POST or None` gives the form the submitted data on POST, and nothing on GET. An empty form isn't "valid", so a GET just shows the page.
- `UserCreationForm` (signup) and `AuthenticationForm` (login) are Django's ready-made forms. `login(request, user)` saves the user in a cookie.
- `instance=product` fills the form with the product's current values, and `form.save()` updates that row.
- `form.save(commit=False)` makes the object **without saving it yet**, so we can add `created_by` first.
- The stock view then does **the same two steps** as the API's `perform_create`: save the transaction, then change `product.quantity`.
- `@login_required(login_url='login')` sends anyone not logged in to the login page.

## 14. inventoryapp/urls.py (web URLs)

Create a **new file** `inventoryapp/urls.py`:

```python title="inventoryapp/urls.py"
from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('signup/', views.signup_view, name='signup'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('products/', views.product_list, name='product_list'),
    path('products/add/', views.add_product, name='add_product'),
    path('products/edit/<int:id>/', views.edit_product, name='edit_product'),
    path('products/delete/<int:id>/', views.delete_product, name='delete_product'),

    path('stock/', views.stock_entry, name='stock_entry'),
    path('transactions/', views.transaction_list, name='transaction_list'),
]
```

**In one line:** each `path(...)` connects a URL to a view. `<int:id>` passes the number from `/products/edit/3/` as `id=3`, and `name=` is what `redirect()` and `{% url %}` use.

## 15. Final project urls.py

Open `inventoryproject/urls.py` again and add **one line** at the bottom of `urlpatterns`:

```python title="inventoryproject/urls.py"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from inventoryapp import api_views

router = DefaultRouter()
router.register('categories', api_views.CategoryViewSet)
router.register('suppliers', api_views.SupplierViewSet)
router.register('products', api_views.ProductViewSet)
router.register('stock', api_views.StockTransactionViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view()),           # JWT login
    path('api/token/refresh/', TokenRefreshView.as_view()),      # new access token
    path('api/', include(router.urls)),                          # all ViewSet URLs
    path('api-auth/', include('rest_framework.urls')),           # Log in link on browser API pages
    path('', include('inventoryapp.urls')),                      # <--- ADDED: web pages
]
```

**In one line:** the new last line sends every other URL (`/`, `/login/`, `/products/`...) to the app's `urls.py`. It goes last so `/admin/` and `/api/` match first.

## 16. Templates

All HTML files go in the `templates/` folder next to `manage.py`. Every page **extends** `base.html`, so the menu is written once. You need **five** files.

**Template words you'll see on every page**

| Tag | Meaning |
|---|---|
| `{% extends 'base.html' %}` + `{% block content %}` | Use the base layout and fill its empty slot |
| `{{ product.name }}` | Print a value from the view's `context` |
| `{% for ... %}` / `{% if ... %}` | Loop / condition |
| `{% url 'edit_product' product.id %}` | Build a URL from its name → `/products/edit/3/` |
| `{% csrf_token %}` | **Required in every POST form**, or you get 403 CSRF failed |
| `get_transaction_type_display` | Show the choice's label ("Stock In") instead of the stored value |

### base.html

```html title="templates/base.html"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Inventory Management</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; background: #f4f6f8; }
        nav { background: #2d6a4f; padding: 14px 20px; }
        nav a { color: white; margin-right: 16px; text-decoration: none; font-weight: bold; }
        .container { max-width: 1000px; margin: 20px auto; background: white; padding: 20px; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f0f0f0; }
        input, select, textarea { width: 100%; padding: 8px; margin: 4px 0 12px; box-sizing: border-box; }
        button { padding: 8px 16px; background: #2d6a4f; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .danger { background: #d73a49; }
        .errorlist, .low { color: #d73a49; font-weight: bold; }
        .inline { display: inline; }
        .box { display: inline-block; width: 200px; padding: 15px; margin: 5px; background: #e9f5ee; border-radius: 8px; }
        .box h2 { margin: 0; }
    </style>
</head>
<body>
    <nav>
        {% if user.is_authenticated %}
            <a href="{% url 'dashboard' %}">Dashboard</a>
            <a href="{% url 'product_list' %}">Products</a>
            <a href="{% url 'stock_entry' %}">Stock In / Out</a>
            <a href="{% url 'transaction_list' %}">History</a>
            {% if user.is_staff %}
                <a href="/admin/">Admin Panel</a>
            {% endif %}
            <a href="{% url 'logout' %}">Logout ({{ user.username }})</a>
        {% else %}
            <a href="{% url 'login' %}">Login</a>
            <a href="{% url 'signup' %}">Sign up</a>
        {% endif %}
    </nav>

    <div class="container">
        {% block content %}
        {% endblock %}
    </div>
</body>
</html>
```

**In one line:** the shared layout: menu on top, each page's content below. `user` is always available, so the menu switches between "logged in" links and Login / Sign up. Skip the `<style>` block if you're in a hurry.

### form.html (used by signup, login, add/edit product and stock in/out)

```html title="templates/form.html"
{% extends 'base.html' %}

{% block content %}
    <h2>{{ title }}</h2>
    <form method="POST">
        {% csrf_token %}
        {{ form.as_p }}
        <button type="submit">{{ title }}</button>
    </form>
{% endblock %}
```

**In one line:** `{{ form.as_p }}` prints every input of whatever form the view sent, with its label and any error message. That's why one template is enough for five pages.

### dashboard.html

```html title="templates/dashboard.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Dashboard</h2>
    <p>Welcome, {{ user.username }}</p>

    <div class="box"><p>Products</p><h2>{{ total_products }}</h2></div>
    <div class="box"><p>Stock value</p><h2>Rs. {{ total_value }}</h2></div>

    <h3>Low stock ({{ low_stock_products|length }})</h3>
    <table>
        <tr><th>Product</th><th>SKU</th><th>In stock</th><th>Reorder level</th></tr>
        {% for product in low_stock_products %}
        <tr>
            <td>{{ product.name }}</td>
            <td>{{ product.sku }}</td>
            <td class="low">{{ product.quantity }}</td>
            <td>{{ product.reorder_level }}</td>
        </tr>
        {% empty %}
        <tr><td colspan="4">All products have enough stock.</td></tr>
        {% endfor %}
    </table>
{% endblock %}
```

**In one line:** two total boxes, then the low-stock products. `|length` counts the items in a list, and `{% empty %}` shows a message when the list has no rows.

### product_list.html

```html title="templates/product_list.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Products</h2>

    <form method="GET">
        <input type="text" name="search" value="{{ search }}" placeholder="Search by name">
        <button type="submit">Search</button>
    </form>

    <p><a href="{% url 'add_product' %}">+ Add New Product</a></p>

    <table>
        <tr><th>Name</th><th>SKU</th><th>Category</th><th>Price</th><th>In stock</th><th>Actions</th></tr>
        {% for product in products %}
        <tr>
            <td>{{ product.name }}</td>
            <td>{{ product.sku }}</td>
            <td>{{ product.category.name }}</td>
            <td>Rs. {{ product.price }}</td>
            <td {% if product.is_low_stock %}class="low"{% endif %}>{{ product.quantity }} {{ product.unit }}</td>
            <td>
                <a href="{% url 'edit_product' product.id %}">Edit</a>
                <form method="POST" action="{% url 'delete_product' product.id %}" class="inline">
                    {% csrf_token %}
                    <button type="submit" class="danger">Delete</button>
                </form>
            </td>
        </tr>
        {% empty %}
        <tr><td colspan="6">No products found.</td></tr>
        {% endfor %}
    </table>
{% endblock %}
```

**In one line:** a GET search box (`/products/?search=usb`), a table of products with low stock in red, and Edit / Delete for each row. `product.is_low_stock` calls the model method; in templates you leave out the `()`.

### transaction_list.html

```html title="templates/transaction_list.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Stock History</h2>

    <table>
        <tr><th>When</th><th>Product</th><th>Type</th><th>Quantity</th><th>Note</th><th>By</th></tr>
        {% for t in transactions %}
        <tr>
            <td>{{ t.created_at|date:"d M Y, H:i" }}</td>
            <td>{{ t.product.name }}</td>
            <td>{{ t.get_transaction_type_display }}</td>
            <td>{{ t.quantity }}</td>
            <td>{{ t.note }}</td>
            <td>{{ t.created_by.username }}</td>
        </tr>
        {% empty %}
        <tr><td colspan="6">No stock movements yet.</td></tr>
        {% endfor %}
    </table>
{% endblock %}
```

**In one line:** the audit log: every stock change, who made it and when. `|date:"d M Y, H:i"` formats the time as `15 Jan 2030, 10:30`.

## 17. Run and check everything

```bash
python manage.py runserver
```

Open `http://127.0.0.1:8000/` and go through this checklist:

1. You're sent to `/login/` because the dashboard has `@login_required`.
2. Click **Sign up**, create `worker2`. You're logged in and see the dashboard.
3. **Products** → add a product, edit it, and try the same SKU twice to see the error.
4. **Stock In / Out** → Stock In 30 Notebooks. **History** shows it.
5. Stock Out 100 Notebooks, and you see the red *Not enough stock* error.
6. Stock Out until the quantity is at or below the reorder level. It shows in red on Products and appears on the Dashboard.

> [!TIP] Done
> You now have models, admin, a JWT-protected REST API with stock rules, plus web pages with signup and login. That's a complete inventory management system.

## 18. Explain it in the interview

**"Walk me through what happens when Postman records a stock out."**

```flow
POST /api/stock/ | Postman sends JSON + Authorization: Bearer <token>
urls.py | the router sends it to StockTransactionViewSet → create
JWTAuthentication | reads the token, sets request.user = admin
IsAuthenticated | the user is logged in → allowed (else 401)
StockTransactionSerializer | quantity ≥ 1, then validate() checks there is enough stock (else 400)
perform_create | saves the transaction with created_by, then subtracts from product.quantity
Response | 201 Created + the transaction as JSON
```

**Questions you may get**

| Question | Short answer |
|---|---|
| What is `class Meta`? | A settings box inside the serializer: `model` says which model to copy fields from, `fields` says which to include. |
| What is a serializer? | It converts model objects to JSON and back, and validates input. It's like a ModelForm for APIs. |
| What does `fields = '__all__'` mean? | Use every column of the model. You can also give a list, like `['name', 'sku']`. |
| What is `read_only_fields`? | Shown in responses but can't be sent. Nobody can type a quantity; it only changes through stock moves. |
| ModelForm vs ModelSerializer? | Same idea, same `class Meta`. A ModelForm makes HTML inputs, a ModelSerializer makes JSON. |
| What does `form.save(commit=False)` do? | Makes the object without saving it, so you can fill in extra fields (like `created_by`) first. |
| What is `perform_create`? | A ViewSet hook that runs after validation, in place of `serializer.save()`. We use it to add `created_by` and update the stock. |
| Why can't you edit stock transactions? | `http_method_names = ['get', 'post']`. Changing history would make the quantities wrong. To fix a mistake you add a new transaction. |
| Why two words in choices, `('kg', 'Kilogram')`? | The first is saved in the database and used in code. The second is the label people see. |
| Why `DecimalField` for price? | It's exact. A float can't store values like 0.1 exactly, which is bad for money. |
| What is JWT? | A signed token given at login. The client sends it in the `Authorization: Bearer` header on every request. |
| Access vs refresh token? | Access is short-lived and used on every request. Refresh is longer-lived and only used to get a new access token. |
| How is the API protected? | `IsAuthenticated` in `DEFAULT_PERMISSION_CLASSES`: no login → 401. For roles you'd write a `BasePermission` class (e.g. only `is_staff` can add products). |
| What if two people sell the last item at the same moment? | In a real system you'd wrap the stock update in `transaction.atomic()` and lock the row with `select_for_update()`. Mention it. You don't need to code it in a practical. |

## 19. Common errors and fixes

| Error | Cause | Fix |
|---|---|---|
| `No module named 'rest_framework_simplejwt'` | Package not installed, or the venv isn't active | Activate the venv, then `pip install djangorestframework-simplejwt` |
| `no such table: inventoryapp_product` | Migrations not run | `python manage.py makemigrations` then `python manage.py migrate` |
| `TemplateDoesNotExist: dashboard.html` | `DIRS` not set, or the file is in the wrong folder | Check Step 2, and keep `templates/` next to `manage.py` |
| `NoReverseMatch: Reverse for 'product_list' not found` | URL name typo, or app URLs not included | Check `name=` in Step 14 and the last line of Step 15 |
| `CSRF verification failed` (403) | A POST form without `{% csrf_token %}` | Add `{% csrf_token %}` inside the `<form>` |
| Postman: *Authentication credentials were not provided* | No token, or the `REST_FRAMEWORK` block is missing | Use Bearer Token in Postman, and check Step 10 |
| Postman: *Token is invalid or expired* | The access token is older than 5 minutes | Call `/api/token/refresh/` or log in again |
| Postman `/api/token/` gives 401 | An old expired Bearer token is still set on the request | Set Authorization to **No Auth** for the token request |
| Login fails for a user made in admin | Password was saved as plain text | Use the admin's **Add user** form, or the Sign up page |
| Quantity didn't change after adding a transaction in `/admin/` | The admin panel skips our view logic | Record stock through `/api/stock/` or the Stock In / Out page |
| `basename` argument not specified | A viewset has no `queryset` line | Add `queryset = Model.objects.all()` to the viewset |
