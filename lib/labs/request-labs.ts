import { BASE_HTML, DEFAULT_MIDDLEWARE, includeUrls, settings } from "./project";
import { bool, list, num, py, str, tone, type Lab, type LabState, type Output } from "./types";

type Resp = {
  status: number;
  reason: string;
  location: string | null;
  contentType: string;
  headers: Record<string, string>;
  body: string;
  preview: string | null;
  printed: string;
};

// ===========================================================================
// authentication
// ===========================================================================

const PROTECTIONS: Record<string, { deco: string; imports: string[]; label: string }> = {
  none: { deco: "", imports: [], label: "no protection" },
  login: {
    deco: "@login_required",
    imports: ["from django.contrib.auth.decorators import login_required"],
    label: "@login_required",
  },
  perm: {
    deco: '@permission_required("reports.view_report")',
    imports: ["from django.contrib.auth.decorators import permission_required"],
    label: "@permission_required",
  },
  permRaise: {
    deco: '@permission_required("reports.view_report", raise_exception=True)',
    imports: ["from django.contrib.auth.decorators import permission_required"],
    label: "@permission_required(raise_exception=True)",
  },
  staff: {
    deco: "@user_passes_test(lambda user: user.is_staff)",
    imports: ["from django.contrib.auth.decorators import user_passes_test"],
    label: "@user_passes_test(is_staff)",
  },
};

function authViews(s: LabState) {
  const p = PROTECTIONS[str(s, "protection")] ?? PROTECTIONS.none;
  return `${["from django.shortcuts import render", ...p.imports].join("\n")}

from .models import Report


${p.deco ? p.deco + "\n" : ""}def dashboard(request):
    reports = Report.objects.all()
    return render(request, "reports/dashboard.html", {"reports": reports})
`;
}

const VISITORS = [
  { value: "anonymous", label: "Anonymous visitor" },
  { value: "member", label: "member (logged in)" },
  { value: "analyst", label: "analyst (has view_report)" },
  { value: "staff", label: "staff (is_staff=True)" },
];

