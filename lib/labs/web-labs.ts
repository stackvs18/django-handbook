import { BASE_HTML, includeUrls, indent, PLAYER_MODEL, playerSeed, settings } from "./project";
import { bool, list, num, py, str, tone, type Lab, type LabState, type Output } from "./types";

type Resp = {
  path: string;
  method: string;
  status: number;
  reason: string;
  location: string | null;
  contentType: string;
  headers: Record<string, string>;
  body: string;
  preview: string | null;
  templates: string[];
  context: Record<string, string>;
  queries: string[];
  errors: string[];
};

/** Render a probe response as the most useful output for its content type. */
function responseOutput(title: string, r: Resp, height?: number): Output {
  if (r.contentType.includes("json")) {
    try {
      return { kind: "json", title, value: JSON.parse(r.body) };
    } catch {
      /* fall through */
    }
  }
  if (r.contentType.includes("html") && r.body) return { kind: "html", title, html: r.preview ?? r.body, height };
  return {
    kind: "text",
    title,
    text: r.body || `(empty body: ${r.status} ${r.reason}${r.location ? ` → Location: ${r.location}` : ""})`,
  };
}

// ===========================================================================
// settings.py
// ===========================================================================

const settingsLab: Lab = {
  slug: "settings",
  title: "settings.py",
  file: "settings.py",
  group: "Project",
  summary: "Flip DEBUG, change ALLOWED_HOSTS, the time zone and the language, or remove the app. See what each setting changes.",
  chapter: "project-structure",
  initial: {
    debug: true,
    allowedHosts: "example.com",
    host: "example.com",
    timeZone: "UTC",
    language: "en-us",
    appInstalled: true,
    appendSlash: true,
  },
  controls: [
    { type: "toggle", key: "debug", label: "DEBUG = True" },
    { type: "text", key: "allowedHosts", label: "ALLOWED_HOSTS", placeholder: "example.com, www.example.com", mono: true },
    {
      type: "segmented",
      key: "host",
      label: "Request arrives for host",
      options: [
        { value: "example.com", label: "example.com" },
        { value: "evil.com", label: "evil.com" },
      ],
    },
    {
      type: "select",
      key: "timeZone",
      label: "TIME_ZONE",
      options: ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London", "Asia/Tokyo"].map((v) => ({ value: v, label: v })),
    },
    {
      type: "select",
      key: "language",
      label: "LANGUAGE_CODE",
      options: [
        { value: "en-us", label: "en-us (English)" },
        { value: "hi", label: "hi (Hindi)" },
        { value: "fr", label: "fr (French)" },
        { value: "de", label: "de (German)" },
        { value: "es", label: "es (Spanish)" },
        { value: "ja", label: "ja (Japanese)" },
      ],
    },
    { type: "toggle", key: "appInstalled", label: '"pages" in INSTALLED_APPS' },
    { type: "toggle", key: "appendSlash", label: "APPEND_SLASH = True" },
  ],
  build: (s) => {
    const hosts = str(s, "allowedHosts")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    return {
      focus: "config/settings.py",
      files: {
        "config/settings.py": settings({
          apps: bool(s, "appInstalled") ? ["pages"] : [],
          debug: bool(s, "debug"),
          allowedHosts: hosts,
          timeZone: str(s, "timeZone"),
          language: str(s, "language"),
          extra: bool(s, "appendSlash") ? "" : "APPEND_SLASH = False",
        }),
        "config/urls.py": includeUrls("pages"),
        "pages/models.py": "",
        "pages/forms.py": `from django import forms


class EmailForm(forms.Form):
    email = forms.EmailField()
`,
        "pages/views.py": `from django.shortcuts import render

from .forms import EmailForm


def home(request):
    form = EmailForm(data={"email": "not-an-email"})
    form.is_valid()
    return render(request, "pages/home.html", {"form": form})


def about(request):
    return render(request, "pages/home.html", {"form": EmailForm()})


def boom(request):
    return 1 / 0
`,
        "pages/urls.py": `from django.urls import path

from . import views

urlpatterns = [
    path("", views.home, name="home"),
    path("about/", views.about, name="about"),
    path("boom/", views.boom, name="boom"),
]
`,
        "pages/templates/pages/home.html": `{% load i18n %}<!DOCTYPE html>
<html lang="{{ LANGUAGE_CODE|default:'en' }}">
<head><meta charset="utf-8"><style>body{font:15px/1.6 system-ui,sans-serif;padding:1.25rem 1.5rem;color:#111;background:#fff}.errorlist{color:#b00020}</style></head>
<body>
  <h1>Settings at work</h1>
  <p><strong>{% now "l, j F Y, H:i" %}</strong> (TIME_ZONE + LANGUAGE_CODE)</p>
  <p>Validating "not-an-email" gives:</p>
  {{ form.email.errors }}
</body>
</html>
`,
      },
    };
  },
  probe: (s) => String.raw`
rows = []
home = request("/")
missing = request("/missing-page/")
boom = request("/boom/")
host = request("/", host=${py(str(s, "host"))})
slash = request("/about")
for label, r, h in [("/", home, "testserver"), ("/missing-page/", missing, "testserver"), ("/boom/", boom, "testserver"), ("/", host, ${py(str(s, "host"))}), ("/about", slash, "testserver")]:
    rows.append([label, h, f"{r['status']} {r['reason']}", r["location"] or (r["errors"][0] if r["errors"] else "")])
result = {"home": home, "missing": missing, "boom": boom, "rows": rows}
`,
  present: (r) => [
    {
      kind: "matrix",
      title: "Requests",
      caption: "Five requests sent through Django with these settings.",
      columns: ["Host", "Response", "Detail"],
      rows: (r.rows as string[][]).map(([path, host, status, detail]) => ({
        label: path,
        cells: [{ text: host }, { text: status, tone: tone(Number(status.split(" ")[0])) }, { text: detail || "", tone: "muted" }],
      })),
    },
    responseOutput("Home page", r.home as Resp),
    responseOutput("404 page", r.missing as Resp, 520),
    responseOutput("500 page", r.boom as Resp, 520),
  ],
  notes: (s) => {
    const hosts = str(s, "allowedHosts");
    const notes = [
      bool(s, "debug")
        ? "DEBUG = True: errors show Django's detailed yellow pages with your code and settings. Never use it in production."
        : "DEBUG = False: visitors see plain error pages; details go to your logs instead.",
      hosts.includes(str(s, "host"))
        ? `Requests for ${str(s, "host")} are accepted because it's in ALLOWED_HOSTS.`
        : `${str(s, "host")} isn't in ALLOWED_HOSTS, so Django answers 400 Bad Request (DisallowedHost). This blocks Host header attacks.`,
      `TIME_ZONE changes the clock shown; LANGUAGE_CODE changes month names and Django's built-in messages.`,
    ];
    if (!bool(s, "appInstalled")) notes.push("Without the app in INSTALLED_APPS Django can't find its templates folder: TemplateDoesNotExist.");
    notes.push(
      bool(s, "appendSlash")
        ? "APPEND_SLASH: /about (no slash) is redirected (301) to /about/ by CommonMiddleware."
        : "APPEND_SLASH = False: /about without the slash is simply 404.",
    );
    return notes;
  },
};

