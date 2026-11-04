You will build an **Inventory Management System** step by step, the same way you built the Player project in class:

**project → app → settings → models → migrations → admin → serializers → viewsets → router → JWT → Postman → web pages**

Every file is shown **in full**. Click **Copy**, paste it into VS Code, save. After every block there is a short note on **what the code does** and **how it is used**, so you can explain it to the interviewer.

> [!TIP] How to use this page in a practical test
> Go top to bottom. Every step ends with something you can run.
> - **Part A (Steps 1–6):** project, models, admin. You can already add data in `/admin/`.
> - **Part B (Steps 7–12):** REST API with serializers, viewsets, router, register, JWT and permissions. Test it in Postman.
> - **Part C (Steps 13–17):** normal Django web pages (MVT) with signup, login, products and stock in/out.
>
> If the test only asks for an API, stop after Part B. If it only asks for web pages, do Part A and then Part C.

> [!NOTE] Where the idea comes from
> Open-source inventory apps (for example [munuhee/sales-and-inventory-management](https://github.com/munuhee/sales-and-inventory-management)) have categories, items, vendors, and stock that goes up on a purchase and down on a sale. We kept only those basic ideas and wrote everything in the simple style from class: plain `models.Model`, choices written by hand, function-based web views and `ModelViewSet` for the API.

## 0. What we're building

**Who uses the system.** No custom user model is needed. Django's `User` already has an `is_staff` tick box, and we use that.

| User | How we know | Can do |
|---|---|---|
| **Manager** | `user.is_staff` is `True` (the superuser is staff too) | Everything: categories, suppliers, products |
| **Worker** | Any other logged-in user | View products, record **stock in** and **stock out** |

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
| POST | `/api/register/` | Create a new (worker) account |
| POST | `/api/token/` | Log in and get JWT `access` + `refresh` tokens |
| POST | `/api/token/refresh/` | Get a new access token |
| GET / POST | `/api/categories/` | List / create categories |
| GET / POST | `/api/suppliers/` | List / create suppliers |
| GET / POST | `/api/products/` | List / create products (`?search=usb`) |
| GET / POST | `/api/stock/` | List / record stock in or out (`?type=out`) |
| GET | `/api/low-stock/` | Products at or below their reorder level |
| GET | `/api/summary/` | Totals: products, stock value, low-stock count |
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
    ├── permissions.py        ← new (Part B)
    ├── api_views.py          ← new (Part B)
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
> You don't need a block of extra settings for pagination, filters, time zone or login URLs. The defaults are fine. There is **one** small extra block you do need, and it comes in **Step 11** when we switch on JWT. That step explains why.

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
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)
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
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.transaction_type.upper() + ' ' + str(self.quantity) + ' x ' + self.product.name
```

**What it does.** Each class becomes one table in the database. Each line inside a class becomes one column.

| Model | What it stores | Links |
|---|---|---|
| `Category` | Product groups | Has many products |
| `Supplier` | Who we buy from | Has many products |
| `Product` | One item in the store | `category` → one Category. `supplier` → one Supplier (optional) |
| `StockTransaction` | One stock movement (in or out) | `product` → one Product. `created_by` → the user who recorded it |

**Field types used**

| Field | Meaning |
|---|---|
| `CharField(max_length=100)` | Short text. `max_length` is required |
| `TextField()` | Long text with no limit |
| `IntegerField()` | Whole number (quantity) |
| `DecimalField(max_digits=10, decimal_places=2)` | Exact money values like `199.50`. Use it for prices, never `FloatField` |
| `EmailField()` | Text that must look like an email |
| `DateTimeField(auto_now_add=True)` | Filled in automatically when the row is created |
| `ForeignKey(Category, ...)` | **Many-to-one.** Many products belong to one category |

**Options and methods used**

- `choices=UNIT_CHOICES` gives a fixed list of allowed values. Each pair is `('value saved in DB', 'Label shown to humans')`.
- `unique=True` on `sku` means two products can't have the same code.
- `default=0` means a new product starts with 0 in stock.
- `blank=True` means the field may be left empty in forms and in the API. `null=True` lets the database store "nothing" (NULL). A supplier is optional, so it needs both.
- `on_delete=models.CASCADE` means: delete a category, and its products are deleted too.
- `on_delete=models.SET_NULL` means: delete a supplier, and the products stay but `supplier` becomes empty.
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
> Adding a stock transaction **inside the admin panel** does not change the product's quantity, because that logic lives in our views (Steps 9 and 13). Use the admin for categories, suppliers and products. Record stock through the API or the Stock page.

## 6. Create the manager and some test data

Create the superuser. This account is the **Manager** (a superuser is always staff):

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
4. **Products** → add `Notebook`: SKU `NB-01`, category Stationery, price `45`, reorder level `20`.

You'll make the **worker** account in Step 12 with the register API (or in Part C with the signup page).

> [!TIP] Checkpoint
> If you can see all four tables in `/admin/` and add rows, **Part A is done**. You already have something to show.

## Part B — REST API

The API sends and receives **JSON** instead of HTML. Three pieces work together:

```flow
Serializer | converts a model object ↔ JSON and validates incoming data (like a ModelForm)
ViewSet | one class that does list, create, retrieve, update and delete
Router | builds all the URLs for a ViewSet automatically
```

## 7. serializers.py

Create a **new file** `inventoryapp/serializers.py`:

```python title="inventoryapp/serializers.py"
from django.contrib.auth.models import User
from rest_framework import serializers
from .models import Category, Supplier, Product, StockTransaction


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password']

    def create(self, validated_data):
        # create_user() saves the password HASHED (never as plain text)
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email', ''),
            password=validated_data['password'],
        )
        return user


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description']


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'phone', 'email', 'address']

    def validate_phone(self, value):
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError('Phone number must be exactly 10 digits.')
        return value


