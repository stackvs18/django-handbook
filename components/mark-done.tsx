"use client";

import { Check } from "lucide-react";
import { setChapterDone, useDoneChapters } from "@/lib/progress";

export function MarkDone({ slug, size = "md" }: { slug: string; size?: "sm" | "md" }) {
  const done = useDoneChapters().includes(slug);

  return (
    <button
      type="button"
      onClick={() => setChapterDone(slug, !done)}
      aria-pressed={done}
      className={`inline-flex items-center gap-2 rounded-full border transition-colors ${
        size === "sm" ? "h-8 px-3 text-[0.78rem]" : "h-10 px-4 text-[0.85rem]"
      } ${
        done
          ? "border-fg bg-fg text-bg"
          : "border-line-strong text-muted hover:border-fg hover:text-fg"
      }`}
    >
      <Check size={size === "sm" ? 13 : 15} strokeWidth={2.25} />
      {done ? "Completed" : "Mark as complete"}
    </button>
  );
}
