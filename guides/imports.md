Import lines feel impossible to remember because they look like random words. They aren't random. Django and DRF follow a few **naming rules**, and once you know the rules you can **rebuild** almost any import instead of memorizing it.

This page gives you:

1. **The rules**, so you can work out an import you've forgotten.
2. **Every file of a project**, in build order, with its complete import block (copy button included) and what each name is used for.
3. **A lookup table**: "I need `X`" → the exact line to write.
4. **Tricks for the test**, so VS Code and Django tell you the import when you forget it.

> [!TIP] The honest truth
> Nobody types imports from memory all day. Real developers use auto-import and copy from the file they wrote yesterday. In a practical, you only need about **15 lines**. Section 5 lists them. Learn those, and use the rules for anything else.

## 1. How to read an import line

```python
from django.shortcuts import render
#    └── where it lives ──┘        └ the thing you want
```

- The part after `from` is a **path of folders and files**, joined with dots. `django.shortcuts` is the file `shortcuts.py` inside the `django` package.
- The part after `import` is the **thing** (a function, class or module) you want from that file.
- You can import several things from the same place with commas: `from django.shortcuts import render, redirect, get_object_or_404`.

There are only **two styles**:

| Style | Example | Then you write |
|---|---|---|
| Import the **thing** | `from django.shortcuts import render` | `render(request, 'home.html')` |
| Import the **module**, use a dot | `from rest_framework import serializers` | `serializers.ModelSerializer` |

Both work. The second one means you remember **one** import and get everything inside it: `serializers.ModelSerializer`, `serializers.ValidationError`, `serializers.CharField` and so on.

## 2. The six rules

### Rule 1: Your own files start with a dot

The dot means "**the same app folder** as this file".

```python
from .models import Patient, Doctor        # hospitalapp/models.py
from .serializers import PatientSerializer # hospitalapp/serializers.py
from .permissions import IsAdminOrReadOnly # hospitalapp/permissions.py
from . import views                        # the whole hospitalapp/views.py file
```

The word after the dot is just **the file name without `.py`**. If you made `permissions.py`, you import with `from .permissions import ...`.

The **project** `urls.py` is in a different folder from the app, so it can't use a dot. Use the app name instead:

```python
from hospitalapp.api_views import PatientViewSet   # project urls.py → app file
```

### Rule 2: Django's path matches what the thing is about

| You want something about… | Path starts with | Example |
|---|---|---|
| Database / models | `django.db` | `from django.db import models` |
| URLs | `django.urls` | `from django.urls import path, include` |
| Common view helpers | `django.shortcuts` | `from django.shortcuts import render, redirect` |
| Login, users, passwords | `django.contrib.auth` | `from django.contrib.auth import login, logout` |
| The admin panel | `django.contrib` | `from django.contrib import admin` |
| Forms | `django` | `from django import forms` |
| Raw responses | `django.http` | `from django.http import HttpResponse` |
| Tests | `django.test` | `from django.test import TestCase` |

`contrib` means "**extra apps that come with Django**": admin, auth, sessions, messages. They're the same apps listed in `INSTALLED_APPS` as `'django.contrib.admin'`, `'django.contrib.auth'` and so on. That list in `settings.py` reminds you the paths.

### Rule 3: Inside `django.contrib.auth`, the file name tells you what's inside

```flow
django.contrib.auth | login, logout, authenticate (the actions)
django.contrib.auth.models | User (a model → models.py)
django.contrib.auth.forms | AuthenticationForm, UserCreationForm (forms → forms.py)
django.contrib.auth.decorators | login_required (a decorator → decorators.py)
```

It's the **same file names you use in your own app**: models, forms, views, decorators. Django is built out of normal apps too.

### Rule 4: DRF works the same way. The file is named after what it holds

DRF's Python name is `rest_framework`. Every file inside it is a **plural word** naming what it holds:

