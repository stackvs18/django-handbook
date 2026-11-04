You will build an **Inventory & Sales Management System (IMS)** from an empty folder. It covers products, suppliers, customers, purchases (stock in), sales with GST invoices (stock out), a full stock audit log, low-stock alerts and reports. You get a JWT-secured REST API plus a server-rendered dashboard. Every file is shown in full, ready to copy.

> [!TIP] How to use this page in a practical test
> Go top to bottom. Every step ends with something that runs. Steps 1–9 are the **must-haves** (models, CRUD API, JWT). Steps 10+ are the **extras** that make you stand out: atomic stock updates, nested sales, reports, a UI and tests.

> [!NOTE] Where the design comes from
> The shape follows a typical open-source Django inventory app (for example [munuhee/sales-and-inventory-management](https://github.com/munuhee/sales-and-inventory-management): Category, Item, Vendor, Customer, Sale + SaleDetail with tax and grand total, Purchase, Invoice). It's simplified to what an intern practical expects. We left out slugs, image uploads and extra packages. We added the parts examiners like: a REST API, JWT, and **stock that can never go negative**.

## 0. Game plan for the practical

| Time | Step | You can show |
|---|---|---|
| 0–10 min | Setup and settings | `runserver` works |
| 10–30 min | Models, migrations, admin | Data entry in `/admin/` |
| 30–55 min | Serializers + ViewSets + URLs | CRUD API in the browser |
| 55–70 min | JWT register/login + permissions | Postman with a `Bearer` token |
| 70–90 min | Stock service: purchases, sales, movements | Stock changes correctly, can't oversell |
| 90–110 min | Reports, seed data, templates | Dashboard and invoice page |
| 110+ min | Tests | `python manage.py test` passes |

## 1. What we're building

**Users**

| User | Can do |
|---|---|
| **Admin / manager** (`is_staff=True`) | Manage categories, suppliers, products and purchases |
| **Staff** (any logged-in user) | View everything, record sales, add customers, adjust stock |

**Data model**

```flow
Category | groups products (Electronics, Stationery…)
Supplier | who we buy from (a vendor)
Customer | who we sell to (optional, since walk-in sales are allowed)
Product | SKU, cost price, selling price, quantity, reorder level
StockMovement | audit log: every IN/OUT with balance after, who and why
Purchase | buy N units from a supplier; when RECEIVED, stock goes IN
Sale + SaleItem | one bill with many lines, GST tax, grand total; stock goes OUT
```

> [!IMPORTANT] The one rule that makes this project good
> `Product.quantity` is **never edited directly**. It only changes through one function, `record_movement()`. That function locks the row, refuses to go below zero, and writes an audit entry. Explain this in the interview.

**API endpoints**

| Method | URL | What it does |
|---|---|---|
| POST | `/api/auth/register/` | Create a staff account |
| POST | `/api/auth/login/` | JWT `access` + `refresh` |
| POST | `/api/auth/refresh/` | New access token |
| GET | `/api/auth/me/` | Current user |
| CRUD | `/api/categories/` | With product count |
| CRUD | `/api/suppliers/` · `/api/customers/` | Contacts |
| CRUD | `/api/products/` | Filter by category, price range, `low_stock=true` |
| GET | `/api/products/low-stock/` | Products at or below the reorder level |
| GET | `/api/products/{id}/movements/` | Stock history of one product |
| GET/POST | `/api/stock-movements/` | Audit log, plus manual adjustments |
| CRUD | `/api/purchases/` | Purchase orders |
| POST | `/api/purchases/{id}/receive/` | Stock IN |
| POST | `/api/purchases/{id}/cancel/` | Cancel a pending purchase |
| GET/POST | `/api/sales/` | Create a sale with many items in **one request** |
| GET | `/api/reports/summary/` | Stock value, sales today, top sellers, by category |

## 2. Project setup

```bash
mkdir inventory-management
cd inventory-management
python -m venv venv
venv\Scripts\activate
```

> [!NOTE]
> macOS/Linux: `source venv/bin/activate`. If PowerShell blocks the script, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

```bash
pip install "django>=5.2,<6" djangorestframework djangorestframework-simplejwt django-filter
```

```bash
django-admin startproject ims .
python manage.py startapp accounts
python manage.py startapp inventory
```

```text
inventory-management/
├── manage.py
├── ims/                     ← settings.py, urls.py
├── accounts/                ← register / login / me (uses Django's built-in User)
├── inventory/
│   ├── models.py  admin.py  services.py  serializers.py  filters.py
│   ├── permissions.py  views.py  urls.py
│   ├── forms.py  web_views.py  web_urls.py  tests.py
│   └── management/commands/seed.py
└── templates/
    ├── base.html
    ├── registration/login.html
    └── inventory/*.html
```

> [!NOTE] Why no custom user here?
> Our roles are just "manager or not", and Django's built-in `User.is_staff` flag already covers that. (The hospital project needed a `role` field, so it used a custom user.) Being able to say *why* you chose one or the other is a good interview point.

## 3. settings.py

Open `ims/settings.py`. Replace `INSTALLED_APPS`:

```python title="ims/settings.py — INSTALLED_APPS"
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "django_filters",
    # our apps
    "accounts",
    "inventory",
]
```

Inside `TEMPLATES`, change the `DIRS` line:

```python title="ims/settings.py — inside TEMPLATES"
        "DIRS": [BASE_DIR / "templates"],
```

Change the time zone line:

```python title="ims/settings.py — TIME_ZONE"
TIME_ZONE = "Asia/Kolkata"
```

Paste at the **bottom**:

```python title="ims/settings.py — add at the bottom"
from datetime import timedelta

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "dashboard"
LOGOUT_REDIRECT_URL = "login"
```

## 4. Models

```python title="inventory/models.py"
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import DecimalField, ExpressionWrapper, F, Sum


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "categories"

    def __str__(self):
        return self.name


class Supplier(models.Model):
    name = models.CharField(max_length=150)
    contact_person = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Customer(models.Model):
    name = models.CharField(max_length=150)
    phone = models.CharField(max_length=15, unique=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.phone})"


class Product(models.Model):
    name = models.CharField(max_length=150)
    sku = models.CharField("SKU", max_length=30, unique=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name="products")
    supplier = models.ForeignKey(
        Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name="products"
    )
    description = models.TextField(blank=True)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=0)  # changed ONLY by services.record_movement
    reorder_level = models.PositiveIntegerField(default=10)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.sku})"

    @property
    def is_low_stock(self):
        return self.quantity <= self.reorder_level

    @property
    def stock_value(self):
        return self.quantity * self.cost_price


class StockMovement(models.Model):
    """Audit log: one row for every change in stock."""

    class Type(models.TextChoices):
        IN = "IN", "Stock in"
        OUT = "OUT", "Stock out"

    class Reason(models.TextChoices):
        PURCHASE = "PURCHASE", "Purchase"
        SALE = "SALE", "Sale"
        ADJUSTMENT = "ADJUSTMENT", "Adjustment"

    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="movements")
    movement_type = models.CharField(max_length=3, choices=Type.choices)
    quantity = models.PositiveIntegerField()
    reason = models.CharField(max_length=10, choices=Reason.choices, default=Reason.ADJUSTMENT)
    note = models.CharField(max_length=255, blank=True)
    balance_after = models.PositiveIntegerField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        sign = "+" if self.movement_type == self.Type.IN else "-"
        return f"{self.product.sku} {sign}{self.quantity} → {self.balance_after}"


class Purchase(models.Model):
    """Buying stock from a supplier. Stock is added only when it is RECEIVED."""

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        RECEIVED = "RECEIVED", "Received"
        CANCELLED = "CANCELLED", "Cancelled"

    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchases")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="purchases")
    quantity = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2, editable=False, default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    ordered_at = models.DateTimeField(auto_now_add=True)
    received_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-ordered_at"]

    def __str__(self):
        return f"PO-{self.pk}: {self.quantity} x {self.product.name}"

    def save(self, *args, **kwargs):
        self.total = self.quantity * self.unit_cost  # always computed, never typed in
        super().save(*args, **kwargs)


class Sale(models.Model):
    """One bill. Lines live in SaleItem. Totals are calculated, not typed."""

    customer = models.ForeignKey(
        Customer, on_delete=models.PROTECT, null=True, blank=True, related_name="sales"
    )
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=Decimal("18.00"))
    sub_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    grand_total = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"INV-{self.pk:05d}"

    def recalculate(self):
        line_total = ExpressionWrapper(
            F("unit_price") * F("quantity"), output_field=DecimalField(max_digits=12, decimal_places=2)
        )
        sub_total = self.items.aggregate(total=Sum(line_total))["total"] or Decimal("0")
        self.sub_total = sub_total
        self.tax_amount = (sub_total * self.tax_percentage / 100).quantize(Decimal("0.01"))
        self.grand_total = self.sub_total + self.tax_amount
        self.save(update_fields=["sub_total", "tax_amount", "grand_total"])


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="sale_items")
    quantity = models.PositiveIntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)  # price at time of sale

    def __str__(self):
        return f"{self.quantity} x {self.product.name}"

    @property
    def line_total(self):
        return self.quantity * self.unit_price
```

> [!REMEMBER] Design decisions to explain
> - **Money is `DecimalField`, never `FloatField`.** `0.1 + 0.2 != 0.3` with floats.
> - `SaleItem.unit_price` **copies** the price at the time of sale, so later price changes don't rewrite old invoices.
> - `on_delete=PROTECT` on product/category means you can't delete a product that appears in old sales.
> - `Purchase.save()` computes `total`. `Sale.recalculate()` uses **`aggregate(Sum(...))`**, which runs the maths in the database.
> - `Sale` + `SaleItem` is the classic **header / line-item** (master–detail) pattern.

```bash
python manage.py makemigrations inventory
python manage.py migrate
```

## 5. Admin

```python title="inventory/admin.py"
from django.contrib import admin

from .models import Category, Customer, Product, Purchase, Sale, SaleItem, StockMovement, Supplier


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ("name", "contact_person", "phone", "email")
    search_fields = ("name", "phone", "email")


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ("name", "phone", "email", "created_at")
    search_fields = ("name", "phone")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "sku", "category", "selling_price", "quantity", "reorder_level", "is_low_stock", "is_active")
    list_filter = ("category", "supplier", "is_active")
    search_fields = ("name", "sku")
    readonly_fields = ("quantity",)  # stock changes only through movements
    list_select_related = ("category",)

    @admin.display(boolean=True, description="Low stock")
    def is_low_stock(self, obj):
        return obj.is_low_stock


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = ("product", "movement_type", "quantity", "balance_after", "reason", "created_by", "created_at")
    list_filter = ("movement_type", "reason")
    search_fields = ("product__name", "product__sku", "note")

    def has_change_permission(self, request, obj=None):
        return False  # audit log is read-only


@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ("__str__", "supplier", "quantity", "unit_cost", "total", "status", "ordered_at")
    list_filter = ("status", "supplier")


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ("product", "quantity", "unit_price")


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("__str__", "customer", "sub_total", "tax_amount", "grand_total", "created_at")
    date_hierarchy = "created_at"
    inlines = [SaleItemInline]
```

```bash
python manage.py createsuperuser
python manage.py runserver
```

Visit <http://127.0.0.1:8000/admin/>. **Checkpoint 1.**

## 6. Stock service (the core business logic)

Keep business rules **out of views** and put them in a plain Python module. The API, the HTML views, the admin and the seed command all call the same functions.

```python title="inventory/services.py"
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Product, Purchase, Sale, SaleItem, StockMovement


def record_movement(*, product, movement_type, quantity, reason=StockMovement.Reason.ADJUSTMENT, user=None, note=""):
    """The ONLY place Product.quantity changes.

    - select_for_update() locks the row, so two sales at the same moment can't oversell.
    - F("quantity") + delta does the maths in SQL (no race between read and write).
    - Writes an audit row with the balance after the change.
    """
    if quantity is None or quantity <= 0:
        raise ValidationError("Quantity must be greater than zero.")

    with transaction.atomic():
        locked = Product.objects.select_for_update().get(pk=product.pk)
        if movement_type == StockMovement.Type.OUT and locked.quantity < quantity:
            raise ValidationError(
                f"Not enough stock for {locked.name}: {locked.quantity} available, {quantity} requested."
            )
        delta = quantity if movement_type == StockMovement.Type.IN else -quantity
        Product.objects.filter(pk=locked.pk).update(quantity=F("quantity") + delta)
        movement = StockMovement.objects.create(
            product=locked,
            movement_type=movement_type,
            quantity=quantity,
            reason=reason,
            note=note,
            balance_after=locked.quantity + delta,
            created_by=user,
        )
    product.quantity = movement.balance_after  # keep the caller's object in sync
    return movement


def receive_purchase(purchase, user=None):
    """PENDING -> RECEIVED: stock goes IN and the product's cost price is updated."""
    if purchase.status != Purchase.Status.PENDING:
        raise ValidationError(f"Purchase is already {purchase.get_status_display().lower()}.")
    with transaction.atomic():
        record_movement(
            product=purchase.product,
            movement_type=StockMovement.Type.IN,
            quantity=purchase.quantity,
            reason=StockMovement.Reason.PURCHASE,
            user=user,
            note=f"PO-{purchase.pk} from {purchase.supplier.name}",
        )
        Product.objects.filter(pk=purchase.product_id).update(cost_price=purchase.unit_cost)
        purchase.status = Purchase.Status.RECEIVED
        purchase.received_at = timezone.now()
        purchase.save(update_fields=["status", "received_at"])
    return purchase


def create_sale(*, items, user=None, customer=None, tax_percentage=Decimal("18.00")):
    """items = [{"product": <Product>, "quantity": 3}, ...]

    All-or-nothing: if ANY line doesn't have enough stock, the whole sale is
    rolled back. No half-saved bill, no stock taken.
    """
    if not items:
        raise ValidationError("A sale needs at least one item.")
    with transaction.atomic():
        sale = Sale.objects.create(customer=customer, tax_percentage=tax_percentage, created_by=user)
        for line in items:
            product = line["product"]
            if not product.is_active:
                raise ValidationError(f"{product.name} is not for sale.")
            record_movement(
                product=product,
                movement_type=StockMovement.Type.OUT,
                quantity=line["quantity"],
                reason=StockMovement.Reason.SALE,
                user=user,
                note=f"INV-{sale.pk:05d}",
            )
            SaleItem.objects.create(
                sale=sale, product=product, quantity=line["quantity"], unit_price=product.selling_price
            )
        sale.recalculate()
    return sale
```

> [!TIP] How to say it in the interview
> "`transaction.atomic()` makes the sale all-or-nothing. `select_for_update()` locks the product row so two cashiers can't sell the last unit twice. `F()` expressions do the arithmetic in the database. Every change leaves an audit row."

## 7. Permissions and filters

```python title="inventory/permissions.py"
from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsStaffOrReadOnly(BasePermission):
    """Any logged-in user can read. Only managers (is_staff) can write."""

    message = "Only managers can change this."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_staff
```

`django-filter` lets you declare filters instead of hand-parsing `request.query_params`:

```python title="inventory/filters.py"
import django_filters
from django.db.models import F

from .models import Product


class ProductFilter(django_filters.FilterSet):
    # /api/products/?min_price=100&max_price=500&low_stock=true&category=2
    min_price = django_filters.NumberFilter(field_name="selling_price", lookup_expr="gte")
    max_price = django_filters.NumberFilter(field_name="selling_price", lookup_expr="lte")
    low_stock = django_filters.BooleanFilter(method="filter_low_stock")

    class Meta:
        model = Product
        fields = ["category", "supplier", "is_active"]

    def filter_low_stock(self, queryset, name, value):
        if value:
            return queryset.filter(quantity__lte=F("reorder_level"))
        return queryset.filter(quantity__gt=F("reorder_level"))
```

## 8. Serializers

> [!NOTE] Serializer in one line
> **Model ↔ JSON + validation.** `serializer.is_valid()` runs the field checks, then `validate_<field>()`, then `validate()`. `serializer.save()` calls `create()` or `update()`. Override `create()` when saving means more than one `INSERT`, as with our sale.

### Accounts

```python title="accounts/serializers.py"
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "is_staff"]
        read_only_fields = ["id", "username", "is_staff"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirm password")

    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "password", "password2"]

    def validate_email(self, value):
        if value and User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("This email is already registered.")
        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        # create_user() hashes the password. New users are normal staff (is_staff=False).
        return User.objects.create_user(**validated_data)
```

### Inventory

```python title="inventory/serializers.py"
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from . import services
from .models import Category, Customer, Product, Purchase, Sale, SaleItem, StockMovement, Supplier


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True)  # from .annotate() in the view

    class Meta:
        model = Category
        fields = ["id", "name", "description", "product_count"]


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ["id", "name", "contact_person", "phone", "email", "address", "created_at"]


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ["id", "name", "phone", "email", "address", "created_at"]


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.name", read_only=True, default=None)
    is_low_stock = serializers.BooleanField(read_only=True)
    stock_value = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id", "name", "sku", "category", "category_name", "supplier", "supplier_name",
            "description", "cost_price", "selling_price", "quantity", "reorder_level",
            "is_low_stock", "stock_value", "is_active", "created_at", "updated_at",
        ]
        # quantity is read-only: stock changes only via purchases / sales / movements
        read_only_fields = ["quantity", "created_at", "updated_at"]

    def validate_sku(self, value):
        return value.strip().upper()

    def validate(self, attrs):
        cost = attrs.get("cost_price", getattr(self.instance, "cost_price", None))
        price = attrs.get("selling_price", getattr(self.instance, "selling_price", None))
        if cost is not None and price is not None and price < cost:
            raise serializers.ValidationError({"selling_price": "Selling price cannot be below cost price."})
        return attrs


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    created_by = serializers.StringRelatedField()

    class Meta:
        model = StockMovement
        fields = [
            "id", "product", "product_name", "movement_type", "quantity", "reason",
            "note", "balance_after", "created_by", "created_at",
        ]
        read_only_fields = ["reason", "balance_after", "created_at"]

    def create(self, validated_data):
        """POST = manual adjustment (damaged goods, stock count correction...)."""
        try:
            return services.record_movement(
                user=self.context["request"].user,
                reason=StockMovement.Reason.ADJUSTMENT,
                **validated_data,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"quantity": exc.messages})


class PurchaseSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source="supplier.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = Purchase
        fields = [
            "id", "supplier", "supplier_name", "product", "product_name", "quantity",
            "unit_cost", "total", "status", "ordered_at", "received_at",
        ]
        read_only_fields = ["total", "status", "ordered_at", "received_at"]

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value

    def validate(self, attrs):
        if self.instance and self.instance.status != Purchase.Status.PENDING:
            raise serializers.ValidationError("Only pending purchases can be edited.")
        return attrs


class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    line_total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = SaleItem
        fields = ["id", "product", "product_name", "quantity", "unit_price", "line_total"]
        read_only_fields = ["unit_price"]  # taken from the product, client can't set it

    def validate_quantity(self, value):
        if value < 1:
            raise serializers.ValidationError("Quantity must be at least 1.")
        return value


class SaleSerializer(serializers.ModelSerializer):
    """Nested WRITE: one POST creates the Sale and all its SaleItems."""

    items = SaleItemSerializer(many=True)
    customer_name = serializers.CharField(source="customer.name", read_only=True, default="Walk-in")
    created_by = serializers.StringRelatedField()

    class Meta:
        model = Sale
        fields = [
            "id", "customer", "customer_name", "items", "tax_percentage",
            "sub_total", "tax_amount", "grand_total", "created_by", "created_at",
        ]
        read_only_fields = ["sub_total", "tax_amount", "grand_total", "created_at"]

    def validate_items(self, items):
        if not items:
            raise serializers.ValidationError("Add at least one item.")
        ids = [line["product"].id for line in items]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Each product can appear only once per sale.")
        return items

    def create(self, validated_data):
        try:
            return services.create_sale(
                items=validated_data["items"],
                customer=validated_data.get("customer"),
                tax_percentage=validated_data.get("tax_percentage", Sale._meta.get_field("tax_percentage").default),
                user=self.context["request"].user,
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"items": exc.messages})
```

> [!TIP] Serializer features shown here
> - `source="category.name"` flattens a relationship, and `default=None` handles a null supplier.
> - `read_only_fields = ["quantity"]` means the API **can't** set stock directly.
> - A nested `items = SaleItemSerializer(many=True)` plus a custom `create()` gives you a **writable nested serializer**. DRF won't save nested data on its own; you must override `create()`.
> - Django's `ValidationError` from the service is converted to DRF's `serializers.ValidationError`, so the client gets a clean 400 instead of a 500.

## 9. Views and URLs

### Accounts

```python title="accounts/views.py"
from django.contrib.auth.models import User
from rest_framework import generics
from rest_framework.permissions import AllowAny

from .serializers import RegisterSerializer, UserSerializer


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]  # anyone can sign up as normal staff


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user
```

```python title="accounts/urls.py"
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

urlpatterns = [
    path("register/", views.RegisterView.as_view(), name="register"),
    path("login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("me/", views.MeView.as_view(), name="me"),
]
```

### Inventory API

```python title="inventory/views.py"
from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum
from django.utils import timezone
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .filters import ProductFilter
from .models import Category, Customer, Product, Purchase, Sale, SaleItem, StockMovement, Supplier
from .permissions import IsStaffOrReadOnly
from .serializers import (
    CategorySerializer,
    CustomerSerializer,
    ProductSerializer,
    PurchaseSerializer,
    SaleSerializer,
    StockMovementSerializer,
    SupplierSerializer,
)

MONEY = DecimalField(max_digits=14, decimal_places=2)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.annotate(product_count=Count("products")).order_by("name")
    serializer_class = CategorySerializer
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ["name"]

    def destroy(self, request, *args, **kwargs):
        if self.get_object().products.exists():
            return Response({"detail": "Category still has products."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)


class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsStaffOrReadOnly]
    search_fields = ["name", "contact_person", "phone", "email"]


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer  # any logged-in staff can add customers at the counter
    search_fields = ["name", "phone", "email"]


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.select_related("category", "supplier")
    serializer_class = ProductSerializer
    permission_classes = [IsStaffOrReadOnly]
    filterset_class = ProductFilter
    search_fields = ["name", "sku", "description"]
    ordering_fields = ["name", "selling_price", "quantity", "created_at"]

    def perform_destroy(self, instance):
        # Soft delete: old sales still point to this product, so just hide it.
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=False, methods=["get"], url_path="low-stock")
    def low_stock(self, request):
        qs = self.get_queryset().filter(is_active=True, quantity__lte=F("reorder_level")).order_by("quantity")
        return Response(self.get_serializer(qs, many=True).data)

    @action(detail=True, methods=["get"])
    def movements(self, request, pk=None):
        product = self.get_object()
        page = self.paginate_queryset(product.movements.select_related("created_by"))
        data = StockMovementSerializer(page, many=True).data
        return self.get_paginated_response(data)


class StockMovementViewSet(
    mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet
):
    """An audit log: list, view and add. No update or delete endpoints exist."""

    queryset = StockMovement.objects.select_related("product", "created_by")
    serializer_class = StockMovementSerializer
    filterset_fields = ["product", "movement_type", "reason"]
    search_fields = ["product__name", "product__sku", "note"]


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.select_related("supplier", "product")
    serializer_class = PurchaseSerializer
    permission_classes = [IsStaffOrReadOnly]
    filterset_fields = ["status", "supplier", "product"]
    ordering_fields = ["ordered_at", "total"]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        if self.get_object().status == Purchase.Status.RECEIVED:
            return Response({"detail": "Received purchases cannot be deleted."}, status=status.HTTP_400_BAD_REQUEST)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"])
    def receive(self, request, pk=None):
        purchase = self.get_object()
        try:
            services.receive_purchase(purchase, user=request.user)
        except DjangoValidationError as exc:
            return Response({"detail": exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(purchase).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        purchase = self.get_object()
        if purchase.status != Purchase.Status.PENDING:
            return Response({"detail": "Only pending purchases can be cancelled."}, status=status.HTTP_400_BAD_REQUEST)
        purchase.status = Purchase.Status.CANCELLED
        purchase.save(update_fields=["status"])
        return Response(self.get_serializer(purchase).data)


class SaleViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Sales are never edited or deleted (that's what returns/credit notes are for)."""

    queryset = Sale.objects.select_related("customer", "created_by").prefetch_related("items__product")
    serializer_class = SaleSerializer
    filterset_fields = ["customer"]
    ordering_fields = ["created_at", "grand_total"]


class ReportSummaryView(APIView):
    """GET /api/reports/summary/: aggregate() and annotate() in action."""

    def get(self, request):
        today = timezone.localdate()
        month_ago = timezone.now() - timedelta(days=30)
        active = Product.objects.filter(is_active=True)

        stock = active.aggregate(
            products=Count("id"),
            units=Sum("quantity"),
            value_at_cost=Sum(ExpressionWrapper(F("quantity") * F("cost_price"), output_field=MONEY)),
            value_at_price=Sum(ExpressionWrapper(F("quantity") * F("selling_price"), output_field=MONEY)),
            low_stock=Count("id", filter=Q(quantity__lte=F("reorder_level"))),
        )
        sales_today = Sale.objects.filter(created_at__date=today).aggregate(
            count=Count("id"), revenue=Sum("grand_total")
        )
        top_products = (
            SaleItem.objects.filter(sale__created_at__gte=month_ago)
            .values("product__name")
            .annotate(units=Sum("quantity"), revenue=Sum(ExpressionWrapper(F("quantity") * F("unit_price"), output_field=MONEY)))
            .order_by("-units")[:5]
        )
        by_category = (
            Category.objects.annotate(
                product_count=Count("products", filter=Q(products__is_active=True)),
                units=Sum("products__quantity", filter=Q(products__is_active=True)),
            )
            .values("name", "product_count", "units")
            .order_by("name")
        )
        return Response(
            {
                "stock": {k: v or 0 for k, v in stock.items()},
                "sales_today": {"count": sales_today["count"], "revenue": sales_today["revenue"] or Decimal("0")},
                "top_products_30_days": list(top_products),
                "by_category": [{**row, "units": row["units"] or 0} for row in by_category],
            }
        )
```

```python title="inventory/urls.py"
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("categories", views.CategoryViewSet)
router.register("suppliers", views.SupplierViewSet)
router.register("customers", views.CustomerViewSet)
router.register("products", views.ProductViewSet)
router.register("stock-movements", views.StockMovementViewSet)
router.register("purchases", views.PurchaseViewSet)
router.register("sales", views.SaleViewSet)

urlpatterns = [
    path("reports/summary/", views.ReportSummaryView.as_view(), name="report_summary"),
    path("", include(router.urls)),
]
```

Project URLs for now (the web pages come in step 12):

```python title="ims/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("inventory.urls")),
    path("api-auth/", include("rest_framework.urls")),
]
```

```bash
python manage.py runserver
```

Open <http://127.0.0.1:8000/api/>. **Checkpoint 2:** the whole API is browsable.

## 10. Seed demo data

```bash
mkdir inventory\management\commands
New-Item inventory\management\__init__.py, inventory\management\commands\__init__.py
```

> [!NOTE]
> Git Bash/macOS/Linux: `mkdir -p inventory/management/commands && touch inventory/management/__init__.py inventory/management/commands/__init__.py`

```python title="inventory/management/commands/seed.py"
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from inventory import services
from inventory.models import Category, Customer, Product, Purchase, StockMovement, Supplier

PRODUCTS = [
    # name, sku, category, cost, price, opening stock, reorder level
    ("USB-C Cable 1m", "ELEC-001", "Electronics", "120", "249", 80, 20),
    ("Wireless Mouse", "ELEC-002", "Electronics", "450", "799", 25, 10),
    ("Keyboard", "ELEC-003", "Electronics", "700", "1199", 6, 8),
    ("A4 Paper Ream", "STAT-001", "Stationery", "220", "320", 40, 15),
    ("Gel Pen (Blue)", "STAT-002", "Stationery", "8", "15", 300, 100),
    ("Stapler", "STAT-003", "Stationery", "90", "160", 4, 5),
    ("Office Chair", "FURN-001", "Furniture", "3500", "5499", 3, 2),
]


class Command(BaseCommand):
    help = "Create demo users, categories, suppliers, products, a purchase and a sale."

    def handle(self, *args, **options):
        admin, created = User.objects.get_or_create(
            username="admin", defaults={"is_staff": True, "is_superuser": True}
        )
        admin.set_password("admin123")
        admin.save()
        staff, _ = User.objects.get_or_create(username="staff", defaults={"first_name": "Sam"})
        staff.set_password("pass1234")
        staff.save()

        if Product.objects.exists():
            self.stdout.write("Products already exist; skipping product data.")
            return

        supplier = Supplier.objects.create(name="Acme Distributors", contact_person="Raj", phone="9811111111")
        Supplier.objects.create(name="Paper World", contact_person="Anita", phone="9822222222")
        customer = Customer.objects.create(name="Rohan Gupta", phone="9833333333")

        for name, sku, cat, cost, price, stock, reorder in PRODUCTS:
            category, _ = Category.objects.get_or_create(name=cat)
            product = Product.objects.create(
                name=name, sku=sku, category=category, supplier=supplier,
                cost_price=Decimal(cost), selling_price=Decimal(price), reorder_level=reorder,
            )
            services.record_movement(
                product=product, movement_type=StockMovement.Type.IN, quantity=stock,
                user=admin, note="Opening stock",
            )

        keyboard = Product.objects.get(sku="ELEC-003")
        purchase = Purchase.objects.create(
            supplier=supplier, product=keyboard, quantity=20, unit_cost=Decimal("680"), created_by=admin
        )
        services.receive_purchase(purchase, user=admin)
        Purchase.objects.create(
            supplier=supplier, product=Product.objects.get(sku="STAT-003"), quantity=30,
            unit_cost=Decimal("85"), created_by=admin,
        )  # left PENDING so you can test /receive/

        services.create_sale(
            items=[
                {"product": Product.objects.get(sku="ELEC-002"), "quantity": 2},
                {"product": Product.objects.get(sku="STAT-002"), "quantity": 10},
            ],
            customer=customer,
            user=staff,
        )
        self.stdout.write(self.style.SUCCESS("Seeded! Logins -> admin/admin123 (manager), staff/pass1234"))
```

```bash
python manage.py seed
```

## 11. Test the API (Postman)

```flow
Register | POST /api/auth/register/ to create a normal staff user
Login | POST /api/auth/login/ to get access + refresh tokens
Call APIs | header Authorization: Bearer <access>
Refresh | POST /api/auth/refresh/ with {"refresh": "..."} when access expires
```

**1. Register** (`POST /api/auth/register/`, no token needed):

```json
{ "username": "cashier1", "password": "Counter@2024", "password2": "Counter@2024", "email": "c1@shop.com" }
```

**2. Login** (`POST /api/auth/login/`):

```json
{ "username": "admin", "password": "admin123" }
```

Copy `access` → Postman **Authorization** tab → **Bearer Token**.

**3. Create a product** (`POST /api/products/`, manager only):

```json
{
  "name": "HDMI Cable 2m",
  "sku": "elec-004",
  "category": 1,
  "supplier": 1,
  "cost_price": "150.00",
  "selling_price": "299.00",
  "reorder_level": 10
}
```

It's created with `quantity: 0` and the SKU is upper-cased to `ELEC-004`. Sending `"quantity": 500` does nothing, because the field is read-only.

**4. Stock in by purchase** (`POST /api/purchases/` then `POST /api/purchases/{id}/receive/`):

```json
{ "supplier": 1, "product": 8, "quantity": 50, "unit_cost": "140.00" }
```

**5. Sell** (`POST /api/sales/`): one request, many items:

```json
{
  "customer": 1,
  "tax_percentage": "18.00",
  "items": [
    { "product": 1, "quantity": 3 },
    { "product": 4, "quantity": 2 }
  ]
}
```

Response:

```json
{
  "id": 2,
  "customer": 1,
  "customer_name": "Rohan Gupta",
  "items": [
    { "id": 3, "product": 1, "product_name": "USB-C Cable 1m", "quantity": 3, "unit_price": "249.00", "line_total": "747.00" },
    { "id": 4, "product": 4, "product_name": "A4 Paper Ream", "quantity": 2, "unit_price": "320.00", "line_total": "640.00" }
  ],
  "tax_percentage": "18.00",
  "sub_total": "1387.00",
  "tax_amount": "249.66",
  "grand_total": "1636.66",
  ...
}
```

Now try to sell **more than you have**:

```json
{ "items": [{ "product": 7, "quantity": 999 }] }
```

```json
{ "items": ["Not enough stock for Office Chair: 3 available, 999 requested."] }
```

Nothing was saved, so the stock is unchanged. That's `transaction.atomic()` at work.

**6. Manual adjustment** (`POST /api/stock-movements/`), e.g. 2 damaged pens:

```json
{ "product": 5, "movement_type": "OUT", "quantity": 2, "note": "Damaged" }
```

**7. Queries to try:**

```text
GET /api/products/?search=cable
GET /api/products/?category=1&min_price=200&max_price=1000&ordering=-selling_price
GET /api/products/?low_stock=true
GET /api/products/low-stock/
GET /api/products/1/movements/
GET /api/stock-movements/?reason=SALE
GET /api/purchases/?status=PENDING
GET /api/reports/summary/
```

Log in as `staff` and `POST /api/products/` returns **403**, because only managers can do that.

## 12. Web dashboard (MVT side)

### Forms

A sale has many lines, so the HTML side uses a **formset**: the same small form repeated several times.

```python title="inventory/forms.py"
from django import forms

from .models import Customer, Product, StockMovement


class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = [
            "name", "sku", "category", "supplier", "description",
            "cost_price", "selling_price", "reorder_level", "is_active",
        ]
        widgets = {"description": forms.Textarea(attrs={"rows": 2})}

    def clean_sku(self):
        return self.cleaned_data["sku"].strip().upper()

    def clean(self):
        cleaned = super().clean()
        cost, price = cleaned.get("cost_price"), cleaned.get("selling_price")
        if cost is not None and price is not None and price < cost:
            self.add_error("selling_price", "Selling price cannot be below cost price.")
        return cleaned


class StockMovementForm(forms.Form):
    product = forms.ModelChoiceField(queryset=Product.objects.filter(is_active=True))
    movement_type = forms.ChoiceField(choices=StockMovement.Type.choices)
    quantity = forms.IntegerField(min_value=1)
    note = forms.CharField(max_length=255, required=False)


class SaleForm(forms.Form):
    customer = forms.ModelChoiceField(queryset=Customer.objects.all(), required=False, empty_label="Walk-in customer")
    tax_percentage = forms.DecimalField(max_digits=5, decimal_places=2, initial=18)


class SaleLineForm(forms.Form):
    product = forms.ModelChoiceField(queryset=Product.objects.filter(is_active=True, quantity__gt=0), required=False)
    quantity = forms.IntegerField(min_value=1, required=False)


SaleLineFormSet = forms.formset_factory(SaleLineForm, extra=4)
```

### Template views

```python title="inventory/web_views.py"
from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import login_required
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import F, Q, Sum
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone

from . import services
from .forms import ProductForm, SaleForm, SaleLineFormSet, StockMovementForm
from .models import Category, Product, Sale, StockMovement


@login_required
def dashboard(request):
    products = Product.objects.filter(is_active=True)
    low_stock = products.filter(quantity__lte=F("reorder_level")).select_related("category").order_by("quantity")
    today_sales = Sale.objects.filter(created_at__date=timezone.localdate())
    stats = {
        "Products": products.count(),
        "Units in stock": products.aggregate(n=Sum("quantity"))["n"] or 0,
        "Low stock": low_stock.count(),
        "Sales today": today_sales.count(),
        "Revenue today (₹)": today_sales.aggregate(n=Sum("grand_total"))["n"] or 0,
    }
    return render(request, "inventory/dashboard.html", {
        "stats": stats,
        "low_stock": low_stock[:10],
        "movements": StockMovement.objects.select_related("product", "created_by")[:10],
        "recent_sales": Sale.objects.select_related("customer")[:5],
    })


@login_required
def product_list(request):
    q = request.GET.get("q", "").strip()
    category = request.GET.get("category", "")
    products = Product.objects.select_related("category").filter(is_active=True)
    if q:
        products = products.filter(Q(name__icontains=q) | Q(sku__icontains=q))
    if category:
        products = products.filter(category_id=category)
    if request.GET.get("low"):
        products = products.filter(quantity__lte=F("reorder_level"))
    page = Paginator(products, 15).get_page(request.GET.get("page"))
    return render(request, "inventory/product_list.html", {
        "page": page, "q": q, "category": category, "categories": Category.objects.all(),
    })


@staff_member_required
def product_form(request, pk=None):
    product = get_object_or_404(Product, pk=pk) if pk else None
    form = ProductForm(request.POST or None, instance=product)
    if request.method == "POST" and form.is_valid():
        product = form.save()
        messages.success(request, f"Saved {product.name}.")
        return redirect("product_list")
    return render(request, "inventory/product_form.html", {"form": form, "product": product})


@login_required
def stock_adjust(request):
    form = StockMovementForm(request.POST or None, initial={"product": request.GET.get("product")})
    if request.method == "POST" and form.is_valid():
        try:
            movement = services.record_movement(user=request.user, **form.cleaned_data)
        except ValidationError as exc:
            form.add_error("quantity", exc.messages)
        else:
            messages.success(request, f"Recorded: {movement}")
            return redirect("dashboard")
    return render(request, "inventory/stock_form.html", {"form": form})


@login_required
def sale_create(request):
    form = SaleForm(request.POST or None)
    formset = SaleLineFormSet(request.POST or None)
    if request.method == "POST" and form.is_valid() and formset.is_valid():
        lines = [f.cleaned_data for f in formset if f.cleaned_data.get("product") and f.cleaned_data.get("quantity")]
        try:
            sale = services.create_sale(
                items=lines,
                customer=form.cleaned_data["customer"],
                tax_percentage=form.cleaned_data["tax_percentage"],
                user=request.user,
            )
        except ValidationError as exc:
            form.add_error(None, exc.messages)
        else:
            messages.success(request, f"Sale {sale} saved.")
            return redirect("sale_detail", pk=sale.pk)
    return render(request, "inventory/sale_form.html", {"form": form, "formset": formset})


@login_required
def sale_detail(request, pk):
    sale = get_object_or_404(Sale.objects.select_related("customer", "created_by"), pk=pk)
    return render(request, "inventory/sale_detail.html", {"sale": sale, "items": sale.items.select_related("product")})
```

> [!NOTE]
> `staff_member_required` (from `django.contrib.admin`) allows only users with `is_staff=True`. Other users are sent to the admin login page.

```python title="inventory/web_urls.py"
from django.urls import path

from . import web_views as views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("products/", views.product_list, name="product_list"),
    path("products/new/", views.product_form, name="product_create"),
    path("products/<int:pk>/edit/", views.product_form, name="product_edit"),
    path("stock/adjust/", views.stock_adjust, name="stock_adjust"),
    path("sales/new/", views.sale_create, name="sale_create"),
    path("sales/<int:pk>/", views.sale_detail, name="sale_detail"),
]
```

Final project URLs. Replace the whole file:

```python title="ims/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("inventory.urls")),
    path("api-auth/", include("rest_framework.urls")),
    path("accounts/", include("django.contrib.auth.urls")),  # login / logout pages
    path("", include("inventory.web_urls")),
]
```

### Templates

Create these folders **next to `manage.py`**:

```bash
mkdir templates\registration, templates\inventory
```

```django title="templates/base.html"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}IMS{% endblock %} · Inventory</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
    .stats article { margin: 0; text-align: center; }
    .stats strong { font-size: 1.8rem; display: block; }
    .low { color: #b91c1c; font-weight: 600; }
    .IN { color: #15803d; } .OUT { color: #b91c1c; }
    .grid-2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; }
    .right { text-align: right; }
    @media print { header, .no-print { display: none; } }
  </style>
</head>
<body>
  <header class="container">
    <nav>
      <ul><li><strong>📦 IMS</strong></li></ul>
      {% if user.is_authenticated %}
      <ul>
        <li><a href="{% url 'dashboard' %}">Dashboard</a></li>
        <li><a href="{% url 'product_list' %}">Products</a></li>
        <li><a href="{% url 'sale_create' %}">New sale</a></li>
        <li><a href="{% url 'stock_adjust' %}">Adjust stock</a></li>
        <li><a href="/api/">API</a></li>
        <li>
          <form method="post" action="{% url 'logout' %}" style="margin:0">
            {% csrf_token %}
            <button type="submit" class="secondary outline" style="padding:4px 12px">Logout ({{ user.username }})</button>
          </form>
        </li>
      </ul>
      {% endif %}
    </nav>
  </header>
  <main class="container">
    {% for message in messages %}
      <article style="padding:.75rem 1rem">{{ message }}</article>
    {% endfor %}
    {% block content %}{% endblock %}
  </main>
</body>
</html>
```

```django title="templates/registration/login.html"
{% extends "base.html" %}
{% block title %}Login{% endblock %}
{% block content %}
<article style="max-width:420px;margin:3rem auto">
  <h2>Sign in</h2>
  {% if form.errors %}<p class="low">Wrong username or password.</p>{% endif %}
  <form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <input type="hidden" name="next" value="{{ next }}">
    <button type="submit">Log in</button>
  </form>
  <small>Demo: admin/admin123 (manager) · staff/pass1234</small>
</article>
{% endblock %}
```

```django title="templates/inventory/dashboard.html"
{% extends "base.html" %}
{% block title %}Dashboard{% endblock %}
{% block content %}
<h2>Dashboard</h2>
<section class="stats">
  {% for label, value in stats.items %}
    <article><strong>{{ value }}</strong>{{ label }}</article>
  {% endfor %}
</section>

<div class="grid-2">
  <section>
    <h3>⚠ Low stock</h3>
    <table>
      <thead><tr><th>Product</th><th class="right">Qty</th><th class="right">Reorder at</th><th></th></tr></thead>
      <tbody>
      {% for p in low_stock %}
        <tr>
          <td>{{ p.name }}<br><small>{{ p.sku }}</small></td>
          <td class="right low">{{ p.quantity }}</td>
          <td class="right">{{ p.reorder_level }}</td>
          <td><a href="{% url 'stock_adjust' %}?product={{ p.pk }}">Restock</a></td>
        </tr>
      {% empty %}
        <tr><td colspan="4">All stocked up 🎉</td></tr>
      {% endfor %}
      </tbody>
    </table>
  </section>

  <section>
    <h3>Recent stock movements</h3>
    <table>
      <thead><tr><th>Product</th><th class="right">Change</th><th class="right">Balance</th><th>Why</th></tr></thead>
      <tbody>
      {% for m in movements %}
        <tr>
          <td>{{ m.product.name }}</td>
          <td class="right {{ m.movement_type }}">{% if m.movement_type == "IN" %}+{% else %}-{% endif %}{{ m.quantity }}</td>
          <td class="right">{{ m.balance_after }}</td>
          <td><small>{{ m.get_reason_display }} {{ m.note }}</small></td>
        </tr>
      {% empty %}
        <tr><td colspan="4">No movements yet.</td></tr>
      {% endfor %}
      </tbody>
    </table>
  </section>
</div>

<h3>Recent sales</h3>
<table>
  <thead><tr><th>Invoice</th><th>Customer</th><th>Date</th><th class="right">Total (₹)</th></tr></thead>
  <tbody>
  {% for s in recent_sales %}
    <tr>
      <td><a href="{% url 'sale_detail' s.pk %}">{{ s }}</a></td>
      <td>{{ s.customer.name|default:"Walk-in" }}</td>
      <td>{{ s.created_at|date:"d M Y H:i" }}</td>
      <td class="right">{{ s.grand_total }}</td>
    </tr>
  {% empty %}
    <tr><td colspan="4">No sales yet.</td></tr>
  {% endfor %}
  </tbody>
</table>
{% endblock %}
```

```django title="templates/inventory/product_list.html"
{% extends "base.html" %}
{% block title %}Products{% endblock %}
{% block content %}
<div style="display:flex;justify-content:space-between;align-items:center">
  <h2>Products</h2>
  {% if user.is_staff %}<a href="{% url 'product_create' %}" role="button">+ New product</a>{% endif %}
</div>

<form method="get" class="grid">
  <input type="search" name="q" value="{{ q }}" placeholder="Name or SKU">
  <select name="category">
    <option value="">All categories</option>
    {% for c in categories %}
      <option value="{{ c.pk }}" {% if category == c.pk|stringformat:"s" %}selected{% endif %}>{{ c.name }}</option>
    {% endfor %}
  </select>
  <label><input type="checkbox" name="low" value="1" {% if request.GET.low %}checked{% endif %}> Low stock only</label>
  <button type="submit">Filter</button>
</form>

<table>
  <thead>
    <tr><th>SKU</th><th>Name</th><th>Category</th><th class="right">Price ₹</th><th class="right">Qty</th><th></th></tr>
  </thead>
  <tbody>
  {% for p in page %}
    <tr>
      <td>{{ p.sku }}</td>
      <td>{{ p.name }}</td>
      <td>{{ p.category.name }}</td>
      <td class="right">{{ p.selling_price }}</td>
      <td class="right {% if p.is_low_stock %}low{% endif %}">{{ p.quantity }}</td>
      <td>
        <a href="{% url 'stock_adjust' %}?product={{ p.pk }}">Stock</a>
        {% if user.is_staff %} · <a href="{% url 'product_edit' p.pk %}">Edit</a>{% endif %}
      </td>
    </tr>
  {% empty %}
    <tr><td colspan="6">No products found.</td></tr>
  {% endfor %}
  </tbody>
</table>

<nav>
  <ul>
    {% if page.has_previous %}<li><a href="?q={{ q }}&category={{ category }}&page={{ page.previous_page_number }}">← Prev</a></li>{% endif %}
    <li>Page {{ page.number }} of {{ page.paginator.num_pages }}</li>
    {% if page.has_next %}<li><a href="?q={{ q }}&category={{ category }}&page={{ page.next_page_number }}">Next →</a></li>{% endif %}
  </ul>
</nav>
{% endblock %}
```

```django title="templates/inventory/product_form.html"
{% extends "base.html" %}
{% block title %}{% if product %}Edit{% else %}New{% endif %} product{% endblock %}
{% block content %}
<article>
  <h2>{% if product %}Edit {{ product.name }}{% else %}New product{% endif %}</h2>
  {% if product %}<p>Current stock: <strong>{{ product.quantity }}</strong> (change it with a stock movement)</p>{% endif %}
  <form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Save</button>
  </form>
</article>
{% endblock %}
```

```django title="templates/inventory/stock_form.html"
{% extends "base.html" %}
{% block title %}Adjust stock{% endblock %}
{% block content %}
<article style="max-width:560px">
  <h2>Stock in / out</h2>
  <form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Record</button>
  </form>
</article>
{% endblock %}
```

```django title="templates/inventory/sale_form.html"
{% extends "base.html" %}
{% block title %}New sale{% endblock %}
{% block content %}
<article>
  <h2>New sale</h2>
  <form method="post">
    {% csrf_token %}
    {% if form.non_field_errors %}<p class="low">{{ form.non_field_errors|join:" " }}</p>{% endif %}
    <div class="grid">
      <label>Customer {{ form.customer }}</label>
      <label>GST % {{ form.tax_percentage }}</label>
    </div>

    {{ formset.management_form }}
    <table>
      <thead><tr><th>Product</th><th style="width:140px">Qty</th></tr></thead>
      <tbody>
      {% for line in formset %}
        <tr>
          <td>{{ line.product }}{{ line.product.errors }}</td>
          <td>{{ line.quantity }}{{ line.quantity.errors }}</td>
        </tr>
      {% endfor %}
      </tbody>
    </table>
    <small>Leave unused rows empty. Prices come from the product, GST is added on top.</small>
    <button type="submit">Save sale</button>
  </form>
</article>
{% endblock %}
```

```django title="templates/inventory/sale_detail.html"
{% extends "base.html" %}
{% block title %}{{ sale }}{% endblock %}
{% block content %}
<article>
  <header style="display:flex;justify-content:space-between">
    <div>
      <h2 style="margin:0">Invoice {{ sale }}</h2>
      <small>{{ sale.created_at|date:"d M Y, H:i" }} · billed by {{ sale.created_by|default:"—" }}</small>
    </div>
    <div class="right">
      <strong>{{ sale.customer.name|default:"Walk-in customer" }}</strong><br>
      <small>{{ sale.customer.phone|default:"" }}</small>
    </div>
  </header>

  <table>
    <thead><tr><th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Rate ₹</th><th class="right">Amount ₹</th></tr></thead>
    <tbody>
    {% for item in items %}
      <tr>
        <td>{{ forloop.counter }}</td>
        <td>{{ item.product.name }} <small>({{ item.product.sku }})</small></td>
        <td class="right">{{ item.quantity }}</td>
        <td class="right">{{ item.unit_price }}</td>
        <td class="right">{{ item.line_total }}</td>
      </tr>
    {% endfor %}
    </tbody>
    <tfoot>
      <tr><td colspan="4" class="right">Sub total</td><td class="right">{{ sale.sub_total }}</td></tr>
      <tr><td colspan="4" class="right">GST {{ sale.tax_percentage }}%</td><td class="right">{{ sale.tax_amount }}</td></tr>
      <tr><th colspan="4" class="right">Grand total</th><th class="right">₹ {{ sale.grand_total }}</th></tr>
    </tfoot>
  </table>
  <button class="no-print" onclick="window.print()">Print invoice</button>
</article>
{% endblock %}
```

```bash
python manage.py runserver
```

Open <http://127.0.0.1:8000/> and log in as `staff` / `pass1234`. Make a sale, print the invoice, adjust stock, and watch the dashboard update. **Checkpoint 3.**

## 13. Automated tests

```python title="inventory/tests.py"
from decimal import Decimal

from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Category, Product, Purchase, StockMovement, Supplier


class InventoryAPITests(APITestCase):
    def setUp(self):
        self.manager = User.objects.create_user("manager", password="pass1234", is_staff=True)
        self.staff = User.objects.create_user("staff", password="pass1234")
        self.category = Category.objects.create(name="Electronics")
        self.supplier = Supplier.objects.create(name="Acme", phone="9811111111")
        self.mouse = Product.objects.create(
            name="Mouse", sku="M-1", category=self.category, supplier=self.supplier,
            cost_price=Decimal("400"), selling_price=Decimal("500"), quantity=10, reorder_level=3,
        )
        self.cable = Product.objects.create(
            name="Cable", sku="C-1", category=self.category,
            cost_price=Decimal("50"), selling_price=Decimal("100"), quantity=2, reorder_level=5,
        )

    def login(self, username):
        res = self.client.post(reverse("token_obtain_pair"), {"username": username, "password": "pass1234"})
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")

    def test_register_then_login(self):
        res = self.client.post(reverse("register"), {
            "username": "new", "password": "Counter@2024", "password2": "Counter@2024",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.login("manager")  # just proves the token flow works

    def test_staff_cannot_create_product(self):
        self.login("staff")
        res = self.client.post(reverse("product-list"), {
            "name": "X", "sku": "X-1", "category": self.category.id, "cost_price": "1", "selling_price": "2",
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_quantity_is_read_only(self):
        self.login("manager")
        res = self.client.post(reverse("product-list"), {
            "name": "Pen", "sku": "p-1", "category": self.category.id,
            "cost_price": "5", "selling_price": "10", "quantity": 999,
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["quantity"], 0)
        self.assertEqual(res.data["sku"], "P-1")

    def test_sale_reduces_stock_and_calculates_gst(self):
        self.login("staff")
        res = self.client.post(reverse("sale-list"), {
            "tax_percentage": "18.00",
            "items": [{"product": self.mouse.id, "quantity": 2}, {"product": self.cable.id, "quantity": 1}],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["sub_total"], "1100.00")
        self.assertEqual(res.data["tax_amount"], "198.00")
        self.assertEqual(res.data["grand_total"], "1298.00")
        self.mouse.refresh_from_db()
        self.assertEqual(self.mouse.quantity, 8)

    def test_overselling_rolls_back_whole_sale(self):
        self.login("staff")
        res = self.client.post(reverse("sale-list"), {
            "items": [{"product": self.mouse.id, "quantity": 1}, {"product": self.cable.id, "quantity": 50}],
        }, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.mouse.refresh_from_db()
        self.assertEqual(self.mouse.quantity, 10)  # the first line was rolled back too
        self.assertFalse(StockMovement.objects.exists())

    def test_receive_purchase_adds_stock(self):
        self.login("manager")
        purchase = Purchase.objects.create(supplier=self.supplier, product=self.cable, quantity=20, unit_cost=Decimal("45"))
        res = self.client.post(reverse("purchase-receive", args=[purchase.id]))
        self.assertEqual(res.status_code, status.HTTP_200_OK, res.data)
        self.cable.refresh_from_db()
        self.assertEqual(self.cable.quantity, 22)
        self.assertEqual(self.cable.cost_price, Decimal("45.00"))
        res = self.client.post(reverse("purchase-receive", args=[purchase.id]))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)  # can't receive twice

    def test_low_stock_filter(self):
        self.login("staff")
        res = self.client.get(reverse("product-list"), {"low_stock": "true"})
        self.assertEqual([p["sku"] for p in res.data["results"]], ["C-1"])
```

```bash
python manage.py test
```

Expected: `Ran 7 tests ... OK`. Then save the requirements:

```bash
pip freeze > requirements.txt
```

## 14. Explain it like a pro

### What happens on `POST /api/sales/`

```flow
Router | /api/sales/ maps to SaleViewSet.create
JWT | JWTAuthentication turns the Bearer token into request.user
Permission | IsAuthenticated (the default from settings)
SaleSerializer.is_valid() | checks every nested item, then validate_items() rejects duplicates
serializer.save() | calls our create(), which calls services.create_sale()
transaction.atomic | creates the Sale, then for each line: lock row, check stock, F() update, audit row, SaleItem
recalculate() | aggregate Sum(price x qty), then GST, then grand total
Response | 201 with the nested invoice JSON (or 400 with everything rolled back)
```

### Likely questions

**Q: Why a `services.py`?**
It holds business rules in one place. The API, the HTML views, the seed command and the tests all call `record_movement()`. Views stay thin and easy to test. ("Fat models / services, thin views.")

**Q: How do you prevent overselling when two people sell at once?**
`select_for_update()` inside `transaction.atomic()` locks the product row until the transaction ends. The second request waits, then sees the reduced quantity. The update itself uses `F("quantity") - n`, so the subtraction happens in SQL.

**Q: Why store `unit_price` on `SaleItem` when the product already has a price?**
Prices change. An invoice must show what the customer actually paid that day.

**Q: Why soft delete products?**
Old sales and movements reference them, and `PROTECT` would block a hard delete anyway. Setting `is_active = False` keeps history intact.

**Q: `ModelViewSet` vs mixins?**
`SaleViewSet` and `StockMovementViewSet` use only the List, Retrieve and Create mixins, so **no update or delete URLs exist**. Financial and audit records should be immutable.

**Q: `select_related` vs `prefetch_related`?**
`select_related` uses a SQL JOIN for FK/one-to-one (`product.category`). `prefetch_related` runs a second query for reverse-FK/many (`sale.items`). The `SaleViewSet` uses both.

**Q: Why `DecimalField` for money?**
Floats are binary approximations. `Decimal` is exact, and `.quantize(Decimal("0.01"))` rounds to paise.

**Q: How does JWT refresh work?**
Access tokens are short-lived (60 min) and sent on every request. When one expires, the client posts the long-lived refresh token to `/api/auth/refresh/` and gets a new access token, without asking for the password again.

## 15. Common errors and fixes

| Error | Fix |
|---|---|
| `No module named 'django_filters'` | `pip install django-filter` (the package name has a dash, the app name an underscore) |
| `'ProductViewSet' should either include a queryset attribute...` | ViewSets need `queryset = ...`, or `basename=` in `router.register` |
| `TypeError: unsupported operand type(s) for *: 'decimal.Decimal' and 'float'` | Use `Decimal("18")`, not `18.0`, in money maths |
| `Expression contains mixed types: DecimalField, PositiveIntegerField` | Wrap it: `ExpressionWrapper(F(a) * F(b), output_field=DecimalField(...))` |
| Nested `items` not saved / `.create() does not support writable nested fields` | Override `create()` in the serializer (we call the service) |
| Postman sends the `items` list as text | Body → **raw → JSON**, not form-data |
| `401 Authentication credentials were not provided` | Add the `Authorization: Bearer <access>` header |
| `TemplateDoesNotExist: registration/login.html` | `templates/` must be next to `manage.py`, with `DIRS = [BASE_DIR / "templates"]` |

## 16. If they ask for one more feature

**Customer returns:** call `record_movement(product=p, movement_type="IN", quantity=n, reason=..., note=f"Return INV-{sale.pk}")`. Add a `RETURN = "RETURN", "Return"` choice to `StockMovement.Reason` and run `makemigrations`.

**CSV export of products:**

```python title="inventory/web_views.py — add"
import csv
from django.http import HttpResponse


@login_required
def export_products_csv(request):
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="products.csv"'
    writer = csv.writer(response)
    writer.writerow(["SKU", "Name", "Category", "Qty", "Cost", "Price"])
    for p in Product.objects.select_related("category"):
        writer.writerow([p.sku, p.name, p.category.name, p.quantity, p.cost_price, p.selling_price])
    return response
```

```python title="inventory/web_urls.py — add"
    path("products/export/", views.export_products_csv, name="product_export"),
```

**Email alert when stock is low:** in `record_movement()`, after the update, check `if movement.balance_after <= locked.reorder_level:` and call `django.core.mail.send_mail(...)`. Set `EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"` to print emails to the terminal.

**CORS for a React front end / Swagger docs / PostgreSQL:** same steps as section 17 of the [hospital project](/project/hospital#17-if-they-ask-for-one-more-feature).
