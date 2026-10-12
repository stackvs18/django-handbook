Every time a user sends you data, through a sign-up form, a comment box or a search field, you must answer three questions: *Is it all there? Is it the right type? Is it safe?* Django's **forms** answer them for you. A form class can:

- **render** HTML inputs,
- **validate** submitted data (required fields, types, lengths, custom rules),
- **clean** it into proper Python values (`"42"` → `42`, `"2025-01-06"` → `date`),
- **re-display** the form with error messages when something's wrong.

There are two kinds:

| Class | Fields come from | Use when |
|---|---|---|
| `forms.Form` | You define every field | The data isn't saved as one model (contact form, search, login) |
| `forms.ModelForm` | A model, automatically | Creating or editing a model instance (most forms) |

## A plain Form

```python title="pages/forms.py"
from django import forms


class ContactForm(forms.Form):
    name = forms.CharField(max_length=100)
    email = forms.EmailField()
    subject = forms.ChoiceField(choices=[("help", "Help"), ("feedback", "Feedback")])
    message = forms.CharField(widget=forms.Textarea(attrs={"rows": 5}))
    copy_me = forms.BooleanField(required=False, label="Send me a copy")
```

### The standard view pattern

Memorise this shape. Nearly every form view looks like it:

```python title="pages/views.py"
from django.shortcuts import redirect, render
from .forms import ContactForm


def contact(request):
    if request.method == "POST":
        form = ContactForm(request.POST)         # 1. bind the submitted data
        if form.is_valid():                      # 2. validate
            data = form.cleaned_data             # 3. use the clean values
            send_message(data["email"], data["message"])
            return redirect("contact_thanks")    # 4. redirect (PRG)
    else:
        form = ContactForm()                     # empty, unbound form for GET
    return render(request, "pages/contact.html", {"form": form})  # 5. errors re-render
```

If the data is invalid, the view falls through to `render()` with the **same bound form**, which now carries the user's input and the error messages.

### Rendering it

```django title="pages/templates/pages/contact.html"
<form method="post" novalidate>
  {% csrf_token %}
  {{ form.as_p }}
  <button type="submit">Send</button>
</form>
```

| Method | Output |
|---|---|
| `{{ form }}` | Default layout (div-based in modern Django) |
| `{{ form.as_div }}` | Each field wrapped in a `<div>` |
| `{{ form.as_p }}` | Each field wrapped in `<p>` |
| `{{ form.as_ul }}` | `<li>` elements (you supply the `<ul>`) |
| `{{ form.as_table }}` | Table rows (you supply the `<table>`) |

For full design control, render fields one by one:

```django
<form method="post">
  {% csrf_token %}
  {{ form.non_field_errors }}

  {% for field in form %}
    <div class="field">
      {{ field.label_tag }}
      {{ field }}
      {% if field.help_text %}<small>{{ field.help_text }}</small>{% endif %}
      {% for error in field.errors %}<p class="error">{{ error }}</p>{% endfor %}
    </div>
  {% endfor %}

  <button type="submit">Send</button>
</form>
```

Or pick a specific one: `{{ form.email }}`, `{{ form.email.errors }}`, `{{ form.email.label }}`, `{{ form.email.value }}`.

## Bound and unbound forms

| | Unbound | Bound |
|---|---|---|
| Created with | `ContactForm()` | `ContactForm(request.POST)` |
| Has data? | No | Yes |
| Can validate? | No | Yes, with `is_valid()` |
| Typical use | Show an empty form | Process a submission |

`form.is_bound` tells you which you have.

## Common form fields

| Field | HTML input | Cleans to |
|---|---|---|
| `CharField` | text | `str` |
| `EmailField` | email | `str` (validated) |
| `IntegerField` / `DecimalField` / `FloatField` | number | `int` / `Decimal` / `float` |
| `BooleanField` | checkbox | `bool` (use `required=False`!) |
| `ChoiceField` / `MultipleChoiceField` | select | `str` / `list` |
| `DateField` / `DateTimeField` | text (or date with a widget) | `date` / `datetime` |
| `URLField` | url | `str` |
| `FileField` / `ImageField` | file | uploaded file |
| `ModelChoiceField(queryset=...)` | select | a model instance |
| `ModelMultipleChoiceField(...)` | multi-select | a QuerySet |

