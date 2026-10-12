import { ChapterNav } from "@/components/chapter-nav";

export default function LearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1440px]">
      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-[290px] shrink-0 overflow-y-auto border-r border-line px-3 py-8 lg:block">
        <ChapterNav />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