| You want | It's in | Import |
|---|---|---|
| `ModelSerializer`, `ValidationError` | `serializers` | `from rest_framework import serializers` |
| `ModelViewSet` | `viewsets` | `from rest_framework import viewsets` |
| `BasePermission`, `IsAuthenticated`, `AllowAny` | `permissions` | `from rest_framework.permissions import BasePermission` |
| `DefaultRouter` | `routers` | `from rest_framework.routers import DefaultRouter` |
| `api_view`, `permission_classes` | `decorators` | `from rest_framework.decorators import api_view` |
| `Response` | `response` (singular!) | `from rest_framework.response import Response` |
| `APIView` | `views` | `from rest_framework.views import APIView` |
| `status.HTTP_201_CREATED` | `status` | `from rest_framework import status` |

The trick: **say the class name, then ask "what kind of thing is it?"** `DefaultRouter` is a router → `routers`. `IsAuthenticated` is a permission → `permissions`. `api_view` is a decorator (it has `@`) → `decorators`.

### Rule 5: SimpleJWT is only used in two places

`rest_framework_simplejwt` = **rest_framework** + **simplejwt**, joined with `_`. You only need it in:

```python
# 1. project urls.py — the login and refresh endpoints (they are views → .views)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
```

```python
# 2. settings.py — as a STRING, not an import
'rest_framework_simplejwt.authentication.JWTAuthentication'
```

Read the class names as English: **Token, Obtain (get), Pair** (access + refresh) → the login view. **Token, Refresh** → the refresh view.

### Rule 6: A settings string is just an import written with dots

`settings.py` never imports DRF. It writes the import path as **text**, and Django imports it for you later. Compare:

```python
from rest_framework_simplejwt.authentication import JWTAuthentication   # import
'rest_framework_simplejwt.authentication.JWTAuthentication'             # the same, as a string
```

Take the import, delete `from`, replace ` import ` with `.`, and put it in quotes. If you can write one, you can write the other.

## 3. Package names vs import names

What you **pip install** and what you **import** are often different. This is the main reason long names like `rest_framework_simplejwt` feel random:

| `pip install …` | Import / INSTALLED_APPS name | Why it's different |
|---|---|---|
| `django` | `django` | Same |
| `djangorestframework` | `rest_framework` | The pip name has "django" in front |
| `djangorestframework-simplejwt` | `rest_framework_simplejwt` | Drop "django", dash `-` becomes underscore `_` |
| `django-filter` | `django_filters` | Dash → underscore, **and** an extra `s` |
| `django-cors-headers` | `corsheaders` | All joined together |

**Rule:** Python names can't contain `-`, so a dash always becomes `_` or disappears.

### What goes in INSTALLED_APPS, and why

```python title="settings.py — INSTALLED_APPS explained"
INSTALLED_APPS = [
    'django.contrib.admin',          # the /admin/ panel
    'django.contrib.auth',           # User model, login, passwords
    'django.contrib.contenttypes',   # needed by auth and admin
    'django.contrib.sessions',       # remembers who is logged in (cookie)
    'django.contrib.messages',       # one-time flash messages
    'django.contrib.staticfiles',    # CSS / JS / images
    'rest_framework',                # DRF (add this for any API)
    'hospitalapp',                   # YOUR app (always add it)
]
```

The first six are **already there** when you run `startproject`. You only ever **add** lines at the end.

> [!NOTE] What about `'rest_framework_simplejwt.token_blacklist'`?
> Read it as **package . feature**: SimpleJWT's "token blacklist" feature. It's **only** needed if you build a *logout* endpoint that blocks a refresh token (and then you must run `migrate`). The beginner hospital and inventory guides **don't use it**, so skip it. JWT login works without adding anything from SimpleJWT to `INSTALLED_APPS`.

Other optional ones, only if you install that package:

| Add to INSTALLED_APPS | Only when you use |
|---|---|
| `'rest_framework_simplejwt.token_blacklist'` | JWT logout with blacklisting |
| `'django_filters'` | the `django-filter` package |
| `'corsheaders'` | a separate React frontend calling your API |

## 4. Every file, its imports, and why

These are the files in the order you write them, using the [hospital](/project/hospital) and [inventory](/project/inventory) guides as the example. Each block is **only the import lines** for that file.