const authLab: Lab = {
  slug: "auth",
  title: "Login & permissions",
  file: "views.py",
  group: "Users & requests",
  summary: "Protect a page with login_required, permission_required or a custom test, and see how four different visitors are treated.",
  chapter: "authentication",
  initial: { protection: "login", loginUrl: "/accounts/login/", visitor: "anonymous", password: "member-pass-123" },
  controls: [
    {
      type: "select",
      key: "protection",
      label: "Protect /dashboard/ with",
      options: Object.entries(PROTECTIONS).map(([value, p]) => ({ value, label: p.label })),
    },
    { type: "text", key: "loginUrl", label: "settings.LOGIN_URL", mono: true },
    { type: "select", key: "visitor", label: "Preview as", options: VISITORS },
    { type: "text", key: "password", label: 'authenticate(username="member", password=…)', mono: true },
  ],
  build: (s) => ({
    focus: "reports/views.py",
    files: {
      "config/settings.py": settings({
        apps: ["reports"],
        extra: `LOGIN_URL = ${py(str(s, "loginUrl") || "/accounts/login/")}\nLOGIN_REDIRECT_URL = "/dashboard/"`,
      }),
      "config/urls.py": `from django.urls import include, path

urlpatterns = [
    path("accounts/", include("django.contrib.auth.urls")),
    path("", include("reports.urls")),
]
`,
      "reports/models.py": `from django.db import models


class Report(models.Model):
    title = models.CharField(max_length=100)

    def __str__(self):
        return self.title
`,
      "reports/views.py": authViews(s),
      "reports/urls.py": `from django.urls import path

from . import views

urlpatterns = [path("dashboard/", views.dashboard, name="dashboard")]
`,
      "templates/base.html": BASE_HTML,
      "templates/registration/login.html": `{% extends "base.html" %}
{% block content %}
<h1>Log in</h1>
<p class="muted">You were sent here by the protection on /dashboard/ (?next={{ next }}).</p>
<form method="post">{% csrf_token %}{{ form.as_div }}<button>Log in</button></form>
{% endblock %}
`,
      "reports/templates/reports/dashboard.html": `{% extends "base.html" %}
{% block content %}
<h1>Dashboard</h1>
<p>Hello, <strong>{{ user.username|default:"anonymous visitor" }}</strong>.</p>
<ul>{% for r in reports %}<li>{{ r }}</li>{% endfor %}</ul>
{% endblock %}
`,
      "seed.py": `from django.contrib.auth.models import Permission, User

from reports.models import Report

Report.objects.create(title="Quarterly sales")
Report.objects.create(title="Website traffic")

User.objects.create_user("member", password="member-pass-123")
analyst = User.objects.create_user("analyst", password="analyst-pass-123")
analyst.user_permissions.add(Permission.objects.get(codename="view_report"))
User.objects.create_user("staff", password="staff-pass-123", is_staff=True)
`,
    },
  }),
  probe: (s) => String.raw`
from django.contrib.auth import authenticate
from django.contrib.auth.models import User

users = {"anonymous": None, **{u.username: u for u in User.objects.all()}}
rows = []
for name in ["anonymous", "member", "analyst", "staff"]:
    r = request("/dashboard/", user=users[name])
    rows.append([name, r["status"], r["reason"], r["location"] or ""])

visitor = users.get(${py(str(s, "visitor"))})
page = request("/dashboard/", user=visitor)
if page["location"]:
    page = request(page["location"], user=visitor)

client = client_for(users["member"])
session = {k: short(v, 50) for k, v in client.session.items()}
member = User.objects.get(username="member")
attempt = authenticate(username="member", password=${py(str(s, "password"))})
result = {
    "rows": rows,
    "page": page,
    "session": session,
    "authenticate": repr(attempt),
    "hash": member.password[:60] + "…",
    "check": member.check_password(${py(str(s, "password"))}),
}
`,
  present: (r) => {
    const page = r.page as Resp;
    return [
      {
        kind: "matrix",
        title: "Who gets in",
        caption: "GET /dashboard/ sent once per visitor.",
        columns: ["Status", "Redirect"],
        rows: (r.rows as [string, number, string, string][]).map(([name, status, reason, loc]) => ({
          label: name,
          cells: [
            { text: `${status} ${reason}`, tone: tone(status) },
            { text: loc || "—", tone: "muted" },
          ],
        })),
      },
      { kind: "html", title: "Page", html: page.preview ?? page.body, height: 420 },
      {
        kind: "kv",
        title: "authenticate() & passwords",
        items: [
          ["authenticate(username='member', …)", String(r.authenticate)],
          ["member.check_password(…)", String(r.check)],
          ["Stored password (a hash, not the password)", String(r.hash)],
          ...Object.entries(r.session as Record<string, string>).map(([k, v]) => [`session["${k}"]`, v] as [string, string]),
        ],
      },
    ];
  },
  notes: (s) => {
    const p = str(s, "protection");
    const notes: Record<string, string> = {
      none: "Without protection anyone, even anonymous visitors, sees the page.",
      login: "`@login_required` redirects anonymous visitors to LOGIN_URL with ?next=/dashboard/ so they can come back after logging in.",
      perm: "`@permission_required` needs the `reports.view_report` permission. Users without it are redirected to the login page, even if they're logged in.",
      permRaise: "With `raise_exception=True`, logged-in users without the permission get 403 Forbidden instead of a confusing redirect.",
      staff: "`@user_passes_test` runs any function you like on request.user. Here only staff pass.",
    };
    return [
      notes[p],
      "`authenticate()` only checks the username and password and returns a User or None. `login()` then stores the user's id in the session.",
      "Passwords are never stored: Django keeps a salted hash and compares hashes with `check_password()`. (The lab uses a fast hasher; real projects use PBKDF2 or Argon2.)",
    ];
  },
};

// ===========================================================================
// middleware
// ===========================================================================

const CUSTOM_MW: Record<string, { cls: string; code: string }> = {
  timing: {
    cls: "TimingMiddleware",
    code: `class TimingMiddleware:
    """Adds an X-Response-Time header."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        print("→ TimingMiddleware (before the view)")
        start = time.perf_counter()
        response = self.get_response(request)
        response["X-Response-Time"] = f"{(time.perf_counter() - start) * 1000:.1f}ms"
        print("← TimingMiddleware (after the view)")
        return response`,
  },
  bots: {
    cls: "BlockBotsMiddleware",
    code: `class BlockBotsMiddleware:
    """Refuses requests from a bad user agent."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        print("→ BlockBotsMiddleware")
        if "BadBot" in request.headers.get("User-Agent", ""):
            print("  BlockBotsMiddleware short-circuits: the view never runs")
            return HttpResponseForbidden("Bots are not welcome.")
        response = self.get_response(request)
        print("← BlockBotsMiddleware")
        return response`,
  },
  maintenance: {
    cls: "MaintenanceMiddleware",
    code: `class MaintenanceMiddleware:
    """Shows a 503 page for every request while switched on."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        print("→ MaintenanceMiddleware: down for maintenance")
        return HttpResponse("We'll be back soon.", status=503)`,
  },
  poweredBy: {
    cls: "PoweredByMiddleware",
    code: `class PoweredByMiddleware:
    """Adds a header to every response."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        print("→ PoweredByMiddleware")
        response = self.get_response(request)
        response["X-Powered-By"] = "Django"
        print("← PoweredByMiddleware")
        return response`,
  },
};

