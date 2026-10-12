import { indent, settings } from "./project";
import { bool, list, num, py, str, tone, type Lab, type LabState } from "./types";

const DRF = ["djangorestframework"];

const TEAM_PLAYER_MODELS = `from django.conf import settings
from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Player(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    team = models.ForeignKey(Team, on_delete=models.SET_NULL, null=True, blank=True, related_name="players")
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=50, blank=True)
    test_innings = models.PositiveIntegerField(default=0)
    runs = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name
`;

const TEAM_PLAYER_SEED = `from django.contrib.auth.models import User

from players.models import Player, Team

alice = User.objects.create_user("alice", password="alice-pass-123")
User.objects.create_user("bob", password="bob-pass-123")
User.objects.create_user("staff", password="staff-pass-123", is_staff=True)
india = Team.objects.create(name="India")
england = Team.objects.create(name="England")
Team.objects.create(name="Australia")
for name, team, country, innings, runs, owner in [
    ("Virat Kohli", india, "India", 191, 8848, alice),
    ("Joe Root", england, "England", 278, 12972, None),
    ("Rohit Sharma", india, "India", 116, 4301, None),
    ("Steve Smith", None, "Australia", 199, 9685, None),
    ("Kane Williamson", None, "New Zealand", 179, 8881, None),
    ("Ben Stokes", england, "England", 197, 6719, None),
    ("Shubman Gill", india, "India", 59, 1893, None),
]:
    Player.objects.create(name=name, team=team, country=country, test_innings=innings, runs=runs, owner=owner)
`;

function apiSettings(extra: string, apps = ["rest_framework", "players"]) {
  return settings({ apps, extra });
}

// ===========================================================================
// serializers.py
// ===========================================================================

function serializerCode(s: LabState) {
  const model = str(s, "base") === "model";
  const fields = list(s, "fields");
  const readOnly = list(s, "readOnly").filter((f) => fields.includes(f));
  const rules = list(s, "rules");
  const teamStyle = str(s, "teamStyle");
  const declared: string[] = [];

  if (fields.includes("team")) {
    if (teamStyle === "string") declared.push("team = serializers.StringRelatedField()");
    if (teamStyle === "slug") declared.push('team = serializers.SlugRelatedField(slug_field="name", queryset=Team.objects.all())');
    if (teamStyle === "nested") declared.push("team = TeamSerializer(read_only=True)");
    if (teamStyle === "pk" && !model) declared.push("team = serializers.PrimaryKeyRelatedField(queryset=Team.objects.all(), allow_null=True)");
  }
  if (fields.includes("average")) declared.push("average = serializers.SerializerMethodField()");

  if (!model) {
    const manual: Record<string, string> = {
      id: "id = serializers.IntegerField(read_only=True)",
      name: "name = serializers.CharField(max_length=100)",
      country: 'country = serializers.CharField(max_length=50, required=False, default="")',
      test_innings: "test_innings = serializers.IntegerField(min_value=0, default=0)",
      runs: "runs = serializers.IntegerField(min_value=0, default=0)",
    };
    for (const f of ["id", "name", "country", "test_innings", "runs"]) {
      if (!fields.includes(f)) continue;
      let line = manual[f];
      if (readOnly.includes(f) && f !== "id") line = line.replace(/\)$/, ", read_only=True)").replace("(, ", "(");
      declared.unshift(line);
    }
  }

  const ordered = ["id", "name", "country", "team", "test_innings", "runs", "average"].filter((f) => fields.includes(f));
  const meta = model
    ? `\n\nclass Meta:\n    model = Player\n    fields = [${ordered.map((f) => py(f)).join(", ")}]${
        readOnly.length ? `\n    read_only_fields = [${readOnly.map((f) => py(f)).join(", ")}]` : ""
      }`
    : "";

  const methods: string[] = [];
  if (fields.includes("average")) {
    methods.push(`def get_average(self, obj):
    return round(obj.runs / obj.test_innings, 2) if obj.test_innings else None`);
  }
  if (rules.includes("name") && fields.includes("name")) {
    methods.push(`def validate_name(self, value):
    if len(value.strip()) < 3:
        raise serializers.ValidationError("Name must be at least 3 characters.")
    return value.strip().title()`);
  }
  if (rules.includes("runs") && fields.includes("runs")) {
    methods.push(`def validate_runs(self, value):
    if value > 20000:
        raise serializers.ValidationError("Nobody has scored that many Test runs.")
    return value`);
  }
  if (rules.includes("cross")) {
    methods.push(`def validate(self, attrs):
    if attrs.get("runs") and not attrs.get("test_innings"):
        raise serializers.ValidationError("Runs need at least one innings.")
    return attrs`);
  }
  if (!model) {
    methods.push(`def create(self, validated_data):
    return Player.objects.create(**validated_data)

def update(self, instance, validated_data):
    for key, value in validated_data.items():
        setattr(instance, key, value)
    instance.save()
    return instance`);
  }

  const body = [declared.join("\n") + meta, ...methods].filter((b) => b.trim()).join("\n\n");
  const team =
    fields.includes("team") && teamStyle === "nested"
      ? `class TeamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Team
        fields = ["id", "name"]


`
      : "";
  return `from rest_framework import serializers

from .models import Player, Team


${team}class PlayerSerializer(serializers.${model ? "ModelSerializer" : "Serializer"}):
${indent(body || "pass")}
`;
}