### settings.py: no imports to add

`startproject` already writes `from pathlib import Path` at the top (that's where `BASE_DIR` comes from). You don't add any imports. You only add **strings** (Rule 6).

### models.py

```python title="hospitalapp/models.py — imports"
from django.db import models
from django.contrib.auth.models import User
```

| Import | What you get | Used like |
|---|---|---|
| `from django.db import models` | All field types and the base `Model` class | `class Patient(models.Model):` and `models.CharField(...)` |
| `from django.contrib.auth.models import User` | Django's built-in user table | `user = models.OneToOneField(User, ...)` |

**Memory hook:** models talk to the **db**. The first line is already written for you by `startapp`. Only add the `User` line if a model links to a user.

### admin.py

```python title="hospitalapp/admin.py — imports"
from django.contrib import admin
from .models import Department, Doctor, Receptionist, Patient, Appointment
```

| Import | What you get | Used like |
|---|---|---|
| `from django.contrib import admin` | The admin site | `admin.site.register(Patient)` |
| `from .models import ...` | Your own models (Rule 1) | The names you pass to `register` |

**Memory hook:** `startapp` writes the first line for you. You add the `.models` line.

### serializers.py

```python title="hospitalapp/serializers.py — imports"
from datetime import date                      # only if you compare dates
from django.contrib.auth.models import User    # only for a register serializer
from rest_framework import serializers
from .models import Department, Doctor, Patient, Appointment
```

| Import | What you get | Used like |
|---|---|---|
| `from rest_framework import serializers` | Everything for serializers | `serializers.ModelSerializer`, `serializers.ValidationError`, `serializers.CharField(...)` |
| `from .models import ...` | Your models | `class Meta: model = Patient` |
| `from datetime import date` | Python's date type (not Django) | `if value < date.today():` |
| `from django.contrib.auth.models import User` | The user model | `class Meta: model = User` in `RegisterSerializer` |

**Memory hook:** the file is called `serializers.py`, and its main import is `from rest_framework import serializers`. **Same word.**

### permissions.py

```python title="hospitalapp/permissions.py — imports"
from rest_framework.permissions import BasePermission
from .models import Doctor, Receptionist   # only if you check role tables
```

| Import | What you get | Used like |
|---|---|---|
| `BasePermission` | The class every custom permission extends | `class IsAdminOrReadOnly(BasePermission):` |
| `from .models import ...` | Your role tables | `Doctor.objects.filter(user=user).exists()` |

**Memory hook:** the file is called `permissions.py`, and the import comes from `rest_framework.permissions`. **Same word again.**

### api_views.py (DRF views)

```python title="inventoryapp/api_views.py — imports"
from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Category, Supplier, Product, StockTransaction
from .serializers import CategorySerializer, SupplierSerializer, ProductSerializer, StockTransactionSerializer
from .permissions import IsStaffOrReadOnly
```

| Import | What you get | Used like |
|---|---|---|
| `from rest_framework import viewsets` | ViewSet classes | `class ProductViewSet(viewsets.ModelViewSet):` |
| `api_view`, `permission_classes` from `.decorators` | Decorators for **function** API views | `@api_view(['POST'])` and `@permission_classes([AllowAny])` above a `def` |
| `AllowAny`, `IsAuthenticated` from `.permissions` | DRF's built-in permissions | `permission_classes = [IsAuthenticated]` |
| `Response` from `.response` | DRF's JSON response | `return Response(serializer.data, status=201)` |
| `.models`, `.serializers`, `.permissions` | Your own files (Rule 1) | `queryset = ...`, `serializer_class = ...`, `permission_classes = [...]` |

**Memory hook:** a ViewSet needs three things: rows (**models**), a converter (**serializers**) and rules (**permissions**). That's the three dot-imports, in the same order as the three class attributes.

> [!NOTE] Only using ModelViewSet?
> If the file only has ViewSets (like the hospital one), you need just `from rest_framework import viewsets` plus your three dot-imports. `api_view`, `Response` and `AllowAny` are only for the extra function views (register, reports).

### views.py (web pages, MVT)

```python title="hospitalapp/views.py — imports"
from datetime import date

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.decorators import login_required

from .models import Doctor, Patient, Appointment
from .permissions import is_doctor, is_admin_or_receptionist
```

| Import | What you get | Used like |
|---|---|---|
| `render` | Turns a template + data into a page | `return render(request, 'home.html', context)` |
| `redirect` | Sends the browser to another URL | `return redirect('patient_list')` |
| `get_object_or_404` | Gets one row, or shows a 404 page | `get_object_or_404(Patient, id=id)` |
| `login`, `logout` from `django.contrib.auth` | Start / end a session | `login(request, user)` and `logout(request)` |
| `AuthenticationForm` from `.auth.forms` | Ready-made login form | `AuthenticationForm(request, data=request.POST)` |
| `UserCreationForm` from `.auth.forms` | Ready-made signup form | `UserCreationForm(request.POST)` |
| `login_required` from `.auth.decorators` | Blocks logged-out users | `@login_required(login_url='login')` |
| `from datetime import date` | Today's date | `date.today()` |

**Memory hook:** `startapp` gives you `from django.shortcuts import render` for free. Just **extend that line** with `, redirect, get_object_or_404`. Everything about login is under `django.contrib.auth` (Rule 3).

### App urls.py

```python title="hospitalapp/urls.py — imports"
from django.urls import path
from . import views
```

| Import | What you get | Used like |
|---|---|---|
| `from django.urls import path` | Makes one URL rule | `path('patients/', views.patient_list, name='patient_list')` |
| `from . import views` | Your **whole** `views.py` file | `views.patient_list`, `views.add_patient`... |

**Memory hook:** `from . import views` has **no file after the dot**. You're importing the file itself, so you write `views.something` everywhere.

### Project urls.py

```python title="hospitalproject/urls.py — imports"
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from hospitalapp.api_views import DepartmentViewSet, DoctorViewSet, PatientViewSet, AppointmentViewSet
```

| Import | What you get | Used like |
|---|---|---|
| `from django.contrib import admin` | Admin URLs | `path('admin/', admin.site.urls)` |
| `path, include` from `django.urls` | URL rules + "use another urls file" | `path('', include('hospitalapp.urls'))` |
| `DefaultRouter` from `rest_framework.routers` | Builds API URLs for ViewSets | `router = DefaultRouter()` and `router.register(...)` |
| `TokenObtainPairView`, `TokenRefreshView` | JWT login + refresh endpoints | `path('api/token/', TokenObtainPairView.as_view())` |
| `from hospitalapp.api_views import ...` | Your ViewSets (no dot, because this is a different folder) | `router.register('patients', PatientViewSet, basename='patient')` |

**Memory hook:** `startproject` writes the first two lines for you (just add `, include`). Then add one line for the **router**, one for **JWT**, and one for **your viewsets**.

> [!TIP] Even shorter
> You can write `from hospitalapp import api_views` and then use `api_views.PatientViewSet`. Then you never have to list the viewset names in the import. The inventory guide does this.

### forms.py (only if you use Django forms)

```python title="forms.py — imports"
from django import forms
from .models import Patient
```

| Import | Used like |
|---|---|
| `from django import forms` | `class PatientForm(forms.ModelForm):` and `forms.CharField(...)` |
| `from .models import Patient` | `class Meta: model = Patient` |

### tests.py (only if asked for tests)

```python title="tests.py — imports"
from django.test import TestCase                 # testing models and web pages
from rest_framework.test import APITestCase      # testing the API
from django.contrib.auth.models import User
from .models import Patient
```

`startapp` already writes `from django.test import TestCase`. For API tests, the DRF version lives in `rest_framework.test`. Same file name, different package.

## 5. The 15 lines you actually need

Learn these, and both practical projects are covered:

```python title="The 15 lines"
from django.db import models
from django.contrib.auth.models import User
from django.contrib import admin
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, logout
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from django.contrib.auth.decorators import login_required
from django.urls import path, include
from rest_framework import serializers, viewsets
from rest_framework.permissions import BasePermission, IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .models import ...   # + .serializers, .permissions, . import views
```

Notice the **groups**:

```flow
django.db / django.contrib / django.shortcuts / django.urls | plain Django (MVT)
django.contrib.auth (+ .models .forms .decorators) | everything about users and login
rest_framework (+ .permissions .decorators .response .routers) | the API
rest_framework_simplejwt.views | JWT login, one line only
.models / .serializers / .permissions / . import views | your own files
```

## 6. "I need X" lookup table

Use **Ctrl+F** on this page to find the name you need.

| I need… | Write this |
|---|---|
| `models.Model`, `models.CharField` | `from django.db import models` |
| `User` | `from django.contrib.auth.models import User` |
| `admin.site.register` | `from django.contrib import admin` |
| `render`, `redirect`, `get_object_or_404` | `from django.shortcuts import render, redirect, get_object_or_404` |
| `HttpResponse`, `JsonResponse` | `from django.http import HttpResponse, JsonResponse` |
| `path`, `include`, `reverse` | `from django.urls import path, include, reverse` |
| `login`, `logout`, `authenticate` | `from django.contrib.auth import login, logout, authenticate` |
| `AuthenticationForm`, `UserCreationForm` | `from django.contrib.auth.forms import AuthenticationForm, UserCreationForm` |
| `@login_required` | `from django.contrib.auth.decorators import login_required` |
| `@staff_member_required` | `from django.contrib.admin.views.decorators import staff_member_required` |
| `messages.success(...)` | `from django.contrib import messages` |
| `forms.Form`, `forms.ModelForm` | `from django import forms` |
| `Q`, `F`, `Count`, `Sum` | `from django.db.models import Q, F, Count, Sum` |
| `timezone.now()` | `from django.utils import timezone` |
| `date.today()` | `from datetime import date` |
| `settings.MEDIA_URL` | `from django.conf import settings` |
| `TestCase` | `from django.test import TestCase` |
| `serializers.ModelSerializer`, `serializers.ValidationError` | `from rest_framework import serializers` |
| `viewsets.ModelViewSet` | `from rest_framework import viewsets` |
| `generics.ListCreateAPIView` | `from rest_framework import generics` |
| `status.HTTP_201_CREATED` | `from rest_framework import status` |
| `BasePermission`, `IsAuthenticated`, `AllowAny`, `IsAdminUser` | `from rest_framework.permissions import BasePermission, IsAuthenticated, AllowAny, IsAdminUser` |
| `@api_view`, `@permission_classes`, `@action` | `from rest_framework.decorators import api_view, permission_classes, action` |
| `Response` | `from rest_framework.response import Response` |
| `APIView` | `from rest_framework.views import APIView` |
| `DefaultRouter` | `from rest_framework.routers import DefaultRouter` |
| `APITestCase`, `APIClient` | `from rest_framework.test import APITestCase, APIClient` |
| `TokenObtainPairView`, `TokenRefreshView` | `from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView` |
| `RefreshToken` (make tokens in code) | `from rest_framework_simplejwt.tokens import RefreshToken` |

## 7. Tricks so you never get stuck in the test

### Trick 1: Let `startapp` and `startproject` write the first lines

These imports are **already in the files** Django creates. Don't delete them, just add to them:

| File | Already written for you |
|---|---|
| `models.py` | `from django.db import models` |
| `admin.py` | `from django.contrib import admin` |
| `views.py` | `from django.shortcuts import render` |
| `tests.py` | `from django.test import TestCase` |
| project `urls.py` | `from django.contrib import admin` and `from django.urls import path` |

The comment at the top of the project `urls.py` even shows how to use `include`. Read it!

### Trick 2: Let VS Code write the import

1. Install the **Python** extension (by Microsoft). It includes Pylance.
2. Press `Ctrl+Shift+P` → **Python: Select Interpreter** → pick the one inside your `venv`. Without this, VS Code can't see Django or DRF.
3. Type the name, for example `get_object_or_404`. When it's underlined, click it and press **`Ctrl+.`** (Quick Fix) → choose **Add "from django.shortcuts import get_object_or_404"**.
4. Auto-complete also offers imports as you type: pick the suggestion that shows the path on the right.

> [!WARNING]
> Check the path VS Code suggests. For `Response` it may offer `django.http.response`, but in an API you want `rest_framework.response`. For `TestCase`, `unittest` is wrong; you want `django.test`.

### Trick 3: Let the error message tell you

Run the server (`python manage.py runserver`) after writing each file. The error says exactly what's missing:

| Error | What it means | Fix |
|---|---|---|
| `NameError: name 'redirect' is not defined` | You used it but didn't import it | Add it to the import (look it up in Section 6) |
| `ModuleNotFoundError: No module named 'rest_framework'` | Package not installed, venv not active, or a typo | `venv\Scripts\activate`, then `pip install djangorestframework` |
| `ModuleNotFoundError: No module named 'djangorestframework'` | You used the **pip** name in the code | Use `rest_framework` (Section 3) |
| `ImportError: cannot import name 'Response' from 'rest_framework'` | Right package, wrong file | It's `rest_framework.response` (Rule 4) |
| `ImportError: attempted relative import with no known parent package` | You ran a file directly with `python views.py` | Always run through `python manage.py runserver` |
| `ImportError: cannot import name 'X'` (circular import) | Two of your files import each other | Move the shared code into one file (for example `permissions.py`) |

### Trick 4: Test an import in 2 seconds

Not sure if a line is right? Try it in the Django shell:

```bash
python manage.py shell
```

```python
>>> from rest_framework.permissions import IsAuthenticated
>>> from rest_framework.permission import IsAuthenticated
ModuleNotFoundError: No module named 'rest_framework.permission'
```

The first line works with no output. That silence means it's correct. The second has a typo (`permission`, missing the `s`), and Python says so.

### Trick 5: Copy from your last file

Most files in a project import the **same things** as the previous file. When you start `api_views.py`, copy the imports from `serializers.py` and change the words. When you start the project `urls.py`, copy the line `from .views import ...` and change it to `from hospitalapp.api_views import ...`.

## 8. Practice: cover the right side

Cover the right column with your hand. Say the import out loud, then check.

| You type in your code… | The import is… |
|---|---|
| `class Book(models.Model):` | `from django.db import models` |
| `return render(request, 'list.html', {...})` | `from django.shortcuts import render` |
| `return redirect('home')` | `from django.shortcuts import redirect` |
| `@login_required(login_url='login')` | `from django.contrib.auth.decorators import login_required` |
| `form = AuthenticationForm(request, data=request.POST)` | `from django.contrib.auth.forms import AuthenticationForm` |
| `login(request, form.get_user())` | `from django.contrib.auth import login` |
| `owner = models.ForeignKey(User, ...)` | `from django.contrib.auth.models import User` |
| `path('', views.home, name='home')` | `from django.urls import path` + `from . import views` |
| `class BookSerializer(serializers.ModelSerializer):` | `from rest_framework import serializers` |
| `class BookViewSet(viewsets.ModelViewSet):` | `from rest_framework import viewsets` |
| `permission_classes = [IsAuthenticated]` | `from rest_framework.permissions import IsAuthenticated` |
| `class IsOwner(BasePermission):` | `from rest_framework.permissions import BasePermission` |
| `@api_view(['GET'])` | `from rest_framework.decorators import api_view` |
| `return Response(data)` | `from rest_framework.response import Response` |
| `router = DefaultRouter()` | `from rest_framework.routers import DefaultRouter` |
| `path('api/token/', TokenObtainPairView.as_view())` | `from rest_framework_simplejwt.views import TokenObtainPairView` |
| `'rest_framework_simplejwt.authentication.JWTAuthentication'` in settings | *(no import, it's a string: Rule 6)* |

> [!REMEMBER] One sentence to remember
> **Your files start with a dot. Django's path says what the thing is about. DRF's file is the plural of what you want. JWT lives in `rest_framework_simplejwt.views`. Settings use the same paths as text.**
