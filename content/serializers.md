A **serializer** is the translator between your Django models and the outside world. It works in two directions:

| Direction | Name | From → To | Example |
|---|---|---|---|
| Outgoing | **Serialization** | Model instance / QuerySet → Python dict → JSON | Sending a player to a mobile app |
| Incoming | **Deserialization** | JSON → Python dict → **validated** data → model instance | Saving a player that a client POSTed |

```flow
Model instance | Player(name="Virat Kohli", runs=8848)
Serializer(player).data | {"id": 1, "name": "Virat Kohli", "runs": 8848}
Renderer | JSON text sent in the response body
```

```flow
Request body (JSON) | {"name": "Rohit", "runs": 4301}
Serializer(data=request.data) | Holds the raw input
.is_valid() | Runs field checks and your validate methods
.validated_data | Clean Python values, ready to use
.save() | Calls create() or update() and returns the model instance
```

> [!EXAM] Serializer in one sentence
> A serializer converts complex data such as model instances and querysets into native Python types that can be rendered as JSON, and converts and **validates** incoming data back into Python objects. `ModelSerializer` builds the fields automatically from a model, just like `ModelForm`.

## Serializers vs forms

If you know Django forms, you know most of this already:

| Django forms | DRF serializers |
|---|---|
| `forms.Form` | `serializers.Serializer` |
| `forms.ModelForm` | `serializers.ModelSerializer` |
| `Form(request.POST)` | `Serializer(data=request.data)` |
| `form.is_valid()` | `serializer.is_valid()` |
| `form.cleaned_data` | `serializer.validated_data` |
| `form.errors` | `serializer.errors` |
| `clean_<field>()` | `validate_<field>()` |
| `clean()` | `validate()` |
| `form.save()` | `serializer.save()` |
| Renders HTML inputs | Renders JSON (`serializer.data`) |

## The example models

```python title="players/models.py"
from django.conf import settings
from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100, unique=True)
    country = models.CharField(max_length=50)

    def __str__(self):
        return self.name


class Player(models.Model):
    class Role(models.TextChoices):
        BATTER = "BAT", "Batter"
        BOWLER = "BOWL", "Bowler"
        ALL_ROUNDER = "AR", "All-rounder"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name="players")
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True,
                             related_name="players")
    name = models.CharField(max_length=100)
    role = models.CharField(max_length=4, choices=Role, default=Role.BATTER)
    test_innings = models.PositiveIntegerField(default=0)
    runs = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name
```

## A plain Serializer (the long way)

Writing a `Serializer` by hand shows what `ModelSerializer` does for you:

```python title="players/serializers.py"
from rest_framework import serializers
from .models import Player


class PlayerSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(max_length=100)
    test_innings = serializers.IntegerField(min_value=0, default=0)
    runs = serializers.IntegerField(min_value=0, default=0)

    def create(self, validated_data):
        return Player.objects.create(**validated_data)

    def update(self, instance, validated_data):
        instance.name = validated_data.get("name", instance.name)
        instance.test_innings = validated_data.get("test_innings", instance.test_innings)
        instance.runs = validated_data.get("runs", instance.runs)
        instance.save()
        return instance
```

`serializer.save()` calls `create()` if the serializer was built without an instance, or `update()` if it was given one.

## ModelSerializer (what you'll use 95% of the time)

```python title="players/serializers.py"
from rest_framework import serializers
from .models import Player


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["id", "name", "team", "role", "test_innings", "runs", "owner", "created_at"]
        read_only_fields = ["owner", "created_at"]
```

From the model, `ModelSerializer` automatically:

- creates a serializer field for each model field, with matching validation (`max_length`, `choices`, `min_value` for positive integers, `unique`...)
- marks fields with defaults or `blank=True` as not required
- implements `create()` and `update()`
- represents foreign keys as primary keys (`"team": 3`)

### Meta options

| Option | Meaning |
|---|---|
| `model` | The model class |
| `fields` | List of fields to include (or `"__all__"`, but listing is safer) |
| `exclude` | Fields to leave out (use either `fields` or `exclude`) |
| `read_only_fields` | Output-only fields; clients can't set them |
| `extra_kwargs` | Extra options per field, e.g. `{"password": {"write_only": True}}` |
| `depth` | Expand relationships into nested objects to this depth (read-only) |

