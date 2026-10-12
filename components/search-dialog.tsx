"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, FileText, Hash, Search } from "lucide-react";

export type SearchEntry = {
  slug: string;
  number: number;
  title: string;
  summary: string;
  part: string;
  headings: { id: string; text: string }[];
};

type Result = {
  key: string;
  href: string;
  title: string;
  context: string;
  kind: "chapter" | "section";
  score: number;
};

let indexPromise: Promise<SearchEntry[]> | null = null;

function loadIndex() {
  indexPromise ??= fetch("/search-index.json")
    .then((r) => r.json() as Promise<SearchEntry[]>)
    .catch(() => {
      indexPromise = null;
      return [];
    });
  return indexPromise;
}

function score(haystack: string, terms: string[]) {
  const h = haystack.toLowerCase();
  let total = 0;
  for (const term of terms) {
    const at = h.indexOf(term);
    if (at === -1) return 0;
    total += at === 0 ? 3 : /\W/.test(h[at - 1] ?? " ") ? 2 : 1;
  }
  return total;
}

function search(index: SearchEntry[], query: string): Result[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) {
    return index.slice(0, 8).map((c) => ({
      key: c.slug,
      href: `/learn/${c.slug}`,
      title: c.title,
      context: `${String(c.number).padStart(2, "0")} · ${c.part}`,
      kind: "chapter",
      score: 0,
    }));
  }

  const results: Result[] = [];
  for (const c of index) {
    const s = score(c.title, terms) * 3 + score(`${c.title} ${c.summary}`, terms);
    if (s > 0) {
      results.push({
        key: c.slug,
        href: `/learn/${c.slug}`,
        title: c.title,
        context: `${String(c.number).padStart(2, "0")} · ${c.part}`,
        kind: "chapter",
        score: s + 4,
      });
    }
    for (const h of c.headings) {
      const hs = score(h.text, terms) * 2 + (score(`${h.text} ${c.title}`, terms) ? 1 : 0);
      if (hs > 0) {
        results.push({
          key: `${c.slug}#${h.id}`,
          href: `/learn/${c.slug}#${h.id}`,
          title: h.text,
          context: c.title,
          kind: "section",
          score: hs,
        });
      }
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 30);
}

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState<SearchEntry[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    loadIndex().then((data) => {
      if (!cancelled) setIndex(data);
    });
    inputRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      cancelled = true;
      document.body.style.overflow = "";
    };
  }, [open]);

  const results = useMemo(() => search(index, query), [index, query]);

  const go = useCallback(
    (result: Result | undefined) => {
      if (!result) return;
      onClose();
      setQuery("");
      setActive(0);
      router.push(result.href);
    },
    [onClose, router],
  );

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="presentation">
      <button
        type="button"
        aria-label="Close search"
        className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the handbook"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-line-strong bg-surface shadow-2xl"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          else if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(results[active]);
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Search chapters and topics…"
            className="h-13 w-full bg-transparent text-[0.95rem] text-fg outline-none placeholder:text-faint"
            aria-label="Search"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <ul ref={listRef} className="max-h-[min(60vh,420px)] overflow-y-auto p-2" role="listbox">
          {results.length === 0 && (
            <li className="px-3 py-10 text-center text-sm text-faint">
              {index.length ? `No results for “${query}”` : "Loading…"}
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === active} data-index={i}>
              <button
                type="button"
                onMouseMove={() => setActive(i)}
                onClick={() => go(r)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                  i === active ? "bg-hover" : ""
                }`}
              >
                {r.kind === "chapter" ? (
                  <FileText size={15} className="shrink-0 text-faint" />
                ) : (
                  <Hash size={15} className="shrink-0 text-faint" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9rem] text-fg">{r.title}</span>
                  <span className="block truncate text-[0.75rem] text-faint">{r.context}</span>
                </span>
                {i === active && <CornerDownLeft size={14} className="shrink-0 text-faint" />}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2.5 text-[0.7rem] text-faint">
          <span>
            <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move
          </span>
          <span>
            <kbd className="kbd">↵</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}
