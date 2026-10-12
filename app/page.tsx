import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CHAPTERS, PARTS } from "@/lib/chapters";
import { LABS } from "@/lib/labs";
import { renderChapter } from "@/lib/markdown";
import { Greeting } from "@/components/greeting";
import { ContinueReading, DoneMark } from "@/components/progress-widgets";

// The command (or file) for each of the 14 steps, shown beside the step title.
const STEP_HINTS = [
  "pip install django",
  "django-admin startproject",
  "python manage.py startapp",
  "settings.py → INSTALLED_APPS",
  "models.py",
  "python manage.py makemigrations",
  "python manage.py migrate",
  "admin.py",
  "python manage.py createsuperuser",
  "templates/",
  "views.py",
  "app/urls.py",
  "project/urls.py → include()",
  "python manage.py runserver",
];

const TERMINAL: [string, string][] = [
  ["$", "pip install django"],
  ["$", "django-admin startproject mysite ."],
  ["$", "python manage.py startapp blog"],
  ["$", "python manage.py migrate"],
  ["$", "python manage.py runserver"],
  ["", "Starting development server at"],
  ["", "http://127.0.0.1:8000/"],
];

const PATHS = [
  {
    label: "Never used Django",
    title: "Start at the very beginning",
    text: "What Django is, how the web works, then a complete project built step by step.",
    href: "/learn/what-is-django",
  },
  {
    label: "Need to build an API",
    title: "Jump to Django REST Framework",
    text: "Serializers, viewsets, routers, JWT login and role-based permissions.",
    href: "/learn/rest-apis",
  },
  {
    label: "Revising for an exam",
    title: "Use the cheat sheet",
    text: "Every command and pattern on one page, plus a glossary of terms.",
    href: "/learn/cheatsheet",
  },
];

