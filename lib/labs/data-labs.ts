import { indent, settings } from "./project";
import { bool, list, num, py, str, type FieldRow, type Lab, type LabState, type Output } from "./types";

const EMPTY_URLS = `from django.urls import path

urlpatterns = []
`;

// ===========================================================================
// models.py
// ===========================================================================

const FIELD_TYPES = [
  "CharField",
  "TextField",
  "IntegerField",
  "PositiveIntegerField",
  "DecimalField",
  "FloatField",
  "BooleanField",
  "DateField",
  "DateTimeField",
  "EmailField",
  "SlugField",
  "URLField",
];

const NAME_RE = /^[a-z_][a-z0-9_]*$/;

function validFields(rows: FieldRow[]) {
  const seen = new Set<string>(["id", "pk", "objects"]);
  return rows.filter((r) => {
    if (!r.on || !NAME_RE.test(r.name) || seen.has(r.name)) return false;
    seen.add(r.name);
    return true;
  });
}

function defaultLiteral(r: FieldRow) {
  const d = (r.default ?? "").trim();
  if (!d) return null;
  switch (r.type) {
    case "IntegerField":
    case "PositiveIntegerField":
    case "FloatField":
      return /^-?\d+(\.\d+)?$/.test(d) ? d : null;
    case "DecimalField":
      return /^-?\d+(\.\d+)?$/.test(d) ? `Decimal(${py(d)})` : null;
    case "BooleanField":
      return /^(true|1|yes)$/i.test(d) ? "True" : "False";
    case "DateTimeField":
      return d === "now" ? "timezone.now" : null;
    case "DateField":
      return d === "today" ? "date.today" : null;
    default:
      return py(d);
  }
}

function fieldLine(r: FieldRow) {
  const args: string[] = [];
  if (["CharField", "SlugField"].includes(r.type)) args.push(`max_length=${r.maxLength || 100}`);
  if (r.type === "DecimalField") args.push("max_digits=7", "decimal_places=2");
  if (r.unique) args.push("unique=True");
  if (r.nullable) args.push("null=True");
  if (r.blank) args.push("blank=True");
  const def = defaultLiteral(r);
  if (def) args.push(`default=${def}`);
  return `${r.name} = models.${r.type}(${args.join(", ")})`;
}

function sampleValue(r: FieldRow, i: number): string {
  if (r.nullable && i === 2) return "None";
  switch (r.type) {
    case "CharField":
      return py(`${r.name.replace(/_/g, " ")} ${i}`.slice(0, r.maxLength || 100));
    case "SlugField":
      return py(`${r.name}-${i}`.slice(0, r.maxLength || 100));
    case "TextField":
      return py(i === 1 ? "A longer piece of text." : "");
    case "IntegerField":
    case "PositiveIntegerField":
      return String(120 * i);
    case "FloatField":
      return String(1.5 * i);
    case "DecimalField":
      return `Decimal(${py(`${299 * i}.50`)})`;
    case "BooleanField":
      return i === 1 ? "True" : "False";
    case "DateField":
      return `date(2024, ${i}, 15)`;
    case "DateTimeField":
      return "timezone.now()";
    case "EmailField":
      return py(`reader${i}@example.com`);
    case "URLField":
      return py(`https://example.com/${i}`);
    default:
      return "None";
  }
}

function modelsCode(s: LabState) {
  const rows = validFields((s.fields as FieldRow[]) ?? []);
  const imports = ["from django.db import models"];
  const needs = (fn: (r: FieldRow) => boolean) => rows.some(fn);
  if (needs((r) => defaultLiteral(r) === "timezone.now")) imports.unshift("from django.utils import timezone");
  if (needs((r) => defaultLiteral(r) === "date.today")) imports.unshift("from datetime import date");
  if (needs((r) => (defaultLiteral(r) ?? "").startsWith("Decimal("))) imports.unshift("from decimal import Decimal");
  const ordering = str(s, "ordering");
  const strField = rows.find((r) => r.name === str(s, "strField")) ?? rows.find((r) => ["CharField", "TextField"].includes(r.type));

  const body = rows.length ? rows.map(fieldLine) : ["pass"];
  const meta =
    ordering !== "none"
      ? `\n\nclass Meta:\n    ordering = [${ordering
          .split(",")
          .map((o) => py(o))
          .join(", ")}]`
      : "";
  const strMethod = strField ? `\n\ndef __str__(self):\n    return str(self.${strField.name})` : "";
  return `${imports.join("\n")}


class Book(models.Model):
${indent(body.join("\n") + meta + strMethod)}
`;
}

function modelsSeed(s: LabState) {
  const rows = validFields((s.fields as FieldRow[]) ?? []);
  const create = [1, 2]
    .map((i) => `Book.objects.create(${rows.map((r) => `${r.name}=${sampleValue(r, i)}`).join(", ")})`)
    .join("\n");
  return `from datetime import date
from decimal import Decimal

from django.utils import timezone

from library.models import Book

${create}
`;
}