const serializersLab: Lab = {
  slug: "serializers",
  title: "Serializers",
  file: "serializers.py",
  group: "REST APIs",
  summary: "Choose fields, relations and validation rules. See the JSON a player becomes, and what happens to JSON sent in.",
  chapter: "serializers",
  packages: DRF,
  initial: {
    base: "model",
    fields: ["id", "name", "team", "runs", "test_innings", "average"],
    readOnly: [],
    teamStyle: "pk",
    rules: ["name", "cross"],
    input: '{\n  "name": "al",\n  "team": 1,\n  "runs": 120,\n  "test_innings": 0\n}',
  },
  controls: [
    {
      type: "segmented",
      key: "base",
      label: "Class",
      options: [
        { value: "model", label: "ModelSerializer" },
        { value: "plain", label: "Serializer" },
      ],
    },
    {
      type: "checklist",
      key: "fields",
      label: "Fields",
      options: ["id", "name", "country", "team", "test_innings", "runs", "average"].map((f) => ({
        value: f,
        label: f === "average" ? "average (SerializerMethodField)" : f,
      })),
    },
    {
      type: "select",
      key: "teamStyle",
      label: "team appears as",
      options: [
        { value: "pk", label: "PrimaryKeyRelatedField → 1" },
        { value: "string", label: 'StringRelatedField → "India"' },
        { value: "slug", label: 'SlugRelatedField(name) → "India"' },
        { value: "nested", label: "Nested TeamSerializer → {…}" },
      ],
      when: (s) => list(s, "fields").includes("team"),
    },
    {
      type: "checklist",
      key: "readOnly",
      label: "read_only",
      options: ["name", "country", "test_innings", "runs"].map((f) => ({ value: f, label: f })),
    },
    {
      type: "checklist",
      key: "rules",
      label: "Validation",
      options: [
        { value: "name", label: "validate_name(): 3+ chars" },
        { value: "runs", label: "validate_runs(): ≤ 20000" },
        { value: "cross", label: "validate(): runs need innings" },
      ],
    },
    { type: "textarea", key: "input", label: "JSON sent by a client (POST)", rows: 7, mono: true },
  ],
  build: (s) => ({
    focus: "players/serializers.py",
    files: {
      "config/settings.py": apiSettings(""),
      "config/urls.py": `urlpatterns = []
`,
      "players/models.py": TEAM_PLAYER_MODELS,
      "players/serializers.py": serializerCode(s),
      "seed.py": TEAM_PLAYER_SEED,
    },
  }),
  probe: (s) => String.raw`
from players.models import Player
from players.serializers import PlayerSerializer

one = PlayerSerializer(Player.objects.select_related("team").get(name="Virat Kohli")).data
many = PlayerSerializer(Player.objects.select_related("team")[:2], many=True).data
try:
    incoming = json.loads(${py(str(s, "input"))})
    parse_error = None
except json.JSONDecodeError as exc:
    incoming, parse_error = {}, str(exc)
ser = PlayerSerializer(data=incoming)
valid = ser.is_valid()
saved = None
if valid:
    obj = ser.save()
    saved = PlayerSerializer(obj).data
result = {
    "one": one,
    "many": many,
    "valid": valid,
    "errors": ser.errors,
    "validated": {k: short(v) for k, v in getattr(ser, "validated_data", {}).items()} if valid else {},
    "saved": saved,
    "parse_error": parse_error,
}
`,
  present: (r) => [
    { kind: "json", title: "Serializer(player).data", value: r.one },
    { kind: "json", title: "many=True", value: r.many },
    {
      kind: "json",
      title: "is_valid()",
      value: r.parse_error
        ? { error: `Invalid JSON: ${r.parse_error}` }
        : r.valid
          ? { "is_valid()": true, validated_data: r.validated, "save() returned": r.saved }
          : { "is_valid()": false, errors: r.errors },
    },
  ],
  notes: (s, r) => {
    const notes = [
      str(s, "base") === "model"
        ? "ModelSerializer reads the Player model: field types, max_length, required/optional and create()/update() come for free."
        : "A plain Serializer declares every field by hand and needs its own create() and update().",
    ];
    if (list(s, "fields").includes("team")) {
      const t: Record<string, string> = {
        pk: "The default for a ForeignKey: the team's id.",
        string: "StringRelatedField uses the team's __str__ and is read-only.",
        slug: "SlugRelatedField shows (and accepts) the team's name instead of its id.",
        nested: "A nested serializer embeds the whole team object; it's read-only unless you write create().",
      };
      notes.push(t[str(s, "teamStyle")]);
    }
    if (list(s, "fields").includes("average")) notes.push("SerializerMethodField calls get_average(obj): computed, read-only output.");
    if (list(s, "readOnly").length) notes.push("read_only fields appear in the output but are ignored in input.");
    if (r && r.valid === false) notes.push("Field errors are listed per field; errors from validate() appear under non_field_errors.");
    return notes;
  },
};