// ===========================================================================
// urls.py
// ===========================================================================

const SAMPLE_FOR: Record<string, string> = {
  int: "7",
  str: '"hello"',
  slug: '"hello-world"',
  path: '"2024/05/report.pdf"',
  uuid: 'UUID("0f8fad5b-d9cb-469f-a165-70867728950e")',
};

function urlsCode(s: LabState) {
  const conv = str(s, "converter");
  const param = /^[a-z_][a-z0-9_]*$/.test(str(s, "param")) ? str(s, "param") : "pk";
  const base = str(s, "prefix").replace(/^\/+|\/+$/g, "") || "articles";
  const slash = bool(s, "trailingSlash") ? "/" : "";
  return `from django.urls import path

from . import views
${bool(s, "namespace") ? '\napp_name = "blog"\n' : ""}
urlpatterns = [
    path("${base}${slash}", views.article_list, name="list"),
    path("${base}/<${conv}:${param}>${slash}", views.article_detail, name="detail"),
    path("archive/<int:year>${slash}", views.archive, name="archive"),
]
`;
}

const urlsLab: Lab = {
  slug: "urls",
  title: "URLs & routing",
  file: "urls.py",
  group: "Project",
  summary: "Change path converters, prefixes and namespaces, then test URLs against the resolver and see what each view receives.",
  chapter: "urls",
  initial: {
    converter: "int",
    param: "pk",
    prefix: "articles",
    includePrefix: "blog/",
    namespace: true,
    trailingSlash: true,
    paths: "/blog/articles/\n/blog/articles/7/\n/blog/articles/hello-world/\n/blog/articles/7\n/blog/articles/2024/05/report.pdf/\n/blog/archive/2024/\n/articles/7/",
  },
  controls: [
    {
      type: "segmented",
      key: "converter",
      label: "Converter",
      options: ["int", "str", "slug", "path", "uuid"].map((c) => ({ value: c, label: `<${c}:…>` })),
    },
    { type: "text", key: "param", label: "Parameter name", mono: true },
    { type: "text", key: "prefix", label: "Route", mono: true },
    {
      type: "segmented",
      key: "includePrefix",
      label: "include() prefix (project urls.py)",
      options: [
        { value: "blog/", label: '"blog/"' },
        { value: "", label: '"" (root)' },
      ],
    },
    { type: "toggle", key: "namespace", label: 'app_name = "blog"' },
    { type: "toggle", key: "trailingSlash", label: "End routes with /" },
    { type: "textarea", key: "paths", label: "Test these URLs (one per line)", rows: 7, mono: true },
  ],
  build: (s) => ({
    focus: "blog/urls.py",
    files: {
      "config/settings.py": settings({ apps: ["blog"] }),
      "config/urls.py": includeUrls("blog", str(s, "includePrefix")),
      "blog/models.py": "",
      "blog/views.py": `from django.http import JsonResponse


def describe(view, kwargs):
    return JsonResponse({
        "view": view,
        "kwargs": {name: f"{value!r} ({type(value).__name__})" for name, value in kwargs.items()},
    })


def article_list(request):
    return describe("article_list", {})


def article_detail(request, **kwargs):
    return describe("article_detail", kwargs)


def archive(request, year):
    return describe("archive", {"year": year})
`,
      "blog/urls.py": urlsCode(s),
    },
  }),
  probe: (s) => {
    const conv = str(s, "converter");
    const param = /^[a-z_][a-z0-9_]*$/.test(str(s, "param")) ? str(s, "param") : "pk";
    const ns = bool(s, "namespace") ? "blog:" : "";
    return String.raw`
from uuid import UUID
from django.urls import NoReverseMatch, Resolver404, resolve, reverse

paths = [p.strip() for p in ${py(str(s, "paths"))}.splitlines() if p.strip()]
rows = []
for p in paths:
    if not p.startswith("/"):
        p = "/" + p
    path_only = p.split("?")[0]
    try:
        m = resolve(path_only)
        match = (m.namespace + ":" if m.namespace else "") + (m.url_name or "")
        kwargs = ", ".join(f"{k}={v!r} ({type(v).__name__})" for k, v in m.kwargs.items()) or "—"
        route = m.route
    except Resolver404:
        match, kwargs, route = "no match", "", ""
    r = request(p)
    rows.append([p, route, match, kwargs, f"{r['status']}" + (f" → {r['location']}" if r["location"] else "")])

reverses = []
for name, kwargs in [(${py(ns + "list")}, {}), (${py(ns + "detail")}, {${py(param)}: ${SAMPLE_FOR[conv]}}), (${py(ns + "archive")}, {"year": 2024}), ("detail", {${py(param)}: ${SAMPLE_FOR[conv]}})]:
    label = f"reverse({name!r}" + (f", kwargs={kwargs!r})" if kwargs else ")")
    try:
        reverses.append([label, reverse(name, kwargs=kwargs)])
    except NoReverseMatch as exc:
        reverses.append([label, "NoReverseMatch: " + str(exc)[:110]])

result = {"rows": rows, "reverses": reverses}
`;
  },
  present: (r) => [
    {
      kind: "matrix",
      title: "Resolve",
      caption: "Each URL goes through resolve() (which pattern matched, what the view receives) and a real request.",
      columns: ["Route matched", "Name", "View receives", "HTTP"],
      rows: (r.rows as string[][]).map(([path, route, match, kwargs, http]) => ({
        label: path,
        cells: [
          { text: route || "—", tone: route ? undefined : "muted" },
          { text: match, tone: match === "no match" ? "warn" : undefined },
          { text: kwargs || "—", tone: "muted" },
          { text: http, tone: tone(Number(http.split(" ")[0])) },
        ],
      })),
    },
    { kind: "table", title: "reverse()", caption: "Building URLs from names, the same thing {% url %} does in templates.", columns: ["Call", "Result"], rows: r.reverses as string[][] },
  ],
  notes: (s) => {
    const conv = str(s, "converter");
    const explain: Record<string, string> = {
      int: "`<int:…>` only matches digits and hands the view a Python int.",
      str: "`<str:…>` matches any text without a slash and passes a string. The default converter.",
      slug: "`<slug:…>` matches letters, numbers, hyphens and underscores, like `hello-world`.",
      path: "`<path:…>` matches anything, including slashes, such as `2024/05/report.pdf`.",
      uuid: "`<uuid:…>` matches a formatted UUID and passes a `uuid.UUID` object.",
    };
    const notes = [explain[conv]];
    notes.push(
      bool(s, "namespace")
        ? 'With `app_name = "blog"` names must be written `blog:detail`. Plain `detail` fails with NoReverseMatch.'
        : "Without app_name, names are global: `detail` works, `blog:detail` doesn't.",
    );
    notes.push(`Patterns in blog/urls.py are added after the include() prefix "${str(s, "includePrefix")}".`);
    if (bool(s, "trailingSlash")) notes.push("URLs missing the final slash get a 301 redirect to the slash version (APPEND_SLASH).");
    return notes;
  },
};

