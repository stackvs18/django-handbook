"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check } from "lucide-react";
import { PARTS, CHAPTERS } from "@/lib/chapters";
import { useDoneChapters } from "@/lib/progress";

const NUMBER = new Map(CHAPTERS.map((c) => [c.slug, c.number]));

export function ChapterNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const done = useDoneChapters();

  return (
    <nav aria-label="Chapters" className="text-[0.84rem]">
      <div className="mb-6 flex items-center justify-between px-3">
        <span className="eyebrow">Contents</span>
        <span className="font-mono text-[0.7rem] text-faint">
          {done.length}/{CHAPTERS.length}
        </span>
      </div>
      {PARTS.map((part, pi) => (
        <div key={part.id} className="mb-7">
          <p className="mb-2 px-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-faint">
            {part.id === "appendix" ? part.title : `Part ${pi + 1} · ${part.title}`}
          </p>
          <ul>
            {part.chapters.map((chapter) => {
              const href = `/learn/${chapter.slug}`;
              const active = pathname === href;
              const isDone = done.includes(chapter.slug);
              return (
                <li key={chapter.slug}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`group flex items-start gap-3 rounded-md px-3 py-[0.4rem] leading-snug transition-colors ${
                      active ? "bg-hover text-fg" : "text-muted hover:bg-hover/60 hover:text-fg"
                    }`}
                  >
                    <span
                      className={`mt-[0.2rem] w-5 shrink-0 font-mono text-[0.68rem] tabular-nums ${
                        active ? "text-fg" : "text-faint"
                      }`}
                    >
                      {String(NUMBER.get(chapter.slug)).padStart(2, "0")}
                    </span>
                    <span className="flex-1">{chapter.title}</span>
                    {isDone && (
                      <Check size={13} strokeWidth={2.25} className="mt-[0.2rem] shrink-0 text-faint" aria-label="Done" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
