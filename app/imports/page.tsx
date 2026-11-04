import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PROJECTS } from "@/lib/projects";
import { renderMarkdownFile } from "@/lib/markdown";
import { ArticleBehaviors } from "@/components/article-behaviors";
import { OnThisPage } from "@/components/on-this-page";
import { ReadingProgress } from "@/components/reading-progress";

export const metadata: Metadata = {
  title: "Import cheat sheet",
  description:
    "Every import line for every Django and DRF file, what it gives you, and simple rules to rebuild an import you have forgotten.",
};

export default async function ImportsPage() {
  const { html, headings, minutes } = await renderMarkdownFile(path.join(process.cwd(), "guides", "imports.md"));

  return (
    <>
      <ReadingProgress />
      <div className="mx-auto flex max-w-[1240px] gap-12 px-5 sm:px-8 xl:px-12">
        <main id="main" className="min-w-0 flex-1 pb-24 pt-10 sm:pt-14">
          <header className="mb-12 max-w-[760px]">
            <p className="eyebrow">Cheat sheet</p>
            <div className="mt-6 flex items-baseline gap-4">
              <span className="font-mono text-sm text-faint">Beginner</span>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-xs text-faint">{minutes} min read</span>
            </div>
            <h1 className="mt-5 font-serif text-[2.4rem] leading-[1.08] tracking-[-0.02em] sm:text-[3.2rem]">
              Import statements, decoded
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">
              Every import for every file in a Django + DRF project, what each one gives you, and six rules so you can
              rebuild an import instead of memorizing it.
            </p>
          </header>

          <div id="article" className="prose max-w-[760px]" dangerouslySetInnerHTML={{ __html: html }} />
          <ArticleBehaviors targetId="article" slug="imports" />

          <footer className="mt-20 max-w-[760px]">
            <nav className="grid gap-3 sm:grid-cols-2" aria-label="Practice projects">
              {PROJECTS.map((p) => (
                <Link key={p.slug} href={`/project/${p.slug}`} className="card group p-5">
                  <span className="flex items-center gap-2 text-xs text-faint">
                    Practise the imports
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-2 block font-medium leading-snug">{p.title}</span>
                </Link>
              ))}
            </nav>
          </footer>
        </main>

        <aside className="hidden w-[220px] shrink-0 xl:block">
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto pb-10 pt-14">
            <OnThisPage headings={headings} />
          </div>
        </aside>
      </div>
    </>
  );
}