// ===========================================================================
// views.py
// ===========================================================================

const VIEW_KINDS: { value: string; label: string; fbv: string; cbv: string }[] = [
  {
    value: "render",
    label: "render() a template",
    fbv: `player = get_object_or_404(Player, pk=pk)
return render(request, "players/player.html", {"player": player})`,
    cbv: `player = get_object_or_404(Player, pk=pk)
return render(request, "players/player.html", {"player": player})`,
  },
  {
    value: "httpresponse",
    label: "HttpResponse(text)",
    fbv: `player = get_object_or_404(Player, pk=pk)
return HttpResponse(f"<h1>{player.name}</h1><p>{player.runs} runs</p>")`,
    cbv: `player = get_object_or_404(Player, pk=pk)
return HttpResponse(f"<h1>{player.name}</h1><p>{player.runs} runs</p>")`,
  },
  {
    value: "json",
    label: "JsonResponse(dict)",
    fbv: `player = get_object_or_404(Player, pk=pk)
return JsonResponse({"id": player.pk, "name": player.name, "runs": player.runs})`,
    cbv: `player = get_object_or_404(Player, pk=pk)
return JsonResponse({"id": player.pk, "name": player.name, "runs": player.runs})`,
  },
  {
    value: "redirect",
    label: "redirect() elsewhere",
    fbv: `return redirect("player_list")`,
    cbv: `return redirect("player_list")`,
  },
  {
    value: "manual404",
    label: "objects.get() without 404",
    fbv: `player = Player.objects.get(pk=pk)   # crashes if it doesn't exist
return render(request, "players/player.html", {"player": player})`,
    cbv: `player = Player.objects.get(pk=pk)   # crashes if it doesn't exist
return render(request, "players/player.html", {"player": player})`,
  },
  {
    value: "status",
    label: "Custom status (201)",
    fbv: `return HttpResponse("Created!", status=201)`,
    cbv: `return HttpResponse("Created!", status=201)`,
  },
];

const DECORATORS: Record<string, { fbv: string; cbv: string; import: string }> = {
  none: { fbv: "", cbv: "", import: "" },
  login: {
    fbv: "@login_required\n",
    cbv: '@method_decorator(login_required, name="dispatch")\n',
    import: "from django.contrib.auth.decorators import login_required",
  },
  post: {
    fbv: "@require_POST\n",
    cbv: '@method_decorator(require_POST, name="dispatch")\n',
    import: "from django.views.decorators.http import require_POST",
  },
};

function viewsCode(s: LabState) {
  const kind = VIEW_KINDS.find((k) => k.value === str(s, "kind")) ?? VIEW_KINDS[0];
  const deco = DECORATORS[str(s, "decorator")] ?? DECORATORS.none;
  const cbv = str(s, "style") === "class";
  const imports = [
    "from django.http import HttpResponse, JsonResponse",
    "from django.shortcuts import get_object_or_404, redirect, render",
    cbv ? "from django.views import View" : "",
    cbv && deco.import ? "from django.utils.decorators import method_decorator" : "",
    deco.import,
  ].filter(Boolean);
  const body = cbv
    ? `${deco.cbv}class PlayerView(View):
    def get(self, request, pk):
${indent(kind.cbv, 8)}

    def post(self, request, pk):
        return self.get(request, pk)
`
    : `${deco.fbv}def player_view(request, pk):
${indent(kind.fbv)}
`;
  return `${imports.join("\n")}

from .models import Player


def player_list(request):
    return render(request, "players/player_list.html", {"players": Player.objects.all()})


${body}`;
}

