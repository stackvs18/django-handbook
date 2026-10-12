import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LAB_GROUPS, LABS } from "@/lib/labs";

export const metadata: Metadata = {
  title: "Live labs",
  description:
    "Interactive Django labs: change models, URLs, views, templates, forms, serializers and more with controls, and see real Django output instantly.",
};

export default function LabsPage() {
  return (
    <main id="main" className="mx-auto max-w-[1120px] px-5 pb-24 pt-14 sm:px-8 sm:pt-20">
      <p className="eyebrow">Live labs</p>
      <h1 className="mt-5 max-w-[18ch] font-serif text-[2.6rem] leading-[1.05] tracking-[-0.02em] sm:text-[3.6rem]">
        Change it. Watch Django react.
      </h1>
      <p className="mt-6 max-w-[62ch] text-lg leading-relaxed text-muted">
        One lab for every part of a Django project. Use the controls to change the code; the left side shows the code,
        the right side shows what Django does with it. No typing needed, though you can edit the code too.
      </p>

      <div className="mt-10 grid gap-4 border-y border-line py-6 text-sm text-muted sm:grid-cols-3">
        <p>
          <span className="font-semibold text-fg">Real Django.</span> Python and Django 6 run inside your browser with
          WebAssembly. Every result is genuine output, not a simulation.
        </p>
        <p>
          <span className="font-semibold text-fg">Controls write code.</span> Each switch rewrites the file on the left;
          changed lines flash so you see exactly what moved.
        </p>
        <p>
          <span className="font-semibold text-fg">First load ~20 MB.</span> Python downloads once and stays loaded while
          you move between labs.
        </p>
      </div>

      <div className="mt-14 space-y-14">
        {LAB_GROUPS.map((group) => {
          const labs = LABS.filter((l) => l.group === group);
          if (!labs.length) return null;
          return (
            <section key={group}>
              <h2 className="font-serif text-[1.8rem] tracking-[-0.01em]">{group}</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {labs.map((lab) => (
                  <Link key={lab.slug} href={`/labs/${lab.slug}`} className="card group flex flex-col p-5">
                    <span className="w-fit rounded border border-line-strong px-1.5 py-0.5 font-mono text-[0.7rem] text-fg">
                      {lab.file}
                    </span>
                    <span className="mt-4 text-[1.02rem] font-medium leading-snug">{lab.title}</span>
                    <span className="mt-1.5 flex-1 text-[0.84rem] leading-relaxed text-muted">{lab.summary}</span>
                    <span className="mt-4 flex items-center gap-1.5 text-[0.78rem] text-faint group-hover:text-fg">
                      Open lab
                      <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
