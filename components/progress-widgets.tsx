"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { CHAPTERS } from "@/lib/chapters";
import { resetProgress, useDoneChapters, useLastChapter } from "@/lib/progress";

export function DoneMark({ slug }: { slug: string }) {
  const done = useDoneChapters().includes(slug);
  if (!done) return null;
  return (
    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-fg text-bg" title="Completed">
      <Check size={11} strokeWidth={3} />
      <span className="sr-only">Completed</span>
    </span>
  );
}

export function ContinueReading() {
  const last = useLastChapter();
  const done = useDoneChapters();
  const chapter = CHAPTERS.find((c) => c.slug === last);
  const count = done.filter((slug) => CHAPTERS.some((c) => c.slug === slug)).length;
  const pct = Math.round((count / CHAPTERS.length) * 100);

  if (!chapter && count === 0) return null;

  return (
    <div className="card rise mt-12 flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">Your progress</p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-fg" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-mono text-xs text-muted">
            {count}/{CHAPTERS.length} chapters
          </span>
          <button
            type="button"
            onClick={resetProgress}
            className="text-xs text-faint underline-offset-2 hover:text-muted hover:underline"
          >
            Reset
          </button>
        </div>
      </div>
      {chapter && (
        <Link
          href={`/learn/${chapter.slug}`}
          className="group flex min-w-0 items-center gap-3 rounded-lg border border-line bg-bg px-4 py-3 transition-colors hover:border-line-strong"
        >
          <span className="min-w-0">
            <span className="block text-xs text-faint">Continue reading</span>
            <span className="block truncate text-sm font-medium">
              {String(chapter.number).padStart(2, "0")} · {chapter.title}
            </span>
          </span>
          <ArrowRight size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
