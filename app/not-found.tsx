import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-[70dvh] max-w-[720px] flex-col justify-center px-5 py-24 sm:px-8">
      <p className="eyebrow">404 · Page not found</p>
      <h1 className="mt-6 font-serif text-5xl leading-tight tracking-[-0.02em]">
        Even Django would raise <em>Http404</em> here.
      </h1>
      <p className="mt-6 text-lg text-muted">
        That page doesn&rsquo;t exist. Try the search (press <kbd className="kbd">/</kbd>) or head back to
        the contents.
      </p>
      <Link
        href="/#contents"
        className="mt-10 inline-flex h-11 w-fit items-center rounded-full bg-fg px-6 text-sm font-medium text-bg"
      >
        Back to contents
      </Link>
    </main>
  );
}
