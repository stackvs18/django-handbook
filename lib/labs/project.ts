// Shared scaffolding for lab projects: settings.py, base template, URLs.

const BASE_APPS = [
  "django.contrib.auth",
  "django.contrib.contenttypes",
  "django.contrib.sessions",
  "django.contrib.messages",
];

export const DEFAULT_MIDDLEWARE = [
  "django.middleware.security.SecurityMiddleware",
  "django.contrib.sessions.middleware.SessionMiddleware",
  "django.middleware.common.CommonMiddleware",
  "django.middleware.csrf.CsrfViewMiddleware",
  "django.contrib.auth.middleware.AuthenticationMiddleware",
  "django.contrib.messages.middleware.MessageMiddleware",
  "django.middleware.clickjacking.XFrameOptionsMiddleware",
];

type SettingsOptions = {
  apps: string[];
  admin?: boolean;
  debug?: boolean;
  allowedHosts?: string[];
  timeZone?: string;
  language?: string;
  middleware?: string[];
  extra?: string;
};

export function settings(o: SettingsOptions) {
  const installed = [
    ...(o.admin ? ["django.contrib.admin"] : []),
    ...BASE_APPS,
    ...(o.admin ? ["django.contrib.staticfiles"] : []),
    ...o.apps,
  ];
  const middleware = o.middleware ?? DEFAULT_MIDDLEWARE;
  return `from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = "lab-only-not-secret"
DEBUG = ${o.debug === false ? "False" : "True"}
ALLOWED_HOSTS = [${(o.allowedHosts ?? []).map((h) => `"${h}"`).join(", ")}]

INSTALLED_APPS = [
${installed.map((a) => `    "${a}",`).join("\n")}
]

MIDDLEWARE = [
${middleware.map((m) => `    "${m}",`).join("\n")}
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

LANGUAGE_CODE = "${o.language ?? "en-us"}"
TIME_ZONE = "${o.timeZone ?? "UTC"}"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
${o.extra ? `\n${o.extra.trim()}\n` : ""}`;
}

export const BASE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>{% block title %}Lab{% endblock %}</title>
  <style>
    body { font: 15px/1.6 system-ui, sans-serif; margin: 0; padding: 1.25rem 1.5rem; color: #111; background: #fff; }
    h1 { font-size: 1.5rem; margin: 0 0 .75rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid #e5e5e5; }
    .muted { color: #777; }
    .errorlist { color: #b00020; margin: .2rem 0; padding-left: 1rem; }
    input, select, textarea, button { font: inherit; padding: .3rem .45rem; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: .75rem 1rem; margin: .5rem 0; }
  </style>
</head>
<body>
{% block content %}{% endblock %}
</body>
</html>
`;

export function includeUrls(app: string, prefix = "") {
  return `from django.urls import include, path

urlpatterns = [
    path("${prefix}", include("${app}.urls")),
]
`;
}

export const PLAYERS = [
  ["Virat Kohli", "India", 191, 8848],
  ["Joe Root", "England", 278, 12972],
  ["Steve Smith", "Australia", 199, 9685],
  ["Kane Williamson", "New Zealand", 179, 8881],
  ["Rohit Sharma", "India", 116, 4301],
  ["Shubman Gill", "India", 59, 1893],
] as const;

export const PLAYER_MODEL = `from django.db import models


class Player(models.Model):
    name = models.CharField(max_length=100)
    country = models.CharField(max_length=50)
    test_innings = models.PositiveIntegerField(default=0)
    runs = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name
`;

export function playerSeed(app = "players") {
  return `from ${app}.models import Player

for name, country, innings, runs in ${JSON.stringify(PLAYERS.map((p) => [...p]))}:
    Player.objects.create(name=name, country=country, test_innings=innings, runs=runs)
`;
}

/** Indent every line of a block by `n` spaces. */
export function indent(text: string, n = 4) {
  const pad = " ".repeat(n);
  return text
    .split("\n")
    .map((l) => (l ? pad + l : l))
    .join("\n");
}