// ===========================================================================
// ViewSets & routers
// ===========================================================================

const VIEWSETS: Record<string, { base: string; label: string }> = {
  model: { base: "viewsets.ModelViewSet", label: "ModelViewSet" },
  readonly: { base: "viewsets.ReadOnlyModelViewSet", label: "ReadOnlyModelViewSet" },
  mixins: {
    base: "mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet",
    label: "List + Create + Retrieve mixins",
  },
};

function viewsetCode(s: LabState) {
  const vs = VIEWSETS[str(s, "viewset")] ?? VIEWSETS.model;
  const actions: string[] = [];
  if (bool(s, "listAction")) {
    actions.push(`@action(detail=False)
def top(self, request):
    best = self.get_queryset().order_by("-runs")[:3]
    return Response(self.get_serializer(best, many=True).data)`);
  }
  if (bool(s, "detailAction")) {
    actions.push(`@action(detail=True, methods=["post"], url_path="add-runs")
def add_runs(self, request, pk=None):
    player = self.get_object()
    player.runs += int(request.data.get("runs", 0))
    player.save()
    return Response(self.get_serializer(player).data)`);
  }
  return `from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Player
from .serializers import PlayerSerializer


class PlayerViewSet(${vs.base}):
    queryset = Player.objects.all()
    serializer_class = PlayerSerializer
${actions.length ? "\n" + indent(actions.join("\n\n")) + "\n" : ""}`;
}