Common arguments: `required`, `label`, `initial`, `help_text`, `widget`, `validators`, `error_messages`, `disabled`, `max_length`, `min_value`, `max_value`.

> [!WARNING] BooleanField is required by default
> A required checkbox must be ticked to pass validation. For an optional checkbox, set `required=False`.

## Widgets

A **widget** controls the HTML for a field, separate from validation:

```python
class EventForm(forms.Form):
    title = forms.CharField(widget=forms.TextInput(attrs={"placeholder": "Event name", "class": "input"}))
    date = forms.DateField(widget=forms.DateInput(attrs={"type": "date"}))
    notes = forms.CharField(widget=forms.Textarea(attrs={"rows": 3}), required=False)
    password = forms.CharField(widget=forms.PasswordInput)
    level = forms.ChoiceField(choices=[("b", "Beginner"), ("a", "Advanced")], widget=forms.RadioSelect)
    topics = forms.MultipleChoiceField(
        choices=[("orm", "ORM"), ("drf", "DRF")], widget=forms.CheckboxSelectMultiple
    )
```

## Validation, step by step

When you call `form.is_valid()`, Django runs, for each field:

```flow
Field.clean() | Built-in checks: required, type conversion, max_length, email format...
validators | Any validators=[...] you attached to the field
clean_<fieldname>() | Your custom method for that one field
clean() | Your cross-field method, after all fields are done
```

If everything passes, `form.cleaned_data` holds the clean values and `is_valid()` returns `True`. Otherwise errors are stored in `form.errors`.

### Validating one field: clean_&lt;field&gt;()

```python
class RegisterForm(forms.Form):
    username = forms.CharField(max_length=30)
    age = forms.IntegerField()

    def clean_username(self):
        username = self.cleaned_data["username"]
        if " " in username:
            raise forms.ValidationError("Username cannot contain spaces.")
        if User.objects.filter(username__iexact=username).exists():
            raise forms.ValidationError("That username is taken.")
        return username.lower()      # ALWAYS return the (possibly changed) value

    def clean_age(self):
        age = self.cleaned_data["age"]
        if age < 13:
            raise forms.ValidationError("You must be at least 13.")
        return age
```

### Validating several fields together: clean()

```python
class PasswordForm(forms.Form):
    password = forms.CharField(widget=forms.PasswordInput)
    confirm = forms.CharField(widget=forms.PasswordInput)

    def clean(self):
        cleaned = super().clean()
        if cleaned.get("password") != cleaned.get("confirm"):
            raise forms.ValidationError("Passwords do not match.")   # a non-field error
            # or attach it to one field:
            # self.add_error("confirm", "Passwords do not match.")
        return cleaned
```

Use `.get()` in `clean()`: a field that failed its own validation is missing from `cleaned_data`.

### Errors

```python
form.errors                # {'email': ['Enter a valid email address.']}
form.errors.as_json()
form.non_field_errors()    # errors raised in clean()
form.has_error("email")
```

> [!REMEMBER] Validation is server-side
> HTML attributes like `required` help users, but anyone can bypass them. Django's validation runs on the server and can't be skipped, so never trust input that hasn't passed `is_valid()`.

## ModelForm

When a form maps to a model, let Django build the fields:

```python title="cricket/forms.py"
from django import forms
from .models import Player


class PlayerForm(forms.ModelForm):
    class Meta:
        model = Player
        fields = ["name", "team", "runs", "innings", "debut"]   # or "__all__" (not recommended)
        labels = {"innings": "Test innings"}
        help_texts = {"runs": "Career test runs"}
        widgets = {"debut": forms.DateInput(attrs={"type": "date"})}

    def clean_runs(self):
        runs = self.cleaned_data["runs"]
        if runs > 20000:
            raise forms.ValidationError("That's more than anyone has ever scored!")
        return runs
```

- Fields, types, `max_length`, `choices`, `blank` and model validators come from the model.
- `fields` should list fields explicitly. `exclude = [...]` is the opposite. Avoid `"__all__"`: adding a sensitive field to the model later would expose it in the form.

### Create and update views with a ModelForm

