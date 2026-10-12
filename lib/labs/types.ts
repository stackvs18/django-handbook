// A Live Lab is a tiny Django project generated from a few controls.
// Changing a control rewrites the code (left pane); the project then runs in
// the browser with real Django and the probe's findings fill the preview
// (right pane).

export type Option = { value: string; label: string };

type Base = {
  key: string;
  label: string;
  hint?: string;
  /** Only show this control when it returns true. */
  when?: (s: LabState) => boolean;
};

export type FieldRow = {
  id: string;
  on: boolean;
  name: string;
  type: string;
  maxLength?: number;
  nullable?: boolean;
  blank?: boolean;
  unique?: boolean;
  default?: string;
};

export type Control =
  | (Base & { type: "select"; options: Option[] })
  | (Base & { type: "segmented"; options: Option[] })
  | (Base & { type: "toggle" })
  | (Base & { type: "text"; placeholder?: string; mono?: boolean })
  | (Base & { type: "number"; min: number; max: number; step?: number })
  | (Base & { type: "checklist"; options: Option[] })
  | (Base & { type: "textarea"; rows?: number; mono?: boolean })
  | (Base & { type: "fields"; types: string[] });

export type LabState = Record<string, unknown>;

export type LabBuild = {
  /** Every file of the project. */
  files: Record<string, string>;
  /** The file the lab teaches; shown and editable in the code pane. */
  focus: string;
  /** Run these files first (used to produce an initial migration to diff against). */
  baseline?: Record<string, string>;
  /** Answers to makemigrations questions. */
  answers?: { rename?: boolean };
};

export type Tone = "ok" | "warn" | "bad" | "muted";

export type Output =
  | { kind: "html"; title: string; html: string; height?: number }
  | { kind: "json"; title: string; value: unknown }
  | { kind: "code"; title: string; lang: "sql" | "python" | "html" | "json" | "text"; text: string }
  | { kind: "table"; title: string; columns: string[]; rows: string[][]; caption?: string }
  | {
      kind: "matrix";
      title: string;
      columns: string[];
      rows: { label: string; cells: { text: string; tone?: Tone }[] }[];
      caption?: string;
    }
  | { kind: "kv"; title: string; items: [string, string][] }
  | { kind: "text"; title: string; text: string };

export type RunInfo = {
  generated: Record<string, string>;
  sql: Record<string, string>;
  log: string;
};

export type LabGroup = "Project" | "Views & templates" | "Models & data" | "Users & requests" | "REST APIs" | "Python";

export type Lab = {
  slug: string;
  title: string;
  /** The file this lab is about, e.g. "models.py". */
  file: string;
  group: LabGroup;
  summary: string;
  chapter?: string;
  packages?: string[];
  controls: Control[];
  initial: LabState;
  build: (s: LabState) => LabBuild;
  /** Python run after the project is set up; must assign `result`. */
  probe: (s: LabState) => string;
  present: (result: Record<string, unknown>, s: LabState, run: RunInfo) => Output[];
  /** Plain-English notes that change with the controls. */
  notes?: (s: LabState, result: Record<string, unknown> | null) => string[];
};

// Small helpers used by lab definitions -------------------------------------

export const str = (s: LabState, k: string) => String(s[k] ?? "");
export const bool = (s: LabState, k: string) => Boolean(s[k]);
export const num = (s: LabState, k: string) => Number(s[k] ?? 0);
export const list = (s: LabState, k: string) => (Array.isArray(s[k]) ? (s[k] as string[]) : []);

export function tone(status: number): Tone {
  if (status >= 500) return "bad";
  if (status >= 400) return "warn";
  if (status >= 300) return "muted";
  return "ok";
}

/** Python string literal. */
export function py(value: string) {
  return JSON.stringify(value);
}