function middlewareCode(s: LabState) {
  const chosen = list(s, "enabled").filter((k) => CUSTOM_MW[k]);
  return `import time

from django.http import HttpResponse, HttpResponseForbidden


${chosen.length ? chosen.map((k) => CUSTOM_MW[k].code).join("\n\n\n") : "# Tick a middleware above to add it."}
`;
}

const middlewareLab: Lab = {
  slug: "middleware",
  title: "Middleware",
  file: "middleware.py",
  group: "Users & requests",
  summary: "Add middleware to the stack, change its order and the user agent, and see the order every layer runs in.",
  chapter: "middleware-and-signals",
  initial: { enabled: ["timing", "bots", "poweredBy"], order: "first", userAgent: "Mozilla/5.0" },
  controls: [
    {
      type: "checklist",
      key: "enabled",
      label: "Custom middleware",
      options: [
        { value: "timing", label: "TimingMiddleware" },
        { value: "bots", label: "BlockBotsMiddleware" },
        { value: "poweredBy", label: "PoweredByMiddleware" },
        { value: "maintenance", label: "MaintenanceMiddleware" },
      ],
    },
    {
      type: "segmented",
      key: "order",
      label: "Position in MIDDLEWARE",
      options: [
        { value: "first", label: "before Django's" },
        { value: "last", label: "after Django's" },
      ],
    },
    {
      type: "segmented",
      key: "userAgent",
      label: "User-Agent",
      options: [
        { value: "Mozilla/5.0", label: "a browser" },
        { value: "BadBot/1.0", label: "BadBot/1.0" },
      ],
    },
  ],
  build: (s) => {
    const chosen = list(s, "enabled").filter((k) => CUSTOM_MW[k]).map((k) => `core.middleware.${CUSTOM_MW[k].cls}`);
    const middleware = str(s, "order") === "first" ? [...chosen, ...DEFAULT_MIDDLEWARE] : [...DEFAULT_MIDDLEWARE, ...chosen];
    return {
      focus: "core/middleware.py",
      files: {
        "config/settings.py": settings({ apps: ["core"], middleware }),
        "config/urls.py": includeUrls("core"),
        "core/models.py": "",
        "core/middleware.py": middlewareCode(s),
        "core/views.py": `from django.http import HttpResponse


def home(request):
    print("  ★ the view runs")
    return HttpResponse("<h1>Hello from the view</h1>")
`,
        "core/urls.py": `from django.urls import path

from . import views

urlpatterns = [path("", views.home)]
`,
      },
    };
  },
  probe: (s) => String.raw`
r = request("/", headers={"User-Agent": ${py(str(s, "userAgent"))}})
from django.conf import settings
result = {"r": r, "middleware": list(settings.MIDDLEWARE)}
`,
  present: (r) => {
    const resp = r.r as Resp;
    const interesting = Object.entries(resp.headers).filter(([k]) => /^(X-|Content-Type|Referrer|Cross-Origin)/i.test(k));
    return [
      { kind: "code", title: "Execution order", lang: "text", text: resp.printed || "(nothing printed)" },
      {
        kind: "kv",
        title: "Response",
        items: [["Status", `${resp.status} ${resp.reason}`], ...interesting.map(([k, v]) => [k, v] as [string, string]), ["Body", resp.body.slice(0, 120)]],
      },
      {
        kind: "table",
        title: "MIDDLEWARE",
        caption: "Top to bottom on the way in, bottom to top on the way out.",
        columns: ["#", "Class"],
        rows: (r.middleware as string[]).map((m, i) => [String(i + 1), m]),
      },
    ];
  },
  notes: (s) => {
    const notes = [
      "Middleware wraps the view like layers of an onion: code before `get_response()` runs on the way in, code after it on the way out.",
    ];
    if (list(s, "enabled").includes("bots") && str(s, "userAgent").includes("BadBot")) notes.push("BlockBotsMiddleware returned a response itself, so nothing below it (including the view) ran.");
    if (list(s, "enabled").includes("maintenance")) notes.push("MaintenanceMiddleware never calls get_response(): every request stops there with 503.");
    notes.push(
      str(s, "order") === "first"
        ? "Placed first, your middleware sees the request before Django's own layers (sessions, CSRF, auth)."
        : "Placed last, your middleware runs after Django's layers, so request.user and request.session are already available.",
    );
    return notes;
  },
};

// ===========================================================================
// sessions, cookies & messages
// ===========================================================================