class ProductSerializer(serializers.ModelSerializer):
    # Extra read-only fields, only shown in the output
    category_name = serializers.CharField(source='category.name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True, allow_null=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    stock_value = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'name', 'sku', 'category', 'category_name', 'supplier', 'supplier_name',
                  'unit', 'price', 'quantity', 'reorder_level', 'is_low_stock', 'stock_value', 'created_at']
        read_only_fields = ['quantity']   # quantity only changes through stock transactions

    def validate_sku(self, value):
        value = value.upper()   # 'usb-01' is saved as 'USB-01'
        products = Product.objects.filter(sku=value)
        if self.instance:
            # When updating, don't compare the product with itself
            products = products.exclude(id=self.instance.id)
        if products.exists():
            raise serializers.ValidationError('A product with SKU ' + value + ' already exists.')
        return value

    def validate_price(self, value):
        if value <= 0:
            raise serializers.ValidationError('Price must be greater than 0.')
        return value

    def validate_reorder_level(self, value):
        if value < 0:
            raise serializers.ValidationError('Reorder level cannot be negative.')
        return value


class StockTransactionSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = StockTransaction
        fields = ['id', 'product', 'product_name', 'transaction_type', 'quantity', 'note',
                  'created_by', 'created_by_username', 'created_at']
        read_only_fields = ['created_by']   # set automatically to the logged-in user

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than 0.')
        return value

    def validate(self, data):
        # Cross-field check: cannot take out more than what is in stock
        product = data['product']
        if data['transaction_type'] == 'out' and data['quantity'] > product.quantity:
            raise serializers.ValidationError(
                'Not enough stock. Only ' + str(product.quantity) + ' left for ' + product.name + '.'
            )
        return data
```

**What it does**

- **`ModelSerializer`** builds the fields from the model for you, just like `ModelForm` does for forms. `Meta.model` says which model. `Meta.fields` lists which columns appear in the JSON.
- **Output (model → JSON).** A Product object becomes:
  ```json
  {"id": 1, "name": "USB Cable", "sku": "USB-01", "category": 1, "category_name": "Electronics", "supplier": 1, "supplier_name": "ABC Traders", "unit": "pcs", "price": "199.00", "quantity": 4, "reorder_level": 5, "is_low_stock": true, "stock_value": "796.00", "created_at": "..."}
  ```
  Money (`DecimalField`) comes out as a **string** (`"199.00"`) so no precision is lost.
- **Input (JSON → model).** On POST, the serializer checks every field, runs your `validate_...` methods, then saves.
- **Foreign keys** like `category` and `product` are sent as **ids** (`"category": 1`).

**The extra fields**

| Field | What it does |
|---|---|
| `category_name = CharField(source='category.name', read_only=True)` | Follows the foreign key and shows the name next to the id |
| `supplier_name = CharField(..., allow_null=True)` | Same, but the supplier is optional. `allow_null=True` shows `null` when a product has no supplier |
| `is_low_stock = BooleanField(read_only=True)` | No `source` is given, so DRF uses the field name and **calls the model method** `is_low_stock()` |
| `stock_value = DecimalField(..., read_only=True)` | Same idea: calls `stock_value()` (quantity × price) |
| `read_only_fields = ['quantity']` | Clients can **see** the quantity but can't **send** it. That keeps the inventory honest |
| `password = CharField(write_only=True)` | The opposite: clients send it, but it's **never** shown in a response |

**RegisterSerializer**
- It uses Django's own `User` model, so no custom user is needed.
- We override `create()` because the default would save the password as plain text. `User.objects.create_user(...)` **hashes** it, which is the only way login will work later.
- `ModelSerializer` adds a "username already exists" check automatically, because `username` is unique in `User`.

**Validation methods**

| Method | Checks |
|---|---|
| `validate_sku` | **Changes** the value to upper case (whatever you return is what gets saved), then checks no other product has that SKU. `self.instance` is the product being updated (`None` on create), so we skip it |
| `validate_price` / `validate_reorder_level` / `validate_quantity` / `validate_phone` | One field each. `raise serializers.ValidationError(...)` gives a **400** response |
| `validate(self, data)` | Several fields together: type is `out` **and** quantity is more than what's in stock |

## 8. permissions.py

Create a **new file** `inventoryapp/permissions.py`:

```python title="inventoryapp/permissions.py"
from rest_framework.permissions import BasePermission


class IsStaffOrReadOnly(BasePermission):
    # Any logged-in user can READ. Only staff (managers) can create, edit or delete.
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return request.user.is_staff
```

**What it does**
- A permission class extends `BasePermission` and overrides `has_permission(self, request, view)`. DRF calls it **before** every request. Return `True` to allow it or `False` to block it.
- Not logged in → `False`, and the API answers **401 Unauthorized**.
- `GET`, `HEAD` and `OPTIONS` only read data, so every logged-in user may use them.
- Anything else (POST, PUT, PATCH, DELETE) is only allowed if `request.user.is_staff` is `True`. Otherwise the API answers **403 Forbidden**.
- Make someone a manager in `/admin/` → Users → click the user → tick **Staff status** → Save.

## 9. api_views.py (ViewSets and function views)

We keep API views in their own file so they don't mix with the web views. Create a **new file** `inventoryapp/api_views.py`:

```python title="inventoryapp/api_views.py"
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Category, Supplier, Product, StockTransaction
from .serializers import (RegisterSerializer, CategorySerializer, SupplierSerializer,
                          ProductSerializer, StockTransactionSerializer)
from .permissions import IsStaffOrReadOnly


# ---------------- ViewSets (full CRUD) ----------------

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrReadOnly]


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all().order_by('name')
    serializer_class = SupplierSerializer
    permission_classes = [IsStaffOrReadOnly]


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsStaffOrReadOnly]

    def get_queryset(self):
        products = Product.objects.all().order_by('name')

        # /api/products/?search=usb
        search = self.request.query_params.get('search')
        if search:
            products = products.filter(name__icontains=search)

        # /api/products/?category=electronics
        category = self.request.query_params.get('category')
        if category:
            products = products.filter(category__name__icontains=category)

        return products


class StockTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = StockTransactionSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post']   # no edit / delete: stock history must not change

    def get_queryset(self):
        transactions = StockTransaction.objects.all().order_by('-created_at')

        # /api/stock/?type=in   or   /api/stock/?type=out
        transaction_type = self.request.query_params.get('type')
        if transaction_type:
            transactions = transactions.filter(transaction_type=transaction_type)

        return transactions

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


# ---------------- Function-based API views ----------------

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def low_stock_products(request):
    low_stock = []
    for product in Product.objects.all().order_by('quantity'):
        if product.is_low_stock():
            low_stock.append(product)

    serializer = ProductSerializer(low_stock, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_summary(request):
    products = Product.objects.all()

    total_value = 0
    low_stock_count = 0
    for product in products:
        total_value = total_value + product.stock_value()
        if product.is_low_stock():
            low_stock_count = low_stock_count + 1

    data = {
        'total_products': products.count(),
        'total_categories': Category.objects.count(),
        'total_suppliers': Supplier.objects.count(),
        'total_stock_value': total_value,
        'low_stock_count': low_stock_count,
    }
    return Response(data)
```

**What it does**

**`ModelViewSet`** gives you 6 actions from one class:

| HTTP | URL | Action |
|---|---|---|
| GET | `/api/products/` | `list` |
| POST | `/api/products/` | `create` |
| GET | `/api/products/1/` | `retrieve` |
| PUT | `/api/products/1/` | `update` (all fields) |
| PATCH | `/api/products/1/` | `partial_update` (only changed fields) |
| DELETE | `/api/products/1/` | `destroy` |

- `queryset = ...` is a fixed list of rows (categories, suppliers).
- `get_queryset(self)` is used when the rows depend on the request. `self.request.query_params.get('search')` reads `?search=...` from the URL. `name__icontains` means "contains, ignoring case". `category__name__icontains` goes through the foreign key to the category's name.
- `permission_classes = [IsStaffOrReadOnly]` is our class from Step 8. `IsAuthenticated` is built into DRF: any logged-in user.

**StockTransactionViewSet**
- `http_method_names = ['get', 'post']` switches off PUT, PATCH and DELETE (they return **405 Method Not Allowed**). Editing old stock history would make the quantities wrong.
- **`perform_create(self, serializer)`** is a hook DRF calls **after validation passes**, in place of a plain `serializer.save()`:
  1. `serializer.save(created_by=self.request.user)` saves the transaction and fills in `created_by`, which the client can't send.
  2. It then adds or subtracts the quantity on the product and saves the product.
- Validation (`validate()` in the serializer) runs **first**, so a stock out bigger than the stock never reaches `perform_create`.

**Function-based API views** (for things that aren't simple CRUD)
- `@api_view(['POST'])` turns a normal function into an API view that only accepts POST. Any other method gets **405**.
- `@permission_classes([AllowAny])` means anyone can call it. That's needed for **register**, because a new user has no token yet.
- `register` follows the same steps as a form: `serializer = ...(data=request.data)` → `is_valid()` → `save()` → **201**, or return the `errors` with **400**.
- `low_stock_products` loops through the products, keeps the low ones, and serializes the list with **`many=True`** (many=True means "this is a list of objects, not one").
- `stock_summary` adds up `stock_value()` for every product and returns a plain dictionary. `Response(...)` turns any dict into JSON.

## 10. Project urls.py (router + JWT URLs)

Open `inventoryproject/urls.py` and replace everything with:

```python title="inventoryproject/urls.py"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from inventoryapp import api_views

router = DefaultRouter()
router.register('categories', api_views.CategoryViewSet, basename='category')
router.register('suppliers', api_views.SupplierViewSet, basename='supplier')
router.register('products', api_views.ProductViewSet, basename='product')
router.register('stock', api_views.StockTransactionViewSet, basename='stock')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Register + JWT login
    path('api/register/', api_views.register, name='register'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Reports
    path('api/low-stock/', api_views.low_stock_products, name='low_stock'),
    path('api/summary/', api_views.stock_summary, name='stock_summary'),

    # All API URLs made by the router
    path('api/', include(router.urls)),

    # Login / logout links on the browsable API pages
    path('api-auth/', include('rest_framework.urls')),
]
```

**What it does**
- `from inventoryapp import api_views` imports the whole file, so we write `api_views.register`, `api_views.ProductViewSet` and so on.
- Each `router.register('products', ProductViewSet, basename='product')` line creates both `products/` and `products/<id>/` for all 6 actions.
- `basename` is a prefix for URL names (`product-list`, `product-detail`). It's **required** when a viewset uses `get_queryset` instead of `queryset`.
- The function views (`register`, `low_stock_products`, `stock_summary`) are added with plain `path(...)`, just like normal Django views.
- `TokenObtainPairView` is the **login** endpoint: POST a username and password, get two tokens. `TokenRefreshView` swaps a refresh token for a new access token.
- `api-auth/` adds a **Log in** link to DRF's browser pages.

## 11. Switch on JWT (the one extra setting)

Open `inventoryproject/settings.py` again and add this block **at the very end of the file**:

```python title="inventoryproject/settings.py — add at the end"
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
}
```

**What it does**
- `DEFAULT_AUTHENTICATION_CLASSES` tells DRF **how to work out who the user is** on each API request.
- `JWTAuthentication` reads the header `Authorization: Bearer <token>` (what Postman sends).
- `SessionAuthentication` reads the normal Django login cookie (what the browser sends after you log in through `api-auth/`).

> [!IMPORTANT] Is this block really needed?
> **Yes, this one is.** Without it, DRF only checks the session cookie and ignores the `Bearer` token completely. Postman would always get *"Authentication credentials were not provided"* even with a valid token. You don't need anything else: no token lifetimes, no pagination and no `LOGIN_URL`. The defaults are fine (access token lasts 5 minutes, refresh token lasts 1 day).

## 12. Test the API

Restart the server if it isn't running (`python manage.py runserver`).

### In the browser

1. Open `http://127.0.0.1:8000/api/`. You'll see the router's list of endpoints.
2. Click **Log in** (top right) and log in as your superuser.
3. Open `/api/products/`, fill in the form at the bottom and click **POST**.

