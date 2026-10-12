# The Django Handbook

A free, book-style guide to Django, from "what is Django?" to JWT-secured REST APIs and deployment. 43 chapters in 6 parts plus an appendix, written in plain English with complete, runnable examples.

Built with Next.js 16 (App Router), Tailwind CSS 4 and Shiki. Every page is statically generated at build time.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (all chapters pre-rendered)
npm start          # serve the production build
npm run lint
```

## Project layout

```text
app/
  page.tsx                 home: greeting, 14-step path, full contents
  learn/layout.tsx         chapter sidebar
  learn/[slug]/page.tsx    one chapter (statically generated per slug)
  search-index.json/       static JSON used by the Ctrl K / "/" search
  globals.css              black-and-white theme tokens and chapter typography
components/                header, search, table of contents, progress, theme toggle, greeting
content/*.md               the chapters, one Markdown file each
lib/chapters.ts            the table of contents: parts, chapter order, titles, summaries
lib/markdown.ts            Markdown -> HTML pipeline (GFM, callouts, flow diagrams, code blocks)
lib/shiki-themes.ts        monochrome syntax-highlighting themes
lib/progress.ts            "mark as complete" / "continue reading", stored in the visitor's browser
```

## Editing chapters

Each chapter is `content/<slug>.md`. Edit the file and the dev server picks it up on refresh.

To **add** a chapter:

1. Create `content/my-topic.md`.
2. Add `{ slug: "my-topic", title: "...", summary: "..." }` to the right part in `lib/chapters.ts`. Its position there sets its number and its prev/next links.

The chapter title and summary come from `lib/chapters.ts`, so a Markdown file starts directly with its first paragraph. Use `##` and `###` for sections; they appear in "On this page" and in search.

### Markdown extras

**Code with a file name** (and a Copy button, added automatically):

````md
```python title="blog/views.py"
def home(request): ...
```
````

Languages: `python`, `bash`, `django` (templates), `html`, `json`, `javascript`, `sql`, `http`, `text`, `dotenv`, `dockerfile`, `yaml`, `toml`, `ini`, `diff`.

**Callouts.** The text after the marker is an optional title; the body starts on the next line:

```md
> [!TIP] Optional title
> Body text.
```

Kinds: `NOTE`, `TIP`, `IMPORTANT`, `WARNING`, `CAUTION`, `EXAM`, `REMEMBER`. `EXAM`, `REMEMBER` and `IMPORTANT` render inverted for emphasis.

**Flow diagrams.** One step per line, `Title | description`:

````md
```flow
Browser | Sends GET /players/
urls.py | Finds the matching view
```
````

**Check-yourself questions** (collapsible):

```md
<details>
<summary>Question text (use <code>…</code> for code here)</summary>

Answer in normal Markdown.
</details>
```

**Links between chapters** use `/learn/<slug>` or `/learn/<slug>#heading-id`. Heading ids are the lowercased heading text with spaces turned into hyphens and punctuation removed.

## Notes

- The greeting ("Good morning / afternoon / evening") uses each visitor's own clock. It contains no name.
- Dark is the default theme; the toggle saves the choice in the browser.
- Reading progress is stored only in the visitor's browser (`localStorage`).

## Deploy

Push to GitHub and import the repository on Vercel (or any host that runs `next build`). No environment variables are needed.
