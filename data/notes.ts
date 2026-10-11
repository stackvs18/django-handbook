export interface NoteSection {
  id: string;
  title: string;
  unit: string;
  marks?: string;
  badge?: string;
  isHighWeight?: boolean;
  content: {
    summary: string;
    explanation: string;
    steps?: { stepNumber: number; title: string; desc: string; code?: string; codeFile?: string }[];
    codeSnippets?: { file: string; language: string; code: string; note?: string }[];
    keyTakeaways?: string[];
  };
}

export const STUDY_NOTES: NoteSection[] = [
  // --- HIGH WEIGHT EXAM SPECIALS ---
  {
    id: "crud-practical-15m",
    title: "CRUD Practical (Complete Movie Reviews Walkthrough)",
    unit: "Unit 9",
    marks: "15 Marks - Practical Exam",
    badge: "MUST MASTER",
    isHighWeight: true,
    content: {
      summary: "Step-by-step practical exam guide for building a complete CRUD application (Movie & Review System) with models, views, templates, authorization, and foreign keys.",
      explanation: "In the 15-mark practical exam, you will be required to build a full CRUD workflow: creating models with foreign keys, wiring up URLs, writing view functions with error handling, using ModelForm / forms.py, writing HTML templates with CSRF tokens, enforcing @login_required, and implementing update/delete permissions.",
      steps: [
        {
          stepNumber: 1,
          title: "Define Models with ForeignKey (movie/models.py)",
          desc: "Create Movie and Review models. Review links to User and Movie with ForeignKey and on_delete=models.CASCADE.",
          codeFile: "movie/models.py",
          code: `from django.db import models
from django.contrib.auth.models import User

class Movie(models.Model):
    title = models.CharField(max_length=100)
    description = models.TextField()
    image = models.ImageField(upload_to='movie/images/')
    url = models.URLField(blank=True)

class Review(models.Model):
    text = models.CharField(max_length=100)
    date = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    movie = models.ForeignKey(Movie, on_delete=models.CASCADE)
    watchAgain = models.BooleanField()

    def __str__(self):
        return self.text`
        },
        {
          stepNumber: 2,
          title: "Register Models in Admin (movie/admin.py)",
          desc: "Register Movie and Review so admin can manage items.",
          codeFile: "movie/admin.py",
          code: `from django.contrib import admin
from .models import Movie, Review

admin.site.register(Movie)
admin.site.register(Review)`
        },
        {
          stepNumber: 3,
          title: "Create ModelForm (movie/forms.py)",
          desc: "Create ReviewForm extending ModelForm with custom widget attributes.",
          codeFile: "movie/forms.py",
          code: `from django.forms import ModelForm, Textarea
from .models import Review

class ReviewForm(ModelForm):
    def __init__(self, *args, **kwargs):
        super(ReviewForm, self).__init__(*args, **kwargs)
        self.fields['text'].widget.attrs.update({'class': 'form-control'})
        self.fields['watchAgain'].widget.attrs.update({'class': 'form-check-input'})

    class Meta:
        model = Review
        fields = ['text', 'watchAgain']
        labels = {'watchAgain': 'Watch Again'}
        widgets = {
            'text': Textarea(attrs={'rows': 4}),
        }`
        },
        {
          stepNumber: 4,
          title: "Write CRUD Views (movie/views.py)",
          desc: "Implement Create, Read, Update, Delete with @login_required authorization.",
          codeFile: "movie/views.py",
          code: `from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from .models import Movie, Review
from .forms import ReviewForm

# READ / DETAIL
def detail(request, movie_id):
    movie = get_object_or_404(Movie, pk=movie_id)
    reviews = Review.objects.filter(movie=movie)
    return render(request, 'detail.html', {'movie': movie, 'reviews': reviews})

# CREATE REVIEW
@login_required
def createreview(request, movie_id):
    movie = get_object_or_404(Movie, pk=movie_id)
    if request.method == 'GET':
        return render(request, 'createreview.html', {'form': ReviewForm(), 'movie': movie})
    else:
        try:
            form = ReviewForm(request.POST)
            newReview = form.save(commit=False)
            newReview.user = request.user
            newReview.movie = movie
            newReview.save()
            return redirect('detail', newReview.movie.id)
        except ValueError:
            return render(request, 'createreview.html', {'form': ReviewForm(), 'error': 'Bad data passed in'})

# UPDATE REVIEW
@login_required
def updatereview(request, review_id):
    review = get_object_or_404(Review, pk=review_id, user=request.user)
    if request.method == 'GET':
        form = ReviewForm(instance=review)
        return render(request, 'updatereview.html', {'review': review, 'form': form})
    else:
        try:
            form = ReviewForm(request.POST, instance=review)
            form.save()
            return redirect('detail', review.movie.id)
        except ValueError:
            return render(request, 'updatereview.html', {'review': review, 'form': form, 'error': 'Bad data in form'})

# DELETE REVIEW
@login_required
def deletereview(request, review_id):
    review = get_object_or_404(Review, pk=review_id, user=request.user)
    review.delete()
    return redirect('detail', review.movie.id)`
        },
        {
          stepNumber: 5,
          title: "Configure App & Project URLs (movie/urls.py)",
          desc: "Wire up URL paths for detail, create, update, and delete actions.",
          codeFile: "movie/urls.py",
          code: `from django.urls import path
from . import views

urlpatterns = [
    path('<int:movie_id>', views.detail, name='detail'),
    path('<int:movie_id>/create', views.createreview, name='createreview'),
    path('review/<int:review_id>', views.updatereview, name='updatereview'),
    path('review/<int:review_id>/delete', views.deletereview, name='deletereview'),
]`
        },
        {
          stepNumber: 6,
          title: "Create Templates with CSRF and Auth checks (detail.html)",
          desc: "Render reviews and show Update/Delete buttons ONLY if user is authenticated and owns the review.",
          codeFile: "movie/templates/detail.html",
          code: `{% extends 'base.html' %}
{% block content %}
<div class="card mb-3">
  <h3>{{ movie.title }}</h3>
  <p>{{ movie.description }}</p>
  {% if user.is_authenticated %}
    <a href="{% url 'createreview' movie.id %}" class="btn btn-primary">Add Review</a>
  {% endif %}
  <hr>
  <h4>Reviews</h4>
  <ul class="list-group">
    {% for review in reviews %}
      <li class="list-group-item">
        <h5>Review by {{ review.user.username }}</h5>
        <h6>{{ review.date }}</h6>
        <p>{{ review.text }}</p>
        {% if user.is_authenticated and user == review.user %}
          <a href="{% url 'updatereview' review.id %}" class="btn btn-sm btn-primary">Update</a>
          <a href="{% url 'deletereview' review.id %}" class="btn btn-sm btn-danger">Delete</a>
        {% endif %}
      </li>
    {% endfor %}
  </ul>
</div>
{% endblock %}`
        }
      ],
      keyTakeaways: [
        "commit=False is crucial: form.save(commit=False) creates object in memory before attaching request.user and movie FKs.",
        "pk=review_id, user=request.user in get_object_or_404 guarantees authorization (users can't edit others' reviews).",
        "@login_required decorator protects views against unauthenticated HTTP access.",
        "LOGIN_URL = 'loginaccount' must be set in settings.py to redirect unauthenticated users."
      ]
    }
  },

  {
    id: "user-auth-5m",
    title: "Users & Authentication (Register, Login, Logout)",
    unit: "Unit 9",
    marks: "5 Marks - Exam Worked Example",
    badge: "HIGH WEIGHT",
    isHighWeight: true,
    content: {
      summary: "Full step-by-step walkthrough of built-in User Creation, AuthenticationForm, authenticate(), login(), logout(), and template authorization logic.",
      explanation: "Django provides built-in authentication tools in django.contrib.auth. Understanding UserCreationForm, AuthenticationForm, authenticate(), login(), and logout() is vital for the 5-mark theory and coding questions.",
      steps: [
        {
          stepNumber: 1,
          title: "Create App & Add to INSTALLED_APPS",
          desc: "Run python manage.py startapp accounts, then add 'accounts' to INSTALLED_APPS in settings.py.",
          codeFile: "settings.py",
          code: `INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'movie',
    'accounts',
]`
        },
        {
          stepNumber: 2,
          title: "Custom UserCreateForm (accounts/forms.py)",
          desc: "Inherit UserCreationForm and remove help_text while applying Bootstrap form-control class.",
          codeFile: "accounts/forms.py",
          code: `from django.contrib.auth.forms import UserCreationForm

class UserCreateForm(UserCreationForm):
    def __init__(self, *args, **kwargs):
        super(UserCreateForm, self).__init__(*args, **kwargs)
        for fieldname in ['username', 'password1', 'password2']:
            if fieldname in self.fields:
                self.fields[fieldname].help_text = None
                self.fields[fieldname].widget.attrs.update({'class': 'form-control'})`
        },
        {
          stepNumber: 3,
          title: "Signup, Login & Logout Views (accounts/views.py)",
          desc: "Implement signupaccount, loginaccount, and logoutaccount functions.",
          codeFile: "accounts/views.py",
          code: `from django.shortcuts import render, redirect
from django.contrib.auth.models import User
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.forms import AuthenticationForm
from django.db import IntegrityError
from django.contrib.auth.decorators import login_required
from .forms import UserCreateForm

def signupaccount(request):
    if request.method == 'GET':
        return render(request, 'signupaccount.html', {'form': UserCreateForm()})
    else:
        if request.POST['password1'] == request.POST['password2']:
            try:
                user = User.objects.create_user(
                    request.POST['username'],
                    password=request.POST['password1']
                )
                user.save()
                login(request, user)
                return redirect('home')
            except IntegrityError:
                return render(request, 'signupaccount.html', {'form': UserCreateForm(), 'error': 'Username already taken.'})
        else:
            return render(request, 'signupaccount.html', {'form': UserCreateForm(), 'error': 'Passwords do not match.'})

def loginaccount(request):
    if request.method == 'GET':
        return render(request, 'loginaccount.html', {'form': AuthenticationForm()})
    else:
        user = authenticate(request, username=request.POST['username'], password=request.POST['password'])
        if user is None:
            return render(request, 'loginaccount.html', {'form': AuthenticationForm(), 'error': 'Username and password do not match.'})
        else:
            login(request, user)
            return redirect('home')

@login_required
def logoutaccount(request):
    logout(request)
    return redirect('home')`
        },
        {
          stepNumber: 4,
          title: "Template Authorization Checks (base.html Navbar)",
          desc: "Use {% if user.is_authenticated %} to dynamically render Login/Signup or Logout links.",
          codeFile: "templates/base.html",
          code: `<nav class="navbar navbar-expand-lg">
  {% if user.is_authenticated %}
    <a class="nav-link" href="{% url 'logoutaccount' %}">Logout ({{ user.username }})</a>
  {% else %}
    <a class="nav-link" href="{% url 'loginaccount' %}">Login</a>
    <a class="nav-link" href="{% url 'signupaccount' %}">Sign Up</a>
  {% endif %}
</nav>`
        }
      ],
      keyTakeaways: [
        "authenticate(request, username=..., password=...) returns User object if credentials are correct, or None if invalid.",
        "login(request, user) establishes the session in cookies/database.",
        "logout(request) flushes session data and logs the user out.",
        "User.objects.create_user(username, password=...) hashes the password automatically using PBKDF2!"
      ]
    }
  },

  {
    id: "drf-serializers-5m",
    title: "DRF Serializers & REST APIs (ModelSerializer & ViewSets)",
    unit: "Unit 10",
    marks: "5 Marks - Exam Worked Example",
    badge: "HIGH WEIGHT",
    isHighWeight: true,
    content: {
      summary: "Complete breakdown of DRF ModelSerializer, ViewSets, DefaultRouter, and request serialization/deserialization lifecycle.",
      explanation: "Django REST Framework (DRF) converts complex Django Model instances into JSON (Serialization) and validates incoming JSON into Python dictionaries/Model instances (Deserialization).",
      codeSnippets: [
        {
          file: "models.py",
          language: "python",
          code: `from django.db import models

class Project(models.Model):
    title = models.CharField(max_length=100)
    description = models.TextField()
    is_completed = models.BooleanField(default=False)`
        },
        {
          file: "serializers.py",
          language: "python",
          code: `from rest_framework import serializers
from .models import Project

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'title', 'description', 'is_completed']`
        },
        {
          file: "views.py",
          language: "python",
          code: `from rest_framework import viewsets
from .models import Project
from .serializers import ProjectSerializer

class ProjectViewSet(viewsets.ModelViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer`
        },
        {
          file: "urls.py",
          language: "python",
          code: `from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ProjectViewSet

router = DefaultRouter()
router.register(r'projects', ProjectViewSet)

urlpatterns = [
    path('api/', include(router.urls)),
]`
        }
      ],
      keyTakeaways: [
        "Serialization: Model Instance / QuerySet -> Python Native Dict -> JSON string",
        "Deserialization & Validation: JSON -> Python Dict -> is_valid() check -> save() -> Model Instance",
        "ModelViewSet automatically generates .list(), .create(), .retrieve(), .update(), .destroy()",
        "DefaultRouter automatically constructs endpoints: /api/projects/ and /api/projects/{id}/"
      ]
    }
  },

  // --- UNIT 9 NOTES ---
  {
    id: "unit9-sqlite3-direct",
    title: "Unit 9 — Python Direct SQLite3 API",
    unit: "Unit 9",
    content: {
      summary: "Direct sqlite3 module usage in Python: connect, cursor, execute, executemany, executescript, fetchone, fetchmany, fetchall, commit, rollback.",
      explanation: "In addition to Django ORM, Python's built-in sqlite3 module allows executing direct SQL statements against an SQLite database.",
      codeSnippets: [
        {
          file: "sqlite3_demo.py",
          language: "python",
          code: `import sqlite3

# 1. Connect to database file (or :memory:)
conn = sqlite3.connect('db.sqlite3')

# 2. Create cursor object
cursor = conn.cursor()

# 3. Create Table (executescript for multiple SQL commands)
cursor.executescript('''
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        grade REAL
    );
''')

# 4. Insert single row (execute)
cursor.execute("INSERT INTO students (name, grade) VALUES (?, ?)", ("Alice", 92.5))

# 5. Insert multiple rows (executemany)
data = [("Bob", 88.0), ("Charlie", 95.0), ("David", 79.5)]
cursor.executemany("INSERT INTO students (name, grade) VALUES (?, ?)", data)

# 6. Commit transaction
conn.commit()

# 7. Check total changed rows
print("Total changes:", conn.total_changes)

# 8. Query and Fetch results
cursor.execute("SELECT * FROM students WHERE grade > ?", (85.0,))
print("Fetch One:", cursor.fetchone())
print("Fetch Many (2):", cursor.fetchmany(2))

cursor.execute("SELECT * FROM students")
print("Fetch All:", cursor.fetchall())

# 9. Rollback demo (if error occurs)
try:
    cursor.execute("INVALID SQL")
except sqlite3.Error as e:
    print("Error encountered, rolling back:", e)
    conn.rollback()

# 10. Close connection
conn.close()`
        }
      ],
      keyTakeaways: [
        "connect(): Opens connection to sqlite3 DB file.",
        "cursor(): Creates cursor object for executing SQL queries.",
        "execute(): Executes single SQL statement with parameterized ? placeholders.",
        "executemany(): Executes SQL statement against list of tuple parameters.",
        "executescript(): Executes script containing multiple semicolon-separated SQL statements.",
        "fetchall() / fetchone() / fetchmany(n): Retrieve result rows.",
        "commit() saves changes, rollback() reverts pending changes."
      ]
    }
  },

  // --- UNIT 10 NOTES ---
  {
    id: "unit10-jwt-simplejwt",
    title: "Unit 10 — JWT Authentication & SimpleJWT",
    unit: "Unit 10",
    content: {
      summary: "Stateless JWT Auth, Header.Payload.Signature structure, TokenObtainPairView, TokenRefreshView, simplejwt settings, and Bearer token header.",
      explanation: "JSON Web Tokens (JWT) provide stateless authentication. Tokens consist of three Base64URL-encoded parts: Header.Payload.Signature. The server verifies the cryptographic signature without querying the database.",
      codeSnippets: [
        {
          file: "settings.py",
          language: "python",
          code: `INSTALLED_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'api',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
}

from datetime import timedelta
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=15),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'AUTH_HEADER_TYPES': ('Bearer',),
}`
        },
        {
          file: "urls.py",
          language: "python",
          code: `from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]`
        },
        {
          file: "HTTP Headers & Request",
          language: "http",
          code: `# Request to protected endpoint
GET /api/posts/ HTTP/1.1
Host: 127.0.0.1:8000
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
        }
      ],
      keyTakeaways: [
        "Access Token: Short lifespan (15 mins), sent in Authorization: Bearer <token> header.",
        "Refresh Token: Long lifespan (1-7 days), used to obtain new access token at /api/token/refresh/.",
        "JWT parts: Header (algorithm info), Payload (claims/user_id/exp), Signature (HMAC SHA256 verification hash)."
      ]
    }
  },

  {
    id: "unit10-postman-versioning",
    title: "Unit 10 — API Testing with Postman & URL Versioning",
    unit: "Unit 10",
    content: {
      summary: "Postman testing environment variables, automated token capture scripts, and URLPathVersioning with serializer branching.",
      explanation: "Postman test scripts capture JWT access tokens automatically. URLPathVersioning allows API endpoints to evolve cleanly without breaking client applications.",
      codeSnippets: [
        {
          file: "Postman Post-response Script (Tests tab)",
          language: "javascript",
          code: `// Capture access token from POST /api/token/ response
const data = pm.response.json();
pm.environment.set("access_token", data.access);`
        },
        {
          file: "settings.py (Versioning)",
          language: "python",
          code: `REST_FRAMEWORK = {
    'DEFAULT_VERSIONING_CLASS': 'rest_framework.versioning.URLPathVersioning',
    'DEFAULT_VERSION': 'v1',
    'ALLOWED_VERSIONS': ['v1', 'v2'],
}`
        },
        {
          file: "views.py (Version Branching)",
          language: "python",
          code: `class BookViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Book.objects.all()
    serializer_class = BookSerializer

    def get_serializer_class(self):
        if self.request.version == 'v2':
            return BookSerializerV2
        return BookSerializer`
        }
      ]
    }
  }
];