### In Postman (with JWT)

**Step 1: register a worker account** (no token needed)

- Method `POST`, URL `http://127.0.0.1:8000/api/register/`
- Body → raw → JSON:

```json
{
    "username": "worker1",
    "email": "worker1@example.com",
    "password": "Store@123"
}
```

The response is **201** with `id`, `username` and `email`. The password is **not** shown because it's `write_only`.

**Step 2: log in and get tokens**

- Method `POST`, URL `http://127.0.0.1:8000/api/token/`
- Body → raw → JSON:

```json
{
    "username": "worker1",
    "password": "Store@123"
}
```

The response has two tokens:

```json
{
    "refresh": "eyJhbGciOiJIUzI1NiIs...",
    "access": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Step 3: use the access token.** In every other request, open the **Authorization** tab, choose **Bearer Token** and paste the `access` value. Postman then sends the header `Authorization: Bearer eyJhbGci...` for you.

**Step 4: try these requests**

| Login as | Request | Body (raw JSON) | Expected |
|---|---|---|---|
| worker1 | `GET /api/products/` | | 200, list of products |
| worker1 | `POST /api/products/` | any | 403, workers can't add products |
| manager | `POST /api/products/` | `{"name": "Mouse", "sku": "ms-01", "category": 1, "unit": "pcs", "price": "499.00", "reorder_level": 5}` | 201, `sku` saved as `MS-01`, `quantity` 0 |
| manager | `POST /api/products/` | `{"name": "Bad", "sku": "x1", "category": 1, "price": "0"}` | 400, price must be greater than 0 |
| worker1 | `POST /api/stock/` | `{"product": 1, "transaction_type": "in", "quantity": 50, "note": "From ABC Traders"}` | 201, USB Cable quantity becomes 50 |
| worker1 | `POST /api/stock/` | `{"product": 1, "transaction_type": "out", "quantity": 70}` | 400, *Not enough stock. Only 50 left* |
| worker1 | `POST /api/stock/` | `{"product": 1, "transaction_type": "out", "quantity": 46, "note": "Sold"}` | 201, quantity becomes 4 |
| worker1 | `GET /api/low-stock/` | | 200, USB Cable is there (4 ≤ 5) |
| worker1 | `GET /api/summary/` | | 200, totals |
| worker1 | `PUT /api/stock/1/` | any | 405 Method Not Allowed |
| *(no token)* | `GET /api/products/` | | 401 Unauthorized |

For the **manager** rows, get a token for your superuser with `POST /api/token/` and use that one.

**Step 5: when the access token expires** (after 5 minutes you get 401 *"Token is invalid or expired"*):

- `POST http://127.0.0.1:8000/api/token/refresh/` with body `{"refresh": "<your refresh token>"}`
- You get a new `access` token. Paste it into the Bearer Token box again.

> [!REMEMBER] Status codes to say in the interview
> **200** OK · **201** Created · **204** Deleted (No Content) · **400** validation error · **401** not logged in / bad token · **403** logged in but not allowed · **404** not found · **405** method not allowed

> [!TIP] Checkpoint
> If stock in, stock out and the "not enough stock" error all work in Postman, **Part B is done**.

## Part C — Web pages (MVT)

Now the normal Django side: HTML pages with signup, login, products and stock in/out. This is the same style as the Player app: `request.POST.get(...)`, `objects.create(...)`, `redirect(...)`.

## 13. views.py (web pages)

Open `inventoryapp/views.py` and replace everything with:

```python title="inventoryapp/views.py"
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.decorators import login_required

from .models import Category, Supplier, Product, StockTransaction


# ---------------- Signup / Login / Logout ----------------

def signup_view(request):
    if request.method == 'POST':
        form = UserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('dashboard')
    else:
        form = UserCreationForm()
    return render(request, 'signup.html', {'form': form})


def login_view(request):
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            login(request, form.get_user())
            return redirect('dashboard')
    else:
        form = AuthenticationForm()
    return render(request, 'login.html', {'form': form})


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
        'total_categories': Category.objects.count(),
        'total_suppliers': Supplier.objects.count(),
        'total_value': total_value,
        'low_stock_products': low_stock_products,
        'recent_transactions': StockTransaction.objects.all().order_by('-created_at')[:5],
    }
    return render(request, 'dashboard.html', context)


# ---------------- Products ----------------

@login_required(login_url='login')
def product_list(request):
    search = request.GET.get('search', '')
    if search:
        products = Product.objects.filter(name__icontains=search).order_by('name')
    else:
        products = Product.objects.all().order_by('name')
    return render(request, 'product_list.html', {'products': products, 'search': search})


@login_required(login_url='login')
def add_product(request):
    if not request.user.is_staff:
        return redirect('product_list')

    error = ''

    if request.method == 'POST':
        sku = request.POST.get('sku').upper()

        if Product.objects.filter(sku=sku).exists():
            error = 'A product with SKU ' + sku + ' already exists.'
        else:
            Product.objects.create(
                name=request.POST.get('name'),
                sku=sku,
                category_id=request.POST.get('category'),
                supplier_id=request.POST.get('supplier') or None,   # empty dropdown -> no supplier
                unit=request.POST.get('unit'),
                price=request.POST.get('price'),
                reorder_level=request.POST.get('reorder_level'),
            )
            return redirect('product_list')

    context = {
        'categories': Category.objects.all().order_by('name'),
        'suppliers': Supplier.objects.all().order_by('name'),
        'error': error,
    }
    return render(request, 'add_product.html', context)


@login_required(login_url='login')
def edit_product(request, id):
    if not request.user.is_staff:
        return redirect('product_list')

    product = get_object_or_404(Product, id=id)
    error = ''

    if request.method == 'POST':
        sku = request.POST.get('sku').upper()

        if Product.objects.filter(sku=sku).exclude(id=product.id).exists():
            error = 'A product with SKU ' + sku + ' already exists.'
        else:
            product.name = request.POST.get('name')
            product.sku = sku
            product.category_id = request.POST.get('category')
            product.supplier_id = request.POST.get('supplier') or None
            product.unit = request.POST.get('unit')
            product.price = request.POST.get('price')
            product.reorder_level = request.POST.get('reorder_level')
            product.save()
            return redirect('product_list')

    context = {
        'product': product,
        'categories': Category.objects.all().order_by('name'),
        'suppliers': Supplier.objects.all().order_by('name'),
        'error': error,
    }
    return render(request, 'edit_product.html', context)


@login_required(login_url='login')
def delete_product(request, id):
    if not request.user.is_staff:
        return redirect('product_list')

    product = get_object_or_404(Product, id=id)
    if request.method == 'POST':
        product.delete()
    return redirect('product_list')


# ---------------- Stock In / Out ----------------

@login_required(login_url='login')
def stock_entry(request):
    error = ''

    if request.method == 'POST':
        product = get_object_or_404(Product, id=request.POST.get('product'))
        transaction_type = request.POST.get('transaction_type')
        quantity = int(request.POST.get('quantity'))
        note = request.POST.get('note')

        if quantity <= 0:
            error = 'Quantity must be greater than 0.'
        elif transaction_type == 'out' and quantity > product.quantity:
            error = 'Not enough stock. Only ' + str(product.quantity) + ' left for ' + product.name + '.'
        else:
            # 1. save the transaction
            StockTransaction.objects.create(
                product=product,
                transaction_type=transaction_type,
                quantity=quantity,
                note=note,
                created_by=request.user,
            )
            # 2. update the product quantity
            if transaction_type == 'in':
                product.quantity = product.quantity + quantity
            else:
                product.quantity = product.quantity - quantity
            product.save()
            return redirect('transaction_list')

    products = Product.objects.all().order_by('name')
    return render(request, 'stock_entry.html', {'products': products, 'error': error})


@login_required(login_url='login')
def transaction_list(request):
    transaction_type = request.GET.get('type', '')
    if transaction_type:
        transactions = StockTransaction.objects.filter(transaction_type=transaction_type).order_by('-created_at')
    else:
        transactions = StockTransaction.objects.all().order_by('-created_at')
    return render(request, 'transaction_list.html', {'transactions': transactions})
```

**What each part does**

**Signup, login and logout** (same as your Authentication notes)
- `UserCreationForm` is Django's ready-made signup form (username, password, confirm password). `form.save()` creates the user with a hashed password.
- `AuthenticationForm` is the ready-made login form. `form.is_valid()` is `True` only when the username and password are correct.
- `login(request, user)` stores the user in the session (a cookie). `logout(request)` clears it.
- New signups are **not staff**, so they are workers. The manager can tick **Staff status** in `/admin/`.

**`@login_required(login_url='login')`**
- If nobody is logged in, Django redirects to the URL named `'login'` instead of showing the page.

**dashboard**
- It loops through every product once: adds `stock_value()` to the total and collects the low-stock ones in a list.
- `order_by('-created_at')[:5]` gives the 5 newest transactions. `[:5]` works like slicing a Python list.

**product_list**
- `request.GET.get('search', '')` reads the search box from the URL (`?search=usb`).
- The template checks `user.is_staff` directly to show or hide the Add, Edit and Delete buttons, so we don't pass anything extra.

**add_product / edit_product**
- `if not request.user.is_staff: return redirect(...)` blocks workers, even if they type the URL by hand.
- `.upper()` saves the SKU in capitals, the same as the serializer does.
- We check the SKU ourselves (`filter(sku=sku).exists()`) and show a friendly error, instead of letting the database crash on `unique=True`. In edit, `.exclude(id=product.id)` skips the product we're editing.
- `category_id=request.POST.get('category')` saves a foreign key straight from the id in the dropdown.
- `request.POST.get('supplier') or None`: when "No supplier" is picked, the value is the empty text `''`. `'' or None` gives `None`, which saves as NULL.
- Notice there's **no quantity input**. Quantity only changes on the Stock page.

**delete_product**
- Only deletes on **POST** (a button in a form with `{% csrf_token %}`), so a link or a page refresh can't delete by accident.

**stock_entry**
- `int(request.POST.get('quantity'))` converts the text from the form into a number so we can compare it.
- It makes the **same two checks** as the API serializer: quantity > 0, and no stock out bigger than the stock.
- Then it does **the same two steps** as the API's `perform_create`: save a `StockTransaction`, then change `product.quantity` and save the product.

**transaction_list**
- Shows the full stock history. `?type=in` or `?type=out` filters it.

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

**What it does**
- Each `path('url/', view_function, name='...')` connects a URL to a view.
- `<int:id>` takes the number from the URL, for example `/products/edit/3/`, and passes it to the view as `id=3`.
- `name='product_list'` lets you write `redirect('product_list')` in views and `{% url 'product_list' %}` in templates.

## 15. Final project urls.py

Open `inventoryproject/urls.py` again and replace everything. It's the same as Step 10 with **one new line** at the bottom:

```python title="inventoryproject/urls.py"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from inventoryapp import api_views

router = DefaultRouter()
router.register('categories', api_views.CategoryViewSet, basename='category')
router.register('suppliers', api_views.SupplierViewSet, basename='supplier')
router.register('products', api_views.ProductViewSet, basename='product')
router.register('stock', api_views.StockTransactionViewSet, basename='stock')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Register + JWT login
    path('api/register/', api_views.register, name='register'),
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Reports
    path('api/low-stock/', api_views.low_stock_products, name='low_stock'),
    path('api/summary/', api_views.stock_summary, name='stock_summary'),

    # All API URLs made by the router
    path('api/', include(router.urls)),

    # Login / logout links on the browsable API pages
    path('api-auth/', include('rest_framework.urls')),

    # Web pages (Part C)
    path('', include('inventoryapp.urls')),   # <--- ADDED
]
```

