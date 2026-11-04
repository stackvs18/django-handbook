import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PROJECTS, getProject } from "@/lib/projects";
import { renderMarkdownFile } from "@/lib/markdown";
import { ArticleBehaviors } from "@/components/article-behaviors";
import { OnThisPage } from "@/components/on-this-page";
import { ReadingProgress } from "@/components/reading-progress";

export const dynamicParams = false;

export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/project/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return { title: project.title, description: project.summary };
}

export default async function ProjectPage({ params }: PageProps<"/project/[slug]">) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const { html, headings, minutes } = await renderMarkdownFile(
    path.join(process.cwd(), "projects", `${slug}.md`),
  );
  const others = PROJECTS.filter((p) => p.slug !== slug);

  return (
    <>
      <ReadingProgress />
      <div className="mx-auto flex max-w-[1240px] gap-12 px-5 sm:px-8 xl:px-12">
        <main id="main" className="min-w-0 flex-1 pb-24 pt-10 sm:pt-14">
          <header className="mb-12 max-w-[760px]">
            <Link href="/project" className="eyebrow inline-flex items-center gap-2 hover:text-fg">
              <ArrowLeft size={13} />
              Practical projects
            </Link>
            <div className="mt-6 flex items-baseline gap-4">
              <span className="font-mono text-sm text-faint">{project.level}</span>
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-xs text-faint">{minutes} min build</span>
            </div>
            <h1 className="mt-5 font-serif text-[2.4rem] leading-[1.08] tracking-[-0.02em] sm:text-[3.2rem]">
              {project.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted">{project.summary}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {project.stack.map((s) => (
                <span
                  key={s}
                  className="rounded border border-line-strong px-2 py-0.5 font-mono text-[0.72rem] text-fg"
                >
                  {s}
                </span>
              ))}
            </div>
          </header>

          <div id="article" className="prose max-w-[760px]" dangerouslySetInnerHTML={{ __html: html }} />
          <ArticleBehaviors targetId="article" slug={`project-${slug}`} />

          <footer className="mt-20 max-w-[760px]">
            <nav className="grid gap-3 sm:grid-cols-2" aria-label="Other projects">
              {others.map((p) => (
                <Link key={p.slug} href={`/project/${p.slug}`} className="card group p-5">
                  <span className="flex items-center gap-2 text-xs text-faint">
                    Next project
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
