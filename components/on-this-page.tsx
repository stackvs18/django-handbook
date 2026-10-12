"use client";

import { useEffect, useState } from "react";
import type { Heading } from "@/lib/markdown";

export function OnThisPage({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const elements = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (!elements.length) return;

    // The active section is the last heading that has scrolled past the top band.
    function update() {
      let current: string | null = null;
      for (const el of elements) {
        if (el.getBoundingClientRect().top <= 120) current = el.id;
        else break;
      }
      setActiveId(current ?? elements[0].id);
    }

    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
    };
  }, [headings]);

  if (!headings.length) return null;

  return (
    <nav aria-label="On this page" className="text-[0.8rem]">
      <p className="eyebrow mb-4">On this page</p>
      <ul className="space-y-0.5 border-l border-line">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={`-ml-px block border-l py-1 leading-snug transition-colors ${
                h.depth === 3 ? "pl-6" : "pl-3.5"
              } ${
                activeId === h.id
                  ? "border-fg text-fg"
                  : "border-transparent text-faint hover:text-muted"
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
