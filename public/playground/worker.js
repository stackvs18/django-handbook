/* Django Playground worker (an ES module worker).
 *
 * Hosts Pyodide (Python compiled to WebAssembly) and a real Django install
 * off the main thread, so the editor stays responsive while Python works.
 * Messages in:  { id, cmd, payload }
 * Messages out: { type: "status", stage, message } | { type: "result", id, result }
 */

import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.mjs";

const INDEX_URL = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";
const DJANGO_SPEC = "django>=5.2,<6.1";

let pyodide = null;
let micropip = null;
let handle = null;
const installed = new Set();

function status(stage, message) {
  postMessage({ type: "status", stage, message });
}

async function boot() {
  status("python", "Downloading Python…");
  pyodide = await loadPyodide({ indexURL: INDEX_URL });

  status("packages", "Loading the package installer…");
  await pyodide.loadPackage(["micropip", "tzdata"]);
  micropip = pyodide.pyimport("micropip");

  status("django", "Installing Django…");
  await micropip.install([DJANGO_SPEC]);

  status("runtime", "Starting the playground runtime…");
  const url = new URL("runtime.py" + self.location.search, self.location.href);
  const source = await (await fetch(url)).text();
  pyodide.runPython(source);
  handle = pyodide.globals.get("handle");

  status("ready", "Ready");
}

async function ensurePackages(packages) {
  const missing = (packages || []).filter((p) => !installed.has(p));
  if (!missing.length) return;
  status("installing", `Installing ${missing.join(", ")}…`);
  await micropip.install(missing);
  missing.forEach((p) => installed.add(p));
  status("ready", "Ready");
}

const booted = boot().catch((err) => {
  status("error", "Python failed to load: " + (err && err.message ? err.message : String(err)));
  throw err;
});

// Python isn't re-entrant, so commands run strictly one after another.
let queue = Promise.resolve();

self.onmessage = (event) => {
  const { id, cmd, payload } = event.data || {};
  queue = queue.then(async () => {
    let result;
    try {
      await booted;
      if (cmd === "run") await ensurePackages(payload && payload.packages);
      result = JSON.parse(handle(cmd, JSON.stringify(payload || {})));
    } catch (err) {
      result = { ok: false, error: err && err.message ? err.message : String(err) };
    }
    postMessage({ type: "result", id, result });
  });
};