> [!WARNING]
> Avoid `fields = "__all__"`. If you later add a sensitive field to the model (say `internal_notes` or `is_verified`), it would silently appear in your API and become writable.

## Using a serializer

### Serializing (output)

```python
player = Player.objects.get(pk=1)
PlayerSerializer(player).data
# {'id': 1, 'name': 'Virat Kohli', 'team': 1, 'role': 'BAT', 'test_innings': 191, ...}

PlayerSerializer(Player.objects.all(), many=True).data
# [{...}, {...}, ...]
```

### Deserializing (input) and creating

```python
serializer = PlayerSerializer(data={"name": "Rohit Sharma", "runs": 4301})
serializer.is_valid()          # True / False
serializer.validated_data      # dict of clean values (only after is_valid)
serializer.errors              # {} or {'field': ['message']}
player = serializer.save(owner=request.user)   # extra kwargs are added to validated_data
```

### Updating

```python
serializer = PlayerSerializer(player, data=request.data)                # PUT: all required fields
serializer = PlayerSerializer(player, data=request.data, partial=True)  # PATCH: any subset
serializer.is_valid(raise_exception=True)
serializer.save()
```

| Call | Result of `.save()` |
|---|---|
| `Serializer(data=...)` | `create()`: a new object |
| `Serializer(instance, data=...)` | `update()`: that object, changed |
| `Serializer(instance, data=..., partial=True)` | `update()` with only the given fields |

### Passing extra values to save()

Data that shouldn't come from the client (the owner, the current time, an IP address) is passed to `save()`:

```python
serializer.save(owner=request.user)
```

In viewsets this happens in `perform_create()`, as you'll see in [ViewSets & Routers](/learn/viewsets-routers).

## Field arguments

These work on every serializer field:

| Argument | Effect |
|---|---|
| `read_only=True` | Included in output, ignored in input |
| `write_only=True` | Accepted in input, never included in output (passwords!) |
| `required=False` | May be omitted in input |
| `default=...` | Used when omitted (implies not required) |
| `allow_null=True` | Accepts `null` |
| `allow_blank=True` | Accepts `""` (string fields) |
| `source="..."` | Read the value from a different attribute or a method |
| `validators=[...]` | Extra validation functions |
| `label`, `help_text` | Shown in the browsable API and docs |

## Validation

Validation runs during `is_valid()`, in this order:

```flow
Field validation | Types, required, max_length, min_value, choices, unique...
validators=[...] | Any validator functions attached to fields
validate_<field>(value) | Your custom check for one field
validate(attrs) | Your custom check involving several fields
```

### Field-level: validate_&lt;field_name&gt;

```python
class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["id", "name", "test_innings", "runs"]

    def validate_name(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Name must be at least 3 characters.")
        return value.strip().title()          # you may also clean the value

    def validate_runs(self, value):
        if value > 20000:
            raise serializers.ValidationError("No one has scored that many test runs.")
        return value
```

### Object-level: validate()

```python
    def validate(self, attrs):
        innings = attrs.get("test_innings", getattr(self.instance, "test_innings", 0))
        runs = attrs.get("runs", getattr(self.instance, "runs", 0))
        if runs > 0 and innings == 0:
            raise serializers.ValidationError("A player can't have runs with zero innings.")
        return attrs
```

Using `getattr(self.instance, ...)` makes this work for PATCH requests too, where `attrs` only holds the fields that were sent.

### Reusable validators

```python
from rest_framework.validators import UniqueTogetherValidator, UniqueValidator


def no_digits(value):
    if any(ch.isdigit() for ch in value):
        raise serializers.ValidationError("Names can't contain digits.")


class TeamSerializer(serializers.ModelSerializer):
    name = serializers.CharField(
        validators=[no_digits, UniqueValidator(queryset=Team.objects.all())]
    )

    class Meta:
        model = Team
        fields = ["id", "name", "country"]
```

`UniqueTogetherValidator(queryset=..., fields=["team", "name"])` in `Meta.validators` checks a combination is unique.