```python title="cricket/views.py"
from django.shortcuts import get_object_or_404, redirect, render
from .forms import PlayerForm
from .models import Player


def player_create(request):
    form = PlayerForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        player = form.save()                  # INSERT
        return redirect("player_detail", pk=player.pk)
    return render(request, "cricket/player_form.html", {"form": form})


def player_update(request, pk):
    player = get_object_or_404(Player, pk=pk)
    form = PlayerForm(request.POST or None, instance=player)   # instance = edit mode
    if request.method == "POST" and form.is_valid():
        form.save()                           # UPDATE
        return redirect("player_detail", pk=player.pk)
    return render(request, "cricket/player_form.html", {"form": form, "player": player})
```

- `instance=player` pre-fills the form and makes `save()` update that row.
- `request.POST or None` is a neat shortcut: bound on POST, unbound on GET.

### save(commit=False)

Need to set something the user doesn't fill in, like the owner? Build the object without saving, adjust it, then save:

```python
if form.is_valid():
    post = form.save(commit=False)
    post.author = request.user
    post.save()
    form.save_m2m()   # needed only when commit=False AND the form has many-to-many fields
```

## Forms with files

```python
form = ProfileForm(request.POST, request.FILES, instance=profile)
```

And the template form needs `enctype="multipart/form-data"`. See [Static & Media Files](/learn/static-and-media).

## Initial values

```python
form = PlayerForm(initial={"runs": 0, "team": default_team})
```

## Formsets: many forms at once

A **formset** manages several copies of a form on one page, such as adding five players at once:

```python
from django.forms import modelformset_factory

PlayerFormSet = modelformset_factory(Player, fields=["name", "runs"], extra=3)


def bulk_add(request):
    formset = PlayerFormSet(request.POST or None, queryset=Player.objects.none())
    if request.method == "POST" and formset.is_valid():
        formset.save()
        return redirect("player_list")
    return render(request, "cricket/bulk_add.html", {"formset": formset})
```

```django
<form method="post">
  {% csrf_token %}
  {{ formset.management_form }}
  {% for form in formset %}{{ form.as_p }}<hr>{% endfor %}
  <button>Save all</button>
</form>
```

`inlineformset_factory(Team, Player, ...)` does the same for children of one parent object.

## CSRF and forms

Every form with `method="post"` must include `{% csrf_token %}` inside the `<form>` tag. Without it, Django rejects the submission with **403 Forbidden**. The full story is in [Security Essentials](/learn/security#csrf-cross-site-request-forgery).

## Django's built-in auth forms

Django ships ready-made forms for accounts in `django.contrib.auth.forms`:

| Form | Purpose |
|---|---|
| `UserCreationForm` | Sign up: username, password, password confirmation |
| `AuthenticationForm` | Log in: username and password |
| `PasswordChangeForm` | Change password while logged in (asks for the old one) |
| `SetPasswordForm` | Set a new password without the old one |
| `PasswordResetForm` | Request a reset email |
| `UserChangeForm` | Edit a user (used by the admin) |

They're covered with full examples in [Users & Authentication](/learn/authentication).

## Summary

| Concept | Remember |
|---|---|
| `Form` vs `ModelForm` | Manual fields vs fields built from a model |
| Bind data | `Form(request.POST)` (+ `request.FILES`) |
| Validate | `form.is_valid()` |
| Clean values | `form.cleaned_data` (only after `is_valid()`) |
| One-field rule | `clean_<field>()`, must return the value |
| Multi-field rule | `clean()` |
| Edit existing | `ModelForm(..., instance=obj)` |
| Set hidden values | `form.save(commit=False)` |
| POST forms | `{% csrf_token %}` |

## Check yourself

<details>
<summary>What's the difference between <code>clean_email()</code> and <code>clean()</code>?</summary>

`clean_email()` validates a single field and must return its value. `clean()` runs after all fields and is used for rules involving several fields, such as "password and confirmation must match".
</details>

<details>
<summary>When is <code>form.cleaned_data</code> available?</summary>

Only after calling `form.is_valid()`. It contains the validated and converted values.
</details>

<details>
<summary>How do you make a ModelForm update an existing object instead of creating a new one?</summary>

Pass `instance=obj` when creating the form: `PlayerForm(request.POST, instance=player)`.
</details>

<details>
<summary>Why use <code>save(commit=False)</code>?</summary>

To get the unsaved model instance so you can set extra fields (e.g. `author = request.user`) before saving it yourself.
</details>
