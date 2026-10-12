import { CHAPTERS } from "@/lib/chapters";
import { renderChapter } from "@/lib/markdown";

export const dynamic = "force-static";

export async function GET() {
  const index = await Promise.all(
    CHAPTERS.map(async (c) => {
      const { headings } = await renderChapter(c.slug);
      return {
        slug: c.slug,
        number: c.number,
        title: c.title,
        summary: c.summary,
        part: c.part.title,
        headings: headings.map(({ id, text }) => ({ id, text })),
      };
    }),
  );
  return Response.json(index);
}
