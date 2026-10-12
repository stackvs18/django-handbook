"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, Search, X } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { SearchDialog } from "./search-dialog";
import { ChapterNav } from "./chapter-nav";

export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape") {
        setMenuOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="icon-btn lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open chapters"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>

          <Link href="/" className="flex items-center gap-2.5" aria-label="Django Handbook home">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-fg font-mono text-[0.72rem] font-bold text-bg">
              dj
            </span>
            <span className="hidden text-[0.95rem] font-semibold tracking-tight sm:inline">
              Django Handbook
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 text-[0.85rem] md:flex" aria-label="Primary">
            <Link href="/#contents" className="nav-link">
              Contents
            </Link>
            <Link href="/learn/first-project" className="nav-link">
              14-step guide
            </Link>
            <Link href="/labs" className="nav-link">
              Live labs
            </Link>
            <Link href="/learn/cheatsheet" className="nav-link">
              Cheat sheet
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[0.82rem] text-faint transition-colors hover:border-line-strong hover:text-muted sm:w-56"
              aria-label="Search"
            >
              <Search size={15} />
              <span className="hidden sm:inline">Search</span>
              <kbd className="kbd ml-auto hidden sm:inline-block">Ctrl K</kbd>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close chapters"
            className="absolute inset-0 bg-bg/70 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="drawer absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col border-r border-line bg-bg">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
              <Link href="/" onClick={() => setMenuOpen(false)} className="text-[0.95rem] font-semibold">
                Django Handbook
              </Link>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMenuOpen(false)}
                aria-label="Close chapters"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-5">
              <ChapterNav onNavigate={() => setMenuOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
