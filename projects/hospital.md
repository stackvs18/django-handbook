You will build a **Hospital Management System** step by step, the same way you built the Player project in class:

**project → app → settings → models → migrations → admin → serializers → viewsets → router → JWT → Postman → web pages**

Every file is shown **in full**. Click **Copy**, paste it into VS Code, save. After every block there is a short note on **what the code does** and **how it is used**, so you can explain it to the interviewer.

> [!TIP] How to use this page in a practical test
> Go top to bottom. Every step ends with something you can run.
> - **Part A (Steps 1–6):** project, models, admin. You can already add data in `/admin/`.
> - **Part B (Steps 7–12):** REST API with serializers, viewsets, router, JWT and roles. Test it in Postman.
> - **Part C (Steps 13–17):** normal Django web pages (MVT) with login, patients and appointments.
>
> If the test only asks for an API, stop after Part B. If it only asks for web pages, do Part A and then Part C.

> [!NOTE] Can't remember an import?
> Every import line used here is explained, file by file, on the [Import cheat sheet](/imports), along with simple rules to rebuild any import you forget.

> [!NOTE] Where the idea comes from
> Open-source hospital apps (for example [hamzaezzine/Hospital-Management](https://github.com/hamzaezzine/Hospital-Management)) have doctors linked to user accounts, departments, patients and appointments with a status. We kept only those basic ideas and wrote everything in the simple style from class: plain `models.Model`, choices written by hand, function-based web views and `ModelViewSet` for the API.

## 0. What we're building

**Who uses the system**

| Role | How we know the role | Can do |
|---|---|---|
| **Admin** | Django superuser (`createsuperuser`) | Everything, including departments and doctors |
| **Receptionist** | Their user is linked to a row in the `Receptionist` table | Add, edit and delete patients. Book and cancel appointments |
| **Doctor** | Their user is linked to a row in the `Doctor` table | See **only their own** appointments, write notes, mark them completed |

**Tables (models)**

```flow
Department | Cardiology, Orthopedics… one department has many doctors
Doctor | name, specialization, fee… linked to a login user
Receptionist | name, phone, shift… linked to a login user
Patient | name, age, gender, phone, blood group
Appointment | patient + doctor + date + time, status: scheduled / completed / cancelled
```

**API endpoints you will have at the end of Part B**

| Method | URL | What it does |
|---|---|---|
| POST | `/api/token/` | Log in and get JWT `access` + `refresh` tokens |
| POST | `/api/token/refresh/` | Get a new access token |
| GET / POST | `/api/departments/` | List / create departments |
| GET / POST | `/api/doctors/` | List / create doctors |
| GET / POST | `/api/patients/` | List / create patients (`?search=name`) |
| GET / POST | `/api/appointments/` | List / book appointments (`?status=scheduled`) |
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
django-admin startproject hospitalproject
cd hospitalproject
python manage.py startapp hospitalapp
mkdir templates
```

**What it does**
- `startproject hospitalproject` creates the project folder with `manage.py` and the settings package.
- `cd hospitalproject` moves into it. **Run every command from here on inside this folder** (the one that has `manage.py`).
- `startapp hospitalapp` creates our app. All models, views and serializers go in here.
- `mkdir templates` creates one folder for all HTML files. We tell Django about it in Step 2.

Your folder now looks like this. The files marked *new* are ones you will create yourself later:

```text
hospitalproject/              ← you are here (has manage.py)
├── manage.py
├── templates/                ← all HTML files (Part C)
├── hospitalproject/          ← project settings
│   ├── settings.py
│   └── urls.py
└── hospitalapp/              ← our app
    ├── models.py
    ├── admin.py
    ├── serializers.py        ← new (Part B)
    ├── permissions.py        ← new (Part B)
    ├── api_views.py          ← new (Part B)
    ├── views.py              ← web pages (Part C)
    └── urls.py               ← new (Part C)
```

## 2. settings.py (only two changes)

Open `hospitalproject/settings.py`. You change **only two things** here: `INSTALLED_APPS` and the templates folder. Leave everything else (database, time zone, middleware) exactly as Django created it.

**Change 1.** Find `INSTALLED_APPS` and add the two marked lines:

```python title="hospitalproject/settings.py — INSTALLED_APPS"
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',   # <--- ADDED (Django REST Framework)
    'hospitalapp',      # <--- ADDED (our app)
]
```

**What it does**
- `INSTALLED_APPS` is the list of apps Django loads.
- `'rest_framework'` turns on DRF. It also gives us the browsable API pages and the `api-auth/` login page.
- `'hospitalapp'` tells Django our app exists. Without it, `makemigrations` will not see your models.

**Change 2.** Find `TEMPLATES` and change `'DIRS': []` to the line below:

```python title="hospitalproject/settings.py — TEMPLATES"
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

Open `hospitalapp/models.py` and replace everything with:

```python title="hospitalapp/models.py"
from django.db import models
from django.contrib.auth.models import User


class Department(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name


class Doctor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)   # the doctor's login account
    name = models.CharField(max_length=100)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    specialization = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True)
    fee = models.IntegerField(default=500)

    def __str__(self):
        return 'Dr. ' + self.name


class Receptionist(models.Model):
    SHIFT_CHOICES = [
        ('morning', 'Morning'),
        ('evening', 'Evening'),
        ('night', 'Night'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE)   # the receptionist's login account
    name = models.CharField(max_length=100)
    phone = models.CharField(max_length=15)
    shift = models.CharField(max_length=10, choices=SHIFT_CHOICES, default='morning')

    def __str__(self):
        return self.name


class Patient(models.Model):
    GENDER_CHOICES = [
        ('male', 'Male'),
        ('female', 'Female'),
        ('other', 'Other'),
    ]
    BLOOD_GROUP_CHOICES = [
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
    ]

    name = models.CharField(max_length=100)
    age = models.IntegerField()
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    phone = models.CharField(max_length=15)
    blood_group = models.CharField(max_length=5, choices=BLOOD_GROUP_CHOICES, blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]

    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE)
    date = models.DateField()
    time = models.TimeField()
    reason = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    notes = models.TextField(blank=True)   # the doctor writes diagnosis / medicines here
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.patient.name + ' with Dr. ' + self.doctor.name + ' on ' + str(self.date)
```

**What it does.** Each class becomes one table in the database. Each line inside a class becomes one column.

| Model | What it stores | Links |
|---|---|---|
| `Department` | Hospital departments | Has many doctors |
| `Doctor` | Doctor details | `department` → one Department. `user` → one login account |
| `Receptionist` | Front desk staff | `user` → one login account |
| `Patient` | Patient details | Has many appointments |
| `Appointment` | One visit | `patient` → one Patient. `doctor` → one Doctor |

### The link lines, explained slowly

These two lines in `Doctor` are the only "hard" part of the models:

```python
user = models.OneToOneField(User, on_delete=models.CASCADE)
department = models.ForeignKey(Department, on_delete=models.CASCADE)
```

Both mean the same basic thing: **"this column points to one row in another table."** Read the `department` line left to right:

| Piece | Read it as |
|---|---|
| `department =` | the name of the column |
| `models.ForeignKey(` | "this points to a row in another table" |
| `Department` | which table it points to |
| `on_delete=models.CASCADE` | "if that department is deleted, delete this doctor too" |

**What the database really stores is just a number.** Django adds `_id` to the name:

| Doctor: id | name | department_id | user_id |
|---|---|---|---|
| 1 | Mehta | 1 | 2 |
| 2 | Rao | 2 | 3 |

| Department: id | name |
|---|---|
| 1 | Cardiology |
| 2 | Orthopedics |

Mehta has `department_id = 1`, so Mehta is in Cardiology. In code you never look up the number yourself. Write `doctor.department.name` and Django follows the link and gives you `'Cardiology'`.

**ForeignKey vs OneToOneField: the only difference**

| | `ForeignKey` | `OneToOneField` |
|---|---|---|
| Can two doctors point to the same row? | **Yes.** Mehta and another doctor can both be in Cardiology (`department_id = 1` twice) | **No.** One login account belongs to only one doctor (`user_id` can't repeat) |
| Real-life example | Many students → one class | One person → one Aadhaar card |
| In `/admin/` | A dropdown to pick the department | A dropdown to pick the user |

**`on_delete` is required** on every link, because Django must know what to do with the doctor if the department is deleted. In this project we always use `models.CASCADE` ("delete this one too").

> [!TIP] The template line to remember
> Every link field is the same line. Only the name and the model change:
> ```python
> name = models.ForeignKey(OtherModel, on_delete=models.CASCADE)
> name = models.OneToOneField(OtherModel, on_delete=models.CASCADE)
> ```
> Use `ForeignKey` almost always. Use `OneToOneField` only for "one user account = one doctor / receptionist".

### Choices, explained slowly

Why does every choice have **two** words, like `('morning', 'Morning')`?

```python
GENDER_CHOICES = [
    ('male', 'Male'),
    ('female', 'Female'),
    ('other', 'Other'),
]
gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
```

| | Left: `'male'` | Right: `'Male'` |
|---|---|---|
| Name | the **value** | the **label** |
| Where it goes | **saved in the database** | **shown to people** |
| Who uses it | your Python code, the API JSON, `request.POST` | the admin dropdown, `get_gender_display` in templates |

- The **value** is for the computer. Keep it short, lowercase and never change it, because your code compares it: `if patient.gender == 'male':`.
- The **label** is for humans. You can change it any time (for example to `'Male (M)'` or Hindi) without touching the database.
- They are allowed to be the same, like `('A+', 'A+')` for blood groups.

**What you actually see in this project**

| Where | Shows | Example |
|---|---|---|
| `/admin/` dropdown | the **label** | You pick **Morning**, but `'morning'` is saved |
| Database row | the **value** | `shift = 'morning'` |
| API JSON (Postman) | the **value** | `"gender": "male"` |
| Sending JSON to the API | must be the **value** | `"gender": "Male"` gives 400 *"Male" is not a valid choice* |
| Template `{{ patient.gender }}` | the **value** | `male` |
| Template `{{ patient.get_gender_display }}` | the **label** | `Male` |

It's exactly like an HTML dropdown: `<option value="male">Male</option>`. The `value="male"` part is sent to the server, and the text `Male` is what the user sees.

### All field types used

| Field | Meaning |
|---|---|
| `CharField(max_length=100)` | Short text. `max_length` is required |
| `TextField()` | Long text with no limit (address, notes) |
| `IntegerField()` | Whole number (age, fee) |
| `EmailField()` | Text that must look like an email |
| `DateField()` / `TimeField()` | A date like `2030-01-15` / a time like `10:30` |
| `DateTimeField(auto_now_add=True)` | Filled in automatically when the row is created |
| `ForeignKey(Department, ...)` | **Many-to-one.** Many doctors belong to one department |
| `OneToOneField(User, ...)` | **One-to-one.** One user account belongs to exactly one doctor |

### All options used

- `choices=GENDER_CHOICES` gives a fixed list of allowed values (see *Choices, explained slowly* above).
- `default='scheduled'` means a new appointment is "scheduled" unless you say otherwise.
- `blank=True` means the field may be left empty in forms and in the API.
- `unique=True` means two departments cannot have the same name.
- `on_delete=models.CASCADE` means: delete the department, and its doctors are deleted too. Delete a patient, and their appointments are deleted too.
- `__str__` is the text Django shows for a row (in admin dropdowns, for example `Dr. Mehta`).

> [!IMPORTANT] Why separate Doctor and Receptionist tables instead of a custom User?
> Django already has a `User` table with username and password. We **don't** replace it (that would need `AbstractUser`, which is harder). Instead, each role gets its own simple table with a `user` link:
> - The user is in the `Doctor` table → they are a **doctor**.
> - The user is in the `Receptionist` table → they are a **receptionist**.
> - The user is a **superuser** → they are the **admin**. There's no Admin table because Django already marks superusers.
>
> This is easy to explain, and it's the same idea as the `Profile` model with a `role` field from your notes.

## 4. Make and run migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

**What it does**
- `makemigrations` reads `models.py` and writes a migration file (`hospitalapp/migrations/0001_initial.py`). It's a plan for creating the tables.
- `migrate` runs that plan on the database (`db.sqlite3`). It also creates Django's built-in tables (users, sessions, admin).
- **Every time you change `models.py`, run both commands again.**

## 5. admin.py

Open `hospitalapp/admin.py` and replace everything with:

```python title="hospitalapp/admin.py"
from django.contrib import admin
from .models import Department, Doctor, Receptionist, Patient, Appointment

admin.site.register(Department)
admin.site.register(Doctor)
admin.site.register(Receptionist)
admin.site.register(Patient)
admin.site.register(Appointment)
```

**What it does**
- `admin.site.register(Model)` adds that table to the admin panel at `/admin/`, with add, edit, delete and list pages for free.
- We use the admin panel to create departments, doctors and staff accounts quickly. Then we don't have to build pages for them.

## 6. Create the admin and some test data

Create the superuser. This account is the **Admin** role:

```bash
python manage.py createsuperuser
python manage.py runserver
```

**What it does**
- `createsuperuser` asks for a username, email (you can leave it empty) and password. A superuser can do everything.
- `runserver` starts the site at `http://127.0.0.1:8000/`. Keep this terminal running and open a second terminal for other commands.

Open `http://127.0.0.1:8000/admin/`, log in, and add this data **in this order** (later rows need earlier ones):

1. **Departments** → add `Cardiology` and `Orthopedics`.
2. **Users** (under Authentication) → add a user `drmehta` with password `Hospital@123`.
3. **Doctors** → add a doctor: User = `drmehta`, Name = `Mehta`, Department = Cardiology, Specialization = `Heart`, Phone = `9876543210`.
4. **Users** → add a user `drrao` with password `Hospital@123`.
5. **Doctors** → add a second doctor: User = `drrao`, Name = `Rao`, Department = Orthopedics, Specialization = `Bones`, Phone = `9876543211`.
6. **Users** → add a user `reception1` with password `Hospital@123`.
7. **Receptionists** → add one: User = `reception1`, Name = `Priya`, Phone = `9876543212`.
8. **Patients** → add one or two patients.

You now have one login for each role:

| Username | Password | Role |
|---|---|---|
| *(your superuser)* | *(your password)* | Admin |
| `reception1` | `Hospital@123` | Receptionist |
| `drmehta` | `Hospital@123` | Doctor (sees only Dr. Mehta's appointments) |
| `drrao` | `Hospital@123` | Doctor (sees only Dr. Rao's appointments) |

> [!TIP] Checkpoint
> If you can see all five tables in `/admin/` and add rows, **Part A is done**. You already have something to show.

## Part B — REST API

The API sends and receives **JSON** instead of HTML. Three pieces work together:

```flow
Serializer | converts a model object ↔ JSON and validates incoming data (like a ModelForm)
ViewSet | one class that does list, create, retrieve, update and delete
Router | builds all the URLs for a ViewSet automatically
```

## 7. serializers.py

Create a **new file** `hospitalapp/serializers.py`:

```python title="hospitalapp/serializers.py"
from datetime import date

from rest_framework import serializers
from .models import Department, Doctor, Patient, Appointment


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'description']


class DoctorSerializer(serializers.ModelSerializer):
    # Extra read-only field: shows "Cardiology" next to the department id
    department_name = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = Doctor
        fields = ['id', 'user', 'name', 'department', 'department_name',
                  'specialization', 'phone', 'email', 'fee']

    def validate_phone(self, value):
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError('Phone number must be exactly 10 digits.')
        return value

    def validate_fee(self, value):
        if value < 0:
            raise serializers.ValidationError('Fee cannot be negative.')
        return value


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ['id', 'name', 'age', 'gender', 'phone', 'blood_group', 'address', 'created_at']

    def validate_age(self, value):
        if value < 0 or value > 120:
            raise serializers.ValidationError('Age must be between 0 and 120.')
        return value

    def validate_phone(self, value):
        if not value.isdigit() or len(value) != 10:
            raise serializers.ValidationError('Phone number must be exactly 10 digits.')
        return value


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.name', read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'patient', 'patient_name', 'doctor', 'doctor_name',
                  'date', 'time', 'reason', 'status', 'notes', 'created_at']

    def validate_date(self, value):
        if value < date.today():
            raise serializers.ValidationError('Appointment date cannot be in the past.')
        return value

    def validate(self, data):
        # Cross-field check: the same doctor cannot have two appointments at the same date + time
        doctor = data.get('doctor')
        appointment_date = data.get('date')
        appointment_time = data.get('time')

        if doctor and appointment_date and appointment_time:
            booked = Appointment.objects.filter(
                doctor=doctor,
                date=appointment_date,
                time=appointment_time,
                status='scheduled',
            )
            if self.instance:
                # When updating, don't compare the appointment with itself
                booked = booked.exclude(id=self.instance.id)
            if booked.exists():
                raise serializers.ValidationError('This doctor already has an appointment at this date and time.')

        return data
```

### `class Meta`, explained slowly

Every serializer above has a small class **inside** it called `Meta`:

```python
class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = ['id', 'name', 'age']
```

`Meta` is just a **settings box** for the class around it. It doesn't make fields itself. It answers two questions for `ModelSerializer`:

| Line | Question it answers |
|---|---|
| `model = Patient` | "Which model should I copy the fields from?" |
| `fields = [...]` | "Which of those fields should I include in the JSON?" |
| `read_only_fields = [...]` *(optional)* | "Which fields can be shown but never sent by the client?" |

Without `Meta`, `ModelSerializer` doesn't know which table you mean, and Django raises an error. The name must be exactly `Meta`, with a capital M and indented **inside** the serializer class.

You have already seen the same idea in a `ModelForm`, which also uses `class Meta: model = ... fields = ...`. Models can have a `Meta` too (for example `class Meta: ordering = ['name']`). The idea is always the same: **`Meta` holds settings about the class, not data.**

**What it does**

- **`ModelSerializer`** builds the fields from the model for you, just like `ModelForm` does for forms. `Meta.model` says which model. `Meta.fields` lists which columns appear in the JSON.
- **Output (model → JSON).** A Patient object becomes:
  ```json
  {"id": 1, "name": "Amit", "age": 34, "gender": "male", "phone": "9123456789", "blood_group": "B+", "address": "", "created_at": "2030-01-10T09:12:00Z"}
  ```
- **Input (JSON → model).** When someone POSTs JSON, the serializer checks every field, runs your `validate_...` methods, then saves.
- **Foreign keys** like `department`, `patient` and `doctor` are sent and shown as **ids** (`"doctor": 1`).
- **`source='department.name'`** follows the foreign key and shows the department's name. `read_only=True` means it only appears in the output. Clients can't send it.
- **`created_at`** is filled in automatically by the model (`auto_now_add`), so DRF makes it read-only on its own.

**Validation methods**

| Method | When it runs | Example |
|---|---|---|
| `validate_phone(self, value)` | For one field. The name must be `validate_<fieldname>` | Phone must be 10 digits |
| `validate_age(self, value)` | For one field | Age between 0 and 120 |
| `validate_date(self, value)` | For one field | No appointments in the past |
| `validate(self, data)` | Once, with **all** fields together | Same doctor + same date + same time = double booking |

- To reject a value, `raise serializers.ValidationError('message')`. DRF then returns **400 Bad Request** with your message.
- To accept it, `return value` (or `return data` in `validate`).
- `self.instance` is the existing appointment when you **update** (PUT/PATCH) and `None` when you **create** (POST). That's why we exclude it, so an appointment doesn't clash with itself.
- `data.get('doctor')` is used instead of `data['doctor']` because a PATCH may send only some fields.

> [!NOTE] Why no Receptionist serializer?
> Receptionists are created by the admin in `/admin/`, so the API doesn't need them. Only make a serializer for something the API actually exposes.

## 8. permissions.py (roles)

Create a **new file** `hospitalapp/permissions.py`:

```python title="hospitalapp/permissions.py"
from rest_framework.permissions import BasePermission
from .models import Doctor, Receptionist


# ---------- Simple helper functions (also used by the web views in Part C) ----------

def is_admin(user):
    return user.is_superuser


def is_doctor(user):
    return Doctor.objects.filter(user=user).exists()


def is_receptionist(user):
    return Receptionist.objects.filter(user=user).exists()


def is_admin_or_receptionist(user):
    return is_admin(user) or is_receptionist(user)


# ---------- Permission classes for the API ----------

class IsAdminOrReadOnly(BasePermission):
    # Any logged-in user can READ. Only the admin can create, edit or delete.
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return is_admin(request.user)


class IsAdminOrReceptionistOrReadOnly(BasePermission):
    # Any logged-in user can READ. Only admin / receptionist can create, edit or delete.
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        return is_admin_or_receptionist(request.user)


class AppointmentPermission(BasePermission):
    # GET          -> any logged-in user
    # POST, DELETE -> admin or receptionist (book / remove)
    # PUT, PATCH   -> admin, receptionist or doctor (a doctor marks it completed)
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return True
        if request.method in ['POST', 'DELETE']:
            return is_admin_or_receptionist(request.user)
        return is_admin_or_receptionist(request.user) or is_doctor(request.user)
```

**What it does**

- **Helper functions** answer one question each, "is this user a doctor?", by checking the tables from Step 3. `.filter(...).exists()` returns `True` or `False`.
- **Permission classes** extend `BasePermission` and override `has_permission(self, request, view)`. DRF calls it **before** every request. Return `True` to allow the request or `False` to block it.
- `request.method` is `'GET'`, `'POST'`, `'PUT'`, `'PATCH'` or `'DELETE'`. `GET`, `HEAD` and `OPTIONS` only read data, so we call them "read-only".
- If you're not logged in, the API returns **401 Unauthorized**. If you're logged in but not allowed, it returns **403 Forbidden**.

| Class | Used on | Rule |
|---|---|---|
| `IsAdminOrReadOnly` | Departments, Doctors | Everyone reads, only admin writes |
| `IsAdminOrReceptionistOrReadOnly` | Patients | Everyone reads, front desk writes |
| `AppointmentPermission` | Appointments | Front desk books, doctor may update |

> [!NOTE] `has_permission` vs `has_object_permission`
> `has_permission` checks the **whole request** ("can this user POST to appointments at all?"). `has_object_permission` checks **one row** ("can this user edit appointment #5?"). We don't need the second one. A doctor can only edit their own appointments because the doctor can't even **see** anyone else's (see `get_queryset` in Step 9).

## 9. api_views.py (ViewSets)

We keep API views in their own file so they don't mix with the web views. Create a **new file** `hospitalapp/api_views.py`:

```python title="hospitalapp/api_views.py"
from rest_framework import viewsets

from .models import Department, Doctor, Patient, Appointment
from .serializers import DepartmentSerializer, DoctorSerializer, PatientSerializer, AppointmentSerializer
from .permissions import IsAdminOrReadOnly, IsAdminOrReceptionistOrReadOnly, AppointmentPermission, is_doctor


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all().order_by('name')
    serializer_class = DepartmentSerializer
    permission_classes = [IsAdminOrReadOnly]


class DoctorViewSet(viewsets.ModelViewSet):
    serializer_class = DoctorSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        doctors = Doctor.objects.all().order_by('name')

        # /api/doctors/?search=mehta
        search = self.request.query_params.get('search')
        if search:
            doctors = doctors.filter(name__icontains=search)

        # /api/doctors/?department=cardio
        department = self.request.query_params.get('department')
        if department:
            doctors = doctors.filter(department__name__icontains=department)

        return doctors


class PatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer
    permission_classes = [IsAdminOrReceptionistOrReadOnly]

    def get_queryset(self):
        patients = Patient.objects.all().order_by('-id')

        # /api/patients/?search=amit
        search = self.request.query_params.get('search')
        if search:
            patients = patients.filter(name__icontains=search)

        return patients


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer
    permission_classes = [AppointmentPermission]

    def get_queryset(self):
        user = self.request.user
        appointments = Appointment.objects.all().order_by('-date', '-time')

        # A doctor only sees their own appointments
        if is_doctor(user):
            appointments = appointments.filter(doctor__user=user)

        # /api/appointments/?status=scheduled
        status = self.request.query_params.get('status')
        if status:
            appointments = appointments.filter(status=status)

        return appointments
```

**What it does**

- **`ModelViewSet`** gives you 6 actions from one class, with no extra code:

| HTTP | URL | Action |
|---|---|---|
| GET | `/api/patients/` | `list` (all patients) |
| POST | `/api/patients/` | `create` |
| GET | `/api/patients/1/` | `retrieve` (one patient) |
| PUT | `/api/patients/1/` | `update` (send all fields) |
| PATCH | `/api/patients/1/` | `partial_update` (send only changed fields) |
| DELETE | `/api/patients/1/` | `destroy` |

- `serializer_class` says which serializer converts the data. `permission_classes` says which permission class from Step 8 to check.
- **`queryset = ...`** is a fixed list of rows. Departments use it because they never change per user.
- **`get_queryset(self)`** is a method you write when the rows depend on the request. DRF uses it for list, retrieve, update and delete.
  - `self.request.query_params.get('search')` reads `?search=...` from the URL. It returns `None` if it's missing.
  - `name__icontains=search` means "name contains this text, ignoring upper/lower case".
  - `department__name__icontains` goes through the foreign key: the doctor's department's name.
  - `doctor__user=user` means "appointments whose doctor is linked to this login user". That's how a doctor sees only their own rows. It also means a doctor gets **404** if they try to open someone else's appointment.
- `.order_by('-id')` sorts newest first. The `-` means descending.

## 10. Project urls.py (router + JWT URLs)

Open `hospitalproject/urls.py` and replace everything with:

```python title="hospitalproject/urls.py"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from hospitalapp.api_views import DepartmentViewSet, DoctorViewSet, PatientViewSet, AppointmentViewSet

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('doctors', DoctorViewSet, basename='doctor')
router.register('patients', PatientViewSet, basename='patient')
router.register('appointments', AppointmentViewSet, basename='appointment')

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT login
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # All API URLs made by the router
    path('api/', include(router.urls)),

    # Login / logout links on the browsable API pages
    path('api-auth/', include('rest_framework.urls')),
]
```

**What it does**

- `DefaultRouter()` makes a router. Each `router.register('patients', PatientViewSet, basename='patient')` line creates **both** URLs, `patients/` and `patients/<id>/`, for all 6 actions.
- `basename` is a prefix for the URL names (`patient-list`, `patient-detail`). It's **required** here because some viewsets use `get_queryset` instead of a `queryset` attribute.
- `path('api/', include(router.urls))` puts every router URL under `/api/`. `DefaultRouter` also makes a clickable index page at `/api/`.
- `TokenObtainPairView` is the **login** endpoint. POST a username and password, and you get two tokens back.
- `TokenRefreshView` takes a refresh token and gives back a new access token.
- `api-auth/` adds a **Log in** link to DRF's browser pages, so you can test in the browser without Postman.

## 11. Switch on JWT (the one extra setting)

Open `hospitalproject/settings.py` again and add this block **at the very end of the file**:

```python title="hospitalproject/settings.py — add at the end"
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

1. Open `http://127.0.0.1:8000/api/`. You'll see a list of all endpoints.
2. Click **Log in** (top right) and log in as `reception1`.
3. Open `/api/patients/`, scroll down, fill in the form and click **POST**. The new patient appears.
4. Open `/api/departments/` and try to POST. You get **403**, because only the admin can add departments.

### In Postman (with JWT)

**Step 1: log in and get tokens**

- Method `POST`, URL `http://127.0.0.1:8000/api/token/`
- Body → raw → JSON:

```json
{
    "username": "reception1",
    "password": "Hospital@123"
}
```

The response has two tokens:

```json
{
    "refresh": "eyJhbGciOiJIUzI1NiIs...",
    "access": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Step 2: use the access token.** In every other request, open the **Authorization** tab, choose **Bearer Token** and paste the `access` value. Postman then sends the header `Authorization: Bearer eyJhbGci...` for you.

**Step 3: try these requests**

| Login as | Request | Body (raw JSON) | Expected |
|---|---|---|---|
| reception1 | `GET /api/patients/` | | 200, list of patients |
| reception1 | `POST /api/patients/` | `{"name": "Amit", "age": 34, "gender": "male", "phone": "9123456789", "blood_group": "B+"}` | 201 Created |
| reception1 | `POST /api/patients/` | `{"name": "X", "age": 150, "gender": "male", "phone": "12ab"}` | 400, age and phone errors |
| reception1 | `POST /api/appointments/` | `{"patient": 1, "doctor": 1, "date": "2030-01-15", "time": "10:30", "reason": "Fever"}` | 201 Created |
| reception1 | same POST again | same body | 400, *already has an appointment* |
| reception1 | `POST /api/departments/` | `{"name": "Neurology"}` | 403 Forbidden |
| drmehta | `GET /api/appointments/` | | 200, only Dr. Mehta's appointments |
| drmehta | `PATCH /api/appointments/1/` | `{"status": "completed", "notes": "Paracetamol 3 days"}` | 200 |
| drmehta | `POST /api/patients/` | any | 403 Forbidden |
| admin | `POST /api/departments/` | `{"name": "Neurology"}` | 201 Created |
| *(no token)* | `GET /api/patients/` | | 401 Unauthorized |

**Step 4: when the access token expires** (after 5 minutes you get 401 *"Token is invalid or expired"*):

- `POST http://127.0.0.1:8000/api/token/refresh/` with body `{"refresh": "<your refresh token>"}`
- You get a new `access` token. Paste it into the Bearer Token box again.

> [!REMEMBER] Status codes to say in the interview
> **200** OK · **201** Created · **204** Deleted (No Content) · **400** validation error · **401** not logged in / bad token · **403** logged in but not allowed · **404** not found (or not yours)

> [!TIP] Checkpoint
> If Postman works for all three roles, **Part B is done**.

## Part C — Web pages (MVT)

Now the normal Django side: HTML pages, login with a form, and pages for patients and appointments. This is the same style as the Player app: `request.POST.get(...)`, `objects.create(...)`, `redirect(...)`.

## 13. views.py (web pages)

Open `hospitalapp/views.py` and replace everything with:

```python title="hospitalapp/views.py"
from datetime import date

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.decorators import login_required

from .models import Doctor, Patient, Appointment
from .permissions import is_doctor, is_admin_or_receptionist


# ---------------- Login / Logout ----------------

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
    todays_appointments = Appointment.objects.filter(date=date.today()).order_by('time')
    if is_doctor(request.user):
        todays_appointments = todays_appointments.filter(doctor__user=request.user)

    context = {
        'total_patients': Patient.objects.count(),
        'total_doctors': Doctor.objects.count(),
        'total_appointments': Appointment.objects.count(),
        'scheduled_count': Appointment.objects.filter(status='scheduled').count(),
        'todays_appointments': todays_appointments,
    }
    return render(request, 'dashboard.html', context)


# ---------------- Patients ----------------

@login_required(login_url='login')
def patient_list(request):
    search = request.GET.get('search', '')
    if search:
        patients = Patient.objects.filter(name__icontains=search).order_by('-id')
    else:
        patients = Patient.objects.all().order_by('-id')

    context = {
        'patients': patients,
        'search': search,
        'can_edit': is_admin_or_receptionist(request.user),
    }
    return render(request, 'patient_list.html', context)


@login_required(login_url='login')
def add_patient(request):
    if not is_admin_or_receptionist(request.user):
        return redirect('patient_list')

    if request.method == 'POST':
        Patient.objects.create(
            name=request.POST.get('name'),
            age=request.POST.get('age'),
            gender=request.POST.get('gender'),
            phone=request.POST.get('phone'),
            blood_group=request.POST.get('blood_group'),
            address=request.POST.get('address'),
        )
        return redirect('patient_list')

    return render(request, 'add_patient.html')


@login_required(login_url='login')
def edit_patient(request, id):
    if not is_admin_or_receptionist(request.user):
        return redirect('patient_list')

    patient = get_object_or_404(Patient, id=id)

    if request.method == 'POST':
        patient.name = request.POST.get('name')
        patient.age = request.POST.get('age')
        patient.gender = request.POST.get('gender')
        patient.phone = request.POST.get('phone')
        patient.blood_group = request.POST.get('blood_group')
        patient.address = request.POST.get('address')
        patient.save()
        return redirect('patient_list')

    return render(request, 'edit_patient.html', {'patient': patient})


@login_required(login_url='login')
def delete_patient(request, id):
    if not is_admin_or_receptionist(request.user):
        return redirect('patient_list')

    patient = get_object_or_404(Patient, id=id)
    if request.method == 'POST':
        patient.delete()
    return redirect('patient_list')


# ---------------- Appointments ----------------

@login_required(login_url='login')
def appointment_list(request):
    appointments = Appointment.objects.all().order_by('-date', '-time')

    # A doctor only sees their own appointments
    if is_doctor(request.user):
        appointments = appointments.filter(doctor__user=request.user)

    status = request.GET.get('status', '')
    if status:
        appointments = appointments.filter(status=status)

    context = {
        'appointments': appointments,
        'status': status,
        'can_edit': is_admin_or_receptionist(request.user),
    }
    return render(request, 'appointment_list.html', context)


@login_required(login_url='login')
def add_appointment(request):
    if not is_admin_or_receptionist(request.user):
        return redirect('appointment_list')

    error = ''

    if request.method == 'POST':
        patient_id = request.POST.get('patient')
        doctor_id = request.POST.get('doctor')
        appointment_date = request.POST.get('date')   # comes as text: '2030-01-15'
        appointment_time = request.POST.get('time')   # comes as text: '10:30'
        reason = request.POST.get('reason')

        already_booked = Appointment.objects.filter(
            doctor_id=doctor_id,
            date=appointment_date,
            time=appointment_time,
            status='scheduled',
        ).exists()

        if appointment_date < str(date.today()):
            error = 'You cannot book an appointment in the past.'
        elif already_booked:
            error = 'This doctor already has an appointment at this date and time.'
        else:
            Appointment.objects.create(
                patient_id=patient_id,
                doctor_id=doctor_id,
                date=appointment_date,
                time=appointment_time,
                reason=reason,
            )
            return redirect('appointment_list')

    context = {
        'patients': Patient.objects.all().order_by('name'),
        'doctors': Doctor.objects.all().order_by('name'),
        'error': error,
    }
    return render(request, 'add_appointment.html', context)


@login_required(login_url='login')
def complete_appointment(request, id):
    appointment = get_object_or_404(Appointment, id=id)

    # A doctor can only complete their own appointments
    if is_doctor(request.user) and appointment.doctor.user != request.user:
        return redirect('appointment_list')

    if request.method == 'POST':
        appointment.notes = request.POST.get('notes')
        appointment.status = 'completed'
        appointment.save()
        return redirect('appointment_list')

    return render(request, 'complete_appointment.html', {'appointment': appointment})


@login_required(login_url='login')
def cancel_appointment(request, id):
    if not is_admin_or_receptionist(request.user):
        return redirect('appointment_list')

    appointment = get_object_or_404(Appointment, id=id)
    if request.method == 'POST':
        appointment.status = 'cancelled'
        appointment.save()
    return redirect('appointment_list')
```

**What each part does**

**Login and logout** (same as your Authentication notes)
- `AuthenticationForm` is Django's ready-made login form. It has username and password fields and checks the password for you.
- `form.is_valid()` is `True` only if the username and password are correct. Then `login(request, user)` saves the user in the session (a cookie), so every later page knows who you are.
- `logout(request)` clears the session.

**`@login_required(login_url='login')`**
- Put it above a view to protect it. If nobody is logged in, Django redirects to the URL named `'login'` instead of showing the page.

**dashboard**
- `.count()` returns how many rows there are, for the summary numbers.
- `filter(date=date.today())` returns only today's appointments. A doctor sees only theirs.
- `context` is a dictionary. Every key becomes a variable you can use in the template, like `{{ total_patients }}`.

**patient_list**
- `request.GET.get('search', '')` reads `?search=...` from the URL (from the search box). The `''` is the default when it's missing.
- `can_edit` is `True` for admin and receptionist. The template uses it to hide the Add, Edit and Delete buttons from doctors.

**add_patient / edit_patient**
- The first `if` blocks doctors: they are sent back to the list.
- A **GET** request just shows the empty form (add) or the filled form (edit).
- A **POST** request (form submitted) reads each input with `request.POST.get('<input name>')`, saves, then redirects to the list.
- `Patient.objects.create(...)` makes and saves a new row in one step. For edit, we change the fields of the existing object and call `.save()`.
- `get_object_or_404(Patient, id=id)` returns the patient, or shows a 404 page if that id doesn't exist.

**delete_patient / cancel_appointment**
- They only delete or cancel on **POST** (a button inside a form with `{% csrf_token %}`). Then a random link or a page refresh can't delete data by accident.

**add_appointment**
- `patient_id=` and `doctor_id=` save the foreign key using the id number that came from the dropdown.
- The **double-booking check** is the same rule as the serializer's `validate()`, but written by hand: look for an existing scheduled appointment with the same doctor, date and time.
- `appointment_date < str(date.today())` works because dates in `YYYY-MM-DD` text form sort correctly as text.
- If something is wrong, we put the message in `error` and show the form again. Nothing is saved.

**complete_appointment**
- GET shows a page with a notes box. POST saves the notes and sets `status` to `'completed'`.
- `appointment.doctor.user != request.user` stops Dr. Mehta from completing Dr. Rao's appointments.

## 14. hospitalapp/urls.py (web URLs)

Create a **new file** `hospitalapp/urls.py`:

```python title="hospitalapp/urls.py"
from django.urls import path
from . import views

urlpatterns = [
    path('', views.dashboard, name='dashboard'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('patients/', views.patient_list, name='patient_list'),
    path('patients/add/', views.add_patient, name='add_patient'),
    path('patients/edit/<int:id>/', views.edit_patient, name='edit_patient'),
    path('patients/delete/<int:id>/', views.delete_patient, name='delete_patient'),

    path('appointments/', views.appointment_list, name='appointment_list'),
    path('appointments/add/', views.add_appointment, name='add_appointment'),
    path('appointments/complete/<int:id>/', views.complete_appointment, name='complete_appointment'),
    path('appointments/cancel/<int:id>/', views.cancel_appointment, name='cancel_appointment'),
]
```

**What it does**
- Each `path('url/', view_function, name='...')` connects a URL to a view.
- `<int:id>` takes the number from the URL, for example `/patients/edit/3/`, and passes it to the view as `id=3`.
- `name='patient_list'` lets you write `redirect('patient_list')` in views and `{% url 'patient_list' %}` in templates, instead of typing the path by hand.

## 15. Final project urls.py

Open `hospitalproject/urls.py` again and replace everything. It's the same as Step 10 with **one new line** at the bottom:

```python title="hospitalproject/urls.py"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from hospitalapp.api_views import DepartmentViewSet, DoctorViewSet, PatientViewSet, AppointmentViewSet

router = DefaultRouter()
router.register('departments', DepartmentViewSet, basename='department')
router.register('doctors', DoctorViewSet, basename='doctor')
router.register('patients', PatientViewSet, basename='patient')
router.register('appointments', AppointmentViewSet, basename='appointment')

urlpatterns = [
    path('admin/', admin.site.urls),

    # JWT login
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # All API URLs made by the router
    path('api/', include(router.urls)),

    # Login / logout links on the browsable API pages
    path('api-auth/', include('rest_framework.urls')),

    # Web pages (Part C)
    path('', include('hospitalapp.urls')),   # <--- ADDED
]
```

**What it does**
- `path('', include('hospitalapp.urls'))` hands every other URL (`/`, `/login/`, `/patients/`...) to the app's `urls.py` from Step 14.
- It goes **last**, so `/admin/` and `/api/` are matched first.

## 16. Templates

All HTML files go in the `templates/` folder next to `manage.py` (the folder from Step 1). Every page **extends** one base page, so the menu and styles are written only once.

### base.html

```html title="templates/base.html"
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hospital Management</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; background: #f4f6f8; }
        nav { background: #1f6feb; padding: 14px 20px; }
        nav a { color: white; margin-right: 16px; text-decoration: none; font-weight: bold; }
        .container { max-width: 1000px; margin: 20px auto; background: white; padding: 20px; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f0f0f0; }
        input, select, textarea { width: 100%; padding: 8px; margin: 4px 0 12px; box-sizing: border-box; }
        button { padding: 8px 16px; background: #1f6feb; color: white; border: none; border-radius: 4px; cursor: pointer; }
        .danger { background: #d73a49; }
        .error { color: #d73a49; font-weight: bold; }
        .inline { display: inline; }
        .box { display: inline-block; width: 200px; padding: 15px; margin: 5px; background: #eef4ff; border-radius: 8px; }
        .box h2 { margin: 0; }
    </style>
</head>
<body>
    <nav>
        {% if user.is_authenticated %}
            <a href="{% url 'dashboard' %}">Dashboard</a>
            <a href="{% url 'patient_list' %}">Patients</a>
            <a href="{% url 'appointment_list' %}">Appointments</a>
            {% if user.is_superuser %}
                <a href="/admin/">Admin Panel</a>
            {% endif %}
            <a href="{% url 'logout' %}">Logout ({{ user.username }})</a>
        {% else %}
            <a href="{% url 'login' %}">Login</a>
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
- `user` is always available in templates. `user.is_authenticated` hides the menu links when nobody is logged in. `user.is_superuser` shows the Admin Panel link only to the admin.
- `{% url 'dashboard' %}` turns a URL **name** from Step 14 into the real path (`/`).
- The `<style>` block is plain CSS so the pages don't look bare. You can skip it in a hurry.

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
{% endblock %}
```

**What it does**
- `{% extends 'base.html' %}` means "use base.html and put my `content` block into its slot".
- `{{ form.as_p }}` prints the `AuthenticationForm` from the view: username and password inputs, plus an error if the login is wrong.
- `{% csrf_token %}` is **required in every POST form**. It adds a hidden security code. Without it Django returns **403 CSRF verification failed**.

### dashboard.html

```html title="templates/dashboard.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Dashboard</h2>
    <p>Welcome, {{ user.username }}</p>

    <div class="box"><p>Patients</p><h2>{{ total_patients }}</h2></div>
    <div class="box"><p>Doctors</p><h2>{{ total_doctors }}</h2></div>
    <div class="box"><p>All appointments</p><h2>{{ total_appointments }}</h2></div>
    <div class="box"><p>Scheduled</p><h2>{{ scheduled_count }}</h2></div>

    <h3>Today's appointments</h3>
    {% if todays_appointments %}
        <table>
            <tr>
                <th>Time</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Reason</th>
                <th>Status</th>
            </tr>
            {% for appointment in todays_appointments %}
            <tr>
                <td>{{ appointment.time }}</td>
                <td>{{ appointment.patient.name }}</td>
                <td>Dr. {{ appointment.doctor.name }}</td>
                <td>{{ appointment.reason }}</td>
                <td>{{ appointment.get_status_display }}</td>
            </tr>
            {% endfor %}
        </table>
    {% else %}
        <p>No appointments today.</p>
    {% endif %}
{% endblock %}
```

**What it does**
- `{{ total_patients }}` prints the values from the view's `context` dictionary.
- `{% for appointment in todays_appointments %}` loops over the rows.
- `appointment.patient.name` follows the foreign key to the patient and prints the name.
- `get_status_display` prints the **label** of a choice ("Scheduled") instead of the stored value ("scheduled"). Django creates `get_<field>_display` for every field with `choices`.

### patient_list.html

```html title="templates/patient_list.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Patients</h2>

    <form method="GET" action="{% url 'patient_list' %}">
        <input type="text" name="search" value="{{ search }}" placeholder="Search by name">
        <button type="submit">Search</button>
    </form>

    {% if can_edit %}
        <p><a href="{% url 'add_patient' %}">+ Add New Patient</a></p>
    {% endif %}

    {% if patients %}
        <table>
            <tr>
                <th>Name</th>
                <th>Age</th>
                <th>Gender</th>
                <th>Phone</th>
                <th>Blood Group</th>
                {% if can_edit %}<th>Actions</th>{% endif %}
            </tr>
            {% for patient in patients %}
            <tr>
                <td>{{ patient.name }}</td>
                <td>{{ patient.age }}</td>
                <td>{{ patient.get_gender_display }}</td>
                <td>{{ patient.phone }}</td>
                <td>{{ patient.blood_group }}</td>
                {% if can_edit %}
                <td>
                    <a href="{% url 'edit_patient' patient.id %}">Edit</a>
                    <form method="POST" action="{% url 'delete_patient' patient.id %}" class="inline"
                          onsubmit="return confirm('Delete this patient?')">
                        {% csrf_token %}
                        <button type="submit" class="danger">Delete</button>
                    </form>
                </td>
                {% endif %}
            </tr>
            {% endfor %}
        </table>
    {% else %}
        <p>No patients found.</p>
    {% endif %}
{% endblock %}
```

**What it does**
- The search form uses **GET**, so the search text ends up in the URL (`/patients/?search=amit`). The view reads it with `request.GET.get('search')`.
- `value="{{ search }}"` keeps the typed text in the box after searching.
- `{% if can_edit %}` hides the Add, Edit and Delete buttons from doctors.
- `{% url 'edit_patient' patient.id %}` builds `/patients/edit/3/`. The second value fills the `<int:id>` part.
- Delete is a small **POST form** with `{% csrf_token %}`. `confirm(...)` shows a browser "Are you sure?" popup first.

### add_patient.html

```html title="templates/add_patient.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Add Patient</h2>
    <form method="POST">
        {% csrf_token %}

        <label>Name</label>
        <input type="text" name="name" required>

        <label>Age</label>
        <input type="number" name="age" min="0" max="120" required>

        <label>Gender</label>
        <select name="gender" required>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
        </select>

        <label>Phone</label>
        <input type="text" name="phone" maxlength="10" required>

        <label>Blood Group</label>
        <select name="blood_group">
            <option value="">-- Not known --</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
        </select>

        <label>Address</label>
        <textarea name="address" rows="3"></textarea>

        <button type="submit">Save Patient</button>
    </form>
{% endblock %}
```

**What it does**
- Every input has a `name` that **matches** `request.POST.get('name')`, `request.POST.get('age')` and so on in the view. If the names don't match, the view gets `None`.
- `<option value="male">` must use the **value** from `GENDER_CHOICES` in the model (`'male'`, not `'Male'`).
- `required`, `min`, `max` and `maxlength` are browser checks, so the user can't submit an empty name or an age of 500.
- `method="POST"` with no `action` sends the form back to the same URL, `/patients/add/`.

### edit_patient.html

```html title="templates/edit_patient.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Edit Patient</h2>
    <form method="POST">
        {% csrf_token %}

        <label>Name</label>
        <input type="text" name="name" value="{{ patient.name }}" required>

        <label>Age</label>
        <input type="number" name="age" value="{{ patient.age }}" min="0" max="120" required>

        <label>Gender</label>
        <select name="gender" required>
            <option value="male" {% if patient.gender == 'male' %}selected{% endif %}>Male</option>
            <option value="female" {% if patient.gender == 'female' %}selected{% endif %}>Female</option>
            <option value="other" {% if patient.gender == 'other' %}selected{% endif %}>Other</option>
        </select>

        <label>Phone</label>
        <input type="text" name="phone" value="{{ patient.phone }}" maxlength="10" required>

        <label>Blood Group</label>
        <select name="blood_group">
            <option value="">-- Not known --</option>
            <option value="A+" {% if patient.blood_group == 'A+' %}selected{% endif %}>A+</option>
            <option value="A-" {% if patient.blood_group == 'A-' %}selected{% endif %}>A-</option>
            <option value="B+" {% if patient.blood_group == 'B+' %}selected{% endif %}>B+</option>
            <option value="B-" {% if patient.blood_group == 'B-' %}selected{% endif %}>B-</option>
            <option value="O+" {% if patient.blood_group == 'O+' %}selected{% endif %}>O+</option>
            <option value="O-" {% if patient.blood_group == 'O-' %}selected{% endif %}>O-</option>
            <option value="AB+" {% if patient.blood_group == 'AB+' %}selected{% endif %}>AB+</option>
            <option value="AB-" {% if patient.blood_group == 'AB-' %}selected{% endif %}>AB-</option>
        </select>

        <label>Address</label>
        <textarea name="address" rows="3">{{ patient.address }}</textarea>

        <button type="submit">Update Patient</button>
    </form>
{% endblock %}
```

**What it does**
- It's the same form as Add, but every input starts **filled in** with the current values (`value="{{ patient.name }}"`).
- `{% if patient.gender == 'male' %}selected{% endif %}` pre-selects the saved option in the dropdown.
- A `<textarea>` has no `value` attribute. The text goes **between** the tags.

### appointment_list.html

```html title="templates/appointment_list.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Appointments</h2>

    <p>
        Filter:
        <a href="{% url 'appointment_list' %}">All</a> |
        <a href="?status=scheduled">Scheduled</a> |
        <a href="?status=completed">Completed</a> |
        <a href="?status=cancelled">Cancelled</a>
    </p>

    {% if can_edit %}
        <p><a href="{% url 'add_appointment' %}">+ Book Appointment</a></p>
    {% endif %}

    {% if appointments %}
        <table>
            <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Actions</th>
            </tr>
            {% for appointment in appointments %}
            <tr>
                <td>{{ appointment.date }}</td>
                <td>{{ appointment.time }}</td>
                <td>{{ appointment.patient.name }}</td>
                <td>Dr. {{ appointment.doctor.name }}</td>
                <td>{{ appointment.reason }}</td>
                <td>{{ appointment.get_status_display }}</td>
                <td>{{ appointment.notes }}</td>
                <td>
                    {% if appointment.status == 'scheduled' %}
                        <a href="{% url 'complete_appointment' appointment.id %}">Complete</a>
                        {% if can_edit %}
                            <form method="POST" action="{% url 'cancel_appointment' appointment.id %}" class="inline"
                                  onsubmit="return confirm('Cancel this appointment?')">
                                {% csrf_token %}
                                <button type="submit" class="danger">Cancel</button>
                            </form>
                        {% endif %}
                    {% endif %}
                </td>
            </tr>
            {% endfor %}
        </table>
    {% else %}
        <p>No appointments found.</p>
    {% endif %}
{% endblock %}
```

**What it does**
- The filter links add `?status=...` to the URL. The view reads it with `request.GET.get('status')`.
- The **Complete** and **Cancel** actions only show while the appointment is still `scheduled`.
- **Cancel** is a POST form (it changes data). **Complete** is a normal link because it opens a page with a notes box first.

### add_appointment.html

```html title="templates/add_appointment.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Book Appointment</h2>

    {% if error %}
        <p class="error">{{ error }}</p>
    {% endif %}

    <form method="POST">
        {% csrf_token %}

        <label>Patient</label>
        <select name="patient" required>
            {% for patient in patients %}
                <option value="{{ patient.id }}">{{ patient.name }} ({{ patient.phone }})</option>
            {% endfor %}
        </select>

        <label>Doctor</label>
        <select name="doctor" required>
            {% for doctor in doctors %}
                <option value="{{ doctor.id }}">Dr. {{ doctor.name }} - {{ doctor.specialization }} (Rs. {{ doctor.fee }})</option>
            {% endfor %}
        </select>

        <label>Date</label>
        <input type="date" name="date" required>

        <label>Time</label>
        <input type="time" name="time" required>

        <label>Reason</label>
        <input type="text" name="reason" required>

        <button type="submit">Book</button>
    </form>
{% endblock %}
```

**What it does**
- The dropdowns are built with a `{% for %}` loop over the `patients` and `doctors` the view sent.
- `value="{{ patient.id }}"` means the form sends the **id**. The view saves it with `patient_id=...`.
- `type="date"` and `type="time"` show a date picker and a time picker. They send text like `2030-01-15` and `10:30`.
- `{% if error %}` shows the double-booking or past-date message from the view.

### complete_appointment.html

```html title="templates/complete_appointment.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Complete Appointment</h2>

    <p><b>Patient:</b> {{ appointment.patient.name }} ({{ appointment.patient.age }} yrs, {{ appointment.patient.get_gender_display }})</p>
    <p><b>Doctor:</b> Dr. {{ appointment.doctor.name }}</p>
    <p><b>Date:</b> {{ appointment.date }} at {{ appointment.time }}</p>
    <p><b>Reason:</b> {{ appointment.reason }}</p>

    <form method="POST">
        {% csrf_token %}
        <label>Diagnosis / medicines / advice</label>
        <textarea name="notes" rows="5" required>{{ appointment.notes }}</textarea>
        <button type="submit">Mark as Completed</button>
    </form>
{% endblock %}
```

**What it does**
- Shows the appointment details, then a notes box.
- Submitting sends POST to the same URL. The view saves `notes` and sets the status to `completed`.

## 17. Run and check everything

```bash
python manage.py runserver
```

Open `http://127.0.0.1:8000/` and go through this checklist:

1. You're sent to `/login/` because the dashboard has `@login_required`.
2. Log in as `reception1`. You see the dashboard with the counts.
3. **Patients** → add a patient, search for them, edit them, then delete.
4. **Appointments** → book one for Dr. Mehta. Book the **same** doctor, date and time again, and you see the red double-booking error.
5. Log out and log in as `drmehta`. **Appointments** shows only Dr. Mehta's. Click **Complete**, write notes and save.
6. As `drmehta`, the Patients page has **no** Add, Edit or Delete buttons.
7. Log in as the admin. The **Admin Panel** link appears in the menu.

> [!TIP] Done
> You now have models, admin, a JWT-protected REST API with three roles, and web pages with login. That's a complete hospital management system.

## 18. Explain it in the interview

**"Walk me through what happens when Postman books an appointment."**

```flow
POST /api/appointments/ | Postman sends JSON + Authorization: Bearer <token>
urls.py | the router sends it to AppointmentViewSet → create
JWTAuthentication | reads the token, sets request.user = reception1
AppointmentPermission | POST + receptionist → allowed (else 403)
AppointmentSerializer | validate_date, then validate() checks double booking (else 400)
serializer.save() | the new row is inserted into the Appointment table
Response | 201 Created + the appointment as JSON
```

**Questions you may get**

| Question | Short answer |
|---|---|
| What is `class Meta`? | A settings box inside the serializer: `model` says which model to copy fields from, `fields` says which to include. |
| What is a serializer? | It converts model objects to JSON and back, and validates input. It's like a ModelForm for APIs. |
| `Serializer` vs `ModelSerializer`? | `Serializer`: you write every field yourself. `ModelSerializer`: fields come from the model automatically. |
| `validate_<field>` vs `validate`? | `validate_<field>` checks one field. `validate` checks several fields together (doctor + date + time). |
| What does `ModelViewSet` give you? | list, create, retrieve, update, partial_update and destroy in one class. |
| What does the router do? | It makes the URLs for a viewset automatically: `/patients/` and `/patients/<id>/`. |
| `queryset` vs `get_queryset()`? | `queryset` is fixed. `get_queryset()` can change per request, for example a doctor sees only their own rows. |
| What is JWT? | A signed token given at login. The client sends it in the `Authorization: Bearer` header on every request, so the server needs no session. |
| Access vs refresh token? | Access is short-lived and used on every request. Refresh is longer-lived and only used to get a new access token. |
| 401 vs 403? | 401 = not logged in or bad token. 403 = logged in but not allowed. |
| How do you do roles? | Separate `Doctor` and `Receptionist` tables linked to `User`, plus custom `BasePermission` classes that check those tables. |
| Why `{% csrf_token %}`? | It stops other websites from submitting forms as you. Django rejects POST forms without it. |
| ForeignKey vs OneToOneField? | ForeignKey = many-to-one (many appointments → one doctor). OneToOne = exactly one each (one user ↔ one doctor). |
| What does `on_delete=models.CASCADE` mean? | When the linked row is deleted, delete this row too. Delete a patient, and their appointments go too. |
| Why two words in choices, `('male', 'Male')`? | The first is saved in the database and used in code. The second is the label people see. |

## 19. Common errors and fixes

| Error | Cause | Fix |
|---|---|---|
| `No module named 'rest_framework_simplejwt'` | Package not installed, or the venv isn't active | Activate the venv, then `pip install djangorestframework-simplejwt` |
| `no such table: hospitalapp_patient` | Migrations not run | `python manage.py makemigrations` then `python manage.py migrate` |
| `TemplateDoesNotExist: dashboard.html` | `DIRS` not set, or the file is in the wrong folder | Check Step 2, and keep `templates/` next to `manage.py` |
| `NoReverseMatch: Reverse for 'patient_list' not found` | URL name typo, or app URLs not included | Check `name=` in Step 14 and the last line of Step 15 |
| `CSRF verification failed` (403) | A POST form without `{% csrf_token %}` | Add `{% csrf_token %}` inside the `<form>` |
| Postman: *Authentication credentials were not provided* | No token, or the `REST_FRAMEWORK` block is missing | Use Bearer Token in Postman, and check Step 11 |
| Postman: *Token is invalid or expired* | The access token is older than 5 minutes | Call `/api/token/refresh/` or log in again |
| `basename` argument not specified | A viewset has `get_queryset` but no `queryset` | Add `basename='...'` to `router.register` |
| Doctor gets 404 for an appointment | That appointment belongs to another doctor | This is correct, because `get_queryset` hides it |
| `Invalid pk "5" - object does not exist.` | You sent a `patient` or `doctor` id that isn't in the database | `GET /api/patients/` first and use a real id |