### What a client sees

```json
{
  "name": ["Name must be at least 3 characters."],
  "non_field_errors": ["A player can't have runs with zero innings."]
}
```

Errors raised in `validate()` appear under `non_field_errors`.

## Customising output

### Extra read-only fields from attributes and methods

```python
class PlayerSerializer(serializers.ModelSerializer):
    team_name = serializers.CharField(source="team.name", read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    owner = serializers.ReadOnlyField(source="owner.username")
    average = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = ["id", "name", "team", "team_name", "role", "role_label",
                  "test_innings", "runs", "average", "owner"]

    def get_average(self, obj):              # method name: get_<field_name>
        return round(obj.runs / obj.test_innings, 2) if obj.test_innings else None
```

```json
{
  "id": 1,
  "name": "Virat Kohli",
  "team": 1,
  "team_name": "India",
  "role": "BAT",
  "role_label": "Batter",
  "test_innings": 191,
  "runs": 8848,
  "average": 46.32,
  "owner": "admin"
}
```

- `source="team.name"` follows attributes with dots.
- `SerializerMethodField` calls `get_<name>(self, obj)` and is always read-only.

### Full control with to_representation()

```python
    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["name"] = data["name"].upper()
        if not self.context["request"].user.is_staff:
            data.pop("owner", None)          # hide a field from non-staff
        return data
```

### Context

Views pass the `request` into `serializer.context` automatically (generic views and viewsets do). Use it to customise output per user:

```python
def get_is_mine(self, obj):
    request = self.context.get("request")
    return request is not None and obj.owner_id == request.user.id
```

When you create a serializer yourself, pass it: `PlayerSerializer(player, context={"request": request})`.

## Relationships

How should `team` appear in JSON? DRF gives you several choices:

| Field | Output for `team` | Writable? |
|---|---|---|
| `PrimaryKeyRelatedField` (default) | `3` | Yes, by id |
| `StringRelatedField` | `"India"` (uses `__str__`) | No |
| `SlugRelatedField(slug_field="name")` | `"India"` | Yes, by that field |
| `HyperlinkedRelatedField` | `"http://.../api/teams/3/"` | Yes, by URL |
| A nested serializer | `{"id": 3, "name": "India", "country": "India"}` | Read-only unless you write `create()` |

```python
class PlayerSerializer(serializers.ModelSerializer):
    team = serializers.SlugRelatedField(slug_field="name", queryset=Team.objects.all())
```

Now clients send `"team": "India"` instead of an id.

### Nested serializers

```python
class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "name", "country"]


class PlayerSerializer(serializers.ModelSerializer):
    team = TeamSerializer(read_only=True)                     # nested object for output
    team_id = serializers.PrimaryKeyRelatedField(             # id for input
        queryset=Team.objects.all(), source="team", write_only=True, allow_null=True
    )

    class Meta:
        model = Player
        fields = ["id", "name", "team", "team_id", "runs"]
```

This common pattern gives clients a rich nested object to read, and a simple id to write.

Reverse relationships work too:

```python
class TeamDetailSerializer(serializers.ModelSerializer):
    players = PlayerSerializer(many=True, read_only=True)   # uses related_name="players"

    class Meta:
        model = Team
        fields = ["id", "name", "country", "players"]
```