const viewsLab: Lab = {
  slug: "views",
  title: "Views",
  file: "views.py",
  group: "Views & templates",
  summary: "Choose what a view returns, wrap it in decorators, write it as a function or a class, and send it different requests.",
  chapter: "views",
  initial: { kind: "render", style: "function", decorator: "none", method: "GET", pk: 1, loggedIn: false },
  controls: [
    { type: "select", key: "kind", label: "The view returns", options: VIEW_KINDS.map(({ value, label }) => ({ value, label })) },
    {
      type: "segmented",
      key: "style",
      label: "Written as",
      options: [
        { value: "function", label: "function" },
        { value: "class", label: "class (View)" },
      ],
    },
    {
      type: "segmented",
      key: "decorator",
      label: "Decorator",
      options: [
        { value: "none", label: "none" },
        { value: "login", label: "@login_required" },
        { value: "post", label: "@require_POST" },
      ],
    },
    {
      type: "segmented",
      key: "method",
      label: "Request method",
      options: [
        { value: "GET", label: "GET" },
        { value: "POST", label: "POST" },
      ],
    },
    { type: "number", key: "pk", label: "Request /player/<pk>/ (1–4 exist)", min: 1, max: 9 },
    { type: "toggle", key: "loggedIn", label: "Visitor is logged in" },
  ],
  build: (s) => ({
    focus: "players/views.py",
    files: {
      "config/settings.py": settings({ apps: ["players"], extra: 'LOGIN_URL = "/login/"' }),
      "config/urls.py": includeUrls("players"),
      "players/models.py": PLAYER_MODEL,
      "players/views.py": viewsCode(s),
      "players/urls.py": `from django.urls import path

from . import views

urlpatterns = [
    path("", views.player_list, name="player_list"),
    path("player/<int:pk>/", views.${str(s, "style") === "class" ? "PlayerView.as_view()" : "player_view"}, name="player"),
]
`,
      "templates/base.html": BASE_HTML,
      "players/templates/players/player.html": `{% extends "base.html" %}
{% block content %}
<h1>{{ player.name }}</h1>
<p>{{ player.country }} · {{ player.runs }} runs in {{ player.test_innings }} innings</p>
{% endblock %}
`,
      "players/templates/players/player_list.html": `{% extends "base.html" %}
{% block content %}
<h1>All players</h1>
<ul>{% for p in players %}<li>{{ p.name }}</li>{% endfor %}</ul>
{% endblock %}
`,
      "seed.py": playerSeed(),
    },
  }),
  probe: (s) => String.raw`
from django.contrib.auth.models import User
user = User.objects.create_user("demo", password="pass-12345") if ${bool(s, "loggedIn") ? "True" : "False"} else None
from players.models import Player
Player.objects.filter(pk__gt=4).delete()
r = request("/player/${num(s, "pk")}/", method=${py(str(s, "method"))}, user=user, form={} if ${py(str(s, "method"))} == "POST" else None)
result = {"r": r}
`,
  present: (r) => {
    const resp = r.r as Resp;
    return [
      responseOutput("Response", resp, 460),
      {
        kind: "kv",
        title: "Status & headers",
        items: [
          ["Status", `${resp.status} ${resp.reason}`],
          ...(resp.location ? ([["Location", resp.location]] as [string, string][]) : []),
          ["Content-Type", resp.contentType],
          ["Templates rendered", resp.templates.join(", ") || "none"],
          ["SQL queries", String(resp.queries.length)],
          ...(resp.errors.length ? ([["Exception", resp.errors[0]]] as [string, string][]) : []),
        ],
      },
    ];
  },
  notes: (s, r) => {
    const resp = r?.r as Resp | undefined;
    const notes: string[] = [];
    const kind = str(s, "kind");
    if (str(s, "decorator") === "login" && !bool(s, "loggedIn")) notes.push("`@login_required` stopped the anonymous visitor and redirected to LOGIN_URL with ?next=.");
    if (str(s, "decorator") === "post" && str(s, "method") === "GET") notes.push("`@require_POST` rejects GET with 405 Method Not Allowed before your code runs.");
    if (kind === "render") notes.push("`render()` fills a template with a context dict and returns an HttpResponse.");
    if (kind === "json") notes.push("`JsonResponse` serialises a dict to JSON and sets Content-Type: application/json.");
    if (kind === "redirect") notes.push("`redirect()` returns a 302 with a Location header; the browser then requests that URL.");
    if (kind === "manual404" && num(s, "pk") > 4) notes.push("`Player.objects.get()` raised DoesNotExist, which becomes a 500 error. Use `get_object_or_404()` for a proper 404.");
    if (kind !== "manual404" && kind !== "redirect" && kind !== "status" && num(s, "pk") > 4) notes.push("`get_object_or_404()` turned the missing row into a clean 404 Not Found.");
    if (str(s, "style") === "class") notes.push("A class-based View dispatches by method: GET calls `get()`, POST calls `post()`. Decorators go on `dispatch` via `method_decorator`.");
    if (resp) notes.push(`Result: ${resp.status} ${resp.reason}.`);
    return notes;
  },
};

// ===========================================================================
// templates
// ===========================================================================

function templateCode(s: LabState) {
  const nameFilter = str(s, "nameFilter") === "none" ? "" : `|${str(s, "nameFilter")}`;
  const truncate = str(s, "truncate") === "none" ? "" : `|${str(s, "truncate")}`;
  const date = str(s, "dateFormat") === "timesince" ? "|timesince" : `|date:"${str(s, "dateFormat")}"`;
  const avg = str(s, "floatFormat") === "none" ? "" : `|floatformat:${str(s, "floatFormat")}`;
  const counter = bool(s, "counter") ? "{{ forloop.counter }}. " : "";
  const badge = `{% if player.runs > ${num(s, "threshold")} %} <span class="badge">★ ${num(s, "threshold")}+</span>{% endif %}`;
  const item = bool(s, "include")
    ? `{% include "players/_card.html" with player=player %}`
    : `<li>${counter}<strong>{{ player.name${nameFilter} }}</strong>: {{ player.runs }} runs, avg {{ player.average${avg} }}${badge}</li>`;
  const loop = bool(s, "useEmpty")
    ? `<ul>
  {% for player in players %}
    ${item}
  {% empty %}
    <li>No players yet.</li>
  {% endfor %}
</ul>`
    : `<ul>
  {% for player in players %}
    ${item}
  {% endfor %}
</ul>`;
  const content = `<h1>{{ title${nameFilter} }}</h1>
<p class="muted">Updated {{ updated${date} }}</p>
<p>{{ bio${truncate}${bool(s, "safe") ? "|safe" : ""} }}</p>

${loop}`;
  return bool(s, "extends")
    ? `{% extends "base.html" %}

{% block content %}
${content}
{% endblock %}
`
    : `${content}
`;
}

