"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import type { Control, FieldRow, LabState } from "@/lib/labs/types";

type Props = {
  controls: Control[];
  state: LabState;
  onChange: (key: string, value: unknown) => void;
};

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <span className="mb-1.5 block font-mono text-[0.66rem] uppercase tracking-[0.08em] text-faint" title={hint}>
      {children}
    </span>
  );
}

export function LabControls({ controls, state, onChange }: Props) {
  return (
    <div className="space-y-4">
      {controls
        .filter((c) => !c.when || c.when(state))
        .map((c) => (
          <div key={c.key}>
            <ControlView control={c} value={state[c.key]} onChange={(v) => onChange(c.key, v)} />
          </div>
        ))}
    </div>
  );
}

function ControlView({ control: c, value, onChange }: { control: Control; value: unknown; onChange: (v: unknown) => void }) {
  switch (c.type) {
    case "select":
      return (
        <label className="block">
          <Label hint={c.hint}>{c.label}</Label>
          <select
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-full rounded-md border border-line bg-bg px-2 text-[0.8rem] text-fg outline-none focus:border-line-strong"
          >
            {c.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      );

    case "segmented":
      return (
        <div>
          <Label hint={c.hint}>{c.label}</Label>
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={c.label}>
            {c.options.map((o) => {
              const on = String(value) === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => onChange(o.value)}
                  className={`rounded-md border px-2.5 py-1.5 text-left text-[0.76rem] leading-tight transition-colors ${
                    on ? "border-fg bg-fg text-bg" : "border-line text-muted hover:border-line-strong hover:text-fg"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      );

    case "toggle":
      return (
        <button
          type="button"
          role="switch"
          aria-checked={!!value}
          onClick={() => onChange(!value)}
          className="flex w-full items-start gap-2.5 text-left"
          title={c.hint}
        >
          <span
            className={`mt-0.5 flex h-[18px] w-8 shrink-0 items-center rounded-full border p-0.5 transition-colors ${
              value ? "border-fg bg-fg" : "border-line-strong"
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full transition-transform ${value ? "translate-x-[14px] bg-bg" : "bg-faint"}`}
            />
          </span>
          <span className={`text-[0.8rem] leading-snug ${value ? "text-fg" : "text-muted"}`}>{c.label}</span>
        </button>
      );

    case "text":
      return (
        <label className="block">
          <Label hint={c.hint}>{c.label}</Label>
          <input
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder={c.placeholder}
            spellCheck={false}
            className={`h-9 w-full rounded-md border border-line bg-bg px-2.5 text-[0.8rem] text-fg outline-none placeholder:text-faint focus:border-line-strong ${
              c.mono ? "font-mono" : ""
            }`}
          />
        </label>
      );

    case "textarea":
      return (
        <label className="block">
          <Label hint={c.hint}>{c.label}</Label>
          <textarea
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            rows={c.rows ?? 4}
            spellCheck={false}
            className={`w-full resize-y rounded-md border border-line bg-bg p-2.5 text-[0.76rem] leading-relaxed text-fg outline-none focus:border-line-strong ${
              c.mono ? "font-mono" : ""
            }`}
          />
        </label>
      );

    case "number": {
      const n = Number(value ?? c.min);
      const step = c.step ?? 1;
      const set = (v: number) => onChange(Math.min(c.max, Math.max(c.min, v)));
      return (
        <div>
          <Label hint={c.hint}>{c.label}</Label>
          <div className="flex items-center gap-2">
            <button type="button" className="lab-step" onClick={() => set(n - step)} aria-label="Decrease">
              <Minus size={13} />
            </button>
            <input
              type="range"
              min={c.min}
              max={c.max}
              step={step}
              value={n}
              onChange={(e) => set(Number(e.target.value))}
              className="lab-range min-w-0 flex-1"
              aria-label={c.label}
            />
            <button type="button" className="lab-step" onClick={() => set(n + step)} aria-label="Increase">
              <Plus size={13} />
            </button>
            <span className="w-12 text-right font-mono text-[0.78rem] tabular-nums text-fg">{n}</span>
          </div>
        </div>
      );
    }

    case "checklist": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div>
          <Label hint={c.hint}>{c.label}</Label>
          <div className="flex flex-wrap gap-1">
            {c.options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onChange(
                      // keep the options' own order, whatever order they're clicked in
                      c.options.map((x) => x.value).filter((v) => (v === o.value ? !on : selected.includes(v))),
                    )
                  }
                  className={`rounded-md border px-2 py-1 text-[0.74rem] transition-colors ${
                    on ? "border-fg text-fg" : "border-dashed border-line-strong text-faint hover:text-muted"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    case "fields":
      return <FieldsEditor label={c.label} types={c.types} rows={(value as FieldRow[]) ?? []} onChange={onChange} />;
  }
}

const NO_LENGTH = new Set(["TextField", "IntegerField", "PositiveIntegerField", "DecimalField", "FloatField", "BooleanField", "DateField", "DateTimeField", "EmailField", "URLField"]);

function FieldsEditor({
  label,
  types,
  rows,
  onChange,
}: {
  label: string;
  types: string[];
  rows: FieldRow[];
  onChange: (rows: FieldRow[]) => void;
}) {
  const update = (id: string, patch: Partial<FieldRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <div>
      <Label>{label}</Label>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.id} className={`rounded-md border p-2 ${r.on ? "border-line-strong" : "border-dashed border-line opacity-60"}`}>
            <div className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={r.on}
                onChange={(e) => update(r.id, { on: e.target.checked })}
                className="accent-[var(--fg)]"
                aria-label={`Include ${r.name}`}
              />
              <input
                value={r.name}
                onChange={(e) => update(r.id, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") })}
                className="h-7 w-[6.5rem] min-w-0 rounded border border-line bg-bg px-1.5 font-mono text-[0.74rem] text-fg outline-none focus:border-line-strong"
                aria-label="Field name"
                spellCheck={false}
              />
              <select
                value={r.type}
                onChange={(e) => update(r.id, { type: e.target.value })}
                className="h-7 min-w-0 flex-1 rounded border border-line bg-bg px-1 font-mono text-[0.7rem] text-fg"
                aria-label="Field type"
              >
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onChange(rows.filter((x) => x.id !== r.id))}
                className="grid h-7 w-7 shrink-0 place-items-center rounded text-faint hover:bg-hover hover:text-fg"
                aria-label={`Remove ${r.name}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
            {r.on && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-5">
                {(["nullable", "blank", "unique"] as const).map((flag) => (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => update(r.id, { [flag]: !r[flag] })}
                    className={`rounded border px-1.5 py-0.5 font-mono text-[0.66rem] ${
                      r[flag] ? "border-fg text-fg" : "border-dashed border-line-strong text-faint"
                    }`}
                  >
                    {flag === "nullable" ? "null" : flag}
                  </button>
                ))}
                {!NO_LENGTH.has(r.type) && (
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={r.maxLength ?? 100}
                    onChange={(e) => update(r.id, { maxLength: Number(e.target.value) || 100 })}
                    className="h-6 w-16 rounded border border-line bg-bg px-1 font-mono text-[0.66rem] text-fg"
                    aria-label="max_length"
                    title="max_length"
                  />
                )}
                <input
                  value={r.default ?? ""}
                  onChange={(e) => update(r.id, { default: e.target.value })}
                  placeholder={r.type === "DateTimeField" ? "default: now" : r.type === "DateField" ? "default: today" : "default"}
                  className="h-6 w-24 rounded border border-line bg-bg px-1 font-mono text-[0.66rem] text-fg placeholder:text-faint"
                  aria-label="default"
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          onChange([
            ...rows,
            { id: Math.random().toString(36).slice(2, 8), on: true, name: `field_${rows.length + 1}`, type: "CharField", maxLength: 100 },
          ])
        }
        className="mt-2 flex items-center gap-1 rounded-md border border-dashed border-line-strong px-2 py-1 text-[0.74rem] text-muted hover:text-fg"
      >
        <Plus size={12} /> Add a field
      </button>
    </div>
  );
}