> [!TIP] Avoid N+1 queries
> Nested serializers touch related objects for every item. In the view, use `Player.objects.select_related("team")` and `Team.objects.prefetch_related("players")`. See [The ORM](/learn/orm#select_related-and-prefetch_related).

### Writable nested serializers

DRF doesn't guess how to save nested data; you write it:

```python
class PlayerInputSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["name", "role", "test_innings", "runs"]


class TeamWithPlayersSerializer(serializers.ModelSerializer):
    players = PlayerInputSerializer(many=True)

    class Meta:
        model = Team
        fields = ["id", "name", "country", "players"]

    def create(self, validated_data):
        players_data = validated_data.pop("players")
        team = Team.objects.create(**validated_data)
        for p in players_data:
            Player.objects.create(team=team, owner=self.context["request"].user, **p)
        return team
```

## HyperlinkedModelSerializer

Uses URLs instead of ids to identify objects, making the API easier to navigate:

```python
class TeamSerializer(serializers.HyperlinkedModelSerializer):
    class Meta:
        model = Team
        fields = ["url", "id", "name", "country"]
```

```json
{ "url": "http://127.0.0.1:8000/api/teams/3/", "id": 3, "name": "India", "country": "India" }
```

It needs `context={"request": request}` and URL names that match the router's `basename` (e.g. `team-detail`).

## Example: a user registration serializer

Passwords must be **write-only** and **hashed**, so override `create()` to use `create_user()`:

```python title="accounts/serializers.py"
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True, label="Confirm password")

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "password2"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password2": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        validated_data.pop("password2")
        return User.objects.create_user(**validated_data)   # hashes the password
```

The response contains `id`, `username` and `email`, never the password.

## A complete example: the Player API serializers

```python title="players/serializers.py"
from rest_framework import serializers
from .models import Player, Team


class TeamSerializer(serializers.ModelSerializer):
    player_count = serializers.IntegerField(source="players.count", read_only=True)

    class Meta:
        model = Team
        fields = ["id", "name", "country", "player_count"]


class PlayerSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.username")
    team = TeamSerializer(read_only=True)
    team_id = serializers.PrimaryKeyRelatedField(
        queryset=Team.objects.all(), source="team", write_only=True,
        required=False, allow_null=True,
    )
    average = serializers.SerializerMethodField()

    class Meta:
        model = Player
        fields = ["id", "name", "role", "team", "team_id", "test_innings", "runs",
                  "average", "owner", "created_at"]
        read_only_fields = ["created_at"]

    def get_average(self, obj):
        return round(obj.runs / obj.test_innings, 2) if obj.test_innings else None

    def validate_name(self, value):
        if len(value.strip()) < 3:
            raise serializers.ValidationError("Name must be at least 3 characters.")
        return value.strip()

    def validate(self, attrs):
        innings = attrs.get("test_innings", getattr(self.instance, "test_innings", 0))
        runs = attrs.get("runs", getattr(self.instance, "runs", 0))
        if runs and not innings:
            raise serializers.ValidationError("Runs require at least one innings.")
        return attrs
```

## Summary

| Task | How |
|---|---|
| Model → JSON | `Serializer(instance).data`, `many=True` for lists |
| JSON → validated data | `Serializer(data=...)` + `is_valid()` + `validated_data` |
| Create / update | `serializer.save()`; pass `instance` (and `partial=True`) to update |
| Set server-side values | `serializer.save(owner=request.user)` |
| Output only | `read_only=True` / `read_only_fields` |
| Input only | `write_only=True` (passwords) |
| One-field rule | `validate_<field>(self, value)` returning the value |
| Multi-field rule | `validate(self, attrs)` returning attrs |
| Computed field | `SerializerMethodField` + `get_<name>()` |
| Value from elsewhere | `source="team.name"` |
| Related object | PK, slug, string, hyperlink or nested serializer |

## Check yourself

<details>
<summary>What's the difference between <code>serializer.data</code> and <code>serializer.validated_data</code>?</summary>

`data` is the serialized output representation (for responses). `validated_data` is the cleaned input after `is_valid()`, used to create or update objects.
</details>

<details>
<summary>How do you make a password field accepted on input but never shown in responses?</summary>

Declare it with `write_only=True`, e.g. `password = serializers.CharField(write_only=True)`, or via `extra_kwargs`.
</details>

<details>
<summary>How do you set <code>owner = request.user</code> when saving through a serializer?</summary>

Pass it to save: `serializer.save(owner=request.user)`. Keep `owner` read-only in the serializer so clients can't set it.
</details>

<details>
<summary>When is <code>create()</code> called and when is <code>update()</code> called?</summary>

`save()` calls `create()` when the serializer was built without an instance, and `update()` when an existing instance was passed in.
</details>

<details>
<summary>Where do errors raised in <code>validate()</code> appear in the response?</summary>

Under the `non_field_errors` key (unless you raise a dict mapping errors to specific fields).
</details>