const templatesLab: Lab = {
  slug: "templates",
  title: "Templates",
  file: "player_list.html",
  group: "Views & templates",
  summary: "Pick filters, toggle tags and inheritance, and watch the HTML Django renders change line by line.",
  chapter: "templates",
  initial: {
    nameFilter: "none",
    truncate: "truncatewords:8",
    dateFormat: "d M Y",
    floatFormat: "2",
    threshold: 8000,
    counter: true,
    useEmpty: true,
    emptyList: false,
    extends: true,
    safe: false,
    include: false,
  },
  controls: [
    {
      type: "select",
      key: "nameFilter",
      label: "Name filter",
      options: ["none", "upper", "lower", "title", "capfirst"].map((v) => ({ value: v, label: v === "none" ? "none" : `|${v}` })),
    },
    {
      type: "select",
      key: "truncate",
      label: "Bio",
      options: [
        { value: "none", label: "full text" },
        { value: "truncatewords:8", label: "|truncatewords:8" },
        { value: "truncatechars:30", label: "|truncatechars:30" },
      ],
    },
    {
      type: "select",
      key: "dateFormat",
      label: "Date",
      options: [
        { value: "d M Y", label: '|date:"d M Y"' },
        { value: "D, d M Y", label: '|date:"D, d M Y"' },
        { value: "Y-m-d", label: '|date:"Y-m-d"' },
        { value: "N j, Y", label: '|date:"N j, Y"' },
        { value: "timesince", label: "|timesince" },
      ],
    },
    {
      type: "segmented",
      key: "floatFormat",
      label: "Average",
      options: [
        { value: "none", label: "raw" },
        { value: "1", label: "|floatformat:1" },
        { value: "2", label: "|floatformat:2" },
      ],
    },
    { type: "number", key: "threshold", label: "{% if player.runs > N %} badge", min: 0, max: 13000, step: 1000 },
    { type: "toggle", key: "counter", label: "{{ forloop.counter }}" },
    { type: "toggle", key: "useEmpty", label: "{% empty %} fallback" },
    { type: "toggle", key: "emptyList", label: "View sends an empty list" },
    { type: "toggle", key: "extends", label: '{% extends "base.html" %}' },
    { type: "toggle", key: "include", label: "{% include %} a card per player" },
    { type: "toggle", key: "safe", label: "|safe on the bio (contains HTML)" },
  ],
  build: (s) => ({
    focus: "players/templates/players/player_list.html",
    files: {
      "config/settings.py": settings({ apps: ["players"] }),
      "config/urls.py": includeUrls("players"),
      "players/models.py": `${PLAYER_MODEL}
    @property
    def average(self):
        return self.runs / self.test_innings if self.test_innings else 0
`,
      "players/views.py": `from datetime import timedelta

from django.shortcuts import render
from django.utils import timezone

from .models import Player


def player_list(request):
    players = Player.objects.order_by("-runs")${bool(s, "emptyList") ? ".none()" : ""}
    return render(request, "players/player_list.html", {
        "title": "top run scorers",
        "updated": timezone.now() - timedelta(days=3, hours=4),
        "bio": "Batters with the <b>most Test runs</b> among active players, <script>alert('xss')</script> updated after every series.",
        "players": players,
    })
`,
      "players/urls.py": `from django.urls import path

from . import views

urlpatterns = [path("", views.player_list, name="player_list")]
`,
      "templates/base.html": BASE_HTML.replace(
        "</style>",
        "  .badge { background: #111; color: #fff; border-radius: 4px; padding: 0 .35rem; font-size: .8em; }\n  </style>",
      ),
      "players/templates/players/_card.html": `<li class="card"><strong>{{ player.name }}</strong><br><span class="muted">{{ player.country }} · {{ player.runs }} runs</span></li>
`,
      "players/templates/players/player_list.html": templateCode(s),
      "seed.py": playerSeed(),
    },
  }),
  probe: () => String.raw`
r = request("/")
result = {"r": r}
`,
  present: (r) => {
    const resp = r.r as Resp;
    return [
      responseOutput("Rendered page", resp, 520),
      { kind: "code", title: "HTML source", lang: "html", text: resp.body },
      {
        kind: "kv",
        title: "Context",
        items: [...Object.entries(resp.context).map(([k, v]) => [k, v] as [string, string]), ["Templates", resp.templates.join(" → ")]],
      },
    ];
  },
  notes: (s) => {
    const notes = [
      "`{{ value|filter:arg }}` transforms a value just before printing it; the data in the view is unchanged.",
      bool(s, "safe")
        ? "`|safe` turns off escaping: the <b> tags render, and so would a <script> from user input. Only use it on HTML you trust."
        : "Auto-escaping is on: the <b> and <script> in the bio are shown as text, not run. That's Django's XSS protection.",
    ];
    if (bool(s, "emptyList")) notes.push(bool(s, "useEmpty") ? "The list is empty, so `{% empty %}` rendered the fallback." : "The list is empty and there's no `{% empty %}`: nothing renders.");
    if (bool(s, "extends")) notes.push("`{% extends %}` must be the first tag. The page fills the base template's `{% block content %}`.");
    else notes.push("Without `{% extends %}` there's no <html>, styles or layout: just the fragment.");
    if (bool(s, "include")) notes.push("`{% include ... with player=player %}` renders a reusable fragment for each item.");
    return notes;
  },
};

// ===========================================================================
// forms.py
// ===========================================================================

