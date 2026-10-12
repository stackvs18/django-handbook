"""
Django Playground runtime.

Runs a real Django project inside Pyodide (Python compiled to WebAssembly).
The browser sends the project's files; this module writes them to the
in-memory filesystem, (re)configures Django, builds the database with real
migrations, and serves requests through Django's test Client while recording
what every layer did (URL resolver, view, queries, templates, response).

Everything runs in the visitor's own browser tab.
"""

import contextlib
import hashlib
import importlib
import inspect
import io
import json
import os
import re
import runpy
import shutil
import sys
import time
import traceback
from datetime import datetime

# Pyodide always has an asyncio event loop running, which makes Django think
# every ORM call happens inside async code. Everything here runs synchronously
# in one worker, so the guard is safely switched off.
os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "true")

ROOT = "/home/pyodide/project"
DB_PATH = "/home/pyodide/playground.sqlite3"
SITE_PACKAGES_RE = re.compile(r'File "/lib/python3\.\d+/(site-packages/)?')

BASE_APPS = [
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
]

# PBKDF2 with a million iterations is very slow in WebAssembly, so the
# playground always uses a fast hasher. Never do this in a real project.
FAST_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

DEFAULT_CONTEXT_KEYS = {
    "True", "False", "None", "csrf_token", "request", "user", "perms",
    "messages", "DEFAULT_MESSAGE_LEVELS", "block", "forloop",
}

S = {
    "configured": False,
    "settings_module": "config.settings",
    "project_labels": set(),
    "schema_key": None,
    "client": None,
    "applied": set(),
    "shell_ns": {},
    "versions": {},
}


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------

def _clean_tb(text):
    """Shorten file paths in tracebacks so they match the editor's paths."""
    text = text.replace(ROOT + "/", "")
    return SITE_PACKAGES_RE.sub('File "', text)


def _short(value, limit=90):
    text = repr(value) if not isinstance(value, str) else value
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _now():
    return datetime.now().strftime("%d/%b/%Y %H:%M:%S")


@contextlib.contextmanager
def _capture():
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        yield buf


def _project_file(path):
    return bool(path) and path.startswith(ROOT + "/")


def _rel(path):
    return path[len(ROOT) + 1:] if _project_file(path) else path


# --------------------------------------------------------------------------
# files and modules
# --------------------------------------------------------------------------

def _is_generated(rel_path):
    return "/migrations/" in rel_path and not rel_path.endswith("__init__.py")


def _write_files(files, keep_migrations):
    os.makedirs(ROOT, exist_ok=True)
    # remove files that no longer exist in the editor
    for dirpath, dirnames, filenames in os.walk(ROOT, topdown=False):
        for name in filenames:
            full = os.path.join(dirpath, name)
            rel = _rel(full)
            if rel in files:
                continue
            if keep_migrations and "/migrations/" in rel:
                continue
            if name.endswith(".pyc"):
                continue
            os.remove(full)
        if dirpath != ROOT and not os.listdir(dirpath):
            os.rmdir(dirpath)

    for rel, content in files.items():
        full = os.path.join(ROOT, rel)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as fh:
            fh.write(content)

    # every folder that holds Python files is a package
    for dirpath, dirnames, filenames in os.walk(ROOT):
        if dirpath == ROOT or "__pycache__" in dirpath:
            continue
        if any(f.endswith(".py") for f in filenames) and "__init__.py" not in filenames:
            open(os.path.join(dirpath, "__init__.py"), "w").close()

    importlib.invalidate_caches()


def _purge_modules():
    for name, module in list(sys.modules.items()):
        if _project_file(getattr(module, "__file__", None) or ""):
            del sys.modules[name]
    importlib.invalidate_caches()


def _schema_key(installed, user_settings):
    h = hashlib.sha256()
    h.update(repr(installed).encode())
    h.update(repr(user_settings.get("AUTH_USER_MODEL")).encode())
    for dirpath, _dirs, filenames in sorted(os.walk(ROOT)):
        if "/migrations" in dirpath or "__pycache__" in dirpath:
            continue
        for name in sorted(filenames):
            rel = _rel(os.path.join(dirpath, name))
            if name == "models.py" or "/models/" in rel or name == "seed.py":
                with open(os.path.join(dirpath, name), encoding="utf-8") as fh:
                    h.update(rel.encode() + fh.read().encode())
    return h.hexdigest()