const modelsLab: Lab = {
  slug: "models",
  title: "Models & fields",
  file: "models.py",
  group: "Models & data",
  summary: "Switch fields on and off, change their types and options, and see the table, SQL, migration and form Django builds.",
  chapter: "models",
  initial: {
    fields: [
      { id: "a", on: true, name: "title", type: "CharField", maxLength: 200 },
      { id: "b", on: true, name: "author", type: "CharField", maxLength: 100 },
      { id: "c", on: true, name: "pages", type: "PositiveIntegerField" },
      { id: "d", on: true, name: "price", type: "DecimalField" },
      { id: "e", on: true, name: "published", type: "DateField", nullable: true, blank: true },
      { id: "f", on: true, name: "in_stock", type: "BooleanField", default: "True" },
      { id: "g", on: false, name: "isbn", type: "CharField", maxLength: 13, unique: true },
      { id: "h", on: false, name: "summary", type: "TextField", blank: true },
      { id: "i", on: false, name: "created_at", type: "DateTimeField", default: "now" },
    ] satisfies FieldRow[],
    ordering: "title",
    strField: "title",
  },
  controls: [
    { type: "fields", key: "fields", label: "Fields", types: FIELD_TYPES },
    {
      type: "select",
      key: "ordering",
      label: "Meta.ordering",
      options: [
        { value: "none", label: "no default order" },
        { value: "title", label: '["title"]' },
        { value: "-price", label: '["-price"]' },
        { value: "author,title", label: '["author", "title"]' },
        { value: "-published", label: '["-published"]' },
      ],
    },
    {
      type: "select",
      key: "strField",
      label: "__str__ returns",
      options: [
        { value: "title", label: "self.title" },
        { value: "author", label: "self.author" },
        { value: "isbn", label: "self.isbn" },
      ],
    },
  ],
  build: (s) => ({
    focus: "library/models.py",
    files: {
      "config/settings.py": settings({ apps: ["library"] }),
      "config/urls.py": EMPTY_URLS,
      "library/models.py": modelsCode(s),
      "seed.py": modelsSeed(s),
    },
  }),
  probe: () => String.raw`
from django.core.exceptions import ValidationError
from django.forms import modelform_factory
from library.models import Book

fields = []
for f in Book._meta.concrete_fields:
    default = ""
    if f.has_default():
        default = getattr(f.default, "__name__", None) or short(f.default, 30)
        if callable(f.default):
            default += "()"
    fields.append([
        f.column,
        f.get_internal_type(),
        f.db_type(connection) or "",
        "PRIMARY KEY" if f.primary_key else ("NULL" if f.null else "NOT NULL"),
        "UNIQUE" if f.unique and not f.primary_key else "",
        default,
        "optional" if (f.blank or f.primary_key or f.has_default()) else "required",
    ])

Form = modelform_factory(Book, fields="__all__")
empty = Form(data={})
empty.is_valid()

try:
    Book().full_clean()
    clean_errors = {}
except ValidationError as e:
    clean_errors = e.message_dict

rows = [[str(b)] + [short(str(getattr(b, f.attname)), 30) for f in Book._meta.concrete_fields] for b in Book.objects.all()]
result = {
    "fields": fields,
    "form": Form().as_div(),
    "form_errors": {k: [str(m) for m in v] for k, v in empty.errors.items()},
    "clean_errors": clean_errors,
    "row_columns": ["str()"] + [f.column for f in Book._meta.concrete_fields],
    "rows": rows,
    "order_sql": str(Book.objects.all().query),
}
`,
  present: (r, _s, run) => {
    const migration = Object.entries(run.generated).find(([p]) => p.includes("0001"));
    const sql = migration ? run.sql[migration[0]] : "";
    const formErrors = r.form_errors as Record<string, string[]>;
    return [
      {
        kind: "table",
        title: "Table",
        caption: "The library_book table Django creates. Every model gets an automatic id primary key.",
        columns: ["Column", "Field", "SQL type", "Null", "Unique", "Default", "In forms"],
        rows: r.fields as string[][],
      },
      { kind: "code", title: "SQL", lang: "sql", text: sql || "-- no migration" },
      { kind: "code", title: "Migration", lang: "python", text: migration?.[1] ?? "" },
      {
        kind: "html",
        title: "ModelForm",
        html: `<h1>BookForm</h1><p class="muted">modelform_factory(Book, fields="__all__")</p><form>${r.form}<p><button type="button">Save</button></p></form>
<div class="card"><strong>Submitting the form empty gives:</strong><ul>${Object.entries(formErrors)
          .map(([k, v]) => `<li><code>${k}</code>: ${v.join(" ")}</li>`)
          .join("") || "<li>No errors: every field is optional.</li>"}</ul></div>`,
      },
      {
        kind: "table",
        title: "Data",
        caption: `Two rows created by seed.py, read back with: ${r.order_sql}`,
        columns: r.row_columns as string[],
        rows: r.rows as string[][],
      },
    ];
  },
  notes: (s) => {
    const rows = validFields((s.fields as FieldRow[]) ?? []);
    const notes: string[] = [];
    for (const f of rows) {
      if (["CharField", "TextField", "SlugField", "EmailField", "URLField"].includes(f.type) && f.nullable) {
        notes.push(`\`${f.name}\` is text with \`null=True\`: it can now be empty in two ways (NULL and ""). Django recommends \`blank=True\` alone for text.`);
      }
      if (f.blank && !f.nullable && !["CharField", "TextField", "SlugField", "EmailField", "URLField", "BooleanField"].includes(f.type)) {
        notes.push(`\`${f.name}\` has \`blank=True\` but not \`null=True\`: forms allow it empty, yet the database can't store an empty ${f.type}. Add \`null=True\`.`);
      }
      if (f.unique) notes.push(`\`${f.name}\` is \`unique=True\`: the database adds a UNIQUE constraint, and ModelForms check for duplicates.`);
      if (f.type === "FloatField") notes.push(`\`${f.name}\` is a FloatField: fine for measurements, but use DecimalField for money.`);
    }
    if (str(s, "ordering") !== "none") notes.push(`\`Meta.ordering\` adds ORDER BY to every query on Book unless you call \`order_by()\` yourself.`);
    notes.push("`blank` controls validation (forms, admin, full_clean); `null` controls the database column.");
    return notes;
  },
};