function formsCode(s: LabState) {
  const fields = list(s, "fields");
  const rules = list(s, "rules");
  const model = str(s, "base") === "model";
  const lines: string[] = [];
  const widget = str(s, "bioWidget") === "textarea" ? "forms.Textarea(attrs={\"rows\": 3})" : "forms.TextInput";
  if (!model) {
    if (fields.includes("name")) lines.push(`name = forms.CharField(max_length=50${rules.includes("minlen") ? ", min_length=3" : ""})`);
    if (fields.includes("email")) lines.push("email = forms.EmailField()");
    if (fields.includes("age")) lines.push(`age = forms.IntegerField(${rules.includes("range") ? "min_value=13, max_value=120" : ""})`);
    if (fields.includes("bio")) lines.push(`bio = forms.CharField(widget=${widget}, required=False)`);
  } else {
    if (fields.includes("age") && rules.includes("range")) lines.push("age = forms.IntegerField(min_value=13, max_value=120)");
  }
  if (fields.includes("password")) {
    lines.push("password = forms.CharField(widget=forms.PasswordInput)");
    lines.push("confirm = forms.CharField(widget=forms.PasswordInput, label=\"Confirm password\")");
  }
  if (fields.includes("terms")) lines.push('terms = forms.BooleanField(label="I accept the terms")');

  const modelFields = ["name", "email", "age", "bio"].filter((f) => fields.includes(f));
  const meta = model
    ? `\n\nclass Meta:\n    model = Member\n    fields = [${modelFields.map((f) => py(f)).join(", ")}]${
        fields.includes("bio") ? `\n    widgets = {"bio": ${widget}}` : ""
      }`
    : "";

  const methods: string[] = [];
  if (rules.includes("noDigits") && fields.includes("name")) {
    methods.push(`def clean_name(self):
    name = self.cleaned_data["name"]
    if any(ch.isdigit() for ch in name):
        raise forms.ValidationError("Names can't contain digits.")
    return name.title()`);
  }
  if (rules.includes("email") && fields.includes("email")) {
    methods.push(`def clean_email(self):
    email = self.cleaned_data["email"].lower()
    if email.endswith("@example.com"):
        raise forms.ValidationError("Please use a real email address.")
    return email`);
  }
  if (rules.includes("match") && fields.includes("password")) {
    methods.push(`def clean(self):
    cleaned = super().clean()
    if cleaned.get("password") != cleaned.get("confirm"):
        self.add_error("confirm", "Passwords don't match.")
    return cleaned`);
  }
  const body = [lines.join("\n") + meta, ...methods].filter((x) => x.trim()).join("\n\n");
  return `from django import forms
${model ? "\nfrom .models import Member\n" : ""}

class SignUpForm(forms.${model ? "ModelForm" : "Form"}):
${indent(body || "pass")}
`;
}

const formsLab: Lab = {
  slug: "forms",
  title: "Forms & validation",
  file: "forms.py",
  group: "Views & templates",
  summary: "Build a form from checkboxes, add validation rules, type what a user submits, and see errors and cleaned_data.",
  chapter: "forms",
  initial: {
    base: "form",
    fields: ["name", "email", "age", "password", "terms"],
    rules: ["minlen", "range", "match"],
    bioWidget: "textarea",
    render: "as_div",
    submit: true,
    inName: "Al",
    inEmail: "al@example",
    inAge: "11",
    inPassword: "secret123",
    inConfirm: "secret124",
    inTerms: false,
  },
  controls: [
    {
      type: "segmented",
      key: "base",
      label: "Class",
      options: [
        { value: "form", label: "forms.Form" },
        { value: "model", label: "forms.ModelForm" },
      ],
    },
    {
      type: "checklist",
      key: "fields",
      label: "Fields",
      options: [
        { value: "name", label: "name" },
        { value: "email", label: "email" },
        { value: "age", label: "age" },
        { value: "bio", label: "bio" },
        { value: "password", label: "password + confirm" },
        { value: "terms", label: "terms" },
      ],
    },
    {
      type: "checklist",
      key: "rules",
      label: "Validation rules",
      options: [
        { value: "minlen", label: "name: min_length=3" },
        { value: "noDigits", label: "clean_name(): no digits" },
        { value: "range", label: "age: 13–120" },
        { value: "email", label: "clean_email(): no example.com" },
        { value: "match", label: "clean(): passwords match" },
      ],
    },
    {
      type: "segmented",
      key: "render",
      label: "Render with",
      options: ["as_div", "as_p", "as_table", "as_ul"].map((v) => ({ value: v, label: `{{ form.${v} }}` })),
    },
    { type: "toggle", key: "submit", label: "Submit this data (bound form)" },
    { type: "text", key: "inName", label: "name", when: (s) => bool(s, "submit") },
    { type: "text", key: "inEmail", label: "email", when: (s) => bool(s, "submit") },
    { type: "text", key: "inAge", label: "age", when: (s) => bool(s, "submit") },
    { type: "text", key: "inPassword", label: "password", when: (s) => bool(s, "submit") },
    { type: "text", key: "inConfirm", label: "confirm", when: (s) => bool(s, "submit") },
    { type: "toggle", key: "inTerms", label: "terms ticked", when: (s) => bool(s, "submit") },
  ],
  build: (s) => ({
    focus: "accounts/forms.py",
    files: {
      "config/settings.py": settings({ apps: ["accounts"] }),
      "config/urls.py": `from django.urls import path

urlpatterns = []
`,
      "accounts/models.py": `from django.db import models


class Member(models.Model):
    name = models.CharField(max_length=50)
    email = models.EmailField(unique=True)
    age = models.PositiveIntegerField()
    bio = models.TextField(blank=True)
`,
      "accounts/forms.py": formsCode(s),
      "templates/base.html": BASE_HTML,
      "accounts/templates/accounts/signup.html": `{% extends "base.html" %}
{% block content %}
<h1>Sign up</h1>
<form method="post">
  {% csrf_token %}
  {{ form.non_field_errors }}
  ${str(s, "render") === "as_table" ? "<table>{{ form.as_table }}</table>" : str(s, "render") === "as_ul" ? "<ul>{{ form.as_ul }}</ul>" : `{{ form.${str(s, "render")} }}`}
  <button type="submit">Create account</button>
</form>
{% endblock %}
`,
    },
  }),
  probe: (s) => String.raw`
from django.template.loader import render_to_string
from django.test import RequestFactory
from accounts.forms import SignUpForm

submitted = ${bool(s, "submit") ? "True" : "False"}
data = {
    "name": ${py(str(s, "inName"))},
    "email": ${py(str(s, "inEmail"))},
    "age": ${py(str(s, "inAge"))},
    "bio": "Loves cricket",
    "password": ${py(str(s, "inPassword"))},
    "confirm": ${py(str(s, "inConfirm"))},
}
if ${bool(s, "inTerms") ? "True" : "False"}:
    data["terms"] = "on"
form = SignUpForm(data=data) if submitted else SignUpForm()
valid = form.is_valid() if submitted else None
html = render_to_string("accounts/signup.html", {"form": form}, request=RequestFactory().get("/"))
result = {
    "html": html,
    "valid": valid,
    "errors": {k: [str(m) for m in v] for k, v in form.errors.items()} if submitted else {},
    "cleaned": {k: short(v) for k, v in getattr(form, "cleaned_data", {}).items()} if submitted else {},
    "fields": [[name, type(f).__name__, type(f.widget).__name__, "required" if f.required else "optional"] for name, f in form.fields.items()],
}
`,
  present: (r) => {
    const errors = r.errors as Record<string, string[]>;
    const cleaned = r.cleaned as Record<string, string>;
    const out: Output[] = [
      { kind: "html", title: "Form", html: String(r.html), height: 520 },
      {
        kind: "kv",
        title: "is_valid()",
        items: [
          ["form.is_valid()", r.valid === null ? "(not submitted: unbound form)" : String(r.valid)],
          ...Object.entries(errors).map(([k, v]) => [`errors["${k}"]`, v.join(" ")] as [string, string]),
          ...Object.entries(cleaned).map(([k, v]) => [`cleaned_data["${k}"]`, v] as [string, string]),
        ],
      },
      { kind: "table", title: "Fields", columns: ["Name", "Field", "Widget", "Required"], rows: r.fields as string[][] },
      { kind: "code", title: "HTML", lang: "html", text: String(r.html).replace(/^[\s\S]*<h1>/, "<h1>").replace(/<\/body>[\s\S]*$/, "") },
    ];
    return out;
  },
  notes: (s, r) => {
    const notes: string[] = [];
    if (str(s, "base") === "model") notes.push("ModelForm builds fields from the Member model: max_length, unique email and the required/optional flags come from models.py.");
    else notes.push("forms.Form: every field is declared by hand in forms.py.");
    if (bool(s, "submit")) {
      notes.push("Validation order: each field's own checks → validators → clean_<field>() → clean(). Errors are collected, not raised one by one.");
      if (r && r.valid === false) notes.push("is_valid() is False, so a view would re-render this form with the errors instead of saving.");
      if (r && r.valid === true) notes.push("is_valid() is True: cleaned_data holds converted Python values (age is an int, not a string).");
    } else {
      notes.push("An unbound form (no data) renders empty inputs and never shows errors.");
    }
    return notes;
  },
};