async function countCodeExamples() {
  const dir = path.join(process.cwd(), "content");
  const files = await fs.readdir(dir);
  let fences = 0;
  for (const file of files) {
    const text = await fs.readFile(path.join(dir, file), "utf8");
    fences += (text.match(/^```/gm) ?? []).length;
  }
  return Math.floor(fences / 2);
}

export default async function Home() {
  const [{ headings }, examples] = await Promise.all([renderChapter("first-project"), countCodeExamples()]);
  const steps = headings.filter((h) => h.depth === 2 && /^Step \d+/.test(h.text));

  return (
    <main id="main" className="overflow-x-clip">
      {/* Hero */}
      <section className="mx-auto max-w-[1120px] px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end lg:gap-14">
          <div>
            <p className="rise eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <Greeting className="text-fg" />
              <span className="h-px w-6 bg-line-strong" aria-hidden="true" />
              <span>A free, open handbook</span>
            </p>

            <h1
              className="rise mt-8 max-w-[14ch] font-serif text-[3.1rem] leading-[0.98] tracking-[-0.035em] sm:text-[5.2rem]"
              style={{ animationDelay: "60ms" }}
            >
              Learn Django, <em className="text-muted">from the first line.</em>
            </h1>

            <p
              className="rise mt-8 max-w-[58ch] text-lg leading-relaxed text-muted sm:text-xl"
              style={{ animationDelay: "120ms" }}
            >
              A book-style guide that starts with <span className="text-fg">what Django even is</span> and
              ends with <span className="text-fg">JWT-secured REST APIs</span> in production. Every concept is
              explained in plain English with complete code you can copy and run.
            </p>

            <div className="rise mt-10 flex flex-wrap gap-3" style={{ animationDelay: "180ms" }}>
              <Link
                href="/learn/what-is-django"
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-fg px-6 text-[0.95rem] font-medium text-bg transition-opacity hover:opacity-90"
              >
                Start reading
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/learn/first-project"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong px-6 text-[0.95rem] text-fg transition-colors hover:border-fg"
              >
                Build an app in 14 steps
              </Link>
            </div>
          </div>

          <figure
            className="rise mt-12 hidden overflow-hidden rounded-xl border border-line bg-surface lg:mt-0 lg:block"
            style={{ animationDelay: "200ms" }}
            aria-label="Starting a Django project in the terminal"
          >
            <figcaption className="flex items-center gap-1.5 border-b border-line px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full border border-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full border border-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full border border-line-strong" />
              <span className="ml-auto font-mono text-[0.68rem] text-faint">terminal</span>
            </figcaption>
            <pre className="overflow-x-auto px-4 py-4 font-mono text-[0.74rem] leading-[1.9]">
              {TERMINAL.map(([prompt, line]) => (
                <span key={line} className="block whitespace-pre">
                  {prompt ? (
                    <>
                      <span className="text-faint">{prompt} </span>
                      <span className="text-fg">{line}</span>
                    </>
                  ) : (
                    <span className="text-muted">{line}</span>
                  )}
                </span>
              ))}
              <span className="block">
                <span className="text-faint">$ </span>
                <span className="cursor-blink inline-block h-[1.05em] w-[0.55em] translate-y-[0.2em] bg-fg" />
              </span>
            </pre>
          </figure>
        </div>

        <dl
          className="rise mt-14 grid max-w-[640px] grid-cols-3 border-y border-line"
          style={{ animationDelay: "240ms" }}
        >
          {[
            [String(CHAPTERS.length), "chapters"],
            [String(PARTS.length - 1), "parts + appendix"],
            [`${examples}+`, "code examples"],
          ].map(([value, label], i) => (
            <div
              key={label}
              className={`flex flex-col-reverse py-5 ${i > 0 ? "border-l border-line pl-5" : ""}`}
            >
              <dt className="mt-1 text-xs text-faint">{label}</dt>
              <dd className="font-serif text-3xl tracking-tight sm:text-4xl">{value}</dd>
            </div>
          ))}
        </dl>

        <ContinueReading />
      </section>

      {/* The 14 steps */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="eyebrow">The beginner path</p>
              <h2 className="mt-5 font-serif text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
                Every Django project, in fourteen steps.
              </h2>
              <p className="mt-6 max-w-[42ch] leading-relaxed text-muted">
                Learn this order once and you can start any project from an empty folder. Each step opens its
                full explanation in the guide, with the exact code to write.
              </p>
              <Link
                href="/learn/first-project"
                className="group mt-8 inline-flex items-center gap-2 text-sm font-medium"
              >
                Open the full walkthrough
                <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <ol className="border-t border-line">
              {steps.map((step, i) => (
                <li key={step.id}>
                  <Link
                    href={`/learn/first-project#${step.id}`}
                    className="group grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-line py-4 transition-colors hover:bg-surface sm:grid-cols-[3rem_minmax(0,1fr)_auto] sm:px-2"
                  >
                    <span className="font-mono text-xs tabular-nums text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[0.98rem] font-medium leading-snug">
                        {step.text.replace(/^Step \d+\s*[—–-]\s*/, "")}
                      </span>
                      <code className="mt-1 block truncate font-mono text-[0.75rem] text-faint">
                        {STEP_HINTS[i]}
                      </code>
                    </span>
                    <ArrowUpRight
                      size={15}
                      className="text-faint opacity-0 transition-opacity group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Live labs */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Live labs</p>
              <h2 className="mt-5 max-w-[20ch] font-serif text-4xl leading-[1.05] tracking-[-0.02em] sm:text-5xl">
                Flip a switch, see Django react.
              </h2>
              <p className="mt-5 max-w-[56ch] leading-relaxed text-muted">
                {LABS.length} interactive labs, one for each part of a project. Controls rewrite the code on the left;
                real Django, running in your browser, shows the result on the right.
              </p>
            </div>
            <Link href="/labs" className="group inline-flex items-center gap-2 text-sm font-medium">
              All labs
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {LABS.map((lab) => (
              <Link
                key={lab.slug}
                href={`/labs/${lab.slug}`}
                className="card flex flex-col gap-2 px-4 py-3.5"
              >
                <span className="w-fit rounded border border-line-strong px-1.5 py-px font-mono text-[0.66rem] text-muted">
                  {lab.file}
                </span>
                <span className="text-[0.9rem] font-medium leading-snug">{lab.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Paths */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8">
          <p className="eyebrow">Where should you start?</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PATHS.map((p) => (
              <Link key={p.href} href={p.href} className="card group flex flex-col p-6">
                <span className="text-xs text-faint">{p.label}</span>
                <span className="mt-4 text-lg font-medium leading-snug">{p.title}</span>
                <span className="mt-2 flex-1 text-sm leading-relaxed text-muted">{p.text}</span>
                <ArrowRight
                  size={16}
                  className="mt-6 text-muted transition-transform group-hover:translate-x-1"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Contents */}
      <section id="contents" className="scroll-mt-14 border-t border-line">
        <div className="mx-auto max-w-[1120px] px-5 py-20 sm:px-8 sm:py-24">
          <p className="eyebrow">Contents</p>
          <h2 className="mt-5 font-serif text-4xl tracking-[-0.02em] sm:text-5xl">What&rsquo;s inside</h2>

          <div className="mt-14 space-y-16">
            {PARTS.map((part, pi) => (
              <div key={part.id} className="grid gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-12">
                <div>
                  <p className="font-mono text-xs text-faint">
                    {part.id === "appendix" ? "Appendix" : `Part ${String(pi + 1).padStart(2, "0")}`}
                  </p>
                  <h3 className="mt-2 font-serif text-[1.9rem] leading-tight tracking-[-0.01em]">
                    {part.title}
                  </h3>
                  <p className="mt-3 max-w-[36ch] text-sm leading-relaxed text-muted">{part.blurb}</p>
                </div>
                <ul className="border-t border-line">
                  {part.chapters.map((chapter) => {
                    const number = CHAPTERS.find((c) => c.slug === chapter.slug)!.number;
                    return (
                      <li key={chapter.slug}>
                        <Link
                          href={`/learn/${chapter.slug}`}
                          className="group flex items-start gap-4 border-b border-line py-4 transition-colors hover:bg-surface sm:px-2"
                        >
                          <span className="mt-1 w-7 shrink-0 font-mono text-xs tabular-nums text-faint">
                            {String(number).padStart(2, "0")}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium leading-snug">{chapter.title}</span>
                            <span className="mt-1 block text-sm leading-relaxed text-muted">
                              {chapter.summary}
                            </span>
                          </span>
                          <DoneMark slug={chapter.slug} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-3 px-5 py-10 text-sm text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>The Django Handbook. Free to read, free to share.</p>
          <p>Written for Django 5.2 LTS and 6.x · Python 3.12+</p>
        </div>
      </footer>
    </main>
  );
}
