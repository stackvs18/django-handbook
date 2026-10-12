import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LabView } from "@/components/labs/lab-view";
import { getLab, LABS } from "@/lib/labs";

export const dynamicParams = false;

export function generateStaticParams() {
  return LABS.map((lab) => ({ slug: lab.slug }));
}

export async function generateMetadata({ params }: PageProps<"/labs/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const lab = getLab(slug);
  if (!lab) return {};
  return { title: `${lab.title} · Live lab`, description: lab.summary };
}

export default async function LabPage({ params }: PageProps<"/labs/[slug]">) {
  const { slug } = await params;
  if (!getLab(slug)) notFound();
  return (
    <main id="main">
      <LabView slug={slug} />
    </main>
  );
}