// ===========================================================================
// class-based views
// ===========================================================================

const CBV_URL: Record<string, string> = {
  ListView: "/players/",
  DetailView: "/players/1/",
  CreateView: "/players/new/",
  UpdateView: "/players/1/edit/",
  DeleteView: "/players/1/delete/",
  TemplateView: "/about/",
};

function cbvCode(s: LabState) {
  const cls = str(s, "viewClass");
  const lines: string[] = [];
  if (cls === "TemplateView") {
    lines.push('template_name = "players/about.html"');
  } else {
    lines.push("model = Player");
    if (cls === "ListView") {
      if (num(s, "paginateBy") > 0) lines.push(`paginate_by = ${num(s, "paginateBy")}`);
      if (str(s, "ordering") !== "none") lines.push(`ordering = [${py(str(s, "ordering"))}]`);
    }
    if (["CreateView", "UpdateView"].includes(cls)) {
      const fields = list(s, "fields");
      lines.push(`fields = [${(fields.length ? fields : ["name"]).map((f) => py(f)).join(", ")}]`);
      lines.push('success_url = reverse_lazy("player_list")');
    }
    if (cls === "DeleteView") lines.push('success_url = reverse_lazy("player_list")');
    const ctxName = str(s, "contextName").trim();
    if (ctxName && /^[a-z_][a-z0-9_]*$/.test(ctxName) && ["ListView", "DetailView"].includes(cls)) {
      lines.push(`context_object_name = ${py(ctxName)}`);
    }
  }
  const methods: string[] = [];
  if (bool(s, "filterIndia") && ["ListView", "DetailView"].includes(cls)) {
    methods.push(`def get_queryset(self):
    return super().get_queryset().filter(country="India")`);
  }
  if (bool(s, "extraContext")) {
    methods.push(`def get_context_data(self, **kwargs):
    context = super().get_context_data(**kwargs)
    context["page_title"] = "Cricket stats"
    return context`);
  }
  const body = [lines.join("\n"), ...methods].join("\n\n");
  return `from django.urls import reverse_lazy
from django.views.generic import ${cls}

from .models import Player


class PlayerView(${cls}):
${indent(body)}
`;
}