// ===========================================================================
// migrations
// ===========================================================================

const MIGRATION_CHANGES: { value: string; label: string; code: string; note: string; after?: string }[] = [
  {
    value: "add_default",
    label: "Add a field with a default",
    code: `    name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)
    country = models.CharField(max_length=50, default="India")`,
    note: "AddField. Existing rows are filled with the default once, then the default is dropped from the column.",
  },
  {
    value: "add_nullable",
    label: "Add an optional field (null=True)",
    code: `    name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)
    debut = models.DateField(null=True, blank=True)`,
    note: "AddField with null=True: existing rows simply get NULL.",
  },
  {
    value: "add_required",
    label: "Add a required field, no default",
    code: `    name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)
    country = models.CharField(max_length=50)`,
    note: "Django can't invent a value for the rows that already exist, so makemigrations stops and asks for a default.",
  },
  {
    value: "remove",
    label: "Remove a field",
    code: `    name = models.CharField(max_length=100)`,
    note: "RemoveField. The column and its data are deleted when you migrate.",
  },
  {
    value: "rename",
    label: "Rename a field",
    code: `    full_name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)`,
    note: "Django can't tell a rename from 'delete one field, add another'. In a terminal it asks you.",
  },
  {
    value: "alter",
    label: "Change max_length",
    code: `    name = models.CharField(max_length=150)
    runs = models.IntegerField(default=0)`,
    note: "AlterField. SQLite can't alter a column in place, so Django rebuilds the table and copies the data.",
  },
  {
    value: "unique",
    label: "Make a field unique",
    code: `    name = models.CharField(max_length=100, unique=True)
    runs = models.IntegerField(default=0)`,
    note: "AlterField adding a UNIQUE constraint. It would fail if existing rows had duplicate names.",
  },
  {
    value: "ordering",
    label: "Add Meta.ordering",
    code: `    name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)

    class Meta:
        ordering = ["-runs"]`,
    note: "AlterModelOptions: no SQL at all. Ordering lives in Python, not in the table.",
  },
  {
    value: "index",
    label: "Add an index",
    code: `    name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)

    class Meta:
        indexes = [models.Index(fields=["runs"], name="player_runs_idx")]`,
    note: "AddIndex: a CREATE INDEX statement. Rows aren't touched.",
  },
  {
    value: "model",
    label: "Add a new model",
    code: `    name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)`,
    after: `

class Team(models.Model):
    name = models.CharField(max_length=100)
`,
    note: "CreateModel: a brand new table.",
  },
];

function playerModels(fields: string, after = "") {
  return `from django.db import models


class Player(models.Model):
${fields}

    def __str__(self):
        return ${fields.includes("full_name") ? "self.full_name" : "self.name"}
${after}`;
}

