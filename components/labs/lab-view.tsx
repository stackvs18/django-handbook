"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronDown, Code2, Eye, LoaderCircle, RotateCcw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import { getLab } from "@/lib/labs";
import { diffLines } from "@/lib/labs/diff";
import { runLab, type LabResult } from "@/lib/labs/run";
import { getRuntime, type RuntimeStatus } from "@/lib/labs/runtime";
import type { LabState } from "@/lib/labs/types";
import { CodeEditor } from "./code-editor";
import { LabControls } from "./lab-controls";
import { OutputView, outputKey } from "./lab-outputs";

type Pane = "controls" | "code" | "preview";

function useRuntimeStatus() {
  const [status, setStatus] = useState<RuntimeStatus>({ stage: "idle", message: "" });
  useEffect(() => getRuntime().subscribe(setStatus), []);
  return status;
}

/** Lines in `after` that are new or changed compared with `before` (1-based). */
function changedLines(before: string, after: string) {
  return diffLines(before, after)
    .filter((l) => l.type === "add" && l.b !== undefined)
    .map((l) => l.b as number);
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(`[^`]+`)/g).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={i} className="rounded border border-line bg-hover px-1 font-mono text-[0.92em] text-fg">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function LabView({ slug }: { slug: string }) {
  const lab = getLab(slug)!;
  const [state, setState] = useState<LabState>(() => structuredClone(lab.initial));
  const [manual, setManual] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ lines: number[]; nonce: number } | null>(null);
  const [result, setResult] = useState<LabResult | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<string | null>(null);
  const [pane, setPane] = useState<Pane>("preview");
  const status = useRuntimeStatus();

  const build = useMemo(() => lab.build(state), [lab, state]);
  const files = useMemo(
    () => (manual === null ? build.files : { ...build.files, [build.focus]: manual }),
    [build, manual],
  );
  const shownPath = viewing && files[viewing] !== undefined ? viewing : build.focus;
  const shownCode = files[shownPath] ?? "";

  // ---- running ------------------------------------------------------------

  const latest = useRef({ state, build, files });
  const busy = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    latest.current = { state, build, files };
  });

  const execute = useCallback(async () => {
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    setRunning(true);
    try {
      do {
        again.current = false;
        const { state: s, build: b, files: f } = latest.current;
        const out = await runLab(lab, s, b, f);
        if (!again.current) setResult(out);
      } while (again.current);
    } finally {
      busy.current = false;
      setRunning(false);
    }
  }, [lab]);

  useEffect(() => {
    const timer = window.setTimeout(() => void execute(), 280);
    return () => window.clearTimeout(timer);
  }, [files, state, execute]);

  // ---- controls -----------------------------------------------------------

  function changeControl(key: string, value: unknown) {
    const next = { ...state, [key]: value };
    const before = files[build.focus] ?? "";
    const after = lab.build(next).files[build.focus] ?? "";
    setFlash({ lines: changedLines(before, after), nonce: Date.now() });
    setManual(null);
    setViewing(null);
    setState(next);
  }

  function reset() {
    setManual(null);
    setViewing(null);
    setFlash(null);
    setState(structuredClone(lab.initial));
  }

  // ---- outputs ------------------------------------------------------------

  const outputs = result?.outputs ?? [];
  const activeKey = tab && outputs.some((o) => outputKey(o.title) === tab) ? tab : outputs[0] ? outputKey(outputs[0].title) : null;
  const active = outputs.find((o) => outputKey(o.title) === activeKey);
  const ready = status.stage === "ready" || status.stage === "installing";
  const booting = !ready && status.stage !== "error";
  const otherFiles = Object.keys(files).filter((p) => p !== build.focus);

  const controlsPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line px-4">
        <span className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-faint">
          <SlidersHorizontal size={12} /> Controls
        </span>
        <button type="button" onClick={reset} className="flex items-center gap-1 text-[0.7rem] text-faint hover:text-fg">
          <RotateCcw size={11} /> Reset
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <LabControls controls={lab.controls} state={state} onChange={changeControl} />
      </div>
    </div>
  );

  const codePanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3">
        <Code2 size={13} className="shrink-0 text-faint" />
        <span className="truncate font-mono text-[0.74rem] text-fg">{shownPath}</span>
        {shownPath !== build.focus && <span className="text-[0.66rem] text-faint">(read-only)</span>}
        {manual !== null && shownPath === build.focus && (
          <span className="rounded border border-fg px-1.5 font-mono text-[0.6rem] uppercase tracking-wider text-fg">edited</span>
        )}
        <div className="relative ml-auto">
          <select
            value={shownPath}
            onChange={(e) => setViewing(e.target.value === build.focus ? null : e.target.value)}
            className="h-7 appearance-none rounded-md border border-line bg-bg py-0 pl-2 pr-6 font-mono text-[0.68rem] text-muted"
            aria-label="Show another file"
          >
            <option value={build.focus}>{build.focus.split("/").pop()} (this lab)</option>
            {otherFiles.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="pointer-events-none absolute right-1.5 top-2 text-faint" />
        </div>
      </div>
      {manual !== null && shownPath === build.focus && (
        <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-1.5 text-[0.7rem] text-muted">
          You&apos;re editing by hand. Moving a control replaces your edits.
          <button type="button" onClick={() => setManual(null)} className="ml-auto text-fg underline underline-offset-2">
            Undo my edits
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <CodeEditor
          path={shownPath}
          value={shownCode}
          readOnly={shownPath !== build.focus}
          flash={shownPath === build.focus ? flash : null}
          onChange={(v) => {
            if (shownPath === build.focus) setManual(v === build.files[build.focus] ? null : v);
          }}
        />
      </div>
    </div>
  );

  const previewPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-stretch border-b border-line">
        <div className="lab-tabs flex min-w-0 flex-1 items-stretch overflow-x-auto">
          {outputs.map((o) => {
            const key = outputKey(o.title);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`shrink-0 border-b px-3 text-[0.74rem] ${
                  key === activeKey ? "border-fg text-fg" : "border-transparent text-faint hover:text-muted"
                }`}
              >
                {o.title}
              </button>
            );
          })}
        </div>
        <span className="flex shrink-0 items-center gap-1.5 px-3 font-mono text-[0.64rem] text-faint">
          {running || booting ? (
            <>
              <LoaderCircle size={11} className="animate-spin" /> {booting ? "starting" : "running"}
            </>
          ) : result ? (
            `${result.ms} ms`
          ) : null}
        </span>
      </div>

      <div className={`min-h-0 flex-1 overflow-auto transition-opacity ${running && result ? "opacity-70" : ""}`}>
        {!result ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <LoaderCircle size={20} className="animate-spin text-faint" />
            <p className="text-[0.82rem] text-fg">{status.message || "Starting…"}</p>
            <p className="max-w-xs text-[0.74rem] leading-relaxed text-faint">
              Real Python and Django are loading inside your browser. The first visit downloads about 20 MB; after that
              it&apos;s cached and every lab starts in about a second.
            </p>
          </div>
        ) : result.error ? (
          <div className="p-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-fg p-3.5">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[0.8rem] font-semibold text-fg">
                  {result.errorKind === "makemigrations" ? "Django refused: makemigrations stopped" : "Django raised an error"}
                </p>
                <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[0.72rem] leading-relaxed text-muted">
                  {result.error}
                </pre>
              </div>
            </div>
          </div>
        ) : active ? (
          <div className="p-4">
            <OutputView output={active} />
          </div>
        ) : null}
      </div>

      {result && result.notes.length > 0 && (
        <div className="max-h-[38%] shrink-0 overflow-y-auto border-t border-line bg-surface px-4 py-3">
          <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-faint">What&apos;s happening</p>
          <ul className="space-y-1.5">
            {result.notes.map((n, i) => (
              <li key={i} className="flex gap-2 text-[0.78rem] leading-relaxed text-muted">
                <span className="mt-[0.55em] h-px w-2.5 shrink-0 bg-faint" />
                <span>
                  <Inline text={n} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* header */}
      <div className="shrink-0 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href="/labs" className="text-[0.74rem] text-faint hover:text-fg">
            Live labs
          </Link>
          <span className="text-faint">/</span>
          <span className="rounded border border-line-strong px-1.5 py-0.5 font-mono text-[0.7rem] text-fg">{lab.file}</span>
          <h1 className="text-[0.95rem] font-semibold text-fg">{lab.title}</h1>
          <span className="ml-auto flex items-center gap-3">
            {lab.chapter && (
              <Link
                href={`/learn/${lab.chapter}`}
                className="hidden items-center gap-1.5 text-[0.72rem] text-faint hover:text-fg sm:flex"
              >
                <BookOpen size={12} /> Read the chapter
              </Link>
            )}
            <span className="flex items-center gap-1.5 font-mono text-[0.66rem] text-faint">
              <span
                className={`h-1.5 w-1.5 rounded-full ${ready ? "bg-fg" : status.stage === "error" ? "bg-fg" : "animate-pulse bg-faint"}`}
              />
              {ready && getRuntime().versions
                ? `Django ${getRuntime().versions!.django} · Python ${getRuntime().versions!.python}`
                : status.message || "Starting…"}
            </span>
          </span>
        </div>
        <p className="mt-1 hidden text-[0.78rem] text-muted md:block">{lab.summary}</p>
      </div>

      {/* phone & tablet: one pane at a time */}
      <div className="flex shrink-0 border-b border-line lg:hidden">
        {(
          [
            ["controls", "Controls", SlidersHorizontal],
            ["code", "Code", Code2],
            ["preview", "Preview", Eye],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b py-2.5 text-[0.76rem] ${
              pane === id ? "border-fg text-fg" : "border-transparent text-faint"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className={`h-full min-h-0 border-line lg:block lg:border-r ${pane === "controls" ? "block" : "hidden"}`} aria-label="Controls">
          {controlsPanel}
        </section>
        <section className={`h-full min-h-0 border-line bg-[var(--lab-code)] lg:block lg:border-r ${pane === "code" ? "block" : "hidden"}`} aria-label="Code">
          {codePanel}
        </section>
        <section className={`h-full min-h-0 lg:block ${pane === "preview" ? "block" : "hidden"}`} aria-label="Preview">
          {previewPanel}
        </section>
      </div>
    </div>
  );
}
