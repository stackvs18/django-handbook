import fs from "node:fs/promises";
import path from "node:path";
import { unified, type Plugin } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { visit, SKIP } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import { createHighlighter, type Highlighter } from "shiki";
import type { Element, ElementContent, Root, Text } from "hast";
import { DARK_PALETTE, monoDark, monoLight } from "./shiki-themes";

export type Heading = { id: string; text: string; depth: 2 | 3 };

declare module "vfile" {
  interface DataMap {
    headings: Heading[];
  }
}

export type RenderedChapter = {
  html: string;
  headings: Heading[];
  minutes: number;
};

const CONTENT_DIR = path.join(process.cwd(), "content");

const LANGS = [
  "python",
  "bash",
  "html",
  "jinja",
  "json",
  "javascript",
  "sql",
  "ini",
  "http",
  "text",
  "diff",
  "dotenv",
  "toml",
  "yaml",
  "dockerfile",
];

// Friendly names in code fences -> Shiki grammar ids
const LANG_ALIAS: Record<string, string> = {
  django: "jinja",
  py: "python",
  sh: "bash",
  shell: "bash",
  console: "bash",
  js: "javascript",
  env: "dotenv",
  txt: "text",
  plaintext: "text",
};

const LANG_LABEL: Record<string, string> = {
  python: "Python",
  bash: "Terminal",
  html: "HTML",
  jinja: "Template",
  json: "JSON",
  javascript: "JavaScript",
  sql: "SQL",
  ini: "Config",
  http: "HTTP",
  text: "Text",
  diff: "Diff",
  dotenv: ".env",
  toml: "TOML",
  yaml: "YAML",
  dockerfile: "Dockerfile",
};

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  highlighterPromise ??= createHighlighter({
    themes: [monoDark, monoLight],
    langs: LANGS,
  });
  return highlighterPromise;
}

function el(
  tagName: string,
  properties: Element["properties"],
  children: ElementContent[] = [],
): Element {
  return { type: "element", tagName, properties, children };
}

function text(value: string): Text {
  return { type: "text", value };
}

/** Fenced code -> highlighted figure with a caption bar and copy button. */
const rehypeCodeBlocks: Plugin<[], Root> = () => {
  return async (tree) => {
    const highlighter = await getHighlighter();
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || !parent || index === undefined) return;
      const code = node.children[0];
      if (!code || code.type !== "element" || code.tagName !== "code") return;

      const classes = (code.properties.className as string[] | undefined) ?? [];
      const rawLang = classes.find((c) => c.startsWith("language-"))?.slice(9) ?? "text";
      const meta = ((code.data as { meta?: string } | undefined)?.meta ?? "").trim();
      const source = toString(code).replace(/\n$/, "");

      if (rawLang === "flow") {
        parent.children[index] = renderFlow(source);
        return SKIP;
      }

      const lang = LANG_ALIAS[rawLang] ?? (LANGS.includes(rawLang) ? rawLang : "text");
      const title = /title="([^"]+)"/.exec(meta)?.[1];

      const hast = highlighter.codeToHast(source, {
        lang,
        themes: { dark: "mono-dark", light: "mono-light" },
        defaultColor: false,
      });
      const pre = hast.children[0] as Element;
      pre.properties.tabIndex = 0;
      compactTokens(pre);

      const caption = el("figcaption", { className: ["code-caption"] }, [
        el("span", { className: ["code-title"] }, [text(title ?? LANG_LABEL[lang] ?? lang)]),
        el(
          "button",
          { type: "button", className: ["copy-btn"], "data-copy": "", "aria-label": "Copy code" },
          [text("Copy")],
        ),
      ]);

      parent.children[index] = el(
        "figure",
        { className: ["code-block"], "data-lang": lang },
        [caption, pre],
      );
      return SKIP;
    });
  };
};

// Dark-theme colour -> short class. Each role maps to a CSS variable that
// switches with the site theme (see .tk-* in globals.css).
const ROLE_CLASS = new Map(
  Object.entries(DARK_PALETTE).map(([role, hex]) => [hex.toLowerCase(), `tk-${role}`]),
);

function tokenClasses(style: string): string[] | null {
  const decls = Object.fromEntries(
    style
      .toLowerCase()
      .split(";")
      .filter(Boolean)
      .map((d) => d.split(":") as [string, string]),
  );
  const role = ROLE_CLASS.get(decls["--shiki-dark"] ?? "");
  if (!role) return null;
  const classes = role === "tk-fg" ? [] : [role];
  if (decls["--shiki-dark-font-weight"] === "bold") classes.push("tk-b");
  if (decls["--shiki-dark-font-style"] === "italic") classes.push("tk-i");
  return classes;
}

/**
 * Shiki emits one inline-styled <span> per token. Our themes are fixed, so
 * replace those styles with a few short classes, drop spans for plain text,
 * and merge neighbours that look the same. Cuts code-block HTML by more than half.
 */
