"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setLastChapter } from "@/lib/progress";

/**
 * Wires up the server-rendered chapter HTML: copy buttons on code blocks,
 * client-side navigation for internal links, and "last read" tracking.
 */
export function ArticleBehaviors({ targetId, slug }: { targetId: string; slug: string }) {
  const router = useRouter();

  useEffect(() => {
    setLastChapter(slug);
  }, [slug]);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;

    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;

      const copy = target.closest<HTMLButtonElement>("button[data-copy]");
      if (copy) {
        const code = copy.closest("figure")?.querySelector("pre")?.innerText ?? "";
        navigator.clipboard?.writeText(code.replace(/\n$/, "")).then(() => {
          copy.textContent = "Copied";
          copy.dataset.state = "copied";
          window.setTimeout(() => {
            copy.textContent = "Copy";
            delete copy.dataset.state;
          }, 1600);
        });
        return;
      }

      const link = target.closest<HTMLAnchorElement>("a[href^='/']");
      if (
        link &&
        !link.target &&
        e.button === 0 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        router.push(link.getAttribute("href")!);
      }
    }

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [targetId, router]);

  return null;
}