const viewsetsLab: Lab = {
  slug: "viewsets",
  title: "ViewSets & routers",
  file: "views.py",
  group: "REST APIs",
  summary: "Pick a ViewSet and a router and see every URL it generates, then which HTTP methods each one accepts.",
  chapter: "viewsets-routers",
  packages: DRF,
  initial: { viewset: "model", router: "DefaultRouter", prefix: "players", listAction: true, detailAction: false },
  controls: [
    {
      type: "segmented",
      key: "viewset",
      label: "ViewSet",
      options: Object.entries(VIEWSETS).map(([value, v]) => ({ value, label: v.label })),
    },
    {
      type: "segmented",
      key: "router",
      label: "Router",
      options: [
        { value: "DefaultRouter", label: "DefaultRouter" },
        { value: "SimpleRouter", label: "SimpleRouter" },
      ],
    },
    { type: "text", key: "prefix", label: "router.register(prefix, …)", mono: true },
    { type: "toggle", key: "listAction", label: "@action(detail=False): top" },
    { type: "toggle", key: "detailAction", label: '@action(detail=True, methods=["post"]): add-runs' },
  ],
  build: (s) => {
    const prefix = str(s, "prefix").replace(/[^a-z0-9_-]/gi, "") || "players";
    return {
      focus: "players/views.py",
      files: {
        "config/settings.py": apiSettings(`REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}`),
        "config/urls.py": `from django.urls import include, path
from rest_framework.routers import ${str(s, "router")}

from players.views import PlayerViewSet

router = ${str(s, "router")}()
router.register(${py(prefix)}, PlayerViewSet, basename="player")

urlpatterns = [
    path("api/", include(router.urls)),
]
`,
        "players/models.py": TEAM_PLAYER_MODELS,
        "players/serializers.py": `from rest_framework import serializers

from .models import Player


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["id", "name", "country", "runs"]
`,
        "players/views.py": viewsetCode(s),
        "seed.py": TEAM_PLAYER_SEED,
      },
    };
  },
  probe: (s) => {
    const prefix = str(s, "prefix").replace(/[^a-z0-9_-]/gi, "") || "players";
    return String.raw`
from django.db import transaction
from config.urls import router

urls = []
for p in router.urls:
    if "format" in str(p.pattern):
        continue  # DefaultRouter also adds .json-style format suffix routes
    callback = p.callback
    actions = getattr(callback, "actions", None) or {}
    urls.append(["/api/" + str(p.pattern).lstrip("^").rstrip("$").replace("\\.", "."), p.name or "", ", ".join(f"{m.upper()}→{a}" for m, a in actions.items()) or "API root"])

tests = [
    ("GET", "/api/"),
    ("GET", "/api/${prefix}/"),
    ("POST", "/api/${prefix}/"),
    ("GET", "/api/${prefix}/1/"),
    ("PUT", "/api/${prefix}/1/"),
    ("PATCH", "/api/${prefix}/1/"),
    ("DELETE", "/api/${prefix}/2/"),
    ("GET", "/api/${prefix}/top/"),
    ("POST", "/api/${prefix}/1/add-runs/"),
]
bodies = {"POST": {"name": "Shubman Gill", "runs": 1893}, "PUT": {"name": "Virat Kohli", "country": "India", "runs": 9000}, "PATCH": {"runs": 9100}}
rows = []
for method, path in tests:
    with transaction.atomic():
        body = {"runs": 50} if path.endswith("add-runs/") else bodies.get(method)
        r = request(path, method=method, body=body)
        transaction.set_rollback(True)
    rows.append([method, path, r["status"], r["reason"], r["body"][:70]])
result = {"urls": urls, "rows": rows}
`;
  },
  present: (r) => [
    {
      kind: "table",
      title: "Generated URLs",
      caption: "router.urls: one register() call produced all of these.",
      columns: ["URL pattern", "Name", "Method → action"],
      rows: (r.urls as string[][]).map(([url, ...rest]) => [url.replace(/\(\?P<(\w+)>[^)]+\)/g, "{$1}"), ...rest]),
    },
    {
      kind: "matrix",
      title: "Requests",
      caption: "Each request ran in a transaction that was rolled back, so they don't affect each other.",
      columns: ["Path", "Status", "Body"],
      rows: (r.rows as [string, string, number, string, string][]).map(([method, path, status, reason, body]) => ({
        label: method,
        cells: [{ text: path }, { text: `${status} ${reason}`, tone: tone(status) }, { text: body, tone: "muted" }],
      })),
    },
  ],
  notes: (s) => {
    const notes = [
      "A router maps HTTP methods to ViewSet actions: GET list → list(), POST → create(), GET one → retrieve(), PUT → update(), PATCH → partial_update(), DELETE → destroy().",
    ];
    if (str(s, "viewset") === "readonly") notes.push("ReadOnlyModelViewSet only has list() and retrieve(): POST, PUT, PATCH and DELETE get 405 Method Not Allowed.");
    if (str(s, "viewset") === "mixins") notes.push("With mixins you choose actions one by one: no Update or Destroy mixin, so PUT/PATCH/DELETE are 405.");
    notes.push(
      str(s, "router") === "DefaultRouter"
        ? "DefaultRouter adds an API root at /api/ listing your endpoints."
        : "SimpleRouter has no API root, so GET /api/ is 404.",
    );
    if (bool(s, "listAction") || bool(s, "detailAction")) notes.push("`@action` methods get their own URLs: detail=False on the list, detail=True on one object.");
    return notes;
  },
};

