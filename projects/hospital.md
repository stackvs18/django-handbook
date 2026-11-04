You will build a **Hospital Management System (HMS)** from an empty folder. You get a REST API with JWT login, three user roles, and a server-rendered dashboard. Every file is shown in full. Click **Copy** on a block and paste it into VS Code.

> [!TIP] How to use this page in a practical test
> Go top to bottom. Each step ends with something you can run, so you always have a working project. If time runs out, stop at the end of any step and you still have something to show. Steps 1–8 are the **must-haves**. Steps 9 onward are the **extras** that make you stand out.

> [!NOTE] Where the design comes from
> The shape follows typical open-source Django hospital apps (for example [hamzaezzine/Hospital-Management](https://github.com/hamzaezzine/Hospital-Management): users with a doctor flag, a Doctor profile linked one-to-one to a User, specialties, and appointments with a status and a time slot). It's simplified to intern-practical level. Instead of separate `Status` and `Time` tables we use `TextChoices` and a slot generator. We left out blogs, comments and image uploads. We added a REST API, JWT, roles, prescriptions and double-booking checks.

## 0. Game plan for the practical

| Time | Step | You can show |
|---|---|---|
| 0–10 min | Setup, settings, custom user | `runserver` works |
| 10–25 min | Models, migrations, admin | Data entry in `/admin/` |
| 25–50 min | Serializers + ViewSets + URLs | Full CRUD API in the browser |
| 50–65 min | JWT login + role permissions | Postman login with `Bearer` token |
| 65–80 min | Business rules (double booking, cancel/complete) | Real validation errors |
| 80–100 min | Dashboard stats, seed data, templates | A UI plus numbers |
| 100+ min | Tests | `python manage.py test` passes |

**What the examiner usually checks:** models and relationships, CRUD API, validation, authentication, permissions, filtering/search/pagination, and whether you can **explain** your code. Section 15 covers the explaining part.

## 1. What we're building

**Roles**

| Role | Can do |
|---|---|
| **Admin** | Everything: departments, doctors, staff accounts |
| **Receptionist** | Register patients, book / cancel appointments |
| **Doctor** | See **only their own** appointments, write prescriptions, mark appointments complete |

**Data model**

```flow
Department | has many Doctors (Cardiology, Orthopedics…)
Doctor | one-to-one with a User account, belongs to a Department
Patient | personal details, blood group, age computed from DOB
Appointment | Patient + Doctor + date + time, status: Scheduled / Completed / Cancelled
Prescription | one-to-one with an Appointment: diagnosis, medicines, advice
```

**API endpoints**

| Method | URL | What it does |
|---|---|---|
| POST | `/api/auth/login/` | Get JWT `access` + `refresh` tokens |
| POST | `/api/auth/refresh/` | Get a new access token |
| POST | `/api/auth/logout/` | Blacklist the refresh token |
| POST | `/api/auth/register/` | Admin creates a staff account |
| GET/PATCH | `/api/auth/me/` | Current user's profile |
| CRUD | `/api/departments/` | Departments with a doctor count |
| CRUD | `/api/doctors/` | Doctors (filter by department, availability) |
| GET | `/api/doctors/{id}/schedule/?date=YYYY-MM-DD` | Booked and free slots for a day |
| CRUD | `/api/patients/` | Patients (search, filter, order) |
| GET | `/api/patients/{id}/history/` | All visits with prescriptions |
| CRUD | `/api/appointments/` | Appointments (double booking is blocked) |
| GET | `/api/appointments/today/` | Today's appointments |
| POST | `/api/appointments/{id}/cancel/` | Cancel |
| POST | `/api/appointments/{id}/complete/` | Mark completed (doctor) |
| CRUD | `/api/prescriptions/` | Prescriptions (doctor writes) |
| GET | `/api/dashboard/` | Counts, revenue, busiest doctors |

## 2. Project setup

Open an empty folder in VS Code, then open the terminal (`` Ctrl+` ``).

```bash
mkdir hospital-management
cd hospital-management
python -m venv venv
venv\Scripts\activate
```

> [!NOTE]
> On macOS or Linux, activate with `source venv/bin/activate`. In PowerShell, if activation is blocked, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.

Install everything we need:

```bash
pip install "django>=5.2,<6" djangorestframework djangorestframework-simplejwt django-filter
```

| Package | Why |
|---|---|
| `django` | The framework |
| `djangorestframework` | DRF: serializers, viewsets, routers, the browsable API |
| `djangorestframework-simplejwt` | JWT login (`access` / `refresh` tokens) |
| `django-filter` | `?status=SCHEDULED&doctor=2` style filtering |

Create the project and two apps:

```bash
django-admin startproject hms .
python manage.py startapp accounts
python manage.py startapp hospital
```

The `.` at the end means "create the project in this folder", so you avoid a `hms/hms/` double folder. `accounts` holds users and login. `hospital` holds everything else.

Final structure (we'll create the extra files as we go):

```text
hospital-management/
├── manage.py
├── hms/                    ← project config
│   ├── settings.py
│   └── urls.py
├── accounts/               ← custom User, JWT login, permissions
│   ├── models.py  admin.py  serializers.py  permissions.py  views.py  urls.py
├── hospital/               ← the domain
│   ├── models.py  admin.py  serializers.py  views.py  urls.py
│   ├── forms.py  web_views.py  web_urls.py  tests.py
│   └── management/commands/seed.py
└── templates/
    ├── base.html
    ├── registration/login.html
    └── hospital/*.html
```

## 3. settings.py

Open `hms/settings.py`. Replace the whole `INSTALLED_APPS` list with:

```python title="hms/settings.py — INSTALLED_APPS"
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # third party
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "django_filters",
    # our apps
    "accounts",
    "hospital",
]
```

In the `TEMPLATES` setting, change the `DIRS` line so Django finds our project-level `templates/` folder:

```python title="hms/settings.py — inside TEMPLATES"
        "DIRS": [BASE_DIR / "templates"],
```

Change the time zone (find the existing `TIME_ZONE` line):

```python title="hms/settings.py — TIME_ZONE"
TIME_ZONE = "Asia/Kolkata"
```

Paste this at the **bottom** of the file:

```python title="hms/settings.py — add at the bottom"
from datetime import timedelta

# Use our own User model (must be set BEFORE the first migrate)
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",  # lets the browsable API use your admin login
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
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# Template (MVT) side: where login sends you
LOGIN_URL = "login"
LOGIN_REDIRECT_URL = "dashboard"
LOGOUT_REDIRECT_URL = "login"
```

> [!IMPORTANT] Why these settings matter
> `DEFAULT_PERMISSION_CLASSES = IsAuthenticated` means **every API endpoint needs login unless we say otherwise**. That's the "secure by default" answer interviewers like. `DEFAULT_FILTER_BACKENDS` gives every ViewSet `?search=`, `?ordering=` and field filters for free.

## 4. Custom User model (do this before migrate)

We need a `role` on each user. The clean way is a custom user model that extends Django's `AbstractUser`.

> [!WARNING]
> Create the custom user **before** you run `migrate` for the first time. Changing `AUTH_USER_MODEL` later means deleting the database and all migrations.

```python title="accounts/models.py"
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Django's built-in user + a role and phone number."""

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        DOCTOR = "DOCTOR", "Doctor"
        RECEPTIONIST = "RECEPTIONIST", "Receptionist"

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.RECEPTIONIST)
    phone = models.CharField(max_length=15, blank=True)

    @property
    def is_admin_role(self):
        return self.is_superuser or self.role == self.Role.ADMIN

    @property
    def is_doctor(self):
        return self.role == self.Role.DOCTOR

    @property
    def is_receptionist(self):
        return self.role == self.Role.RECEPTIONIST
```

```python title="accounts/admin.py"
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ("username", "first_name", "last_name", "email", "role", "is_active")
    list_filter = ("role", "is_active", "is_staff")
    fieldsets = UserAdmin.fieldsets + (("Hospital", {"fields": ("role", "phone")}),)
    add_fieldsets = UserAdmin.add_fieldsets + (("Hospital", {"fields": ("role", "phone", "first_name", "last_name")}),)
```

## 5. Hospital models

This file holds the core of the project: five models, their relationships, choices, and a few helper methods.

```python title="hospital/models.py"
import datetime as dt

from django.conf import settings
from django.db import models
from django.utils import timezone


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Doctor(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="doctor_profile"
    )
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="doctors")
    specialization = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    consultation_fee = models.DecimalField(max_digits=8, decimal_places=2, default=500)
    is_available = models.BooleanField(default=True)

    class Meta:
        ordering = ["user__first_name"]

    def __str__(self):
        return f"Dr. {self.user.get_full_name() or self.user.username}"

    def free_slots(self, day):
        """All 30-minute slots in working hours that are not booked on `day`."""
        booked = set(
            self.appointments.filter(date=day)
            .exclude(status=Appointment.Status.CANCELLED)
            .values_list("time", flat=True)
        )
        slots = []
        current = dt.datetime.combine(day, Appointment.WORK_START)
        end = dt.datetime.combine(day, Appointment.WORK_END)
        while current < end:
            if current.time() not in booked:
                slots.append(current.strftime("%H:%M"))
            current += dt.timedelta(minutes=Appointment.SLOT_MINUTES)
        return slots


class Patient(models.Model):
    class Gender(models.TextChoices):
        MALE = "M", "Male"
        FEMALE = "F", "Female"
        OTHER = "O", "Other"

    class BloodGroup(models.TextChoices):
        A_POS = "A+", "A+"
        A_NEG = "A-", "A-"
        B_POS = "B+", "B+"
        B_NEG = "B-", "B-"
        O_POS = "O+", "O+"
        O_NEG = "O-", "O-"
        AB_POS = "AB+", "AB+"
        AB_NEG = "AB-", "AB-"

    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    gender = models.CharField(max_length=1, choices=Gender.choices)
    date_of_birth = models.DateField()
    blood_group = models.CharField(max_length=3, choices=BloodGroup.choices, blank=True)
    phone = models.CharField(max_length=15, unique=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.full_name

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def age(self):
        today = timezone.localdate()
        dob = self.date_of_birth
        return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class Appointment(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "SCHEDULED", "Scheduled"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    WORK_START = dt.time(9, 0)
    WORK_END = dt.time(17, 0)
    SLOT_MINUTES = 30

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="appointments")
    date = models.DateField()
    time = models.TimeField()
    reason = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.SCHEDULED)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-time"]
        indexes = [models.Index(fields=["doctor", "date"])]

    def __str__(self):
        return f"{self.patient} with {self.doctor} on {self.date} {self.time:%H:%M}"

    @classmethod
    def slot_taken(cls, doctor, day, at, exclude_pk=None):
        """True if the doctor already has a non-cancelled appointment at that date+time."""
        qs = cls.objects.filter(doctor=doctor, date=day, time=at).exclude(status=cls.Status.CANCELLED)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        return qs.exists()


class Prescription(models.Model):
    appointment = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name="prescription"
    )
    diagnosis = models.TextField()
    medicines = models.TextField(help_text="One per line, e.g. Paracetamol 500mg - 1-0-1 - 5 days")
    advice = models.TextField(blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Prescription for {self.appointment}"
```

> [!REMEMBER] Relationship cheat sheet
> - `ForeignKey`: many-to-one. Many appointments belong to one doctor.
> - `OneToOneField`: exactly one. One doctor profile per user, one prescription per appointment.
> - `on_delete=PROTECT`: you **can't** delete a department that still has doctors.
> - `on_delete=CASCADE`: deleting a patient deletes their appointments.
> - `on_delete=SET_NULL`: deleting a staff user keeps the appointment and sets `created_by` to NULL.
> - `related_name="appointments"` lets you write `doctor.appointments.all()`.

Create the tables:

```bash
python manage.py makemigrations accounts hospital
python manage.py migrate
```

## 6. Admin panel

```python title="hospital/admin.py"
from django.contrib import admin

from .models import Appointment, Department, Doctor, Patient, Prescription


class DoctorInline(admin.TabularInline):
    model = Doctor
    extra = 0
    fields = ("user", "specialization", "consultation_fee", "is_available")


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name",)
    inlines = [DoctorInline]


@admin.register(Doctor)
class DoctorAdmin(admin.ModelAdmin):
    list_display = ("__str__", "department", "specialization", "consultation_fee", "is_available")
    list_filter = ("department", "is_available")
    list_editable = ("is_available",)
    search_fields = ("user__first_name", "user__last_name", "specialization")
    list_select_related = ("user", "department")


class AppointmentInline(admin.TabularInline):
    model = Appointment
    extra = 0
    fields = ("doctor", "date", "time", "status", "reason")


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "gender", "age", "blood_group", "phone", "created_at")
    list_filter = ("gender", "blood_group")
    search_fields = ("first_name", "last_name", "phone", "email")
    inlines = [AppointmentInline]


class PrescriptionInline(admin.StackedInline):
    model = Prescription
    extra = 0


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ("patient", "doctor", "date", "time", "status")
    list_filter = ("status", "date", "doctor")
    list_editable = ("status",)
    search_fields = ("patient__first_name", "patient__last_name", "reason")
    date_hierarchy = "date"
    list_select_related = ("patient", "doctor__user")
    inlines = [PrescriptionInline]


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ("appointment", "follow_up_date", "created_at")
    search_fields = ("diagnosis", "appointment__patient__first_name")
```

```bash
python manage.py createsuperuser
python manage.py runserver
```

Open <http://127.0.0.1:8000/admin/>, log in, and add a Department. **Checkpoint 1:** the data layer works.

## 7. Permissions (who can do what)

A DRF permission class answers one question: "may this request continue?" `has_permission` runs on every request. `has_object_permission` runs when a single object is fetched.

```python title="accounts/permissions.py"
from rest_framework.permissions import SAFE_METHODS, BasePermission

# SAFE_METHODS = ("GET", "HEAD", "OPTIONS"): reading, not changing anything.


class IsAdminRole(BasePermission):
    message = "Only admins can do this."

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.is_admin_role)


class IsAdminOrReadOnly(BasePermission):
    """Any logged-in user can read. Only admins can create/update/delete."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_admin_role


class IsFrontDeskOrReadOnly(BasePermission):
    """Admins and receptionists can write. Doctors can only read."""

    message = "Only reception or admin staff can do this."

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_admin_role or request.user.is_receptionist


class IsDoctorOrAdmin(BasePermission):
    message = "Only doctors can do this."

    def has_permission(self, request, view):
        return bool(
            request.user.is_authenticated
            and (request.user.is_doctor or request.user.is_admin_role)
        )


class IsDoctorOrAdminOrReadOnly(BasePermission):
    """Everyone logged in can read; doctors/admins can write; a doctor edits only their own."""

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in SAFE_METHODS:
            return True
        return request.user.is_doctor or request.user.is_admin_role

    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS or request.user.is_admin_role:
            return True
        return obj.appointment.doctor.user_id == request.user.id
```

## 8. Serializers

> [!NOTE] What is a serializer? (the 20-second answer)
> A serializer does three things. It converts a **model instance → JSON** for responses. It converts **JSON → validated Python data** for requests. It **saves** that data with `.save()`. `ModelSerializer` builds the fields for you from the model, the same way `ModelForm` does for HTML forms. Validation hooks: `validate_<field>(value)` checks one field, and `validate(attrs)` checks several fields together.

### Accounts serializers (register + JWT with extra claims)

```python title="accounts/serializers.py"
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username", "first_name", "last_name", "email", "phone", "role"]
        read_only_fields = ["id", "username", "role"]  # users can't promote themselves


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirm password")

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "email", "phone", "role",
            "password", "password2",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)  # hashes the password, never store plain text
        user.save()
        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Login: adds role/username inside the JWT and returns the user with the tokens."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["role"] = user.role
        return token

    def validate(self, attrs):
        data = super().validate(attrs)  # {"refresh": "...", "access": "..."}
        data["user"] = UserSerializer(self.user).data
        return data
```

### Hospital serializers

```python title="hospital/serializers.py"
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers

from .models import Appointment, Department, Doctor, Patient, Prescription

User = get_user_model()


class DepartmentSerializer(serializers.ModelSerializer):
    # Filled by .annotate(doctor_count=Count("doctors")) in the ViewSet
    doctor_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "description", "doctor_count", "created_at"]


class DoctorSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="user.get_full_name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = Doctor
        fields = [
            "id", "user", "name", "department", "department_name",
            "specialization", "phone", "consultation_fee", "is_available",
        ]

    def validate_user(self, user):
        if user.role != User.Role.DOCTOR:
            raise serializers.ValidationError("This user does not have the DOCTOR role.")
        return user


class PatientSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)  # model @property
    age = serializers.IntegerField(read_only=True)  # model @property

    class Meta:
        model = Patient
        fields = [
            "id", "first_name", "last_name", "full_name", "gender", "date_of_birth", "age",
            "blood_group", "phone", "email", "address", "created_at",
        ]

    def validate_date_of_birth(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Date of birth cannot be in the future.")
        return value

    def validate_phone(self, value):
        digits = value.replace("+", "").replace(" ", "").replace("-", "")
        if not digits.isdigit() or not 10 <= len(digits) <= 13:
            raise serializers.ValidationError("Enter a valid phone number (10-13 digits).")
        return value


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    doctor_name = serializers.StringRelatedField(source="doctor")
    has_prescription = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            "id", "patient", "patient_name", "doctor", "doctor_name", "date", "time",
            "reason", "status", "has_prescription", "created_by", "created_at",
        ]
        read_only_fields = ["status", "created_by", "created_at"]

    def get_has_prescription(self, obj):
        return hasattr(obj, "prescription")

    def validate(self, attrs):
        # On PATCH some fields are missing, so fall back to the existing values.
        doctor = attrs.get("doctor", getattr(self.instance, "doctor", None))
        day = attrs.get("date", getattr(self.instance, "date", None))
        at = attrs.get("time", getattr(self.instance, "time", None))

        if day and day < timezone.localdate():
            raise serializers.ValidationError({"date": "Appointment date cannot be in the past."})
        if at and not (Appointment.WORK_START <= at < Appointment.WORK_END):
            raise serializers.ValidationError({"time": "Hospital hours are 09:00 to 17:00."})
        if at and at.minute % Appointment.SLOT_MINUTES:
            raise serializers.ValidationError({"time": "Book on the hour or half hour (e.g. 10:00, 10:30)."})
        if "doctor" in attrs and not doctor.is_available:
            raise serializers.ValidationError({"doctor": "This doctor is not available."})
        if Appointment.slot_taken(doctor, day, at, exclude_pk=getattr(self.instance, "pk", None)):
            raise serializers.ValidationError("This doctor already has an appointment at that time.")
        return attrs


class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source="appointment.patient.full_name", read_only=True)
    doctor_name = serializers.StringRelatedField(source="appointment.doctor")

    class Meta:
        model = Prescription
        fields = [
            "id", "appointment", "patient_name", "doctor_name", "diagnosis",
            "medicines", "advice", "follow_up_date", "created_at",
        ]

    def validate_appointment(self, appointment):
        user = self.context["request"].user
        if appointment.status == Appointment.Status.CANCELLED:
            raise serializers.ValidationError("Cannot prescribe for a cancelled appointment.")
        if not user.is_admin_role and appointment.doctor.user_id != user.id:
            raise serializers.ValidationError("You can only prescribe for your own appointments.")
        return appointment


class AppointmentHistorySerializer(serializers.ModelSerializer):
    """Nested: each appointment carries its prescription (or null)."""

    doctor_name = serializers.StringRelatedField(source="doctor")
    prescription = PrescriptionSerializer(read_only=True)

    class Meta:
        model = Appointment
        fields = ["id", "date", "time", "doctor_name", "reason", "status", "prescription"]
```

> [!TIP] Serializer tricks used above, and how to say them in the interview
> - `source="department.name"`: read a value through a relationship (flattening).
> - `StringRelatedField`: show the related object's `__str__` instead of its id.
> - `SerializerMethodField` + `get_<name>()`: any computed value.
> - `read_only=True` / `read_only_fields`: shown in responses, ignored in requests.
> - `write_only=True`: accepted in requests, never returned (passwords).
> - Nested serializer (`PrescriptionSerializer(read_only=True)`): embeds a related object.
> - `OneToOneField` → DRF automatically adds a uniqueness check, so you get "prescription with this appointment already exists".

## 9. API views (ViewSets)

A `ModelViewSet` gives you `list`, `create`, `retrieve`, `update`, `partial_update` and `destroy` in one class. `@action` adds extra endpoints like `/appointments/5/cancel/`.

### Auth views

```python title="accounts/views.py"
from django.contrib.auth import get_user_model
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .permissions import IsAdminRole
from .serializers import CustomTokenObtainPairSerializer, RegisterSerializer, UserSerializer

User = get_user_model()


class LoginView(TokenObtainPairView):
    """POST username + password -> access + refresh tokens (+ user info)."""

    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(generics.CreateAPIView):
    """Only an admin can create staff accounts (doctor / receptionist / admin)."""

    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [IsAdminRole]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    """POST {"refresh": "<token>"} -> refresh token can no longer be used."""

    def post(self, request):
        try:
            RefreshToken(request.data["refresh"]).blacklist()
        except (KeyError, TokenError):
            return Response({"detail": "A valid refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "Logged out."}, status=status.HTTP_205_RESET_CONTENT)
```

### Hospital views

```python title="hospital/views.py"
from django.db.models import Count, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import (
    IsAdminOrReadOnly,
    IsDoctorOrAdmin,
    IsDoctorOrAdminOrReadOnly,
    IsFrontDeskOrReadOnly,
)

from .models import Appointment, Department, Doctor, Patient, Prescription
from .serializers import (
    AppointmentHistorySerializer,
    AppointmentSerializer,
    DepartmentSerializer,
    DoctorSerializer,
    PatientSerializer,
    PrescriptionSerializer,
)


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.annotate(doctor_count=Count("doctors")).order_by("name")
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrReadOnly]
    search_fields = ["name"]
    ordering_fields = ["name", "doctor_count"]

    def destroy(self, request, *args, **kwargs):
        department = self.get_object()
        if department.doctors.exists():
            return Response(
                {"detail": "Move or delete this department's doctors first."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.select_related("user", "department")
    serializer_class = DoctorSerializer
    permission_classes = [IsAdminOrReadOnly]
    filterset_fields = ["department", "is_available"]
    search_fields = ["user__first_name", "user__last_name", "specialization", "department__name"]
    ordering_fields = ["consultation_fee", "user__first_name"]

    @action(detail=True, methods=["get"])
    def schedule(self, request, pk=None):
        """GET /api/doctors/{id}/schedule/?date=2025-01-31"""
        doctor = self.get_object()
        try:
            day = parse_date(request.query_params.get("date", "")) or timezone.localdate()
        except ValueError:
            return Response({"date": "Use the format YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        booked = (
            doctor.appointments.filter(date=day)
            .exclude(status=Appointment.Status.CANCELLED)
            .select_related("patient")
            .order_by("time")
        )
        return Response(
            {
                "doctor": str(doctor),
                "date": day,
                "booked": AppointmentSerializer(booked, many=True).data,
                "free_slots": doctor.free_slots(day),
            }
        )


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [IsFrontDeskOrReadOnly]
    filterset_fields = ["gender", "blood_group"]
    search_fields = ["first_name", "last_name", "phone", "email"]
    ordering_fields = ["first_name", "created_at", "date_of_birth"]

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """GET /api/patients/{id}/history/: every visit with its prescription."""
        patient = self.get_object()
        visits = patient.appointments.select_related(
            "doctor__user", "prescription"
        ).order_by("-date", "-time")
        return Response(
            {
                "patient": PatientSerializer(patient).data,
                "appointments": AppointmentHistorySerializer(visits, many=True).data,
            }
        )


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    filterset_fields = ["status", "date", "doctor", "patient"]
    search_fields = ["patient__first_name", "patient__last_name", "patient__phone", "reason"]
    ordering_fields = ["date", "time", "created_at"]

    def get_queryset(self):
        qs = Appointment.objects.select_related("patient", "doctor__user", "prescription")
        user = self.request.user
        if user.is_doctor:  # doctors only ever see their own appointments
            qs = qs.filter(doctor__user=user)
        return qs

    def get_permissions(self):
        if self.action == "complete":
            return [IsDoctorOrAdmin()]
        return [IsFrontDeskOrReadOnly()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=False, methods=["get"])
    def today(self, request):
        qs = self.filter_queryset(self.get_queryset()).filter(date=timezone.localdate()).order_by("time")
        return Response(self.get_serializer(qs, many=True).data)

    def _change_status(self, appointment, new_status):
        if appointment.status != Appointment.Status.SCHEDULED:
            return Response(
                {"detail": f"Appointment is already {appointment.get_status_display().lower()}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        appointment.status = new_status
        appointment.save(update_fields=["status"])
        return Response(self.get_serializer(appointment).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return self._change_status(self.get_object(), Appointment.Status.CANCELLED)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._change_status(self.get_object(), Appointment.Status.COMPLETED)


class PrescriptionViewSet(viewsets.ModelViewSet):
    serializer_class = PrescriptionSerializer
    permission_classes = [IsDoctorOrAdminOrReadOnly]
    filterset_fields = ["appointment__doctor", "appointment__patient"]
    search_fields = ["diagnosis", "medicines", "appointment__patient__first_name"]

    def get_queryset(self):
        qs = Prescription.objects.select_related("appointment__patient", "appointment__doctor__user")
        if self.request.user.is_doctor:
            qs = qs.filter(appointment__doctor__user=self.request.user)
        return qs

    def perform_create(self, serializer):
        prescription = serializer.save()
        # Writing a prescription means the visit happened.
        Appointment.objects.filter(pk=prescription.appointment_id).update(
            status=Appointment.Status.COMPLETED
        )


class DashboardStatsView(APIView):
    """GET /api/dashboard/: numbers for a dashboard (uses aggregate + annotate)."""

    def get(self, request):
        today = timezone.localdate()
        appointments = Appointment.objects.all()
        if request.user.is_doctor:
            appointments = appointments.filter(doctor__user=request.user)

        by_status = dict(
            appointments.order_by().values_list("status").annotate(total=Count("id"))
        )
        revenue = appointments.filter(status=Appointment.Status.COMPLETED).aggregate(
            total=Sum("doctor__consultation_fee")
        )["total"] or 0
        busiest = (
            Doctor.objects.select_related("user")
            .annotate(today_count=Count("appointments", filter=Q(appointments__date=today)))
            .order_by("-today_count")[:5]
        )
        return Response(
            {
                "patients": Patient.objects.count(),
                "doctors": Doctor.objects.count(),
                "departments": Department.objects.count(),
                "appointments_today": appointments.filter(date=today).count(),
                "appointments_by_status": by_status,
                "revenue_from_completed": revenue,
                "busiest_doctors_today": [
                    {"doctor": str(d), "appointments": d.today_count} for d in busiest
                ],
            }
        )
```

> [!IMPORTANT] Three things worth pointing out to the examiner
> 1. **`get_queryset()` filtering by role.** A doctor asking for someone else's appointment gets a 404, not someone else's data.
> 2. **`select_related(...)`** loads related rows with a JOIN, which avoids the N+1 query problem.
> 3. **`perform_create()`** sets `created_by` from the logged-in user, so the client can't fake it.

## 10. URLs

```python title="accounts/urls.py"
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", views.LogoutView.as_view(), name="api_logout"),
    path("register/", views.RegisterView.as_view(), name="register"),
    path("me/", views.MeView.as_view(), name="me"),
]
```

```python title="hospital/urls.py"
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register("departments", views.DepartmentViewSet)
router.register("doctors", views.DoctorViewSet)
router.register("patients", views.PatientViewSet)
# No class-level `queryset` on these two, so the router needs a basename
router.register("appointments", views.AppointmentViewSet, basename="appointment")
router.register("prescriptions", views.PrescriptionViewSet, basename="prescription")

urlpatterns = [
    path("dashboard/", views.DashboardStatsView.as_view(), name="api_dashboard"),
    path("", include(router.urls)),
]
```

Replace the project URLs. We'll add the web pages in step 13.

```python title="hms/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("hospital.urls")),
    path("api-auth/", include("rest_framework.urls")),  # login button on the browsable API
]
```

```bash
python manage.py runserver
```

Open <http://127.0.0.1:8000/api/>. DRF's **browsable API** lists every endpoint. You're already logged in from the admin, so you can create departments, doctors and patients right in the browser. **Checkpoint 2:** a full CRUD API.

## 11. Seed demo data (one command)

Typing test data by hand wastes the examiner's time. Write a management command instead. Create the folders and two **empty** `__init__.py` files:

```bash
mkdir hospital\management\commands
New-Item hospital\management\__init__.py, hospital\management\commands\__init__.py
```

> [!NOTE]
> That's PowerShell. In Git Bash/macOS/Linux use `mkdir -p hospital/management/commands && touch hospital/management/__init__.py hospital/management/commands/__init__.py`. You can also just create the two empty files in VS Code.

```python title="hospital/management/commands/seed.py"
import datetime as dt

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from hospital.models import Appointment, Department, Doctor, Patient

User = get_user_model()

DEPARTMENTS = ["Cardiology", "Orthopedics", "Pediatrics", "General Medicine"]

DOCTORS = [
    # username, first, last, department, specialization, fee
    ("dr_mehta", "Anil", "Mehta", "Cardiology", "Cardiologist", 800),
    ("dr_rao", "Priya", "Rao", "Orthopedics", "Orthopedic Surgeon", 700),
    ("dr_khan", "Sana", "Khan", "Pediatrics", "Pediatrician", 600),
    ("dr_iyer", "Vikram", "Iyer", "General Medicine", "General Physician", 400),
]

PATIENTS = [
    ("Ravi", "Kumar", "M", "1985-03-12", "B+", "9876500001"),
    ("Neha", "Sharma", "F", "1992-07-25", "O+", "9876500002"),
    ("Arjun", "Patel", "M", "2015-11-02", "A+", "9876500003"),
    ("Fatima", "Shaikh", "F", "1978-01-30", "AB+", "9876500004"),
    ("John", "Dsouza", "M", "1965-09-18", "O-", "9876500005"),
    ("Meera", "Nair", "F", "2001-05-09", "B-", "9876500006"),
]


class Command(BaseCommand):
    help = "Create demo users, departments, doctors, patients and today's appointments."

    def make_user(self, username, password, role, **extra):
        user, _ = User.objects.get_or_create(username=username, defaults={"role": role, **extra})
        user.set_password(password)
        user.save()
        return user

    def handle(self, *args, **options):
        admin = self.make_user("admin", "admin123", User.Role.ADMIN, is_staff=True, is_superuser=True)
        self.make_user("reception", "pass1234", User.Role.RECEPTIONIST, first_name="Riya")

        departments = {
            name: Department.objects.get_or_create(name=name)[0] for name in DEPARTMENTS
        }

        doctors = []
        for i, (username, first, last, dept, spec, fee) in enumerate(DOCTORS, start=1):
            user = self.make_user(username, "pass1234", User.Role.DOCTOR, first_name=first, last_name=last)
            doctor, _ = Doctor.objects.get_or_create(
                user=user,
                defaults={
                    "department": departments[dept],
                    "specialization": spec,
                    "phone": f"90000000{i:02d}",
                    "consultation_fee": fee,
                },
            )
            doctors.append(doctor)

        patients = []
        for first, last, gender, dob, blood, phone in PATIENTS:
            patient, _ = Patient.objects.get_or_create(
                phone=phone,
                defaults={
                    "first_name": first, "last_name": last, "gender": gender,
                    "date_of_birth": dob, "blood_group": blood,
                },
            )
            patients.append(patient)

        today = timezone.localdate()
        for i, patient in enumerate(patients):
            Appointment.objects.get_or_create(
                doctor=doctors[i % len(doctors)],
                date=today,
                time=dt.time(10 + i, 0),
                defaults={"patient": patient, "reason": "Routine check-up", "created_by": admin},
            )

        self.stdout.write(self.style.SUCCESS(
            "Seeded! Logins -> admin/admin123, reception/pass1234, dr_mehta/pass1234"
        ))
```

```bash
python manage.py seed
```

## 12. Test the API with JWT (Postman or curl)

### How JWT works here

```flow
Login | POST /api/auth/login/ with username + password
Server | checks the password, returns access (60 min) + refresh (1 day) tokens
Every request | send header Authorization: Bearer <access>
Server | verifies the token signature, no database session needed
Access expires | POST /api/auth/refresh/ with the refresh token, get a new access token
Logout | POST /api/auth/logout/ to blacklist the refresh token
```

### In Postman

1. **POST** `http://127.0.0.1:8000/api/auth/login/`, Body → raw → JSON:

```json
{ "username": "reception", "password": "pass1234" }
```

Response:

```json
{
  "refresh": "eyJhbGciOiJIUzI1NiIs...",
  "access": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": 2, "username": "reception", "first_name": "Riya", "role": "RECEPTIONIST", ... }
}
```

2. Copy `access`. On the next request, open the **Authorization** tab → Type **Bearer Token** → paste.

3. **POST** `http://127.0.0.1:8000/api/patients/`:

```json
{
  "first_name": "Amit",
  "last_name": "Verma",
  "gender": "M",
  "date_of_birth": "1990-04-15",
  "blood_group": "A+",
  "phone": "9123456789",
  "email": "amit@example.com"
}
```

4. **POST** `http://127.0.0.1:8000/api/appointments/` (use a future date):

```json
{ "patient": 7, "doctor": 1, "date": "2030-01-15", "time": "10:30", "reason": "Fever and headache" }
```

Send the **same request again** and you get the double-booking error:

```json
{ "non_field_errors": ["This doctor already has an appointment at that time."] }
```

5. Try other endpoints:

```text
GET  /api/patients/?search=sharma
GET  /api/patients/?gender=F&ordering=-created_at
GET  /api/appointments/?status=SCHEDULED&date=2030-01-15
GET  /api/appointments/today/
GET  /api/doctors/1/schedule/?date=2030-01-15
GET  /api/patients/1/history/
POST /api/appointments/1/cancel/
GET  /api/dashboard/
```

6. Log in as `dr_mehta` / `pass1234`. `GET /api/appointments/` now shows **only Dr. Mehta's** appointments. A doctor who tries `POST /api/patients/` gets `403 Forbidden`. Then write a prescription:

```json
{
  "appointment": 1,
  "diagnosis": "Viral fever",
  "medicines": "Paracetamol 500mg - 1-0-1 - 3 days\nORS - after each loose motion",
  "advice": "Rest, plenty of fluids",
  "follow_up_date": "2030-01-20"
}
```

The appointment's status changes to `COMPLETED` automatically.

### Same thing with curl (Windows: use `curl.exe`)

```bash
curl.exe -X POST http://127.0.0.1:8000/api/auth/login/ -H "Content-Type: application/json" -d "{\"username\":\"reception\",\"password\":\"pass1234\"}"
curl.exe http://127.0.0.1:8000/api/patients/ -H "Authorization: Bearer PASTE_ACCESS_TOKEN"
```

## 13. Web dashboard (MVT side)

The API is the main deliverable. A small HTML front end shows you also know classic Django. It uses **session login** (`django.contrib.auth`) and the same models.

### Forms

```python title="hospital/forms.py"
from django import forms
from django.utils import timezone

from .models import Appointment, Doctor, Patient


class DateInput(forms.DateInput):
    input_type = "date"


class TimeInput(forms.TimeInput):
    input_type = "time"


class PatientForm(forms.ModelForm):
    class Meta:
        model = Patient
        fields = [
            "first_name", "last_name", "gender", "date_of_birth",
            "blood_group", "phone", "email", "address",
        ]
        widgets = {
            "date_of_birth": DateInput(),
            "address": forms.Textarea(attrs={"rows": 2}),
        }

    def clean_date_of_birth(self):
        dob = self.cleaned_data["date_of_birth"]
        if dob > timezone.localdate():
            raise forms.ValidationError("Date of birth cannot be in the future.")
        return dob


class AppointmentForm(forms.ModelForm):
    class Meta:
        model = Appointment
        fields = ["patient", "doctor", "date", "time", "reason"]
        widgets = {"date": DateInput(), "time": TimeInput(attrs={"step": 1800})}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["doctor"].queryset = Doctor.objects.filter(is_available=True).select_related("user")

    def clean(self):
        cleaned = super().clean()
        doctor, day, at = cleaned.get("doctor"), cleaned.get("date"), cleaned.get("time")
        if day and day < timezone.localdate():
            self.add_error("date", "Appointment date cannot be in the past.")
        if at and not (Appointment.WORK_START <= at < Appointment.WORK_END):
            self.add_error("time", "Hospital hours are 09:00 to 17:00.")
        if doctor and day and at and Appointment.slot_taken(doctor, day, at):
            raise forms.ValidationError("This doctor already has an appointment at that time.")
        return cleaned
```

### Template views

```python title="hospital/web_views.py"
from functools import wraps

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from .forms import AppointmentForm, PatientForm
from .models import Appointment, Doctor, Patient


def front_desk_required(view_func):
    """Logged in AND admin/receptionist, otherwise 403."""

    @wraps(view_func)
    @login_required
    def wrapper(request, *args, **kwargs):
        if not (request.user.is_admin_role or request.user.is_receptionist):
            raise PermissionDenied
        return view_func(request, *args, **kwargs)

    return wrapper


@login_required
def dashboard(request):
    today = timezone.localdate()
    appointments = (
        Appointment.objects.filter(date=today)
        .select_related("patient", "doctor__user")
        .order_by("time")
    )
    if request.user.is_doctor:
        appointments = appointments.filter(doctor__user=request.user)

    stats = {
        "Patients": Patient.objects.count(),
        "Doctors": Doctor.objects.count(),
        "Today": appointments.count(),
        "Scheduled": appointments.filter(status=Appointment.Status.SCHEDULED).count(),
    }
    return render(request, "hospital/dashboard.html", {
        "today": today, "appointments": appointments, "stats": stats,
    })


@login_required
def patient_list(request):
    q = request.GET.get("q", "").strip()
    patients = Patient.objects.all()
    if q:
        patients = patients.filter(
            Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(phone__icontains=q)
        )
    page = Paginator(patients, 10).get_page(request.GET.get("page"))
    return render(request, "hospital/patient_list.html", {"page": page, "q": q})


@login_required
def patient_detail(request, pk):
    patient = get_object_or_404(Patient, pk=pk)
    visits = patient.appointments.select_related("doctor__user", "prescription")
    return render(request, "hospital/patient_detail.html", {"patient": patient, "visits": visits})


@front_desk_required
def patient_form(request, pk=None):
    patient = get_object_or_404(Patient, pk=pk) if pk else None
    form = PatientForm(request.POST or None, instance=patient)
    if request.method == "POST" and form.is_valid():
        patient = form.save()
        messages.success(request, f"Saved {patient.full_name}.")
        return redirect("patient_detail", pk=patient.pk)
    return render(request, "hospital/patient_form.html", {"form": form, "patient": patient})


@front_desk_required
def appointment_create(request):
    form = AppointmentForm(request.POST or None, initial={"patient": request.GET.get("patient")})
    if request.method == "POST" and form.is_valid():
        appointment = form.save(commit=False)
        appointment.created_by = request.user
        appointment.save()
        messages.success(request, f"Booked: {appointment}")
        return redirect("dashboard")
    return render(request, "hospital/appointment_form.html", {"form": form})


@login_required
@require_POST
def appointment_status(request, pk, new_status):
    appointment = get_object_or_404(Appointment, pk=pk)
    allowed = {
        "cancel": (Appointment.Status.CANCELLED, request.user.is_admin_role or request.user.is_receptionist),
        "complete": (Appointment.Status.COMPLETED, request.user.is_admin_role or appointment.doctor.user_id == request.user.id),
    }
    if new_status not in allowed or not allowed[new_status][1]:
        raise PermissionDenied
    if appointment.status == Appointment.Status.SCHEDULED:
        appointment.status = allowed[new_status][0]
        appointment.save(update_fields=["status"])
        messages.success(request, f"Appointment marked {appointment.get_status_display().lower()}.")
    return redirect("dashboard")
```

```python title="hospital/web_urls.py"
from django.urls import path

from . import web_views as views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("patients/", views.patient_list, name="patient_list"),
    path("patients/new/", views.patient_form, name="patient_create"),
    path("patients/<int:pk>/", views.patient_detail, name="patient_detail"),
    path("patients/<int:pk>/edit/", views.patient_form, name="patient_edit"),
    path("appointments/new/", views.appointment_create, name="appointment_create"),
    path("appointments/<int:pk>/<str:new_status>/", views.appointment_status, name="appointment_status"),
]
```

Now the **final** project URLs. Replace the whole file:

```python title="hms/urls.py"
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/", include("hospital.urls")),
    path("api-auth/", include("rest_framework.urls")),
    path("accounts/", include("django.contrib.auth.urls")),  # login / logout pages
    path("", include("hospital.web_urls")),
]
```

### Templates

Create a `templates` folder **next to `manage.py`** (not inside an app), with `registration` and `hospital` folders inside it.

```bash
mkdir templates\registration, templates\hospital
```

The base layout uses [Pico CSS](https://picocss.com) from a CDN, so plain HTML looks clean without writing any CSS.

```django title="templates/base.html"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{% block title %}HMS{% endblock %} · Hospital</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css">
  <style>
    .badge { padding: 2px 8px; border-radius: 99px; font-size: .8rem; }
    .SCHEDULED { background: #dbeafe; color: #1e40af; }
    .COMPLETED { background: #dcfce7; color: #166534; }
    .CANCELLED { background: #fee2e2; color: #991b1b; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; }
    .stats article { margin: 0; text-align: center; }
    .stats strong { font-size: 2rem; display: block; }
    td form { margin: 0; display: inline; }
    td button { padding: 4px 10px; margin: 0; font-size: .8rem; width: auto; }
  </style>
</head>
<body>
  <header class="container">
    <nav>
      <ul><li><strong>🏥 HMS</strong></li></ul>
      {% if user.is_authenticated %}
      <ul>
        <li><a href="{% url 'dashboard' %}">Dashboard</a></li>
        <li><a href="{% url 'patient_list' %}">Patients</a></li>
        {% if user.is_admin_role or user.is_receptionist %}
          <li><a href="{% url 'appointment_create' %}">Book</a></li>
        {% endif %}
        <li><a href="/api/">API</a></li>
        <li>
          <form method="post" action="{% url 'logout' %}" style="margin:0">
            {% csrf_token %}
            <button type="submit" class="secondary outline" style="padding:4px 12px">
              Logout ({{ user.username }})
            </button>
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
  <h2>Staff login</h2>
  {% if form.errors %}<p style="color:#b91c1c">Wrong username or password.</p>{% endif %}
  <form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <input type="hidden" name="next" value="{{ next }}">
    <button type="submit">Log in</button>
  </form>
  <small>Demo: admin/admin123 · reception/pass1234 · dr_mehta/pass1234</small>
</article>
{% endblock %}
```

```django title="templates/hospital/dashboard.html"
{% extends "base.html" %}
{% block title %}Dashboard{% endblock %}
{% block content %}
<h2>Good day, {{ user.first_name|default:user.username }}</h2>
<p>{{ user.get_role_display }} · {{ today|date:"l, d M Y" }}</p>

<section class="stats">
  {% for label, value in stats.items %}
    <article><strong>{{ value }}</strong>{{ label }}</article>
  {% endfor %}
</section>

<h3>Today's appointments</h3>
<figure>
<table>
  <thead>
    <tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Reason</th><th>Status</th><th></th></tr>
  </thead>
  <tbody>
  {% for a in appointments %}
    <tr>
      <td>{{ a.time|time:"H:i" }}</td>
      <td><a href="{% url 'patient_detail' a.patient.pk %}">{{ a.patient.full_name }}</a></td>
      <td>{{ a.doctor }}</td>
      <td>{{ a.reason }}</td>
      <td><span class="badge {{ a.status }}">{{ a.get_status_display }}</span></td>
      <td>
        {% if a.status == "SCHEDULED" %}
          {% if user.is_doctor or user.is_admin_role %}
          <form method="post" action="{% url 'appointment_status' a.pk 'complete' %}">
            {% csrf_token %}<button>Complete</button>
          </form>
          {% endif %}
          {% if user.is_receptionist or user.is_admin_role %}
          <form method="post" action="{% url 'appointment_status' a.pk 'cancel' %}">
            {% csrf_token %}<button class="secondary">Cancel</button>
          </form>
          {% endif %}
        {% endif %}
      </td>
    </tr>
  {% empty %}
    <tr><td colspan="6">No appointments today.</td></tr>
  {% endfor %}
  </tbody>
</table>
</figure>
{% endblock %}
```

```django title="templates/hospital/patient_list.html"
{% extends "base.html" %}
{% block title %}Patients{% endblock %}
{% block content %}
<div style="display:flex;justify-content:space-between;align-items:center">
  <h2>Patients</h2>
  {% if user.is_admin_role or user.is_receptionist %}
    <a href="{% url 'patient_create' %}" role="button">+ New patient</a>
  {% endif %}
</div>

<form method="get" role="search">
  <input type="search" name="q" value="{{ q }}" placeholder="Search name or phone">
  <button type="submit">Search</button>
</form>

<table>
  <thead><tr><th>Name</th><th>Gender</th><th>Age</th><th>Blood</th><th>Phone</th></tr></thead>
  <tbody>
  {% for p in page %}
    <tr>
      <td><a href="{% url 'patient_detail' p.pk %}">{{ p.full_name }}</a></td>
      <td>{{ p.get_gender_display }}</td>
      <td>{{ p.age }}</td>
      <td>{{ p.blood_group|default:"—" }}</td>
      <td>{{ p.phone }}</td>
    </tr>
  {% empty %}
    <tr><td colspan="5">No patients found.</td></tr>
  {% endfor %}
  </tbody>
</table>

<nav>
  <ul>
    {% if page.has_previous %}<li><a href="?q={{ q }}&page={{ page.previous_page_number }}">← Prev</a></li>{% endif %}
    <li>Page {{ page.number }} of {{ page.paginator.num_pages }}</li>
    {% if page.has_next %}<li><a href="?q={{ q }}&page={{ page.next_page_number }}">Next →</a></li>{% endif %}
  </ul>
</nav>
{% endblock %}
```

```django title="templates/hospital/patient_form.html"
{% extends "base.html" %}
{% block title %}{% if patient %}Edit{% else %}New{% endif %} patient{% endblock %}
{% block content %}
<article>
  <h2>{% if patient %}Edit {{ patient.full_name }}{% else %}New patient{% endif %}</h2>
  <form method="post">
    {% csrf_token %}
    {{ form.as_p }}
    <button type="submit">Save</button>
  </form>
</article>
{% endblock %}
```

```django title="templates/hospital/patient_detail.html"
{% extends "base.html" %}
{% block title %}{{ patient.full_name }}{% endblock %}
{% block content %}
<article>
  <h2>{{ patient.full_name }}</h2>
  <p>
    {{ patient.get_gender_display }} · {{ patient.age }} yrs · Blood {{ patient.blood_group|default:"?" }}<br>
    📞 {{ patient.phone }} {% if patient.email %}· ✉ {{ patient.email }}{% endif %}
  </p>
  {% if user.is_admin_role or user.is_receptionist %}
    <a href="{% url 'patient_edit' patient.pk %}" role="button" class="secondary">Edit</a>
    <a href="{% url 'appointment_create' %}?patient={{ patient.pk }}" role="button">Book appointment</a>
  {% endif %}
</article>

<h3>Visit history</h3>
{% for v in visits %}
  <article>
    <header>
      <strong>{{ v.date|date:"d M Y" }} {{ v.time|time:"H:i" }}</strong> · {{ v.doctor }}
      <span class="badge {{ v.status }}">{{ v.get_status_display }}</span>
    </header>
    <p><em>{{ v.reason }}</em></p>
    {% if v.prescription %}
      <p><strong>Diagnosis:</strong> {{ v.prescription.diagnosis }}</p>
      <p><strong>Medicines:</strong><br>{{ v.prescription.medicines|linebreaksbr }}</p>
      {% if v.prescription.advice %}<p><strong>Advice:</strong> {{ v.prescription.advice }}</p>{% endif %}
    {% endif %}
  </article>
{% empty %}
  <p>No visits yet.</p>
{% endfor %}
{% endblock %}
```

```django title="templates/hospital/appointment_form.html"
{% extends "base.html" %}
{% block title %}Book appointment{% endblock %}
{% block content %}
<article>
  <h2>Book appointment</h2>
  <form method="post">
    {% csrf_token %}
    {{ form.non_field_errors }}
    {{ form.as_p }}
    <button type="submit">Book</button>
  </form>
</article>
{% endblock %}
```

```bash
python manage.py runserver
```

Open <http://127.0.0.1:8000/>. You're sent to the login page. Log in as `reception` / `pass1234`, add a patient and book an appointment. Then log out, log in as `dr_mehta` and complete it. **Checkpoint 3:** API plus UI.

## 14. Automated tests

```python title="hospital/tests.py"
import datetime as dt

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Appointment, Department, Doctor, Patient

User = get_user_model()


class HospitalAPITests(APITestCase):
    def setUp(self):
        self.reception = User.objects.create_user("rec", password="pass1234", role=User.Role.RECEPTIONIST)
        doc_user = User.objects.create_user("doc", password="pass1234", role=User.Role.DOCTOR, first_name="Asha")
        other_user = User.objects.create_user("doc2", password="pass1234", role=User.Role.DOCTOR)
        dept = Department.objects.create(name="Cardiology")
        self.doctor = Doctor.objects.create(user=doc_user, department=dept, specialization="Cardio", phone="9000000001")
        self.other = Doctor.objects.create(user=other_user, department=dept, specialization="Cardio", phone="9000000002")
        self.patient = Patient.objects.create(
            first_name="Ravi", last_name="Kumar", gender="M", date_of_birth="1990-05-01", phone="9876543210"
        )
        self.tomorrow = timezone.localdate() + dt.timedelta(days=1)

    def login(self, username):
        res = self.client.post(reverse("token_obtain_pair"), {"username": username, "password": "pass1234"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {res.data['access']}")
        return res

    def book(self, **overrides):
        data = {
            "patient": self.patient.id, "doctor": self.doctor.id,
            "date": str(self.tomorrow), "time": "10:00", "reason": "Chest pain", **overrides,
        }
        return self.client.post(reverse("appointment-list"), data)

    def test_login_returns_tokens_and_role(self):
        res = self.login("rec")
        self.assertIn("access", res.data)
        self.assertIn("refresh", res.data)
        self.assertEqual(res.data["user"]["role"], "RECEPTIONIST")

    def test_anonymous_is_rejected(self):
        res = self.client.get(reverse("patient-list"))
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_receptionist_can_book(self):
        self.login("rec")
        res = self.book()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        self.assertEqual(res.data["status"], "SCHEDULED")

    def test_double_booking_is_rejected(self):
        self.login("rec")
        self.book()
        res = self.book()
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_past_date_is_rejected(self):
        self.login("rec")
        res = self.book(date=str(timezone.localdate() - dt.timedelta(days=1)))
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("date", res.data)

    def test_doctor_sees_only_own_appointments(self):
        Appointment.objects.create(patient=self.patient, doctor=self.doctor, date=self.tomorrow, time=dt.time(10), reason="a")
        Appointment.objects.create(patient=self.patient, doctor=self.other, date=self.tomorrow, time=dt.time(11), reason="b")
        self.login("doc")
        res = self.client.get(reverse("appointment-list"))
        self.assertEqual(res.data["count"], 1)

    def test_doctor_cannot_create_patient(self):
        self.login("doc")
        res = self.client.post(reverse("patient-list"), {
            "first_name": "X", "last_name": "Y", "gender": "M", "date_of_birth": "2000-01-01", "phone": "9999999999",
        })
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_prescription_completes_appointment(self):
        appt = Appointment.objects.create(patient=self.patient, doctor=self.doctor, date=self.tomorrow, time=dt.time(10), reason="a")
        self.login("doc")
        res = self.client.post(reverse("prescription-list"), {
            "appointment": appt.id, "diagnosis": "Flu", "medicines": "Paracetamol",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        appt.refresh_from_db()
        self.assertEqual(appt.status, Appointment.Status.COMPLETED)
```

```bash
python manage.py test
```

Expected: `Ran 8 tests ... OK`.

Save your dependencies:

```bash
pip freeze > requirements.txt
```

## 15. Explain it like a pro (interview answers)

### Request flow for `POST /api/appointments/`

```flow
urls.py | the router maps /api/appointments/ to AppointmentViewSet, action create
Authentication | JWTAuthentication reads the Bearer token and sets request.user
Permissions | IsFrontDeskOrReadOnly: is this user admin or receptionist?
Serializer | AppointmentSerializer(data=request.data).is_valid(): field checks, then validate()
perform_create | serializer.save(created_by=request.user) runs INSERT via the ORM
Response | serializer.data as JSON with 201 Created
```

### Likely questions

**Q: What's the difference between `APIView`, generic views and `ViewSet`?**
`APIView` is the lowest level: you write `get()` and `post()` yourself. Generic views (`ListCreateAPIView`) add the queryset, serializer and pagination wiring. A `ViewSet` groups all CRUD actions in one class, and a router generates the URLs for it.

**Q: Why JWT and not sessions?**
JWT is stateless. The server doesn't store sessions, it only verifies the token signature. That suits mobile and SPA clients and multiple servers. The access token is short-lived (60 min) to limit damage if it's stolen. The refresh token (1 day) gets new access tokens. Logout blacklists the refresh token.

**Q: What's inside a JWT?**
Three base64 parts: `header.payload.signature`. Our payload has `user_id`, `exp`, `role` and `username`. It's **signed, not encrypted**, so never put secrets in it.

**Q: Where does validation happen?**
Three levels. Field level (`validate_phone`), object level (`validate()` for double booking across doctor + date + time), and model/DB level (`unique=True` on phone, `OneToOneField` on prescription).

**Q: How do you stop a doctor from seeing other doctors' data?**
Two layers: `get_queryset()` filters by `request.user`, and permission classes check the role. The doctor gets a 404 for other doctors' records, so we don't even reveal that they exist.

**Q: What's the N+1 problem?**
Listing 10 appointments and reading `appointment.doctor.user` would fire 1 + 10 + 10 queries. `select_related("doctor__user")` turns that into a single JOIN query. For reverse FK or many-to-many, use `prefetch_related`.

**Q: `annotate` vs `aggregate`?**
`aggregate` returns **one** dict for the whole queryset, e.g. total revenue. `annotate` adds a computed value **to each row**, e.g. `doctor_count` per department.

## 16. Common errors and fixes

| Error | Fix |
|---|---|
| `No module named 'rest_framework_simplejwt'` | venv not active, or package not installed. Run `pip install djangorestframework-simplejwt` |
| `ValueError: Dependency on app with no migrations: accounts` | Run `python manage.py makemigrations accounts hospital` |
| `InconsistentMigrationHistory ... admin.0001_initial` | You ran `migrate` before creating the custom User. Delete `db.sqlite3` and the migration files (keep `__init__.py`), then migrate again |
| `401 Authentication credentials were not provided` | Missing header `Authorization: Bearer <access>` |
| `401 Given token not valid` | Access token expired. Call `/api/auth/refresh/` or log in again |
| `403 You do not have permission` | Your role isn't allowed. Check which user you logged in as |
| `TemplateDoesNotExist: registration/login.html` | `templates/` must sit next to `manage.py`, and `DIRS` must be `[BASE_DIR / "templates"]` |
| `405 Method "GET" not allowed` on logout | Django 5 logout must be a POST form (already done in `base.html`) |
| `AssertionError: basename argument not specified` | ViewSets without `queryset` need `basename=` in `router.register` |

## 17. If they ask for one more feature

**Allow a React/Angular front end (CORS):**

```bash
pip install django-cors-headers
```

```python title="hms/settings.py — CORS"
INSTALLED_APPS += ["corsheaders"]
MIDDLEWARE.insert(0, "corsheaders.middleware.CorsMiddleware")
CORS_ALLOWED_ORIGINS = ["http://localhost:3000", "http://localhost:5173"]
```

**Swagger / OpenAPI docs:**

```bash
pip install drf-spectacular
```

```python title="hms/settings.py — API docs"
INSTALLED_APPS += ["drf_spectacular"]
REST_FRAMEWORK["DEFAULT_SCHEMA_CLASS"] = "drf_spectacular.openapi.AutoSchema"
```

```python title="hms/urls.py — add to urlpatterns"
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

urlpatterns += [
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="docs"),
]
```

**Switch to PostgreSQL/MySQL:**

```bash
pip install psycopg[binary]
```

```python title="hms/settings.py — DATABASES"
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",   # or "django.db.backends.mysql" (pip install mysqlclient)
        "NAME": "hms",
        "USER": "postgres",
        "PASSWORD": "postgres",
        "HOST": "localhost",
        "PORT": "5432",
    }
}
```

**Billing (sketch):** add a `Bill` model with `appointment = OneToOneField(Appointment)`, `amount = DecimalField`, `is_paid = BooleanField`. Create it in `PrescriptionViewSet.perform_create` using `amount=appointment.doctor.consultation_fee`. Expose it with a `BillViewSet` and a `@action(detail=True, methods=["post"]) def pay(...)`. Same pattern as cancel/complete.
