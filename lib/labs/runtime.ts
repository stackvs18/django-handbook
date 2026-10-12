"use client";

// One Python (Pyodide + Django) worker for the whole site. It starts the first
// time a lab needs it and stays alive while the visitor moves between labs, so
// Python only downloads and boots once.

/** Bump when public/playground/runtime.py or worker.js change, to bust caches. */
const RUNTIME_VERSION = "2";

export type RuntimeStage = "idle" | "python" | "packages" | "django" | "runtime" | "installing" | "ready" | "error";
export type RuntimeStatus = { stage: RuntimeStage; message: string };

export type RunResult =
  | {
      ok: true;
      log: string;
      rebuilt: boolean;
      generated: Record<string, string>;
      sql: Record<string, string>;
      versions: { django: string; python: string };
      ms: number;
    }
  | { ok: false; error: string; kind?: string };

export type ProbeResult = { ok: true; result: Record<string, unknown>; printed: string } | { ok: false; error: string };

type Listener = (status: RuntimeStatus) => void;

class Runtime {
  private worker: Worker | null = null;
  private pending = new Map<number, (value: unknown) => void>();
  private nextId = 1;
  private listeners = new Set<Listener>();
  status: RuntimeStatus = { stage: "idle", message: "Python isn't running yet" };
  versions: { django: string; python: string } | null = null;

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setStatus(status: RuntimeStatus) {
    this.status = status;
    this.listeners.forEach((l) => l(status));
  }

  start() {
    if (this.worker) return;
    this.setStatus({ stage: "python", message: "Starting Python…" });
    const worker = new Worker(`/playground/worker.js?v=${RUNTIME_VERSION}`, { type: "module" });
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type === "status") this.setStatus({ stage: data.stage, message: data.message });
      else if (data?.type === "result") {
        this.pending.get(data.id)?.(data.result);
        this.pending.delete(data.id);
      }
    };
    worker.onerror = (event) => {
      this.setStatus({ stage: "error", message: event.message || "The Python worker stopped." });
      this.failAll("The Python worker stopped.");
    };
    this.worker = worker;
  }

  restart() {
    this.worker?.terminate();
    this.worker = null;
    this.failAll("Python was restarted.");
    this.start();
  }

  private failAll(message: string) {
    for (const resolve of this.pending.values()) resolve({ ok: false, error: message });
    this.pending.clear();
  }

  private call<T>(cmd: string, payload: unknown): Promise<T> {
    this.start();
    const id = this.nextId++;
    return new Promise<T>((resolve) => {
      this.pending.set(id, resolve as (value: unknown) => void);
      this.worker!.postMessage({ id, cmd, payload });
    });
  }

  async run(payload: {
    files: Record<string, string>;
    packages?: string[];
    resetDatabase?: boolean;
    answers?: { rename?: boolean };
  }) {
    const result = await this.call<RunResult>("run", payload);
    if (result.ok) this.versions = result.versions;
    return result;
  }

  probe(code: string) {
    return this.call<ProbeResult>("probe", { code });
  }
}

let shared: Runtime | null = null;

export function getRuntime() {
  shared ??= new Runtime();
  return shared;
}