// ===========================================================================
// permissions
// ===========================================================================

const PERMISSIONS = ["AllowAny", "IsAuthenticated", "IsAuthenticatedOrReadOnly", "IsAdminUser", "IsOwnerOrReadOnly", "DjangoModelPermissions"];

function permissionViews(s: LabState) {
  const perm = str(s, "permission");
  const custom = perm === "IsOwnerOrReadOnly";
  const permRef = custom ? "IsOwnerOrReadOnly" : `permissions.${perm}`;
  return `from rest_framework import permissions, viewsets

from .models import Player
from .permissions import IsOwnerOrReadOnly
from .serializers import PlayerSerializer


class PlayerViewSet(viewsets.ModelViewSet):
    serializer_class = PlayerSerializer
    permission_classes = [${permRef}]

    def get_queryset(self):
${
  bool(s, "ownOnly")
    ? `        if self.request.user.is_authenticated:
            return Player.objects.filter(owner=self.request.user)
        return Player.objects.none()`
    : "        return Player.objects.all()"
}

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(owner=user if user.is_authenticated else None)
`;
}

const permissionsLab: Lab = {
  slug: "permissions",
  title: "API permissions",
  file: "views.py",
  group: "REST APIs",
  summary: "Pick a permission class and see a full matrix of who can list, create, read, edit and delete. Real requests, real status codes.",
  chapter: "api-permissions",
  packages: DRF,
  initial: { permission: "IsAuthenticatedOrReadOnly", ownOnly: false },
  controls: [
    { type: "select", key: "permission", label: "permission_classes", options: PERMISSIONS.map((p) => ({ value: p, label: p })) },
    { type: "toggle", key: "ownOnly", label: "get_queryset(): only my own players" },
  ],
  build: (s) => ({
    focus: "players/views.py",
    files: {
      "config/settings.py": apiSettings(`REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.BasicAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}`),
      "config/urls.py": `from django.urls import include, path
from rest_framework.routers import DefaultRouter

from players.views import PlayerViewSet

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")

urlpatterns = [path("api/", include(router.urls))]
`,
      "players/models.py": TEAM_PLAYER_MODELS,
      "players/permissions.py": `from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsOwnerOrReadOnly(BasePermission):
    """Anyone may read; only the owner may change a player."""

    def has_permission(self, request, view):
        return request.method in SAFE_METHODS or request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        return request.method in SAFE_METHODS or obj.owner == request.user
`,
      "players/serializers.py": `from rest_framework import serializers

from .models import Player


class PlayerSerializer(serializers.ModelSerializer):
    owner = serializers.ReadOnlyField(source="owner.username")

    class Meta:
        model = Player
        fields = ["id", "name", "runs", "owner"]
`,
      "players/views.py": permissionViews(s),
      "seed.py":
        TEAM_PLAYER_SEED +
        `
from django.contrib.auth.models import Permission

editor = User.objects.create_user("editor", password="editor-pass-123")
editor.user_permissions.add(*Permission.objects.filter(codename__in=["add_player", "change_player", "delete_player"]))
`,
    },
  }),
  probe: () => String.raw`
from django.contrib.auth.models import User
from django.db import transaction

virat = 1  # owned by alice
users = [("anonymous", None)] + [(u, User.objects.get(username=u)) for u in ["alice", "bob", "editor", "staff"]]
actions = [
    ("GET list", "GET", "/api/players/", None),
    ("POST create", "POST", "/api/players/", {"name": "New Player", "runs": 10}),
    ("GET alice's", "GET", f"/api/players/{virat}/", None),
    ("PATCH alice's", "PATCH", f"/api/players/{virat}/", {"runs": 9999}),
    ("DELETE alice's", "DELETE", f"/api/players/{virat}/", None),
]
rows = []
for name, user in users:
    cells = []
    for label, method, path, body in actions:
        with transaction.atomic():
            r = request(path, method=method, body=body, user=user)
            transaction.set_rollback(True)
        cells.append(r["status"])
    rows.append([name, cells])
result = {"columns": [a[0] for a in actions], "rows": rows}
`,
  present: (r) => [
    {
      kind: "matrix",
      title: "Who can do what",
      caption: "alice owns player 1. editor has add/change/delete_player permissions. staff has is_staff=True. Every request is rolled back afterwards.",
      columns: r.columns as string[],
      rows: (r.rows as [string, number[]][]).map(([name, cells]) => ({
        label: name,
        cells: cells.map((code) => ({ text: String(code), tone: tone(code) })),
      })),
    },
    {
      kind: "kv",
      title: "Status codes",
      items: [
        ["200 / 201 / 204", "allowed"],
        ["401 Unauthorized", "not logged in (BasicAuthentication sends a login challenge)"],
        ["403 Forbidden", "logged in, but the permission class said no"],
        ["404 Not Found", "the object isn't in get_queryset() for this user"],
      ],
    },
  ],
  notes: (s) => {
    const p = str(s, "permission");
    const explain: Record<string, string> = {
      AllowAny: "AllowAny: everyone can do everything, even anonymous visitors. DRF's default, which is why you should set one.",
      IsAuthenticated: "IsAuthenticated: any logged-in user can do anything; anonymous visitors get 401.",
      IsAuthenticatedOrReadOnly: "IsAuthenticatedOrReadOnly: anyone can read (GET); writing needs a login.",
      IsAdminUser: "IsAdminUser: only users with is_staff=True get in.",
      IsOwnerOrReadOnly: "IsOwnerOrReadOnly (custom): has_object_permission() compares obj.owner with request.user, so only alice can edit or delete her player.",
      DjangoModelPermissions: "DjangoModelPermissions: POST needs add_player, PATCH needs change_player, DELETE needs delete_player (the same permissions you'd tick in the admin).",
    };
    const notes = [explain[p]];
    if (bool(s, "ownOnly")) notes.push("Filtering get_queryset() hides other people's rows entirely: they get 404, as if the player didn't exist.");
    notes.push("has_permission() runs on every request; has_object_permission() only when a single object is fetched (retrieve, update, destroy).");
    return notes;
  },
};

