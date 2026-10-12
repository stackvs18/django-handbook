"use client";

import { getRuntime } from "./runtime";
import type { Lab, LabBuild, LabState, Output } from "./types";

export type LabResult = {
  outputs: Output[];
  notes: string[];
  error?: string;
  errorKind?: string;
  ms: number;
};

// Baseline runs (e.g. the 0001 migration the migrations lab diffs against)
// depend only on the baseline files, so they're computed once and reused.
const baselines = new Map<string, Record<string, string>>();

export async function runLab(lab: Lab, state: LabState, build: LabBuild, files: Record<string, string>): Promise<LabResult> {
  const started = performance.now();
  const rt = getRuntime();
  const done = (r: Omit<LabResult, "ms">): LabResult => ({ ...r, ms: Math.round(performance.now() - started) });
  const notesFor = (result: Record<string, unknown> | null) => {
    try {
      return lab.notes?.(state, result) ?? [];
    } catch {
      return [];
    }
  };

  let extra: Record<string, string> = {};
  if (build.baseline) {
    const key = lab.slug + JSON.stringify(build.baseline);
    let generated = baselines.get(key);
    if (!generated) {
      const first = await rt.run({ files: build.baseline, packages: lab.packages, resetDatabase: true });
      if (!first.ok) return done({ outputs: [], notes: notesFor(null), error: first.error });
      generated = first.generated;
      baselines.set(key, generated);
    }
    extra = generated;
  }

  const run = await rt.run({ files: { ...files, ...extra }, packages: lab.packages, resetDatabase: true, answers: build.answers });
  if (!run.ok) return done({ outputs: [], notes: notesFor(null), error: run.error, errorKind: run.kind });

  const probe = await rt.probe(lab.probe(state));
  if (!probe.ok) return done({ outputs: [], notes: notesFor(null), error: probe.error });

  try {
    const outputs = lab.present(probe.result, state, { generated: run.generated, sql: run.sql, log: run.log });
    return done({ outputs, notes: notesFor(probe.result) });
  } catch (err) {
    return done({ outputs: [], notes: notesFor(null), error: `Couldn't read the result: ${String(err)}` });
  }
}