function compactTokens(pre: Element) {
  delete pre.properties.style;

  visit(pre, "element", (line) => {
    // Shiki writes the class as a plain string property: { class: "line" }
    const cls = String(line.properties.class ?? line.properties.className ?? "");
    if (line.tagName !== "span" || !cls.split(/[ ,]/).includes("line")) return;

    const merged: ElementContent[] = [];
    for (const token of line.children) {
      if (token.type !== "element") {
        merged.push(token);
        continue;
      }
      const style = String(token.properties.style ?? "");
      const classes = tokenClasses(style);
      const value = toString(token);
      const prev = merged[merged.length - 1];

      if (classes && classes.length === 0) {
        if (prev?.type === "text") prev.value += value;
        else merged.push(text(value));
        continue;
      }

      const props: Element["properties"] = classes ? { className: classes } : { style };
      const key = JSON.stringify(props);
      if (prev?.type === "element" && JSON.stringify(prev.properties) === key) {
        (prev.children[0] as Text).value += value;
        continue;
      }
      merged.push(el("span", props, [text(value)]));
    }
    line.children = merged;
    delete line.properties.class;
    line.properties.className = ["line"];
    return SKIP;
  });
}

/**
 * ```flow
 * Browser | sends GET /players/
 * urls.py | finds the matching path()
 * ```
 */
function renderFlow(source: string): Element {
  const steps = source
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [title, ...rest] = line.split("|");
      return { title: title.trim(), desc: rest.join("|").trim() };
    });

  return el(
    "ol",
    { className: ["flow"] },
    steps.map((step, i) =>
      el("li", { className: ["flow-step"] }, [
        el("span", { className: ["flow-index"] }, [text(String(i + 1).padStart(2, "0"))]),
        el("span", { className: ["flow-body"] }, [
          el("span", { className: ["flow-title"] }, [text(step.title)]),
          ...(step.desc ? [el("span", { className: ["flow-desc"] }, [text(step.desc)])] : []),
        ]),
      ]),
    ),
  );
}

const CALLOUTS: Record<string, string> = {
  NOTE: "Note",
  TIP: "Tip",
  IMPORTANT: "Important",
  WARNING: "Warning",
  CAUTION: "Careful",
  EXAM: "Exam focus",
  REMEMBER: "Remember",
};

/** GitHub-style alerts: > [!TIP] Optional title */
const rehypeCallouts: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "element", (node) => {
      if (node.tagName !== "blockquote") return;
      const firstP = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "p",
      );
      const first = firstP?.children[0];
      if (!firstP || !first || first.type !== "text") return;

      const match = /^\[!(\w+)\][ \t]*/.exec(first.value);
      if (!match || !CALLOUTS[match[1].toUpperCase()]) return;
      first.value = first.value.slice(match[0].length);

      // The title is everything up to the first line break; it may contain inline code.
      const titleNodes: ElementContent[] = [];
      while (firstP.children.length) {
        const child = firstP.children[0];
        if (child.type === "text" && child.value.includes("\n")) {
          const at = child.value.indexOf("\n");
          if (at > 0) titleNodes.push(text(child.value.slice(0, at)));
          child.value = child.value.slice(at + 1);
          break;
        }
        if (child.type === "element" && child.tagName === "br") {
          firstP.children.shift();
          break;
        }
        titleNodes.push(child);
        firstP.children.shift();
      }

      const hasTitle = titleNodes.some((n) => toString(n as Element).trim());
      const kind = match[1].toLowerCase();

      if (!toString(firstP).trim()) {
        node.children = node.children.filter((c) => c !== firstP);
      }

      node.tagName = "aside";
      node.properties = { className: ["callout", `callout-${kind}`] };
      node.children.unshift(
        el(
          "p",
          { className: ["callout-title"] },
          hasTitle ? titleNodes : [text(CALLOUTS[match[1].toUpperCase()])],
        ),
      );
    });
  };
};

/** Scrollable tables, external links, heading anchors, heading collection. */
const rehypeFinish: Plugin<[], Root> = () => {
  return (tree, file) => {
    const headings: Heading[] = [];

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName === "table" && parent && index !== undefined) {
        parent.children[index] = el("div", { className: ["table-wrap"] }, [node]);
        return SKIP;
      }

      if (node.tagName === "a") {
        const href = String(node.properties.href ?? "");
        if (/^https?:\/\//.test(href)) {
          node.properties.target = "_blank";
          node.properties.rel = ["noopener", "noreferrer"];
        }
      }

      if ((node.tagName === "h2" || node.tagName === "h3") && node.properties.id) {
        const id = String(node.properties.id);
        headings.push({ id, text: toString(node), depth: node.tagName === "h2" ? 2 : 3 });
        node.children.push(
          el("a", { href: `#${id}`, className: ["anchor"], "aria-label": "Link to this section" }, [
            text("#"),
          ]),
        );
      }
    });

    file.data.headings = headings;
  };
};

// Keyed by file modification time so edits show up during development.
const cache = new Map<string, Promise<RenderedChapter>>();

function chapterPath(slug: string) {
  return path.join(CONTENT_DIR, `${slug}.md`);
}

async function render(source: string): Promise<RenderedChapter> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeCodeBlocks)
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeCallouts)
    .use(rehypeFinish)
    .use(rehypeStringify)
    .process(source);

  const words = source.replace(/```[\s\S]*?```/g, " ").split(/\s+/).length;
  const codeLines = (source.match(/```[\s\S]*?```/g) ?? []).join("\n").split("\n").length;

  return {
    html: String(file),
    headings: file.data.headings ?? [],
    minutes: Math.max(2, Math.round(words / 200 + codeLines / 40)),
  };
}

export async function renderChapter(slug: string): Promise<RenderedChapter> {
  const file = chapterPath(slug);
  const { mtimeMs } = await fs.stat(file);
  const key = `${slug}@${mtimeMs}`;
  let entry = cache.get(key);
  if (!entry) {
    entry = fs.readFile(file, "utf8").then(render);
    cache.set(key, entry);
  }
  return entry;
}