// ===========================================================================
// JWT
// ===========================================================================

const jwtLab: Lab = {
  slug: "jwt",
  title: "JWT authentication",
  file: "settings.py",
  group: "REST APIs",
  summary: "Log in for a real token pair, decode it, then call an endpoint with a valid, missing, tampered or expired token.",
  chapter: "jwt",
  packages: [...DRF, "djangorestframework-simplejwt"],
  initial: { lifetime: "15", algorithm: "HS256", claims: true },
  controls: [
    {
      type: "segmented",
      key: "lifetime",
      label: "ACCESS_TOKEN_LIFETIME",
      options: [
        { value: "5", label: "5 minutes" },
        { value: "15", label: "15 minutes" },
        { value: "1440", label: "1 day" },
      ],
    },
    {
      type: "segmented",
      key: "algorithm",
      label: "ALGORITHM",
      options: [
        { value: "HS256", label: "HS256" },
        { value: "HS512", label: "HS512" },
      ],
    },
    { type: "toggle", key: "claims", label: "Custom claims (username, is_staff)" },
  ],
  build: (s) => ({
    focus: "config/settings.py",
    files: {
      "config/settings.py": apiSettings(`from datetime import timedelta

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=${num(s, "lifetime")}),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "ALGORITHM": "${str(s, "algorithm")}",${bool(s, "claims") ? '\n    "TOKEN_OBTAIN_SERIALIZER": "players.tokens.MyTokenObtainPairSerializer",' : ""}
}`),
      "config/urls.py": `from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from players.views import me

urlpatterns = [
    path("api/token/", TokenObtainPairView.as_view()),
    path("api/token/refresh/", TokenRefreshView.as_view()),
    path("api/me/", me),
]
`,
      "players/models.py": "",
      "players/tokens.py": `from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username
        token["is_staff"] = user.is_staff
        return token
`,
      "players/views.py": `from rest_framework.decorators import api_view
from rest_framework.response import Response


@api_view(["GET"])
def me(request):
    return Response({"id": request.user.id, "username": request.user.username})
`,
      "seed.py": `from django.contrib.auth.models import User

User.objects.create_user("asha", password="asha-pass-123")
`,
    },
  }),
  probe: () => String.raw`
import base64
from datetime import timedelta
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import AccessToken

def decode(part):
    return json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))

login = request("/api/token/", method="POST", body={"username": "asha", "password": "asha-pass-123"})
tokens = json.loads(login["body"])
access = tokens.get("access", "")
header_b64, payload_b64, signature = access.split(".")
payload = decode(payload_b64)

forged_payload = dict(payload, user_id="999")
forged = header_b64 + "." + base64.urlsafe_b64encode(json.dumps(forged_payload).encode()).decode().rstrip("=") + "." + signature

expired = AccessToken.for_user(User.objects.get(username="asha"))
expired.set_exp(lifetime=-timedelta(seconds=1))

wrong = request("/api/token/", method="POST", body={"username": "asha", "password": "nope"})
calls = [
    ["POST /api/token/ (right password)", login["status"], login["body"][:60] + "…"],
    ["POST /api/token/ (wrong password)", wrong["status"], wrong["body"][:90]],
]
for label, token in [("no token", None), ("valid token", access), ("tampered payload", forged), ("expired token", str(expired))]:
    r = request("/api/me/", headers={"Authorization": f"Bearer {token}"} if token else None)
    calls.append([f"GET /api/me/ with {label}", r["status"], r["body"][:110]])
refresh = request("/api/token/refresh/", method="POST", body={"refresh": tokens.get("refresh", "")})
calls.append(["POST /api/token/refresh/", refresh["status"], refresh["body"][:60] + "…"])

result = {
    "header": decode(header_b64),
    "payload": payload,
    "signature": signature[:24] + "…",
    "raw": access,
    "calls": calls,
    "lifetime_seconds": payload["exp"] - payload["iat"],
}
`,
  present: (r) => [
    {
      kind: "matrix",
      title: "Requests",
      caption: "Real calls through SimpleJWT's views and JWTAuthentication.",
      columns: ["Status", "Body"],
      rows: (r.calls as [string, number, string][]).map(([label, status, body]) => ({
        label,
        cells: [
          { text: String(status), tone: tone(status) },
          { text: body, tone: "muted" },
        ],
      })),
    },
    { kind: "json", title: "Decoded token", value: { header: r.header, payload: r.payload, signature: r.signature } },
    { kind: "code", title: "Raw access token", lang: "text", text: String(r.raw).split(".").join("\n.") },
  ],
  notes: (s, r) => {
    const notes = [
      "A JWT is header.payload.signature. Anyone can decode the first two parts, so never put secrets in them.",
      "Changing even one character of the payload breaks the signature: the tampered token is rejected with 401.",
      `exp − iat = ${r ? Number(r.lifetime_seconds) / 60 : num(s, "lifetime")} minutes, set by ACCESS_TOKEN_LIFETIME. After that the token is refused and the client must use the refresh token.`,
    ];
    if (bool(s, "claims")) notes.push("The custom serializer added `username` and `is_staff` claims, so a frontend can read them without another request.");
    notes.push("The client sends the token in a header: `Authorization: Bearer <access>`. The server stores no session: that's what stateless means.");
    return notes;
  },
};