const sessionsLab: Lab = {
  slug: "sessions",
  title: "Sessions, cookies & messages",
  file: "views.py",
  group: "Users & requests",
  summary: "Visit a page several times and watch the session remember things. Switch where sessions are stored and flash one-time messages.",
  chapter: "sessions-and-messages",
  initial: { visits: 3, engine: "db", messages: true, cart: true },
  controls: [
    { type: "number", key: "visits", label: "Number of visits", min: 1, max: 6 },
    {
      type: "segmented",
      key: "engine",
      label: "SESSION_ENGINE",
      options: [
        { value: "db", label: "database" },
        { value: "signed_cookies", label: "signed cookie" },
        { value: "cache", label: "cache" },
      ],
    },
    { type: "toggle", key: "cart", label: "Also add to a cart list" },
    { type: "toggle", key: "messages", label: 'messages.success(...) on each visit' },
  ],
  build: (s) => ({
    focus: "shop/views.py",
    files: {
      "config/settings.py": settings({
        apps: ["shop"],
        extra: `SESSION_ENGINE = "django.contrib.sessions.backends.${str(s, "engine")}"`,
      }),
      "config/urls.py": includeUrls("shop"),
      "shop/models.py": "",
      "shop/views.py": `from django.contrib import messages
from django.shortcuts import render


def home(request):
    visits = request.session.get("visits", 0) + 1
    request.session["visits"] = visits
${
  bool(s, "cart")
    ? `
    cart = request.session.get("cart", [])
    cart.append(f"item {visits}")
    request.session["cart"] = cart          # reassign so Django saves it
`
    : ""
}${bool(s, "messages") ? `\n    messages.success(request, f"Visit number {visits} recorded.")\n` : ""}
    return render(request, "shop/home.html", {"visits": visits})
`,
      "shop/urls.py": `from django.urls import path

from . import views

urlpatterns = [path("", views.home)]
`,
      "templates/base.html": BASE_HTML,
      "shop/templates/shop/home.html": `{% extends "base.html" %}
{% block content %}
{% if messages %}<ul>{% for m in messages %}<li class="card">{{ m }}</li>{% endfor %}</ul>{% endif %}
<h1>You've visited {{ visits }} time{{ visits|pluralize }}</h1>
<p>Cart: {{ request.session.cart|join:", "|default:"(empty)" }}</p>
{% endblock %}
`,
    },
  }),
  probe: (s) => String.raw`
from django.contrib.sessions.models import Session
client = client_for(None)
log = []
for i in range(${num(s, "visits")}):
    r = request("/", client=client)
    cookie = client.cookies.get("sessionid")
    log.append([str(i + 1), str(r["status"]), (cookie.value[:46] + "…") if cookie and len(cookie.value) > 46 else (cookie.value if cookie else "(none)")])
rows = []
try:
    for sess in Session.objects.all():
        rows.append([sess.session_key, short(sess.get_decoded(), 90), str(sess.expire_date)[:19]])
except Exception as exc:
    rows.append(["(no table)", str(exc)[:80], ""])
result = {"page": r, "log": log, "rows": rows, "session": {k: short(v, 60) for k, v in client.session.items()}}
`,
  present: (r, s) => {
    const page = r.page as Resp;
    const outs: Output[] = [
      { kind: "html", title: "Page", html: page.preview ?? page.body, height: 320 },
      {
        kind: "table",
        title: "Cookie per visit",
        caption: "The browser sends this sessionid cookie back on every request.",
        columns: ["Visit", "Status", "sessionid cookie"],
        rows: r.log as string[][],
      },
      {
        kind: "kv",
        title: "request.session",
        items: Object.entries(r.session as Record<string, string>).map(([k, v]) => [k, v] as [string, string]),
      },
    ];
    if (str(s, "engine") === "db") {
      outs.push({ kind: "table", title: "django_session table", columns: ["session_key", "decoded data", "expires"], rows: r.rows as string[][] });
    }
    return outs;
  },
  notes: (s) => {
    const engine = str(s, "engine");
    const notes = [
      "HTTP is stateless. The session gives each visitor a random id in a cookie; the data itself is stored by the session engine.",
    ];
    if (engine === "db") notes.push("Database engine: the data lives in the django_session table; the cookie only holds a random key.");
    if (engine === "signed_cookies") notes.push("Signed-cookie engine: the data itself is inside the cookie (signed so it can't be edited, but readable). Notice the cookie grows as the session grows.");
    if (engine === "cache") notes.push("Cache engine: fast, but sessions vanish when the cache is cleared.");
    if (bool(s, "messages")) notes.push("Messages are stored for exactly one display: each visit shows the message added on that visit, then it's gone.");
    return notes;
  },
};

export const REQUEST_LABS = [authLab, middlewareLab, sessionsLab];