const cbvLab: Lab = {
  slug: "class-based-views",
  title: "Class-based views",
  file: "views.py",
  group: "Views & templates",
  summary: "Swap between ListView, DetailView, CreateView and friends. See the template each one picks and the context it builds for you.",
  chapter: "class-based-views",
  initial: {
    viewClass: "ListView",
    paginateBy: 3,
    ordering: "-runs",
    contextName: "",
    filterIndia: false,
    extraContext: false,
    fields: ["name", "country", "runs"],
  },
  controls: [
    {
      type: "segmented",
      key: "viewClass",
      label: "Generic view",
      options: ["ListView", "DetailView", "CreateView", "UpdateView", "DeleteView", "TemplateView"].map((v) => ({ value: v, label: v })),
    },
    { type: "number", key: "paginateBy", label: "paginate_by (0 = off)", min: 0, max: 6, when: (s) => str(s, "viewClass") === "ListView" },
    {
      type: "select",
      key: "ordering",
      label: "ordering",
      options: [
        { value: "none", label: "none" },
        { value: "name", label: '["name"]' },
        { value: "-runs", label: '["-runs"]' },
      ],
      when: (s) => str(s, "viewClass") === "ListView",
    },
    {
      type: "text",
      key: "contextName",
      label: "context_object_name",
      placeholder: "default: player / player_list",
      mono: true,
      when: (s) => ["ListView", "DetailView"].includes(str(s, "viewClass")),
    },
    {
      type: "checklist",
      key: "fields",
      label: "fields (form)",
      options: ["name", "country", "test_innings", "runs"].map((f) => ({ value: f, label: f })),
      when: (s) => ["CreateView", "UpdateView"].includes(str(s, "viewClass")),
    },
    { type: "toggle", key: "filterIndia", label: "Override get_queryset() (India only)", when: (s) => ["ListView", "DetailView"].includes(str(s, "viewClass")) },
    { type: "toggle", key: "extraContext", label: "Override get_context_data()" },
  ],
  build: (s) => {
    const cls = str(s, "viewClass");
    const ctxName = str(s, "contextName").trim();
    const listVar = ctxName || "player_list";
    const objVar = ctxName || "player";
    return {
      focus: "players/views.py",
      files: {
        "config/settings.py": settings({ apps: ["players"] }),
        "config/urls.py": includeUrls("players"),
        "players/models.py": PLAYER_MODEL,
        "players/views.py": cbvCode(s),
        "players/urls.py": `from django.urls import path

from .views import PlayerView

urlpatterns = [
    path("", PlayerView.as_view(), name="home"),
    path("players/", PlayerView.as_view(), name="player_list"),
    path("players/new/", PlayerView.as_view(), name="player_new"),
    path("players/<int:pk>/", PlayerView.as_view(), name="player_detail"),
    path("players/<int:pk>/edit/", PlayerView.as_view(), name="player_edit"),
    path("players/<int:pk>/delete/", PlayerView.as_view(), name="player_delete"),
    path("about/", PlayerView.as_view(), name="about"),
]
`,
        "templates/base.html": BASE_HTML,
        "players/templates/players/player_list.html": `{% extends "base.html" %}
{% block content %}
<h1>{{ page_title|default:"Players" }}</h1>
<ul>{% for p in ${cls === "ListView" ? listVar : "player_list"} %}<li>{{ p.name }} ({{ p.country }}, {{ p.runs }})</li>{% empty %}<li>None</li>{% endfor %}</ul>
{% if is_paginated %}<p class="muted">Page {{ page_obj.number }} of {{ paginator.num_pages }}</p>{% endif %}
{% endblock %}
`,
        "players/templates/players/player_detail.html": `{% extends "base.html" %}
{% block content %}
<h1>{{ ${cls === "DetailView" ? objVar : "player"}.name }}</h1>
<p>{{ ${cls === "DetailView" ? objVar : "player"}.country }} · {{ ${cls === "DetailView" ? objVar : "player"}.runs }} runs</p>
{% endblock %}
`,
        "players/templates/players/player_form.html": `{% extends "base.html" %}
{% block content %}
<h1>{% if object %}Edit {{ object.name }}{% else %}New player{% endif %}</h1>
<form method="post">{% csrf_token %}{{ form.as_div }}<button>Save</button></form>
{% endblock %}
`,
        "players/templates/players/player_confirm_delete.html": `{% extends "base.html" %}
{% block content %}
<h1>Delete {{ object.name }}?</h1>
<form method="post">{% csrf_token %}<button>Yes, delete</button></form>
{% endblock %}
`,
        "players/templates/players/about.html": `{% extends "base.html" %}
{% block content %}
<h1>{{ page_title|default:"About" }}</h1>
<p>A TemplateView only renders a template. No model, no queryset.</p>
{% endblock %}
`,
        "seed.py": playerSeed(),
      },
    };
  },
  probe: (s) => String.raw`
from players.views import PlayerView

r = request(${py(CBV_URL[str(s, "viewClass")] ?? "/players/")})
names = r["templateNames"]
result = {
    "r": r,
    "mro": [c.__name__ for c in PlayerView.__mro__[1:] if c.__name__ not in ("object",)],
    "template_names": names,
}
`,
  present: (r) => {
    const resp = r.r as Resp;
    return [
      responseOutput("Page", resp, 440),
      {
        kind: "table",
        title: "Context",
        caption: "Everything the view put in the template context for you.",
        columns: ["Variable", "Value"],
        rows: Object.entries(resp.context).map(([k, v]) => [k, v]),
      },
      {
        kind: "kv",
        title: "How it works",
        items: [
          ["Template looked for", (r.template_names as string[]).join(", ")],
          ["Template rendered", resp.templates[0] ?? "none"],
          ["SQL queries", String(resp.queries.length)],
          ["Inherits from", (r.mro as string[]).join(" → ")],
        ],
      },
    ];
  },
  notes: (s) => {
    const cls = str(s, "viewClass");
    const explain: Record<string, string> = {
      ListView: "ListView runs `Player.objects.all()`, renders players/player_list.html and adds `player_list` / `object_list` to the context.",
      DetailView: "DetailView fetches one Player by the pk in the URL (404 if missing) and renders player_detail.html with `player` / `object`.",
      CreateView: "CreateView builds a ModelForm from `fields`, renders player_form.html, and on a valid POST saves and redirects to success_url.",
      UpdateView: "UpdateView is CreateView plus fetching an existing object: the form arrives pre-filled.",
      DeleteView: "DeleteView shows a confirmation page on GET and deletes on POST, then redirects.",
      TemplateView: "TemplateView just renders template_name. Use it for static pages.",
    };
    const notes = [explain[cls]];
    if (cls === "ListView" && num(s, "paginateBy") > 0) notes.push("`paginate_by` adds `page_obj`, `paginator` and `is_paginated` to the context and slices the queryset.");
    if (bool(s, "extraContext")) notes.push("`get_context_data()` is the hook for adding your own variables, like page_title here.");
    return notes;
  },
};

export const WEB_LABS = [settingsLab, urlsLab, viewsLab, templatesLab, formsLab, cbvLab];