// ===========================================================================
// pagination, search, ordering
// ===========================================================================

const PAGINATORS: Record<string, string> = {
  none: "",
  page: "rest_framework.pagination.PageNumberPagination",
  limit: "rest_framework.pagination.LimitOffsetPagination",
  cursor: "rest_framework.pagination.CursorPagination",
};

function paginationQuery(s: LabState) {
  const params = new URLSearchParams();
  const pag = str(s, "paginator");
  if (pag === "page" && num(s, "page") > 1) params.set("page", String(num(s, "page")));
  if (pag === "limit") {
    params.set("limit", String(num(s, "pageSize")));
    if (num(s, "page") > 1) params.set("offset", String((num(s, "page") - 1) * num(s, "pageSize")));
  }
  if (str(s, "search").trim()) params.set("search", str(s, "search").trim());
  if (str(s, "ordering") !== "default" && pag !== "cursor") params.set("ordering", str(s, "ordering"));
  if (str(s, "country") !== "all") params.set("country", str(s, "country"));
  const q = params.toString();
  return `/api/players/${q ? `?${q}` : ""}`;
}

const paginationLab: Lab = {
  slug: "pagination",
  title: "Pagination, search & ordering",
  file: "views.py",
  group: "REST APIs",
  summary: "Choose a paginator, page size, search term and ordering. The URL and the JSON response update together.",
  chapter: "filtering-pagination",
  packages: DRF,
  initial: { paginator: "page", pageSize: 3, page: 1, search: "", ordering: "-runs", country: "all" },
  controls: [
    {
      type: "segmented",
      key: "paginator",
      label: "Pagination class",
      options: [
        { value: "none", label: "none" },
        { value: "page", label: "PageNumber" },
        { value: "limit", label: "LimitOffset" },
        { value: "cursor", label: "Cursor" },
      ],
    },
    { type: "number", key: "pageSize", label: "PAGE_SIZE", min: 1, max: 7, when: (s) => str(s, "paginator") !== "none" },
    { type: "number", key: "page", label: "Page", min: 1, max: 7, when: (s) => ["page", "limit"].includes(str(s, "paginator")) },
    { type: "text", key: "search", label: "?search=", placeholder: "e.g. india or root", mono: true },
    {
      type: "select",
      key: "ordering",
      label: "?ordering=",
      options: [
        { value: "default", label: "(default)" },
        { value: "-runs", label: "-runs" },
        { value: "name", label: "name" },
        { value: "-test_innings", label: "-test_innings" },
      ],
    },
    {
      type: "select",
      key: "country",
      label: "?country= (custom filter)",
      options: ["all", "India", "England", "Australia", "New Zealand"].map((c) => ({ value: c, label: c })),
    },
  ],
  build: (s) => {
    const pag = PAGINATORS[str(s, "paginator")];
    return {
      focus: "players/views.py",
      files: {
        "config/settings.py": apiSettings(`REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],${
      pag ? `\n    "DEFAULT_PAGINATION_CLASS": "${pag}",\n    "PAGE_SIZE": ${num(s, "pageSize")},` : ""
    }
}`),
        "config/urls.py": `from django.urls import include, path
from rest_framework.routers import DefaultRouter

from players.views import PlayerViewSet

router = DefaultRouter()
router.register("players", PlayerViewSet, basename="player")

urlpatterns = [path("api/", include(router.urls))]
`,
        "players/models.py": TEAM_PLAYER_MODELS,
        "players/serializers.py": `from rest_framework import serializers

from .models import Player


class PlayerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Player
        fields = ["id", "name", "country", "test_innings", "runs"]
`,
        "players/views.py": `from rest_framework import filters, viewsets

from .models import Player
from .serializers import PlayerSerializer


class PlayerViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PlayerSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "country"]
    ordering_fields = ["runs", "name", "test_innings"]
    ordering = ["-runs"]

    def get_queryset(self):
        queryset = Player.objects.all()
        country = self.request.query_params.get("country")
        if country:
            queryset = queryset.filter(country=country)
        return queryset
`,
        "seed.py": TEAM_PLAYER_SEED,
      },
    };
  },
  probe: (s) => String.raw`
r = request(${py(paginationQuery(s))})
result = {"url": ${py(paginationQuery(s))}, "status": r["status"], "body": json.loads(r["body"]) if r["body"] else None, "queries": r["queries"]}
`,
  present: (r) => [
    { kind: "json", title: `GET ${r.url}`, value: r.body },
    { kind: "code", title: `SQL (${(r.queries as string[]).length})`, lang: "sql", text: (r.queries as string[]).join("\n\n") },
  ],
  notes: (s) => {
    const pag = str(s, "paginator");
    const t: Record<string, string> = {
      none: "No pagination: the response is a plain list of every row. Fine for 7 players, a problem for 70,000.",
      page: "PageNumberPagination wraps results in {count, next, previous, results}. Clients ask for ?page=2.",
      limit: "LimitOffsetPagination uses ?limit= and ?offset=, handy for infinite scrolling.",
      cursor: "CursorPagination gives opaque next/previous cursors and no total count. Very fast on huge tables; it needs a fixed ordering, so ?ordering is ignored here.",
    };
    const notes = [t[pag]];
    if (str(s, "search").trim()) notes.push("SearchFilter turned ?search= into a case-insensitive LIKE on name OR country.");
    notes.push("Pagination runs a COUNT query plus a LIMIT/OFFSET query. Check the SQL tab.");
    return notes;
  },
};

export const API_LABS = [serializersLab, viewsetsLab, permissionsLab, jwtLab, paginationLab];
