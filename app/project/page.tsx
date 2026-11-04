import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PROJECTS } from "@/lib/projects";

export const metadata: Metadata = {
  title: "Practical projects",
  description:
    "Complete Django + DRF projects built from an empty folder: hospital management and inventory management, every file shown in full.",
};

export default function ProjectsPage() {
  return (
    <main id="main" className="mx-auto max-w-[1120px] px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <p className="eyebrow">Practical projects</p>
      <h1 className="mt-5 max-w-[20ch] font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-[3.6rem]">
        Build a full system, file by file.
      </h1>
      <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-muted">
        Two interview-style practical projects, written at beginner level in the same style as class notes. Each one
        starts at an empty folder and ends with a working REST API (serializers, viewsets, router, JWT) and simple
        Django web pages. Every file has a copy button and a short note on what it does.
      </p>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {PROJECTS.map((p) => (
          <Link key={p.slug} href={`/project/${p.slug}`} className="card group flex flex-col p-6">
            <span className="w-fit rounded border border-line-strong px-1.5 py-0.5 font-mono text-[0.7rem] text-fg">
              /project/{p.slug}
            </span>
            <span className="mt-5 font-serif text-[1.6rem] leading-tight">{p.title}</span>
            <span className="mt-2 flex-1 text-[0.9rem] leading-relaxed text-muted">{p.summary}</span>
            <span className="mt-5 flex flex-wrap gap-1.5">
              {p.stack.map((s) => (
                <span key={s} className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.68rem] text-faint">
                  {s}
                </span>
              ))}
            </span>
            <span className="mt-5 flex items-center gap-1.5 text-[0.82rem] text-faint group-hover:text-fg">
              Start building
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
