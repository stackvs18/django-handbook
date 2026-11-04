You will build a **Hospital Management System** step by step, the same way you built the Player project in class:

**project → app → settings → models → migrations → admin → serializers → viewsets → router → JWT → Postman → web pages**

Every file is shown **in full**. Click **Copy**, paste it into VS Code, save. After every block there is a short note on **what the code does** and **how it is used**, so you can explain it to the interviewer.

> [!TIP] How to use this page in a practical test
> Go top to bottom. Every step ends with something you can run.
> - **Part A (Steps 1–6):** project, models, admin. You can already add data in `/admin/`.
> - **Part B (Steps 7–11):** REST API with serializers, viewsets, router and JWT. Test it in Postman.
> - **Part C (Steps 12–17):** normal Django web pages (MVT) with ModelForms, login, patients and appointments.
>
> If the test only asks for an API, stop after Part B. If it only asks for web pages, do Part A and then Part C.

> [!NOTE] Can't remember an import?
> Every import line used here is explained, file by file, on the [Import cheat sheet](/imports), along with simple rules to rebuild any import you forget.

> [!NOTE] Where the idea comes from
> Open-source hospital apps (for example [hamzaezzine/Hospital-Management](https://github.com/hamzaezzine/Hospital-Management)) have doctors linked to user accounts, departments, patients and appointments with a status. We kept only those basic ideas and wrote everything in the simple style from class: plain `models.Model`, choices written by hand, function-based web views and `ModelViewSet` for the API.

## 0. What we're building

**Who uses the system**

Every page and API needs a **login**. After that, everyone can do everything, with **one rule**: a doctor only sees their own appointments.

| User | How we know | Sees |
|---|---|---|
| **Admin** | Django superuser (`createsuperuser`) | Everything, plus the admin panel |
| **Receptionist** | Their user is linked to a row in the `Receptionist` table | All patients and appointments |
| **Doctor** | Their user is linked to a row in the `Doctor` table | **Only their own** appointments |

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
| GET / POST | `/api/patients/` | List / create patients |
| GET / POST | `/api/appointments/` | List / book appointments (a doctor sees only theirs) |
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
    ├── api_views.py          ← new (Part B)
    ├── forms.py              ← new (Part C)
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
> You don't need a block of extra settings for pagination, filters, time zone or login URLs. The defaults are fine. There is **one** small extra block you do need, and it comes in **Step 10** when we switch on JWT. That step explains why.

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
Serializer | converts a model object ↔ JSON and checks incoming data (like a ModelForm)
ViewSet | one class that does list, create, read, update and delete
Router | builds all the URLs for a ViewSet automatically
```

## 7. serializers.py

Create a **new file** `hospitalapp/serializers.py`:

```python title="hospitalapp/serializers.py"
from rest_framework import serializers
from .models import Department, Doctor, Patient, Appointment


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = '__all__'


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = '__all__'


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = '__all__'


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = '__all__'

    def validate(self, data):
        # Only check when booking a NEW appointment (POST), not when updating one
        if not self.instance:
            already_booked = Appointment.objects.filter(
                doctor=data['doctor'],
                date=data['date'],
                time=data['time'],
                status='scheduled',
            ).exists()
            if already_booked:
                raise serializers.ValidationError('This doctor already has an appointment at this time.')
        return data
```

**In one line:** a serializer turns a model row into JSON, and checks JSON before saving it. It's a `ModelForm` for APIs.

- **`class Meta`** is a settings box, the same as in a `ModelForm`. `model` says which table. `fields = '__all__'` means "every column".
- Foreign keys (`doctor`, `patient`, `department`) are sent and shown as **ids**, e.g. `"doctor": 1`.
- **`validate(self, data)`** is the hospital's one rule: the same doctor can't be booked twice at the same date and time. `raise serializers.ValidationError(...)` sends back **400**.
- `self.instance` is empty on POST and holds the appointment on PUT/PATCH. So a doctor marking an appointment completed isn't blocked by the check.

## 8. api_views.py (ViewSets)

We keep API views in their own file so they don't mix with the web views. Create a **new file** `hospitalapp/api_views.py`:

```python title="hospitalapp/api_views.py"
from rest_framework import viewsets
from .models import Department, Doctor, Patient, Appointment
from .serializers import DepartmentSerializer, DoctorSerializer, PatientSerializer, AppointmentSerializer


class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointment.objects.all()
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        # A doctor sees only their own appointments. Everyone else sees all of them.
        if hasattr(self.request.user, 'doctor'):
            return Appointment.objects.filter(doctor__user=self.request.user)
        return Appointment.objects.all()
```

**In one line:** each `ModelViewSet` gives list, create, read, update and delete for one table, from just two lines:

- `queryset` → which rows. `serializer_class` → which serializer from Step 7.

| HTTP | URL | Does |
|---|---|---|
| GET / POST | `/api/patients/` | list all / create one |
| GET / PUT / PATCH / DELETE | `/api/patients/1/` | read / update / update some fields / delete |

**`get_queryset`** changes the rows per user:
- `Doctor` has `user = OneToOneField(User)`, so Django gives every user a `user.doctor`. `hasattr(user, 'doctor')` is `True` only for doctors.
- `doctor__user=self.request.user` means "appointments whose doctor is this login user". Another doctor's appointment gives **404**.

> [!NOTE] What about permissions?
> We don't write a `permissions.py`. One setting in Step 10 makes the whole API **login only**. Any logged-in user can use every endpoint, and the only role rule is that a doctor sees just their own appointments.

## 9. Project urls.py (router + JWT URLs)

Open `hospitalproject/urls.py` and replace everything with:

```python title="hospitalproject/urls.py"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from hospitalapp import api_views

router = DefaultRouter()
router.register('departments', api_views.DepartmentViewSet)
router.register('doctors', api_views.DoctorViewSet)
router.register('patients', api_views.PatientViewSet)
router.register('appointments', api_views.AppointmentViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view()),           # JWT login
    path('api/token/refresh/', TokenRefreshView.as_view()),      # new access token
    path('api/', include(router.urls)),                          # all ViewSet URLs
    path('api-auth/', include('rest_framework.urls')),           # Log in link on browser API pages
]
```

**In one line:** the router writes the API URLs for you.

- Each `router.register('patients', api_views.PatientViewSet)` makes `/api/patients/` and `/api/patients/<id>/`.
- `from hospitalapp import api_views` imports the whole file, so we write `api_views.PatientViewSet`.
- `api/token/` is the **login** (username + password → tokens). `api/token/refresh/` gives a new access token.

## 10. Switch on JWT and "login only" (the one extra setting)

Open `hospitalproject/settings.py` again and add this block **at the very end of the file**:

```python title="hospitalproject/settings.py — add at the end"
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

1. Open `http://127.0.0.1:8000/api/`. You'll see a list of all endpoints.
2. Click **Log in** (top right) and log in as `reception1`.
3. Open `/api/patients/`, fill in the form at the bottom and click **POST**. The new patient appears.

### In Postman (with JWT)

**Step 1: log in.** `POST http://127.0.0.1:8000/api/token/`, Body → raw → JSON:

```json
{
    "username": "reception1",
    "password": "Hospital@123"
}
```

You get back `"refresh"` and `"access"` tokens.

**Step 2: use the token.** In every other request: **Authorization** tab → **Bearer Token** → paste the `access` value.

**Step 3: try these requests**

| Login as | Request | Body (raw JSON) | Expected |
|---|---|---|---|
| reception1 | `GET /api/patients/` | | 200, list of patients |
| reception1 | `POST /api/patients/` | `{"name": "Amit", "age": 34, "gender": "male", "phone": "9123456789", "blood_group": "B+"}` | 201 Created |
| reception1 | `POST /api/appointments/` | `{"patient": 1, "doctor": 1, "date": "2030-01-15", "time": "10:30", "reason": "Fever"}` | 201 Created |
| reception1 | same POST again | same body | 400, *already has an appointment* |
| drmehta | `GET /api/appointments/` | | 200, only Dr. Mehta's appointments |
| drmehta | `PATCH /api/appointments/1/` | `{"status": "completed", "notes": "Paracetamol 3 days"}` | 200 |
| any | `DELETE /api/patients/1/` | | 204 Deleted |
| *(no token)* | `GET /api/patients/` | | 401 Unauthorized |

**Step 4: token expired?** (401 *"Token is invalid or expired"* after 5 minutes) `POST /api/token/refresh/` with `{"refresh": "<your refresh token>"}` and paste the new `access` token.

> [!REMEMBER] Status codes to say in the interview
> **200** OK · **201** Created · **204** Deleted (No Content) · **400** validation error · **401** not logged in / bad token · **404** not found (or not yours)

> [!TIP] Checkpoint
> If Postman works for reception1 and drmehta, **Part B is done**.

## Part C — Web pages (MVT)

Now the normal Django side: HTML pages with login, patients and appointments. We use **ModelForms**, so Django builds the HTML inputs and checks them for us. One `form.html` template is shared by every form page.

## 12. forms.py

Create a **new file** `hospitalapp/forms.py`:

```python title="hospitalapp/forms.py"
from django import forms
from .models import Patient, Appointment


class PatientForm(forms.ModelForm):
    class Meta:
        model = Patient
        fields = '__all__'


class AppointmentForm(forms.ModelForm):
    class Meta:
        model = Appointment
        fields = ['patient', 'doctor', 'date', 'time', 'reason']
        widgets = {
            'date': forms.DateInput(attrs={'type': 'date'}),   # date picker
            'time': forms.TimeInput(attrs={'type': 'time'}),   # time picker
        }

    def clean(self):
        data = super().clean()
        already_booked = Appointment.objects.filter(
            doctor=data.get('doctor'),
            date=data.get('date'),
            time=data.get('time'),
            status='scheduled',
        ).exists()
        if already_booked:
            raise forms.ValidationError('This doctor already has an appointment at this time.')
        return data
```

**In one line:** a `ModelForm` is the web-page twin of a `ModelSerializer`: same `class Meta`, but it makes HTML inputs instead of JSON.

- `PatientForm` uses `'__all__'`. `created_at` is filled in automatically, so Django leaves it out of the form by itself.
- `AppointmentForm` lists only the fields the receptionist types. `status` and `notes` keep their defaults.
- `widgets` turn the date and time boxes into pickers.
- `clean()` is the same double-booking rule as the serializer's `validate()`. `super().clean()` gives the checked data. We use `.get()` because a field with an error is missing from it.

## 13. views.py (web pages)

Open `hospitalapp/views.py` and replace everything with:

```python title="hospitalapp/views.py"
from datetime import date

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm
from django.contrib.auth.decorators import login_required

from .models import Doctor, Patient, Appointment
from .forms import PatientForm, AppointmentForm


# ---------------- Login / Logout ----------------

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
    context = {
        'total_patients': Patient.objects.count(),
        'total_doctors': Doctor.objects.count(),
        'todays_appointments': Appointment.objects.filter(date=date.today()),
    }
    return render(request, 'dashboard.html', context)


# ---------------- Patients ----------------

@login_required(login_url='login')
def patient_list(request):
    search = request.GET.get('search', '')
    patients = Patient.objects.filter(name__icontains=search)
    return render(request, 'patient_list.html', {'patients': patients, 'search': search})


@login_required(login_url='login')
def add_patient(request):
    form = PatientForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect('patient_list')
    return render(request, 'form.html', {'form': form, 'title': 'Add Patient'})


@login_required(login_url='login')
def edit_patient(request, id):
    patient = get_object_or_404(Patient, id=id)
    form = PatientForm(request.POST or None, instance=patient)
    if form.is_valid():
        form.save()
        return redirect('patient_list')
    return render(request, 'form.html', {'form': form, 'title': 'Edit Patient'})


@login_required(login_url='login')
def delete_patient(request, id):
    patient = get_object_or_404(Patient, id=id)
    if request.method == 'POST':
        patient.delete()
    return redirect('patient_list')


# ---------------- Appointments ----------------

@login_required(login_url='login')
def appointment_list(request):
    appointments = Appointment.objects.all()
    if hasattr(request.user, 'doctor'):   # a doctor sees only their own
        appointments = appointments.filter(doctor__user=request.user)
    return render(request, 'appointment_list.html', {'appointments': appointments})


@login_required(login_url='login')
def add_appointment(request):
    form = AppointmentForm(request.POST or None)
    if form.is_valid():
        form.save()
        return redirect('appointment_list')
    return render(request, 'form.html', {'form': form, 'title': 'Book Appointment'})


@login_required(login_url='login')
def complete_appointment(request, id):
    appointment = get_object_or_404(Appointment, id=id)
    if request.method == 'POST':
        appointment.notes = request.POST.get('notes')
        appointment.status = 'completed'
        appointment.save()
        return redirect('appointment_list')
    return render(request, 'complete_appointment.html', {'appointment': appointment})


@login_required(login_url='login')
def cancel_appointment(request, id):
    appointment = get_object_or_404(Appointment, id=id)
    if request.method == 'POST':
        appointment.status = 'cancelled'
        appointment.save()
    return redirect('appointment_list')
```

**In one line:** every form view is the same 5 lines: **make the form → if valid, save and redirect → otherwise show the page.**

- `request.POST or None` gives the form the submitted data on POST, and nothing on GET. An empty form isn't "valid", so a GET just shows the page.
- `instance=patient` fills the form with the patient's current values, and `form.save()` then updates that row instead of making a new one.
- `name__icontains=search` means "name contains this text". An empty search matches everyone.
- `@login_required(login_url='login')` sends anyone not logged in to the login page.
- Delete and cancel only act on **POST**, so a page refresh can't delete anything.
- `complete_appointment` saves the doctor's notes and sets the status to `completed`.

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

**In one line:** each `path(...)` connects a URL to a view. `<int:id>` passes the number from `/patients/edit/3/` as `id=3`, and `name=` is what `redirect()` and `{% url %}` use.

## 15. Final project urls.py

Open `hospitalproject/urls.py` again and add **one line** at the bottom of `urlpatterns`:

```python title="hospitalproject/urls.py"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from hospitalapp import api_views

router = DefaultRouter()
router.register('departments', api_views.DepartmentViewSet)
router.register('doctors', api_views.DoctorViewSet)
router.register('patients', api_views.PatientViewSet)
router.register('appointments', api_views.AppointmentViewSet)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/token/', TokenObtainPairView.as_view()),           # JWT login
    path('api/token/refresh/', TokenRefreshView.as_view()),      # new access token
    path('api/', include(router.urls)),                          # all ViewSet URLs
    path('api-auth/', include('rest_framework.urls')),           # Log in link on browser API pages
    path('', include('hospitalapp.urls')),                       # <--- ADDED: web pages
]
```

**In one line:** the new last line sends every other URL (`/`, `/login/`, `/patients/`...) to the app's `urls.py`. It goes last so `/admin/` and `/api/` match first.

## 16. Templates

All HTML files go in the `templates/` folder next to `manage.py`. Every page **extends** `base.html`, so the menu is written once. You need **six** files.

**Template words you'll see on every page**

| Tag | Meaning |
|---|---|
| `{% extends 'base.html' %}` + `{% block content %}` | Use the base layout and fill its empty slot |
| `{{ patient.name }}` | Print a value from the view's `context` |
| `{% for ... %}` / `{% if ... %}` | Loop / condition |
| `{% url 'edit_patient' patient.id %}` | Build a URL from its name → `/patients/edit/3/` |
| `{% csrf_token %}` | **Required in every POST form**, or you get 403 CSRF failed |
| `get_status_display` | Show the choice's label ("Scheduled") instead of the stored value |

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
        .errorlist { color: #d73a49; font-weight: bold; }
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

**In one line:** the shared layout: menu on top, each page's content below. `user` is always available, so the menu hides links when nobody is logged in. Skip the `<style>` block if you're in a hurry.

### form.html (used by login, add/edit patient and book appointment)

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

**In one line:** `{{ form.as_p }}` prints every input of whatever form the view sent, with its label and any error message. That's why one template is enough for four pages.

### dashboard.html

```html title="templates/dashboard.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Dashboard</h2>
    <p>Welcome, {{ user.username }}</p>

    <div class="box"><p>Patients</p><h2>{{ total_patients }}</h2></div>
    <div class="box"><p>Doctors</p><h2>{{ total_doctors }}</h2></div>

    <h3>Today's appointments</h3>
    <table>
        <tr><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th></tr>
        {% for appointment in todays_appointments %}
        <tr>
            <td>{{ appointment.time }}</td>
            <td>{{ appointment.patient.name }}</td>
            <td>Dr. {{ appointment.doctor.name }}</td>
            <td>{{ appointment.get_status_display }}</td>
        </tr>
        {% empty %}
        <tr><td colspan="4">No appointments today.</td></tr>
        {% endfor %}
    </table>
{% endblock %}
```

**In one line:** two count boxes, then today's appointments. `{% empty %}` shows a message when the list has no rows, and `appointment.patient.name` follows the foreign key to the patient's name.

### patient_list.html

```html title="templates/patient_list.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Patients</h2>

    <form method="GET">
        <input type="text" name="search" value="{{ search }}" placeholder="Search by name">
        <button type="submit">Search</button>
    </form>

    <p><a href="{% url 'add_patient' %}">+ Add New Patient</a></p>

    <table>
        <tr><th>Name</th><th>Age</th><th>Gender</th><th>Phone</th><th>Actions</th></tr>
        {% for patient in patients %}
        <tr>
            <td>{{ patient.name }}</td>
            <td>{{ patient.age }}</td>
            <td>{{ patient.get_gender_display }}</td>
            <td>{{ patient.phone }}</td>
            <td>
                <a href="{% url 'edit_patient' patient.id %}">Edit</a>
                <form method="POST" action="{% url 'delete_patient' patient.id %}" class="inline">
                    {% csrf_token %}
                    <button type="submit" class="danger">Delete</button>
                </form>
            </td>
        </tr>
        {% empty %}
        <tr><td colspan="5">No patients found.</td></tr>
        {% endfor %}
    </table>
{% endblock %}
```

**In one line:** a GET search box (`/patients/?search=amit`), a table of patients, and Edit / Delete for each row. Delete is a small POST form because it changes data.

### appointment_list.html

```html title="templates/appointment_list.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Appointments</h2>

    <p><a href="{% url 'add_appointment' %}">+ Book Appointment</a></p>

    <table>
        <tr><th>Date</th><th>Time</th><th>Patient</th><th>Doctor</th><th>Status</th><th>Notes</th><th>Actions</th></tr>
        {% for appointment in appointments %}
        <tr>
            <td>{{ appointment.date }}</td>
            <td>{{ appointment.time }}</td>
            <td>{{ appointment.patient.name }}</td>
            <td>Dr. {{ appointment.doctor.name }}</td>
            <td>{{ appointment.get_status_display }}</td>
            <td>{{ appointment.notes }}</td>
            <td>
                {% if appointment.status == 'scheduled' %}
                    <a href="{% url 'complete_appointment' appointment.id %}">Complete</a>
                    <form method="POST" action="{% url 'cancel_appointment' appointment.id %}" class="inline">
                        {% csrf_token %}
                        <button type="submit" class="danger">Cancel</button>
                    </form>
                {% endif %}
            </td>
        </tr>
        {% empty %}
        <tr><td colspan="7">No appointments found.</td></tr>
        {% endfor %}
    </table>
{% endblock %}
```

**In one line:** all appointments (a doctor sees only theirs), with **Complete** and **Cancel** shown only while an appointment is still scheduled.

### complete_appointment.html

```html title="templates/complete_appointment.html"
{% extends 'base.html' %}

{% block content %}
    <h2>Complete Appointment</h2>
    <p><b>Patient:</b> {{ appointment.patient.name }}</p>
    <p><b>Doctor:</b> Dr. {{ appointment.doctor.name }}</p>
    <p><b>Reason:</b> {{ appointment.reason }}</p>

    <form method="POST">
        {% csrf_token %}
        <label>Diagnosis / medicines / advice</label>
        <textarea name="notes" rows="5" required>{{ appointment.notes }}</textarea>
        <button type="submit">Mark as Completed</button>
    </form>
{% endblock %}
```

**In one line:** shows the appointment, then a notes box. `name="notes"` matches `request.POST.get('notes')` in the view.

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
6. Log in as the admin. The **Admin Panel** link appears in the menu.

> [!TIP] Done
> You now have models, admin, a JWT-protected REST API, and web pages with login. That's a complete hospital management system.

## 18. Explain it in the interview

**"Walk me through what happens when Postman books an appointment."**

```flow
POST /api/appointments/ | Postman sends JSON + Authorization: Bearer <token>
urls.py | the router sends it to AppointmentViewSet → create
JWTAuthentication | reads the token, sets request.user = reception1
IsAuthenticated | the user is logged in → allowed (else 401)
AppointmentSerializer | validate() checks double booking (else 400)
serializer.save() | the new row is inserted into the Appointment table
Response | 201 Created + the appointment as JSON
```

**Questions you may get**

| Question | Short answer |
|---|---|
| What is `class Meta`? | A settings box inside the serializer: `model` says which model to copy fields from, `fields` says which to include. |
| What is a serializer? | It converts model objects to JSON and back, and validates input. It's like a ModelForm for APIs. |
| `Serializer` vs `ModelSerializer`? | `Serializer`: you write every field yourself. `ModelSerializer`: fields come from the model automatically. |
| What does `fields = '__all__'` mean? | Use every column of the model. You can also give a list, like `['name', 'age']`. |
| `validate` in a serializer? | It checks several fields together (doctor + date + time) and raises `ValidationError` for a 400. |
| ModelForm vs ModelSerializer? | Same idea, same `class Meta`. A ModelForm makes HTML inputs, a ModelSerializer makes JSON. |
| What does `ModelViewSet` give you? | list, create, retrieve, update, partial_update and destroy in one class. |
| What does the router do? | It makes the URLs for a viewset automatically: `/patients/` and `/patients/<id>/`. |
| `queryset` vs `get_queryset()`? | `queryset` is fixed. `get_queryset()` can change per request, for example a doctor sees only their own rows. |
| What is JWT? | A signed token given at login. The client sends it in the `Authorization: Bearer` header on every request, so the server needs no session. |
| Access vs refresh token? | Access is short-lived and used on every request. Refresh is longer-lived and only used to get a new access token. |
| How is the API protected? | `IsAuthenticated` in `DEFAULT_PERMISSION_CLASSES`: no login → 401. For more roles you'd write a `BasePermission` class. |
| How does a doctor see only their own rows? | `Doctor` is linked to `User`, so `get_queryset` checks `hasattr(user, 'doctor')` and filters by `doctor__user=user`. |
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
| Postman: *Authentication credentials were not provided* | No token, or the `REST_FRAMEWORK` block is missing | Use Bearer Token in Postman, and check Step 10 |
| Postman: *Token is invalid or expired* | The access token is older than 5 minutes | Call `/api/token/refresh/` or log in again |
| ``Field name `phone` is not valid for model `Doctor` `` | A name in `fields` doesn't match the model (e.g. the model says `phone_number`) | Use the exact model field name, or `fields = '__all__'` |
| `basename` argument not specified | A viewset has no `queryset` line | Add `queryset = Model.objects.all()` to the viewset |
| Doctor gets 404 for an appointment | That appointment belongs to another doctor | This is correct, because `get_queryset` hides it |
| `Invalid pk "5" - object does not exist.` | You sent a `patient` or `doctor` id that isn't in the database | `GET /api/patients/` first and use a real id |