const migrationsLab: Lab = {
  slug: "migrations",
  title: "Migrations",
  file: "migrations/",
  group: "Models & data",
  summary: "Start from a model with existing data, make one change, and watch makemigrations write the next migration.",
  chapter: "migrations",
  initial: { change: "add_default", renameYes: true },
  controls: [
    {
      type: "select",
      key: "change",
      label: "Change the model",
      options: MIGRATION_CHANGES.map(({ value, label }) => ({ value, label })),
    },
    {
      type: "toggle",
      key: "renameYes",
      label: "Answer “y” to “Did you rename player.name to player.full_name?”",
      when: (s) => str(s, "change") === "rename",
    },
  ],
  build: (s) => {
    const change = MIGRATION_CHANGES.find((c) => c.value === str(s, "change")) ?? MIGRATION_CHANGES[0];
    const base = {
      "config/settings.py": settings({ apps: ["players"] }),
      "config/urls.py": EMPTY_URLS,
    };
    return {
      focus: "players/models.py",
      baseline: {
        ...base,
        "players/models.py": playerModels(`    name = models.CharField(max_length=100)
    runs = models.IntegerField(default=0)`),
      },
      files: { ...base, "players/models.py": playerModels(change.code, change.after) },
      answers: { rename: bool(s, "renameYes") },
    };
  },
  probe: () => String.raw`
import io
from django.core.management import call_command

names = sorted(migrations)
latest = names[-1] if names else None
before_cols = before_rows = after_cols = after_rows = None
log = ""
if len(names) >= 2:
    call_command("migrate", "players", "0001", verbosity=0)
    with connection.cursor() as c:
        c.execute("INSERT INTO players_player (name, runs) VALUES (%s, %s)", ["Virat Kohli", 8848])
        c.execute("INSERT INTO players_player (name, runs) VALUES (%s, %s)", ["Joe Root", 12972])
        c.execute("SELECT * FROM players_player")
        before_cols = [d[0] for d in c.description]
        before_rows = [[short(v) for v in row] for row in c.fetchall()]
    out = io.StringIO()
    call_command("migrate", "players", stdout=out, verbosity=1)
    log = out.getvalue()
    with connection.cursor() as c:
        c.execute("SELECT * FROM players_player")
        after_cols = [d[0] for d in c.description]
        after_rows = [[short(v) for v in row] for row in c.fetchall()]

result = {
    "names": names,
    "latest": latest,
    "before": [before_cols, before_rows],
    "after": [after_cols, after_rows],
    "log": log,
}
`,
  present: (r, _s, run) => {
    const latest = r.latest as string | null;
    const names = r.names as string[];
    if (!latest || names.length < 2) {
      return [{ kind: "text", title: "makemigrations", text: "No changes detected: the model is the same as in 0001." }];
    }
    const text = run.generated[latest] ?? "";
    const ops = [...text.matchAll(/migrations\.(\w+)\(/g)].map((m) => m[1]);
    const [bc, br] = r.before as [string[], string[][]];
    const [ac, ar] = r.after as [string[], string[][]];
    return [
      { kind: "code", title: latest.split("/").pop()!, lang: "python", text },
      { kind: "code", title: "SQL", lang: "sql", text: run.sql[latest] || "-- this migration runs no SQL" },
      {
        kind: "table",
        title: "Data before",
        caption: "Two players saved while only 0001 was applied.",
        columns: bc,
        rows: br,
      },
      {
        kind: "table",
        title: "Data after",
        caption: `The same rows after running: python manage.py migrate (applies ${latest.split("/").pop()})`,
        columns: ac,
        rows: ar,
      },
      {
        kind: "kv",
        title: "Operations",
        items: [
          ["Migration files", names.map((n) => n.split("/").pop()).join(", ")],
          ["Operations in the new one", ops.join(", ") || "none"],
          ["migrate output", (r.log as string).trim().split("\n").pop() ?? ""],
        ],
      },
    ];
  },
  notes: (s) => {
    const change = MIGRATION_CHANGES.find((c) => c.value === str(s, "change"));
    const notes = [change?.note ?? ""];
    if (str(s, "change") === "rename") {
      notes.push(
        bool(s, "renameYes")
          ? "Answering yes produces a RenameField: the column is renamed and the data is kept."
          : "Answering no means RemoveField + AddField: the old column (and its data) would be dropped, and the new required field needs a default.",
      );
    }
    notes.push("Workflow: change models.py → `makemigrations` (writes the file) → `migrate` (changes the database).");
    return notes;
  },
};

// ===========================================================================
// relationships
// ===========================================================================

const ON_DELETE = ["CASCADE", "PROTECT", "SET_NULL", "RESTRICT", "DO_NOTHING"];

function relationshipModels(s: LabState) {
  const kind = str(s, "kind");
  const onDelete = str(s, "onDelete");
  const related = kind === "o2o" ? "" : str(s, "relatedName").trim();
  const rn = /^[a-z_][a-z0-9_]*$/.test(related) ? `, related_name=${py(related)}` : "";
  const nullable = onDelete === "SET_NULL" ? ", null=True, blank=True" : "";

  if (kind === "o2o") {
    return `from django.db import models


class Player(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Profile(models.Model):
    player = models.OneToOneField(Player, on_delete=models.${onDelete}${nullable}${rn})
    bio = models.TextField()

    def __str__(self):
        return f"Profile of {self.player}"
`;
  }
  if (kind === "m2m" || kind === "through") {
    const through = kind === "through" ? ', through="Participation"' : "";
    return `from django.db import models


class Tournament(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Player(models.Model):
    name = models.CharField(max_length=100)
    tournaments = models.ManyToManyField(Tournament${through}${rn}, blank=True)

    def __str__(self):
        return self.name
${
  kind === "through"
    ? `

class Participation(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE)
    tournament = models.ForeignKey(Tournament, on_delete=models.CASCADE)
    runs_scored = models.PositiveIntegerField(default=0)
`
    : ""
}`;
  }
  return `from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Player(models.Model):
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.${onDelete}${nullable}${rn})

    def __str__(self):
        return self.name
`;
}

const relationshipsLab: Lab = {
  slug: "relationships",
  title: "Relationships & on_delete",
  file: "models.py",
  group: "Models & data",
  summary: "ForeignKey, OneToOne and ManyToMany side by side. See the tables they create and what deleting a parent really does.",
  chapter: "relationships",
  initial: { kind: "fk", onDelete: "CASCADE", relatedName: "players" },
  controls: [
    {
      type: "segmented",
      key: "kind",
      label: "Relationship",
      options: [
        { value: "fk", label: "ForeignKey" },
        { value: "o2o", label: "OneToOneField" },
        { value: "m2m", label: "ManyToManyField" },
        { value: "through", label: "M2M + through" },
      ],
    },
    {
      type: "select",
      key: "onDelete",
      label: "on_delete",
      options: ON_DELETE.map((o) => ({ value: o, label: `models.${o}` })),
      when: (s) => ["fk", "o2o"].includes(str(s, "kind")),
    },
    {
      type: "text",
      key: "relatedName",
      label: "related_name",
      placeholder: "empty = player_set",
      mono: true,
      when: (s) => str(s, "kind") !== "o2o",
    },
  ],
  build: (s) => ({
    focus: "club/models.py",
    files: {
      "config/settings.py": settings({ apps: ["club"] }),
      "config/urls.py": EMPTY_URLS,
      "club/models.py": relationshipModels(s),
    },
  }),
  probe: (s) => {
    const kind = str(s, "kind");
    const rawName = kind === "o2o" ? "" : str(s, "relatedName").trim();
    const rn = /^[a-z_][a-z0-9_]*$/.test(rawName) ? rawName : "";
    return String.raw`
from django.db import IntegrityError, transaction
from django.db.models.deletion import ProtectedError, RestrictedError
from club import models as m

kind = ${py(kind)}
related = ${py(rn)}
steps = []
tables = {}

with connection.cursor() as c:
    for t in connection.introspection.table_names(c):
        if t.startswith("club_"):
            tables[t] = [col.name for col in connection.introspection.get_table_description(c, t)]

def attempt(label, fn):
    try:
        with transaction.atomic():
            value = fn()
        steps.append([label, short(value, 120)])
    except (ProtectedError, RestrictedError, IntegrityError) as exc:
        message = exc.args[0] if exc.args and isinstance(exc.args[0], str) else str(exc)
        steps.append([label, f"{type(exc).__name__}: {message.splitlines()[0][:150]}"])

if kind == "fk":
    india = m.Team.objects.create(name="India")
    england = m.Team.objects.create(name="England")
    m.Player.objects.create(name="Virat Kohli", team=india)
    m.Player.objects.create(name="Rohit Sharma", team=india)
    m.Player.objects.create(name="Joe Root", team=england)
    accessor = related or "player_set"
    steps.append(["virat.team (forward)", str(m.Player.objects.get(name="Virat Kohli").team)])
    steps.append([f"india.{accessor}.all() (reverse)", short(list(getattr(india, accessor).all()))])
    steps.append(["Player.objects.filter(team__name='India')", short(list(m.Player.objects.filter(team__name="India")))])
    attempt("india.delete()", lambda: india.delete())
    steps.append(["Players left", short([(p.name, str(p.team) if p.team_id else None) for p in m.Player.objects.all()], 160)])
elif kind == "o2o":
    virat = m.Player.objects.create(name="Virat Kohli")
    m.Profile.objects.create(player=virat, bio="Former India captain")
    accessor = related or "profile"
    steps.append(["profile.player (forward)", str(m.Profile.objects.get().player)])
    steps.append([f"virat.{accessor} (reverse)", str(getattr(virat, accessor))])
    attempt("Profile.objects.create(player=virat, ...) again", lambda: m.Profile.objects.create(player=virat, bio="Second"))
    attempt("virat.delete()", lambda: virat.delete())
    steps.append(["Profiles left", short(list(m.Profile.objects.values_list("bio", flat=True)))])
else:
    wc = m.Tournament.objects.create(name="World Cup")
    ashes = m.Tournament.objects.create(name="The Ashes")
    virat = m.Player.objects.create(name="Virat Kohli")
    root = m.Player.objects.create(name="Joe Root")
    accessor = related or "player_set"
    if kind == "m2m":
        virat.tournaments.add(wc)
        root.tournaments.add(wc, ashes)
        steps.append(["root.tournaments.add(wc, ashes)", short(list(root.tournaments.all()))])
    else:
        m.Participation.objects.create(player=virat, tournament=wc, runs_scored=765)
        m.Participation.objects.create(player=root, tournament=wc, runs_scored=310)
        m.Participation.objects.create(player=root, tournament=ashes, runs_scored=400)
        steps.append(["Participation rows", short(list(m.Participation.objects.values_list("player__name", "tournament__name", "runs_scored")), 160)])
        steps.append(["players with 500+ runs in a tournament", short(list(m.Player.objects.filter(participation__runs_scored__gte=500)))])
    steps.append([f"wc.{accessor}.all() (reverse)", short(list(getattr(wc, accessor).all()))])
    join = [t for t in tables if t not in ("club_player", "club_tournament")]
    attempt("wc.delete()", lambda: wc.delete())
    steps.append(["root.tournaments.all() after", short(list(root.tournaments.all()))])

result = {"tables": tables, "steps": steps}
`;
  },
  present: (r, _s, run) => {
    const tables = r.tables as Record<string, string[]>;
    const migration = Object.keys(run.sql)[0];
    return [
      {
        kind: "table",
        title: "Tables",
        caption: "The real tables in the database. Relationships are just columns (or a join table) holding ids.",
        columns: ["Table", "Columns"],
        rows: Object.entries(tables).map(([t, cols]) => [t, cols.join(", ")]),
      },
      {
        kind: "table",
        title: "Try it",
        caption: "Each line ran against the database. The last steps delete the parent object.",
        columns: ["Python", "Result"],
        rows: r.steps as string[][],
      },
      { kind: "code", title: "SQL", lang: "sql", text: migration ? run.sql[migration] : "" },
    ];
  },
  notes: (s) => {
    const kind = str(s, "kind");
    const od = str(s, "onDelete");
    const notes: string[] = [];
    if (kind === "fk") notes.push("A ForeignKey puts a `team_id` column on the *many* side (Player).");
    if (kind === "o2o") notes.push("A OneToOneField is a ForeignKey with UNIQUE: each player has at most one profile.");
    if (kind === "m2m") notes.push("ManyToManyField creates a third, hidden join table holding pairs of ids.");
    if (kind === "through") notes.push("With `through`, you own the join table and can store extra data on each pair (here, runs scored).");
    if (kind === "fk" || kind === "o2o") {
      const explain: Record<string, string> = {
        CASCADE: "CASCADE deletes the children too.",
        PROTECT: "PROTECT refuses to delete while children exist (ProtectedError).",
        SET_NULL: "SET_NULL keeps the children and empties their link (needs null=True, added automatically here).",
        RESTRICT: "RESTRICT, like PROTECT, blocks the delete unless it's part of a larger cascade.",
        DO_NOTHING: "DO_NOTHING leaves it to the database, which rejects the broken reference (IntegrityError).",
      };
      notes.push(explain[od]);
    }
    notes.push("`related_name` names the reverse accessor; without it Django uses `<model>_set`.");
    return notes;
  },
};

// ===========================================================================
// ORM queries
// ===========================================================================

const LOOKUPS = ["exact", "iexact", "icontains", "startswith", "gt", "gte", "lt", "lte", "in", "isnull"];

function lookupValue(field: string, lookup: string, raw: string) {
  const numeric = ["runs", "wickets", "innings"].includes(field);
  if (lookup === "isnull") return /^(true|1|yes)$/i.test(raw.trim()) ? "True" : "False";
  if (lookup === "in") {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    return `[${parts.map((p) => (numeric && /^-?\d+$/.test(p) ? p : py(p))).join(", ")}]`;
  }
  return numeric && /^-?\d+$/.test(raw.trim()) ? raw.trim() : py(raw);
}

function queryCode(s: LabState) {
  const field = str(s, "field");
  const lookup = str(s, "lookup");
  const parts: string[] = ["Player.objects"];
  if (bool(s, "selectRelated")) parts.push('.select_related("team")');
  if (field !== "none") {
    const key = lookup === "exact" ? field : `${field}__${lookup}`;
    parts.push(`.${bool(s, "exclude") ? "exclude" : "filter"}(${key}=${lookupValue(field, lookup, str(s, "value"))})`);
  }
  const order = str(s, "order");
  if (order !== "none") parts.push(`.order_by(${order.split(",").map((o) => py(o)).join(", ")})`);
  const shape = str(s, "shape");
  const agg = str(s, "aggregate");
  let expr = parts.join("");
  if (agg !== "none") {
    expr += `.aggregate(${agg}("runs"))`;
  } else if (shape === "values") expr += '.values("name", "team__name", "runs")';
  else if (shape === "values_list") expr += '.values_list("name", flat=True)';
  else if (shape === "count") expr += ".count()";
  else if (shape === "exists") expr += ".exists()";
  else if (shape === "first") expr += ".first()";
  const limit = num(s, "limit");
  if (limit > 0 && agg === "none" && ["objects", "values", "values_list"].includes(shape)) expr += `[:${limit}]`;

  const loop =
    bool(s, "touchTeam") && agg === "none" && shape === "objects"
      ? `

for player in result:
    print(player.name, "plays for", player.team.name)`
      : "";
  return `from django.db.models import Avg, Count, Max, Min, Q, Sum

from players.models import Player, Team

result = ${expr}${loop}
`;
}

const queriesLab: Lab = {
  slug: "queries",
  title: "ORM queries",
  file: "shell",
  group: "Models & data",
  summary: "Build a QuerySet from dropdowns. See the Python, the SQL Django generates, the rows it returns and how many queries ran.",
  chapter: "orm",
  initial: {
    field: "runs",
    lookup: "gte",
    value: "5000",
    exclude: false,
    order: "-runs",
    limit: 0,
    shape: "objects",
    aggregate: "none",
    selectRelated: false,
    touchTeam: true,
  },
  controls: [
    {
      type: "select",
      key: "field",
      label: "Filter on",
      options: [
        { value: "none", label: "nothing (all rows)" },
        { value: "name", label: "name" },
        { value: "runs", label: "runs" },
        { value: "wickets", label: "wickets" },
        { value: "team__name", label: "team__name (across the FK)" },
      ],
    },
    {
      type: "select",
      key: "lookup",
      label: "Lookup",
      options: LOOKUPS.map((l) => ({ value: l, label: l === "exact" ? "exact (=)" : `__${l}` })),
      when: (s) => str(s, "field") !== "none",
    },
    { type: "text", key: "value", label: "Value", mono: true, when: (s) => str(s, "field") !== "none" },
    { type: "toggle", key: "exclude", label: "exclude() instead of filter()", when: (s) => str(s, "field") !== "none" },
    {
      type: "select",
      key: "order",
      label: "order_by",
      options: [
        { value: "none", label: "none" },
        { value: "name", label: '"name"' },
        { value: "-runs", label: '"-runs"' },
        { value: "-wickets", label: '"-wickets"' },
        { value: "team__name,-runs", label: '"team__name", "-runs"' },
      ],
    },
    {
      type: "select",
      key: "shape",
      label: "Return",
      options: [
        { value: "objects", label: "model objects" },
        { value: "values", label: ".values(...)" },
        { value: "values_list", label: ".values_list(flat=True)" },
        { value: "count", label: ".count()" },
        { value: "exists", label: ".exists()" },
        { value: "first", label: ".first()" },
      ],
    },
    {
      type: "select",
      key: "aggregate",
      label: "aggregate",
      options: [
        { value: "none", label: "none" },
        { value: "Sum", label: 'Sum("runs")' },
        { value: "Avg", label: 'Avg("runs")' },
        { value: "Max", label: 'Max("runs")' },
        { value: "Count", label: 'Count("runs")' },
      ],
    },
    { type: "number", key: "limit", label: "Slice [:n]", min: 0, max: 10 },
    { type: "toggle", key: "touchTeam", label: "Loop and print player.team.name" },
    { type: "toggle", key: "selectRelated", label: 'select_related("team")' },
  ],
  build: (s) => ({
    focus: "shell.py",
    files: {
      "config/settings.py": settings({ apps: ["players"] }),
      "config/urls.py": EMPTY_URLS,
      "players/models.py": `from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Player(models.Model):
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.CASCADE, related_name="players")
    runs = models.PositiveIntegerField(default=0)
    wickets = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name
`,
      "seed.py": `from players.models import Player, Team

teams = {name: Team.objects.create(name=name) for name in ["India", "England", "Australia", "New Zealand"]}
for name, team, runs, wickets in [
    ("Virat Kohli", "India", 8848, 0),
    ("Rohit Sharma", "India", 4301, 2),
    ("Jasprit Bumrah", "India", 450, 205),
    ("Joe Root", "England", 12972, 71),
    ("Ben Stokes", "England", 6719, 210),
    ("Steve Smith", "Australia", 9685, 19),
    ("Pat Cummins", "Australia", 1491, 289),
    ("Kane Williamson", "New Zealand", 8881, 30),
]:
    Player.objects.create(name=name, team=teams[team], runs=runs, wickets=wickets)
`,
      "shell.py": queryCode(s),
    },
  }),
  probe: () => String.raw`
import io, os
from contextlib import redirect_stdout
from django.db.models import QuerySet
from django.test.utils import CaptureQueriesContext

code = open(os.path.join("/home/pyodide/project", "shell.py")).read()
ns = {"__name__": "__shell__"}
out = io.StringIO()
with CaptureQueriesContext(connection) as q, redirect_stdout(out):
    exec(compile(code, "shell.py", "exec"), ns)
    value = ns.get("result")
    if isinstance(value, QuerySet):
        items = list(value)
    else:
        items = None

columns, rows, kind = [], [], type(value).__name__
if items is not None:
    if items and isinstance(items[0], dict):
        columns = list(items[0].keys())
        rows = [[short(v) for v in it.values()] for it in items]
    elif items and hasattr(items[0], "_meta"):
        fields = [f for f in items[0]._meta.concrete_fields]
        columns = ["str()"] + [f.attname for f in fields]
        rows = [[str(it)] + [short(str(getattr(it, f.attname))) for f in fields] for it in items]
    else:
        columns = ["value"]
        rows = [[short(it)] for it in items]
elif isinstance(value, dict):
    columns = list(value.keys())
    rows = [[short(v) for v in value.values()]]
else:
    columns = ["value"]
    rows = [[short(value, 200)]]

result = {
    "kind": kind,
    "repr": short(value, 400),
    "columns": columns,
    "rows": rows,
    "queries": [x["sql"] for x in q.captured_queries],
    "printed": out.getvalue(),
}
`,
  present: (r) => {
    const queries = r.queries as string[];
    const outs: Output[] = [
      {
        kind: "table",
        title: "Result",
        caption: `${r.kind} · ${queries.length} SQL quer${queries.length === 1 ? "y" : "ies"}`,
        columns: r.columns as string[],
        rows: r.rows as string[][],
      },
      {
        kind: "code",
        title: `SQL (${queries.length})`,
        lang: "sql",
        text: queries.map((q, i) => `-- ${i + 1}\n${q}`).join("\n\n") || "-- no queries ran",
      },
      { kind: "code", title: "repr()", lang: "python", text: String(r.repr) },
    ];
    if (r.printed) outs.push({ kind: "code", title: "print() output", lang: "text", text: String(r.printed) });
    return outs;
  },
  notes: (s, r) => {
    const notes: string[] = [];
    const queries = (r?.queries as string[] | undefined) ?? [];
    if (bool(s, "touchTeam") && str(s, "shape") === "objects" && str(s, "aggregate") === "none") {
      notes.push(
        bool(s, "selectRelated")
          ? "select_related(\"team\") joined the team table into the same query: one query no matter how many players."
          : `Each \`player.team\` ran its own query: ${Math.max(0, queries.length - 1)} extra. That's the N+1 problem. Switch on select_related.`,
      );
    }
    if (str(s, "shape") === "exists") notes.push("`.exists()` asks the database for at most one row: the cheapest way to check.");
    if (str(s, "shape") === "count") notes.push("`.count()` runs SELECT COUNT(*) instead of loading rows.");
    if (str(s, "aggregate") !== "none") notes.push("`.aggregate()` returns a dict, computed by the database in one query.");
    if (str(s, "field") === "team__name") notes.push("Double underscores follow the ForeignKey: Django adds an INNER JOIN.");
    notes.push("QuerySets are lazy: nothing runs until you loop, slice, print or call methods like count().");
    return notes;
  },
};

// ===========================================================================
// admin.py
// ===========================================================================

const ADMIN_FIELDS = [
  { value: "name", label: "name" },
  { value: "team", label: "team" },
  { value: "runs", label: "runs" },
  { value: "wickets", label: "wickets" },
  { value: "is_active", label: "is_active" },
];

function adminCode(s: LabState) {
  if (str(s, "style") === "plain") {
    return `from django.contrib import admin

from .models import Player, Team

admin.site.register(Player)
admin.site.register(Team)
`;
  }
  const display = list(s, "listDisplay");
  const filters = list(s, "listFilter");
  const search = list(s, "search");
  const lines = [
    display.length ? `list_display = (${display.map((f) => py(f)).join(", ")}${display.length === 1 ? "," : ""})` : "",
    filters.length ? `list_filter = (${filters.map((f) => py(f)).join(", ")}${filters.length === 1 ? "," : ""})` : "",
    search.length ? `search_fields = (${search.map((f) => py(f)).join(", ")}${search.length === 1 ? "," : ""})` : "",
    str(s, "ordering") !== "none" ? `ordering = (${py(str(s, "ordering"))},)` : "",
    bool(s, "editable") && display.includes("runs") && display[0] !== "runs" ? `list_editable = ("runs",)` : "",
    `list_per_page = ${num(s, "perPage")}`,
  ].filter(Boolean);
  return `from django.contrib import admin

from .models import Player, Team


@admin.register(Player)
class PlayerAdmin(admin.ModelAdmin):
${indent(lines.join("\n"))}


admin.site.register(Team)
`;
}

const adminLab: Lab = {
  slug: "admin",
  title: "The admin site",
  file: "admin.py",
  group: "Models & data",
  summary: "Tick boxes to choose columns, filters and search fields. The real Django admin re-renders on the right.",
  chapter: "admin",
  initial: {
    style: "modeladmin",
    listDisplay: ["name", "team", "runs"],
    listFilter: ["team"],
    search: ["name"],
    ordering: "-runs",
    perPage: 5,
    editable: false,
    q: "",
  },
  controls: [
    {
      type: "segmented",
      key: "style",
      label: "Registration",
      options: [
        { value: "plain", label: "admin.site.register(Player)" },
        { value: "modeladmin", label: "@admin.register + ModelAdmin" },
      ],
    },
    { type: "checklist", key: "listDisplay", label: "list_display", options: ADMIN_FIELDS, when: (s) => str(s, "style") !== "plain" },
    {
      type: "checklist",
      key: "listFilter",
      label: "list_filter",
      options: ADMIN_FIELDS.filter((f) => ["team", "is_active"].includes(f.value)),
      when: (s) => str(s, "style") !== "plain",
    },
    {
      type: "checklist",
      key: "search",
      label: "search_fields",
      options: [
        { value: "name", label: "name" },
        { value: "team__name", label: "team__name" },
      ],
      when: (s) => str(s, "style") !== "plain",
    },
    {
      type: "select",
      key: "ordering",
      label: "ordering",
      options: [
        { value: "none", label: "none" },
        { value: "name", label: '"name"' },
        { value: "-runs", label: '"-runs"' },
        { value: "-wickets", label: '"-wickets"' },
      ],
      when: (s) => str(s, "style") !== "plain",
    },
    { type: "number", key: "perPage", label: "list_per_page", min: 2, max: 20, when: (s) => str(s, "style") !== "plain" },
    { type: "toggle", key: "editable", label: 'list_editable = ("runs",)', when: (s) => str(s, "style") !== "plain" },
    { type: "text", key: "q", label: "Search the list for", placeholder: "e.g. root" },
  ],
  build: (s) => ({
    focus: "players/admin.py",
    files: {
      "config/settings.py": settings({ apps: ["players"], admin: true }),
      "config/urls.py": `from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
]
`,
      "players/models.py": `from django.db import models


class Team(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


class Player(models.Model):
    name = models.CharField(max_length=100)
    team = models.ForeignKey(Team, on_delete=models.CASCADE)
    runs = models.PositiveIntegerField(default=0)
    wickets = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
`,
      "players/admin.py": adminCode(s),
      "seed.py": `from django.contrib.auth.models import User

from players.models import Player, Team

User.objects.create_superuser("admin", "admin@example.com", "admin-pass-123")
teams = {n: Team.objects.create(name=n) for n in ["India", "England", "Australia"]}
for name, team, runs, wickets, active in [
    ("Virat Kohli", "India", 8848, 0, True),
    ("Rohit Sharma", "India", 4301, 2, True),
    ("Jasprit Bumrah", "India", 450, 205, True),
    ("Joe Root", "England", 12972, 71, True),
    ("Alastair Cook", "England", 12472, 1, False),
    ("Steve Smith", "Australia", 9685, 19, True),
    ("Pat Cummins", "Australia", 1491, 289, True),
]:
    Player.objects.create(name=name, team=teams[team], runs=runs, wickets=wickets, is_active=active)
`,
    },
  }),
  probe: (s) => String.raw`
from urllib.parse import quote
from django.contrib.auth.models import User

admin = User.objects.get(username="admin")
q = ${py(str(s, "q").trim())}
page = request("/admin/players/player/" + ("?q=" + quote(q) if q else ""), user=admin)
result = {"page": page}
`,
  present: (r) => {
    const page = r.page as { status: number; preview: string | null; body: string; queries: string[] };
    return [
      { kind: "html", title: "Change list", html: page.preview ?? page.body, height: 560 },
      {
        kind: "code",
        title: `SQL (${page.queries.length})`,
        lang: "sql",
        text: page.queries.join("\n\n"),
      },
    ];
  },
  notes: (s) => {
    if (str(s, "style") === "plain") {
      return ["Plain `register()` gives one column, the result of `__str__`, with no filters or search. Switch to ModelAdmin."];
    }
    const notes = [
      "`list_display` picks the columns; `list_filter` adds the sidebar; `search_fields` adds the search box.",
      "Notice the SQL tab: the list page runs a COUNT for pagination, then fetches one page of rows.",
    ];
    if (list(s, "listDisplay").includes("team")) notes.push("Showing `team` makes the admin JOIN the team table (it uses select_related for ForeignKeys in list_display).");
    if (bool(s, "editable")) notes.push("`list_editable` turns the runs column into inputs with a Save button.");
    return notes;
  },
};

export const DATA_LABS = [modelsLab, migrationsLab, relationshipsLab, queriesLab, adminLab];