**What it does**
- `path('', include('inventoryapp.urls'))` hands every other URL (`/`, `/login/`, `/products/`...) to the app's `urls.py` from Step 14.
- It goes **last**, so `/admin/` and `/api/` are matched first.

## 16. Templates

All HTML files go in the `templates/` folder next to `manage.py` (the folder from Step 1). Every page **extends** one base page, so the menu and styles are written only once.

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
        .error { color: #d73a49; font-weight: bold; }
        .low { color: #d73a49; font-weight: bold; }
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

**What it does**
- This is the **layout** shared by every page: the top menu plus a white box in the middle.
- `{% block content %}{% endblock %}` is an empty slot. Each page fills it with its own HTML.
- `user` is always available in templates. `user.is_authenticated` switches the menu between "logged in" links and Login / Sign up. `user.is_staff` shows the Admin Panel link only to managers.
- `{% url 'dashboard' %}` turns a URL **name** from Step 14 into the real path.

### login.html

```html title="templates/login.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Login</h2>
    <form method="POST">
        {% csrf_token %}
        {{ form.as_p }}
        <button type="submit">Login</button>
    </form>
    <p>No account? <a href="{% url 'signup' %}">Sign up</a></p>
{% endblock %}
```

**What it does**
- `{% extends 'base.html' %}` means "use base.html and put my `content` block into its slot".
- `{{ form.as_p }}` prints the form fields from the view, each inside a `<p>`, including error messages.
- `{% csrf_token %}` is **required in every POST form**. Without it Django returns **403 CSRF verification failed**.

### signup.html

```html title="templates/signup.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Sign up</h2>
    <form method="POST">
        {% csrf_token %}
        {{ form.as_p }}
        <button type="submit">Create account</button>
    </form>
    <p>Already have an account? <a href="{% url 'login' %}">Login</a></p>
{% endblock %}
```

**What it does**
- It's the same pattern as login, but `form` is a `UserCreationForm`. Django prints the password rules and errors like *"A user with that username already exists."* for you.

### dashboard.html

```html title="templates/dashboard.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Dashboard</h2>
    <p>Welcome, {{ user.username }}{% if user.is_staff %} (Manager){% endif %}</p>

    <div class="box"><p>Products</p><h2>{{ total_products }}</h2></div>
    <div class="box"><p>Categories</p><h2>{{ total_categories }}</h2></div>
    <div class="box"><p>Suppliers</p><h2>{{ total_suppliers }}</h2></div>
    <div class="box"><p>Stock value</p><h2>Rs. {{ total_value }}</h2></div>

    <h3>Low stock ({{ low_stock_products|length }})</h3>
    {% if low_stock_products %}
        <table>
            <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>In stock</th>
                <th>Reorder level</th>
            </tr>
            {% for product in low_stock_products %}
            <tr>
                <td>{{ product.name }}</td>
                <td>{{ product.sku }}</td>
                <td class="low">{{ product.quantity }}</td>
                <td>{{ product.reorder_level }}</td>
            </tr>
            {% endfor %}
        </table>
    {% else %}
        <p>All products have enough stock.</p>
    {% endif %}

    <h3>Recent stock movements</h3>
    {% if recent_transactions %}
        <table>
            <tr>
                <th>When</th>
                <th>Product</th>
                <th>Type</th>
                <th>Qty</th>
                <th>By</th>
            </tr>
            {% for t in recent_transactions %}
            <tr>
                <td>{{ t.created_at|date:"d M Y, H:i" }}</td>
                <td>{{ t.product.name }}</td>
                <td>{{ t.get_transaction_type_display }}</td>
                <td>{{ t.quantity }}</td>
                <td>{{ t.created_by.username }}</td>
            </tr>
            {% endfor %}
        </table>
    {% else %}
        <p>No stock movements yet.</p>
    {% endif %}
{% endblock %}
```

**What it does**
- `{{ total_products }}` prints values from the view's `context` dictionary.
- `|length` is a **filter**: it counts the items in a list. `|date:"d M Y, H:i"` formats a date as `15 Jan 2030, 10:30`.
- `get_transaction_type_display` prints the label ("Stock In") instead of the stored value ("in"). Django creates `get_<field>_display` for every field with `choices`.
- `t.created_by.username` follows the foreign key to the user.

### product_list.html

```html title="templates/product_list.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Products</h2>

    <form method="GET" action="{% url 'product_list' %}">
        <input type="text" name="search" value="{{ search }}" placeholder="Search by name">
        <button type="submit">Search</button>
    </form>

    {% if user.is_staff %}
        <p><a href="{% url 'add_product' %}">+ Add New Product</a></p>
    {% endif %}

    {% if products %}
        <table>
            <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Price</th>
                <th>In stock</th>
                <th>Value</th>
                {% if user.is_staff %}<th>Actions</th>{% endif %}
            </tr>
            {% for product in products %}
            <tr>
                <td>{{ product.name }}</td>
                <td>{{ product.sku }}</td>
                <td>{{ product.category.name }}</td>
                <td>{% if product.supplier %}{{ product.supplier.name }}{% else %}-{% endif %}</td>
                <td>Rs. {{ product.price }}</td>
                <td>
                    {% if product.is_low_stock %}
                        <span class="low">{{ product.quantity }} {{ product.unit }} (LOW)</span>
                    {% else %}
                        {{ product.quantity }} {{ product.unit }}
                    {% endif %}
                </td>
                <td>Rs. {{ product.stock_value }}</td>
                {% if user.is_staff %}
                <td>
                    <a href="{% url 'edit_product' product.id %}">Edit</a>
                    <form method="POST" action="{% url 'delete_product' product.id %}" class="inline"
                          onsubmit="return confirm('Delete this product and its stock history?')">
                        {% csrf_token %}
                        <button type="submit" class="danger">Delete</button>
                    </form>
                </td>
                {% endif %}
            </tr>
            {% endfor %}
        </table>
    {% else %}
        <p>No products found.</p>
    {% endif %}
{% endblock %}
```

**What it does**
- The search form uses **GET**, so the text ends up in the URL (`/products/?search=usb`).
- `{% if product.is_low_stock %}` calls the model method. In templates you write it **without** `()`.
- `{% if product.supplier %}` is needed because the supplier can be empty. Then we show `-`.
- `{% if user.is_staff %}` hides the Add, Edit and Delete buttons from workers.
- Delete is a small **POST form** with `{% csrf_token %}`, plus a browser `confirm(...)` popup.

### add_product.html

```html title="templates/add_product.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Add Product</h2>

    {% if error %}
        <p class="error">{{ error }}</p>
    {% endif %}

    <form method="POST">
        {% csrf_token %}

        <label>Name</label>
        <input type="text" name="name" required>

        <label>SKU (product code)</label>
        <input type="text" name="sku" required>

        <label>Category</label>
        <select name="category" required>
            {% for category in categories %}
                <option value="{{ category.id }}">{{ category.name }}</option>
            {% endfor %}
        </select>

        <label>Supplier</label>
        <select name="supplier">
            <option value="">-- No supplier --</option>
            {% for supplier in suppliers %}
                <option value="{{ supplier.id }}">{{ supplier.name }}</option>
            {% endfor %}
        </select>

        <label>Unit</label>
        <select name="unit">
            <option value="pcs">Pieces</option>
            <option value="kg">Kilogram</option>
            <option value="ltr">Litre</option>
            <option value="box">Box</option>
        </select>

        <label>Price (Rs.)</label>
        <input type="number" name="price" step="0.01" min="0.01" required>

        <label>Reorder level (warn when stock is at or below this)</label>
        <input type="number" name="reorder_level" value="10" min="0" required>

        <p>New products start with 0 in stock. Use <b>Stock In / Out</b> to add stock.</p>
        <button type="submit">Save Product</button>
    </form>
{% endblock %}
```

**What it does**
- Every input's `name` matches a `request.POST.get('...')` in the view.
- Category and supplier dropdowns are built with `{% for %}` loops. They send the **id** of the chosen row.
- The first supplier option has `value=""`. That's the empty text the view turns into `None`.
- Unit options use the **values** from `UNIT_CHOICES` (`pcs`, `kg`...).
- `step="0.01"` lets the price have paise (decimals). `min` and `required` are quick browser checks.

### edit_product.html

```html title="templates/edit_product.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Edit Product</h2>

    {% if error %}
        <p class="error">{{ error }}</p>
    {% endif %}

    <form method="POST">
        {% csrf_token %}

        <label>Name</label>
        <input type="text" name="name" value="{{ product.name }}" required>

        <label>SKU (product code)</label>
        <input type="text" name="sku" value="{{ product.sku }}" required>

        <label>Category</label>
        <select name="category" required>
            {% for category in categories %}
                <option value="{{ category.id }}" {% if category.id == product.category_id %}selected{% endif %}>{{ category.name }}</option>
            {% endfor %}
        </select>

        <label>Supplier</label>
        <select name="supplier">
            <option value="">-- No supplier --</option>
            {% for supplier in suppliers %}
                <option value="{{ supplier.id }}" {% if supplier.id == product.supplier_id %}selected{% endif %}>{{ supplier.name }}</option>
            {% endfor %}
        </select>

        <label>Unit</label>
        <select name="unit">
            <option value="pcs" {% if product.unit == 'pcs' %}selected{% endif %}>Pieces</option>
            <option value="kg" {% if product.unit == 'kg' %}selected{% endif %}>Kilogram</option>
            <option value="ltr" {% if product.unit == 'ltr' %}selected{% endif %}>Litre</option>
            <option value="box" {% if product.unit == 'box' %}selected{% endif %}>Box</option>
        </select>

        <label>Price (Rs.)</label>
        <input type="number" name="price" value="{{ product.price }}" step="0.01" min="0.01" required>

        <label>Reorder level</label>
        <input type="number" name="reorder_level" value="{{ product.reorder_level }}" min="0" required>

        <p>Current stock: <b>{{ product.quantity }} {{ product.unit }}</b> (change it on the Stock In / Out page)</p>
        <button type="submit">Update Product</button>
    </form>
{% endblock %}
```

**What it does**
- It's the same form as Add, but every input starts **filled in** with the product's current values.
- `product.category_id` is the id stored in the foreign key column. `{% if category.id == product.category_id %}selected{% endif %}` pre-selects the current category.
- Quantity is only **shown**, never edited here.

### stock_entry.html

```html title="templates/stock_entry.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Stock In / Out</h2>

    {% if error %}
        <p class="error">{{ error }}</p>
    {% endif %}

    <form method="POST">
        {% csrf_token %}

        <label>Product</label>
        <select name="product" required>
            {% for product in products %}
                <option value="{{ product.id }}">{{ product.name }} ({{ product.sku }}) - in stock: {{ product.quantity }}</option>
            {% endfor %}
        </select>

        <label>Type</label>
        <select name="transaction_type" required>
            <option value="in">Stock In (goods received)</option>
            <option value="out">Stock Out (goods sold / used)</option>
        </select>

        <label>Quantity</label>
        <input type="number" name="quantity" min="1" required>

        <label>Note</label>
        <input type="text" name="note" placeholder="e.g. Received from ABC Traders / Sold to customer">

        <button type="submit">Save</button>
    </form>
{% endblock %}
```

**What it does**
- The product dropdown shows the current stock, so the worker knows how much can go out.
- The `value`s `in` and `out` match `TYPE_CHOICES` in the model.
- If the view finds a problem (for example *Not enough stock*), it shows it in red at the top and saves nothing.

### transaction_list.html

```html title="templates/transaction_list.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Stock History</h2>

    <p>
        Filter:
        <a href="{% url 'transaction_list' %}">All</a> |
        <a href="?type=in">Stock In</a> |
        <a href="?type=out">Stock Out</a>
    </p>

    {% if transactions %}
        <table>
            <tr>
                <th>When</th>
                <th>Product</th>
                <th>Type</th>
                <th>Quantity</th>
                <th>Note</th>
                <th>By</th>
            </tr>
            {% for t in transactions %}
            <tr>
                <td>{{ t.created_at|date:"d M Y, H:i" }}</td>
                <td>{{ t.product.name }}</td>
                <td>{{ t.get_transaction_type_display }}</td>
                <td>{% if t.transaction_type == 'in' %}+{% else %}-{% endif %}{{ t.quantity }}</td>
                <td>{{ t.note }}</td>
                <td>{{ t.created_by.username }}</td>
            </tr>
            {% endfor %}
        </table>
    {% else %}
        <p>No stock movements yet.</p>
    {% endif %}
{% endblock %}
```

**What it does**
- The filter links add `?type=in` or `?type=out`. The view reads it with `request.GET.get('type')`.
- `+` or `-` in front of the quantity makes it easy to see which way the stock moved.
- This table is your **audit log**: every change to stock, who made it and when.

## 17. Run and check everything

```bash
python manage.py runserver
```

Open `http://127.0.0.1:8000/` and go through this checklist:

1. You're sent to `/login/` because the dashboard has `@login_required`.
2. Click **Sign up**, create `worker2`. You're logged in and see the dashboard.
3. **Products** shows the list but **no** Add, Edit or Delete buttons (worker2 is not staff).
4. **Stock In / Out** → Stock In 30 Notebooks. **History** shows `+30`.
5. Stock Out 100 Notebooks, and you see the red *Not enough stock* error.
6. Stock Out until the quantity is at or below the reorder level. It shows **(LOW)** on Products and appears on the Dashboard.
7. Log out and log in as the superuser. Add a product, edit it, and try the same SKU twice to see the error.

> [!TIP] Done
> You now have models, admin, a JWT-protected REST API with register, staff permissions and stock rules, plus web pages with signup and login. That's a complete inventory management system.

## 18. Explain it in the interview

**"Walk me through what happens when Postman records a stock out."**

```flow
POST /api/stock/ | Postman sends JSON + Authorization: Bearer <token>
urls.py | the router sends it to StockTransactionViewSet → create
JWTAuthentication | reads the token, sets request.user = worker1
IsAuthenticated | the user is logged in → allowed (else 401)
StockTransactionSerializer | validate_quantity, then validate() checks there is enough stock (else 400)
perform_create | saves the transaction with created_by, then subtracts from product.quantity
Response | 201 Created + the transaction as JSON
```

**Questions you may get**

| Question | Short answer |
|---|---|
| What is a serializer? | It converts model objects to JSON and back, and validates input. It's like a ModelForm for APIs. |
| `read_only_fields` vs `write_only=True`? | Read-only: shown in responses but can't be sent (quantity). Write-only: can be sent but is never shown (password). |
| Why override `create()` in RegisterSerializer? | So the password is hashed with `create_user()`. A plain save would store it as text and login would fail. |
| What is `perform_create`? | A ViewSet hook that runs after validation, in place of `serializer.save()`. We use it to add `created_by` and update the stock. |
| Why can't you edit stock transactions? | `http_method_names = ['get', 'post']`. Changing history would make the quantities wrong. To fix a mistake you add a new transaction. |
| `@api_view` vs `ModelViewSet`? | `@api_view` is a single function for custom endpoints (register, reports). `ModelViewSet` is full CRUD for one model. |
| What does `many=True` do? | It tells the serializer it's getting a list of objects, so it returns a JSON list. |
| Why `DecimalField` for price? | It's exact. A float can't store values like 0.1 exactly, which is bad for money. |
| What is JWT? | A signed token given at login. The client sends it in the `Authorization: Bearer` header on every request. |
| Access vs refresh token? | Access is short-lived and used on every request. Refresh is longer-lived and only used to get a new access token. |
| 401 vs 403? | 401 = not logged in or bad token. 403 = logged in but not allowed (worker trying to add a product). |
| How do you do roles here? | With Django's built-in `is_staff` flag, checked by the `IsStaffOrReadOnly` permission class and in the web views. |
| What if two people sell the last item at the same moment? | In a real system you'd wrap the stock update in `transaction.atomic()` and lock the row with `select_for_update()`. Mention it. You don't need to code it in a practical. |

## 19. Common errors and fixes

| Error | Cause | Fix |
|---|---|---|
| `No module named 'rest_framework_simplejwt'` | Package not installed, or the venv isn't active | Activate the venv, then `pip install djangorestframework-simplejwt` |
| `no such table: inventoryapp_product` | Migrations not run | `python manage.py makemigrations` then `python manage.py migrate` |
| `TemplateDoesNotExist: dashboard.html` | `DIRS` not set, or the file is in the wrong folder | Check Step 2, and keep `templates/` next to `manage.py` |
| `NoReverseMatch: Reverse for 'product_list' not found` | URL name typo, or app URLs not included | Check `name=` in Step 14 and the last line of Step 15 |
| `CSRF verification failed` (403) | A POST form without `{% csrf_token %}` | Add `{% csrf_token %}` inside the `<form>` |
| Postman: *Authentication credentials were not provided* | No token, or the `REST_FRAMEWORK` block is missing | Use Bearer Token in Postman, and check Step 11 |
| Postman: *Token is invalid or expired* | The access token is older than 5 minutes | Call `/api/token/refresh/` or log in again |
| Postman register gives 401 | An old expired Bearer token is still set on the request | Set Authorization to **No Auth** for register and token requests |
| Login fails for a user made in admin or the API | Password was saved as plain text | Use `create_user()` (as in RegisterSerializer) or the admin's add-user form |
| Quantity didn't change after adding a transaction in `/admin/` | The admin panel skips our view logic | Record stock through `/api/stock/` or the Stock In / Out page |
| `basename` argument not specified | A viewset has `get_queryset` but no `queryset` | Add `basename='...'` to `router.register` |
