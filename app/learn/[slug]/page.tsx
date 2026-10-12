import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { CHAPTERS, getChapter } from "@/lib/chapters";
import { LABS } from "@/lib/labs";
import { renderChapter } from "@/lib/markdown";
import { ArticleBehaviors } from "@/components/article-behaviors";
import { MarkDone } from "@/components/mark-done";
import { OnThisPage } from "@/components/on-this-page";
import { ReadingProgress } from "@/components/reading-progress";

export const dynamicParams = false;

export function generateStaticParams() {
  return CHAPTERS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/learn/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const found = getChapter(slug);
  if (!found) return {};
  return { title: found.chapter.title, description: found.chapter.summary };
}

export default async function ChapterPage({ params }: PageProps<"/learn/[slug]">) {
  const { slug } = await params;
  const found = getChapter(slug);
  if (!found) notFound();

  const { chapter, prev, next } = found;
  const { html, headings, minutes } = await renderChapter(slug);
  const labs = LABS.filter((lab) => lab.chapter === slug);
  const isAppendix = chapter.part.id === "appendix";

  return (
    <>
      <ReadingProgress />
      <div className="mx-auto flex max-w-[1120px] gap-12 px-5 sm:px-8 xl:px-12">
        <main id="main" className="min-w-0 flex-1 pb-24 pt-10 sm:pt-14">
          <header className="mb-12 max-w-[720px]">
            <p className="eyebrow">
              {isAppendix ? "Appendix" : `Part ${chapter.partNumber} · ${chapter.part.title}`}
            </p>
            <div className="mt-6 flex items-baseline gap-4">
              <span className="font-mono text-sm tabular-nums text-faint">
                {String(chapter.number).padStart(2, "0")}
              </span>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-xs text-faint">{minutes} min read</span>
            </div>
            <h1 className="mt-5 font-serif text-[2.4rem] leading-[1.08] tracking-[-0.02em] sm:text-[3.2rem]">
              {chapter.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">{chapter.summary}</p>
            {labs.length > 0 && (
              <div className="mt-7 flex flex-wrap gap-2">
                {labs.map((lab) => (
                  <Link
                    key={lab.slug}
                    href={`/labs/${lab.slug}`}
                    className="group flex items-center gap-2.5 rounded-full border border-line-strong py-1.5 pl-1.5 pr-4 text-[0.82rem] transition-colors hover:border-fg"
                  >
                    <span className="rounded-full bg-fg px-2 py-0.5 font-mono text-[0.66rem] uppercase tracking-wider text-bg">
                      Live lab
                    </span>
                    <span className="text-fg">{lab.title}</span>
                    <ArrowRight size={13} className="text-faint transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            )}
          </header>

          <div id="article" className="prose max-w-[720px]" dangerouslySetInnerHTML={{ __html: html }} />
          <ArticleBehaviors targetId="article" slug={slug} />

          <footer className="mt-20 max-w-[720px]">
            <div className="flex flex-wrap items-center justify-between gap-4 border-y border-line py-6">
              <p className="text-sm text-muted">Finished this chapter?</p>
              <MarkDone slug={slug} />
            </div>

            <nav className="mt-8 grid gap-3 sm:grid-cols-2" aria-label="Chapter navigation">
              {prev ? (
                <Link href={`/learn/${prev.slug}`} className="card group p-5">
                  <span className="flex items-center gap-2 text-xs text-faint">
                    <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" />
                    Previous
                  </span>
                  <span className="mt-2 block font-medium leading-snug">{prev.title}</span>
                </Link>
              ) : (
                <span className="hidden sm:block" />
              )}
              {next && (
                <Link href={`/learn/${next.slug}`} className="card group p-5 text-right">
                  <span className="flex items-center justify-end gap-2 text-xs text-faint">
                    Next
                    <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-2 block font-medium leading-snug">{next.title}</span>
                </Link>
              )}
            </nav>
          </footer>
        </main>

        <aside className="hidden w-[210px] shrink-0 xl:block">
          <div className="sticky top-14 max-h-[calc(100dvh-3.5rem)] overflow-y-auto pb-10 pt-14">
            <OnThisPage headings={headings} />
          </div>
        </aside>
      </div>
    </>
  );
}