# --------------------------------------------------------------------------
# Django configuration
# --------------------------------------------------------------------------

def _db_settings():
    return {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": DB_PATH}}


def _ensure_django():
    if S["configured"]:
        return
    if ROOT not in sys.path:
        sys.path.insert(0, ROOT)

    import django
    from django.conf import settings

    settings.configure(
        DEBUG=True,
        SECRET_KEY="playground-only",
        ALLOWED_HOSTS=["*"],
        INSTALLED_APPS=BASE_APPS,
        DATABASES=_db_settings(),
        DEFAULT_AUTO_FIELD="django.db.models.BigAutoField",
        PASSWORD_HASHERS=FAST_HASHERS,
        USE_TZ=True,
        TIME_ZONE="UTC",
    )
    django.setup()

    from django.test.utils import setup_test_environment

    setup_test_environment()  # lets responses report templates and context

    # Errors are reported through the playground itself; keep the console quiet.
    import logging

    for name in ("django.request", "django.security", "django.server"):
        logging.getLogger(name).setLevel(logging.CRITICAL)

    import platform

    S["versions"] = {"django": django.get_version(), "python": platform.python_version()}
    S["configured"] = True


def _uncached_templates(templates):
    """Use non-caching loaders so edited templates show up immediately."""
    result = []
    for engine in templates or []:
        engine = dict(engine)
        options = dict(engine.get("OPTIONS") or {})
        if str(engine.get("BACKEND", "")).endswith("DjangoTemplates") and "loaders" not in options:
            loaders = ["django.template.loaders.filesystem.Loader"]
            if engine.get("APP_DIRS"):
                loaders.append("django.template.loaders.app_directories.Loader")
            options["loaders"] = loaders
            engine["APP_DIRS"] = False
        engine["OPTIONS"] = options
        result.append(engine)
    return result


def _install_apps(installed):
    from django.apps import apps
    from django.contrib.contenttypes.models import ContentType

    # Return the registry to the clean state left by django.setup(), even if
    # a previous run failed half-way through loading someone's models.py.
    while apps.stored_app_configs:
        apps.app_configs = apps.stored_app_configs.pop()
    apps.apps_ready = apps.models_ready = apps.ready = True
    apps.loading = False
    apps.clear_cache()

    for label in S["project_labels"]:
        apps.all_models.pop(label, None)
    ContentType.objects.clear_cache()

    try:
        apps.set_installed_apps(installed)
    finally:
        S["project_labels"] = {
            config.label for config in apps.app_configs.values() if _project_file(config.path + "/")
        }


def _purge_third_party(user):
    """
    Django REST Framework copies its settings onto class attributes when it is
    imported (for example APIView.permission_classes). When REST_FRAMEWORK or
    SIMPLE_JWT change, re-import those packages so the new settings apply.
    """
    from django.apps import apps

    key = repr(user.get("REST_FRAMEWORK")) + repr(user.get("SIMPLE_JWT"))
    if key == S.get("drf_key"):
        return
    S["drf_key"] = key
    for name in list(sys.modules):
        if name == "rest_framework" or name.startswith(("rest_framework.", "rest_framework_simplejwt")):
            del sys.modules[name]
    for label in ("authtoken", "token_blacklist"):
        apps.all_models.pop(label, None)
    importlib.invalidate_caches()


def _apply_settings(user):
    from django.conf import global_settings, settings
    from django.test.signals import setting_changed

    values = dict(user)
    values.pop("DATABASES", None)
    values["PASSWORD_HASHERS"] = FAST_HASHERS
    values["ALLOWED_HOSTS"] = list(values.get("ALLOWED_HOSTS") or []) + ["testserver", "localhost"]
    values["TEMPLATES"] = _uncached_templates(values.get("TEMPLATES"))
    installed = list(values.pop("INSTALLED_APPS", BASE_APPS))

    for name in S["applied"] - set(values):
        if hasattr(global_settings, name):
            setattr(settings, name, getattr(global_settings, name))
    for name, value in values.items():
        setattr(settings, name, value)
    settings.INSTALLED_APPS = installed
    S["applied"] = set(values)

    _purge_third_party(user)
    _install_apps(installed)

    for name in [*values, "INSTALLED_APPS"]:
        setting_changed.send(sender=None, setting=name, value=getattr(settings, name), enter=True)
    return installed


# --------------------------------------------------------------------------
# commands
# --------------------------------------------------------------------------

def cmd_run(payload):
    """Write files, configure Django, migrate if models changed, seed."""
    started = time.perf_counter()
    files = payload["files"]
    S["settings_module"] = payload.get("settingsModule", "config.settings")
    force = payload.get("resetDatabase", False)

    _ensure_django()
    from django.core.management import call_command
    from django.db import connections
    from django.test import Client

    log = []

    # Probe whether the schema changed before touching anything on disk.
    _write_files(files, keep_migrations=True)
    _purge_modules()
    user_settings_module = importlib.import_module(S["settings_module"])
    user_settings = {k: v for k, v in vars(user_settings_module).items() if k.isupper()}
    installed_preview = list(user_settings.get("INSTALLED_APPS", BASE_APPS))
    key = _schema_key(installed_preview, user_settings)
    rebuild = force or key != S["schema_key"] or not os.path.exists(DB_PATH)

    if rebuild:
        connections.close_all()
        if os.path.exists(DB_PATH):
            os.remove(DB_PATH)
        _write_files(files, keep_migrations=False)
        _purge_modules()
        user_settings_module = importlib.import_module(S["settings_module"])
        user_settings = {k: v for k, v in vars(user_settings_module).items() if k.isupper()}

    if rebuild:
        S["schema_key"] = None  # marked valid again once the rebuild succeeds
    installed = _apply_settings(user_settings)

    generated = {}
    sql = {}
    if rebuild:
        labels = sorted(S["project_labels"])
        out = io.StringIO()
        log.append("$ python manage.py makemigrations")
        # In a terminal, makemigrations asks "Did you rename X to Y?". Here the
        # caller decides the answer (payload["answers"]["rename"]).
        from django.db.migrations.questioner import NonInteractiveMigrationQuestioner

        rename = bool((payload.get("answers") or {}).get("rename"))
        original = (NonInteractiveMigrationQuestioner.ask_rename, NonInteractiveMigrationQuestioner.ask_rename_model)
        NonInteractiveMigrationQuestioner.ask_rename = lambda self, *a, **k: rename
        NonInteractiveMigrationQuestioner.ask_rename_model = lambda self, *a, **k: rename
        try:
            call_command("makemigrations", *labels, stdout=out, stderr=out, interactive=False)
        except SystemExit:
            # e.g. a new non-nullable field without a default: Django refuses and exits
            message = out.getvalue().strip()
            return {"ok": False, "error": message or "makemigrations stopped.", "kind": "makemigrations"}
        finally:
            NonInteractiveMigrationQuestioner.ask_rename, NonInteractiveMigrationQuestioner.ask_rename_model = original
        log.append(out.getvalue().rstrip() or "No changes detected")
        importlib.invalidate_caches()

        out = io.StringIO()
        log.append("\n$ python manage.py migrate")
        call_command("migrate", stdout=out, stderr=out, interactive=False, verbosity=1)
        log.append(out.getvalue().rstrip())

        seed = os.path.join(ROOT, "seed.py")
        if os.path.exists(seed):
            log.append("\n$ python seed.py")
            with _capture() as buf:
                runpy.run_path(seed, run_name="__main__")
            log.append(buf.getvalue().rstrip() or "Sample data created.")
    else:
        log.append("Models unchanged: keeping the database and its data.")

    for dirpath, _dirs, filenames in os.walk(ROOT):
        for name in sorted(filenames):
            rel = _rel(os.path.join(dirpath, name))
            if _is_generated(rel) and name.endswith(".py"):
                with open(os.path.join(dirpath, name), encoding="utf-8") as fh:
                    generated[rel] = fh.read()
                app_label = rel.split("/")[0]
                out = io.StringIO()
                try:
                    call_command("sqlmigrate", app_label, name[:-3], stdout=out)
                    sql[rel] = out.getvalue().strip()
                except Exception as exc:  # noqa: BLE001
                    sql[rel] = f"-- {exc}"

    out = io.StringIO()
    call_command("check", stdout=out, stderr=out)
    checks = out.getvalue().strip()

    previous = S["client"]
    client = Client(enforce_csrf_checks=True, raise_request_exception=False)
    if previous is not None and not rebuild:
        client.cookies = previous.cookies
    S["client"] = client
    S["shell_ns"] = {}
    S["schema_key"] = key
    S["generated"] = generated
    S["sql"] = sql
    S["run_log"] = "\n".join(log)

    from django.conf import settings

    banner = [
        "Performing system checks...",
        "",
        checks,
        "",
        datetime.now().strftime("%B %d, %Y - %H:%M:%S"),
        f"Django version {S['versions']['django']}, using settings '{S['settings_module']}'",
        "Starting development server at http://127.0.0.1:8000/",
    ]

    return {
        "ok": True,
        "log": "\n".join(log),
        "checks": checks,
        "banner": "\n".join(banner),
        "rebuilt": rebuild,
        "generated": generated,
        "sql": sql,
        "installedApps": installed,
        "middleware": list(getattr(settings, "MIDDLEWARE", [])),
        "versions": S["versions"],
        "ms": round((time.perf_counter() - started) * 1000),
    }


def _source_of(obj):
    try:
        source_file = inspect.getsourcefile(obj)
        line = inspect.getsourcelines(obj)[1]
    except (TypeError, OSError):
        return None
    if _project_file(source_file or ""):
        return {"file": _rel(source_file), "line": line}
    return None


def _api_view_function(cls):
    """Find the original function wrapped by DRF's @api_view decorator."""
    for method in ("get", "post", "put", "patch", "delete"):
        handler = getattr(cls, method, None)
        for cell in getattr(handler, "__closure__", None) or ():
            value = cell.cell_contents
            if inspect.isfunction(value) and value.__name__ == cls.__name__:
                return value
    return None


def _view_info(match):
    func = match.func
    info = {"name": match._func_path, "kind": "function", "bases": [], "actions": None}
    target = func

    if hasattr(func, "actions"):  # DRF ViewSet routed by a router
        target = func.cls
        info["kind"] = "viewset"
        info["actions"] = dict(func.actions)
    elif hasattr(func, "cls"):  # DRF APIView (including @api_view)
        target = func.cls
        info["kind"] = "apiview"
    elif hasattr(func, "view_class"):  # Django class-based view
        target = func.view_class
        info["kind"] = "class"

    if inspect.isclass(target):
        info["name"] = f"{target.__module__}.{target.__name__}"
        info["bases"] = [b.__name__ for b in target.__mro__[1:6] if b is not object]
        original = _api_view_function(target) if info["kind"] == "apiview" else None
        if original is not None:
            info["kind"] = "api_view"
            info["bases"] = []
            source = _source_of(original)
        else:
            source = _source_of(target)
    else:
        decorators = []
        wrapped = func
        while hasattr(wrapped, "__wrapped__"):
            decorators.append(getattr(wrapped, "__name__", "decorator"))
            wrapped = wrapped.__wrapped__
        info["decorated"] = bool(decorators)
        source = _source_of(inspect.unwrap(func))

    if source:
        info.update(source)
    return info


def cmd_request(payload):
    from django.core.signals import got_request_exception
    from django.db import connection
    from django.test.utils import CaptureQueriesContext
    from django.urls import Resolver404, resolve

    client = S["client"]
    if client is None:
        return {"ok": False, "error": "The project hasn't been run yet."}

    method = (payload.get("method") or "GET").upper()
    path = payload.get("path") or "/"
    if not path.startswith("/"):
        path = "/" + path
    path_only = path.split("?", 1)[0]
    form = payload.get("form")  # list of [name, value] pairs from an HTML form
    body = payload.get("body")  # raw body for API requests
    content_type = payload.get("contentType") or "application/json"
    extra = {"HTTP_ACCEPT": payload.get("accept") or "text/html,application/xhtml+xml,*/*;q=0.8"}
    for name, value in (payload.get("headers") or {}).items():
        if value:
            extra["HTTP_" + name.upper().replace("-", "_")] = value

    trace = {"method": method, "path": path}
    try:
        match = resolve(path_only)
        trace["resolver"] = {
            "route": match.route,
            "name": match.url_name,
            "namespace": match.namespace or None,
            "kwargs": {k: _short(v) for k, v in match.kwargs.items()},
        }
        trace["view"] = _view_info(match)
    except Resolver404:
        trace["resolver"] = None
        trace["view"] = None

    errors = []
    problems = []

    def on_exception(sender, request=None, **kwargs):
        errors.append(_clean_tb(traceback.format_exc()))
        exc = sys.exc_info()[1]
        info = getattr(exc, "template_debug", None)
        if info and _project_file(str(info.get("name", ""))):
            problems.append(
                {
                    "path": _rel(str(info["name"])),
                    "line": info.get("line") or 1,
                    "message": f"{type(exc).__name__}: {exc}",
                }
            )

    got_request_exception.connect(on_exception)
    sent_cookies = sorted(client.cookies.keys())
    started = time.perf_counter()
    try:
        with CaptureQueriesContext(connection) as queries, _capture() as printed:
            if form is not None and method == "POST":
                data = {}
                for key, value in form:
                    data.setdefault(key, []).append(value)
                response = client.post(path, data=data, **extra)
            elif method in ("GET", "HEAD") or body in (None, ""):
                response = client.generic(method, path, **extra)
            else:
                response = client.generic(method, path, data=body, content_type=content_type, **extra)
    finally:
        got_request_exception.disconnect(on_exception)
    elapsed = (time.perf_counter() - started) * 1000

    content = b"".join(response.streaming_content) if response.streaming else response.content
    ctype = response.headers.get("Content-Type", "")
    text = content.decode(response.charset or "utf-8", errors="replace")

    templates = []
    widget_templates = set()
    for template in getattr(response, "templates", None) or []:
        name = getattr(template, "name", None)
        if not name:
            continue
        if name.startswith("django/forms/"):
            widget_templates.add(name)  # built-in form/widget templates: just count them
        elif name not in templates:
            templates.append(name)

    context = {}
    ctx = getattr(response, "context", None)
    if ctx is not None:
        try:
            flat = {}
            contexts = ctx if isinstance(ctx, list) else [ctx]
            for c in contexts:
                for d in getattr(c, "dicts", []):
                    flat.update(d)
            for key, value in flat.items():
                if key in DEFAULT_CONTEXT_KEYS or key.startswith("_"):
                    continue
                context[key] = f"{type(value).__name__}: {_short(value, 120)}"
        except Exception:  # noqa: BLE001
            pass

    request = getattr(response, "wsgi_request", None)
    user = None
    session = {}
    if request is not None:
        u = getattr(request, "user", None)
        if u is not None:
            user = {"name": str(u), "authenticated": bool(getattr(u, "is_authenticated", False))}
        sess = getattr(request, "session", None)
        if sess is not None:
            try:
                session = {k: _short(v, 40) for k, v in sess.items()}
            except Exception:  # noqa: BLE001
                session = {}

    from django.conf import settings

    trace.update(
        {
            "status": response.status_code,
            "reason": response.reason_phrase,
            "contentType": ctype,
            "headers": {k: v for k, v in response.headers.items()},
            "setCookies": sorted(response.cookies.keys()),
            "sentCookies": sent_cookies,
            "location": response.headers.get("Location"),
            "ms": round(elapsed, 1),
            "size": len(content),
            "queries": [
                {"sql": q["sql"], "ms": round(float(q.get("time") or 0) * 1000, 2)}
                for q in queries.captured_queries
            ],
            "templates": templates,
            "widgetTemplates": len(widget_templates),
            "context": context,
            "user": user,
            "session": session,
            "middleware": list(getattr(settings, "MIDDLEWARE", [])),
            "printed": printed.getvalue(),
            "errors": errors,
            "problems": problems,
            "csrfFailed": response.status_code == 403 and "CSRF verification failed" in text,
            "form": [[k, v if "password" not in k.lower() else "••••"] for k, v in (form or [])],
        }
    )

    log_line = f'[{_now()}] "{method} {path} HTTP/1.1" {response.status_code} {len(content)}'

    return {
        "ok": True,
        "body": text,
        "preview": _inline_static(text) if "html" in ctype else None,
        "trace": trace,
        "log": log_line,
    }


LINK_RE = re.compile(r"<link\b[^>]*?href=[\"']([^\"']+\.css)[\"'][^>]*>", re.I)
SCRIPT_RE = re.compile(r"<script\b[^>]*\bsrc=[\"']/[^\"']*[\"'][^>]*>\s*</script>", re.I)


def _inline_static(html):
    """Inline CSS from static files so pages like the admin look right in the preview."""
    from django.conf import settings
    from django.contrib.staticfiles import finders

    static_url = "/" + str(getattr(settings, "STATIC_URL", "static/") or "static/").strip("/") + "/"

    def replace(match):
        href = match.group(1)
        if not href.startswith(static_url):
            return match.group(0)
        found = finders.find(href[len(static_url):])
        if not found:
            return ""
        try:
            with open(found, encoding="utf-8") as fh:
                return "<style>" + fh.read() + "</style>"
        except OSError:
            return ""

    try:
        html = LINK_RE.sub(replace, html)
    except Exception:  # noqa: BLE001
        pass
    return SCRIPT_RE.sub("", html)


def _shell_namespace():
    if S["shell_ns"]:
        return S["shell_ns"]
    from django.apps import apps
    from django.db import models as dj_models

    ns = {"__name__": "__shell__"}
    imported = []
    for config in apps.get_app_configs():
        if config.label in S["project_labels"] or config.label == "auth":
            for model in config.get_models():
                if config.label == "auth" and model.__name__ not in ("User", "Group", "Permission"):
                    continue
                ns[model.__name__] = model
                imported.append(f"from {model.__module__} import {model.__name__}")
    for name in ("Q", "F", "Count", "Sum", "Avg", "Max", "Min", "Value", "Prefetch"):
        ns[name] = getattr(dj_models, name)
    from django.utils import timezone

    ns["timezone"] = timezone
    ns["__imported__"] = imported
    S["shell_ns"] = ns
    return ns


def cmd_shell(payload):
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    code = payload.get("code", "")
    ns = _shell_namespace()
    with CaptureQueriesContext(connection) as queries, _capture() as out:
        try:
            try:
                compiled = compile(code, "<shell>", "eval")
                is_expr = True
            except SyntaxError:
                compiled = compile(code, "<shell>", "exec")
                is_expr = False
            if is_expr:
                value = eval(compiled, ns)  # noqa: S307 - it's the user's own browser
                if value is not None:
                    print(repr(value))
                    ns["_"] = value
            else:
                exec(compiled, ns)  # noqa: S102
        except Exception:  # noqa: BLE001
            print(_clean_tb(traceback.format_exc()).rstrip())
    return {
        "ok": True,
        "output": out.getvalue(),
        "queries": [q["sql"] for q in queries.captured_queries],
    }


def cmd_shell_info(payload):
    ns = _shell_namespace()
    return {"ok": True, "imported": ns.get("__imported__", [])}


def cmd_db(payload):
    from django.apps import apps
    from django.contrib.auth import get_user_model

    models = []
    for config in apps.get_app_configs():
        if config.label in S["project_labels"]:
            for model in config.get_models(include_auto_created=True):
                models.append(model)
    try:
        user_model = get_user_model()
        if user_model not in models:
            models.append(user_model)
    except Exception:  # noqa: BLE001
        pass

    tables = []
    for model in models:
        fields = list(model._meta.concrete_fields)
        try:
            rows = list(model.objects.values_list(*[f.attname for f in fields])[:100])
            count = model.objects.count()
        except Exception as exc:  # noqa: BLE001
            tables.append({"label": model._meta.label, "table": model._meta.db_table, "error": str(exc)})
            continue
        tables.append(
            {
                "label": model._meta.label,
                "table": model._meta.db_table,
                "columns": [f.column for f in fields],
                "rows": [[_short(v, 48) if v is not None else None for v in row] for row in rows],
                "count": count,
            }
        )
    return {"ok": True, "tables": tables}


# --------------------------------------------------------------------------
# Live labs: a probe script inspects the running project and returns data
# --------------------------------------------------------------------------

def _lab_client(user=None):
    from django.test import Client

    client = Client(raise_request_exception=False)
    if user is not None:
        client.force_login(user)
    return client


def _lab_request(path, method="GET", form=None, body=None, user=None, headers=None, client=None, host=None):
    """Send one request through Django and describe the response."""
    from django.core.signals import got_request_exception
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    client = client or _lab_client(user)
    extra = {"HTTP_" + k.upper().replace("-", "_"): v for k, v in (headers or {}).items() if v}
    if host:
        extra["HTTP_HOST"] = host
    errors = []

    def on_exception(sender, request=None, **kwargs):
        errors.append(_clean_tb(traceback.format_exc()).strip().splitlines()[-1])

    got_request_exception.connect(on_exception)
    try:
        with CaptureQueriesContext(connection) as queries, _capture() as printed:
            if form is not None:
                response = client.post(path, data=form, **extra)
            elif body is not None:
                data = body if isinstance(body, str) else json.dumps(body)
                response = client.generic(method, path, data=data, content_type="application/json", **extra)
            else:
                response = client.generic(method, path, **extra)
    finally:
        got_request_exception.disconnect(on_exception)

    content = b"".join(response.streaming_content) if response.streaming else response.content
    ctype = response.headers.get("Content-Type", "")
    text = content.decode(response.charset or "utf-8", errors="replace")
    templates = []
    for t in getattr(response, "templates", None) or []:
        name = getattr(t, "name", None)
        if name and not name.startswith("django/forms/") and name not in templates:
            templates.append(name)
    context = {}
    ctx = getattr(response, "context", None)
    if ctx is not None:
        try:
            for c in ctx if isinstance(ctx, list) else [ctx]:
                for d in getattr(c, "dicts", []):
                    for k, v in d.items():
                        if k not in DEFAULT_CONTEXT_KEYS and not k.startswith("_"):
                            context[k] = f"{type(v).__name__}: {_short(v, 80)}"
        except Exception:  # noqa: BLE001
            pass
    names = getattr(response, "template_name", None)  # set by TemplateResponse (class-based views)
    if isinstance(names, str):
        names = [names]
    return {
        "templateNames": [str(n) for n in names] if isinstance(names, (list, tuple)) else [],
        "path": path,
        "method": method if form is None else "POST",
        "status": response.status_code,
        "reason": response.reason_phrase,
        "location": response.headers.get("Location"),
        "contentType": ctype,
        "headers": dict(response.headers.items()),
        "body": text,
        "preview": _inline_static(text) if "html" in ctype else None,
        "templates": templates,
        "context": context,
        "queries": [q["sql"] for q in queries.captured_queries],
        "printed": printed.getvalue(),
        "errors": errors,
    }


def cmd_probe(payload):
    """Run a lab's probe script. It must assign a JSON-serialisable `result`."""
    from django.db import connection

    ns = {
        "__name__": "__probe__",
        "json": json,
        "request": _lab_request,
        "client_for": _lab_client,
        "migrations": dict(S.get("generated") or {}),
        "migration_sql": dict(S.get("sql") or {}),
        "connection": connection,
        "short": _short,
        "result": {},
    }
    with _capture() as out:
        try:
            exec(compile(payload.get("code", ""), "<lab>", "exec"), ns)  # noqa: S102 - runs in the visitor's own browser
        except Exception:  # noqa: BLE001
            return {"ok": False, "error": _clean_tb(traceback.format_exc()), "printed": out.getvalue()}
    return {"ok": True, "result": ns.get("result"), "printed": out.getvalue()}


COMMANDS = {
    "probe": cmd_probe,
    "run": cmd_run,
    "request": cmd_request,
    "shell": cmd_shell,
    "shellInfo": cmd_shell_info,
    "db": cmd_db,
}


def handle(command, payload_json):
    payload = json.loads(payload_json) if payload_json else {}
    try:
        result = COMMANDS[command](payload)
    except Exception:  # noqa: BLE001
        result = {"ok": False, "error": _clean_tb(traceback.format_exc())}
    return json.dumps(result, default=str)
