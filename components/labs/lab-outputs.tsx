"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import type { Output, Tone } from "@/lib/labs/types";

// ---------------------------------------------------------------------------
// tiny highlighters (monochrome: weight and shade, no colour)
// ---------------------------------------------------------------------------

const SQL_KEYWORDS =
  /\b(SELECT|FROM|WHERE|AND|OR|NOT|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|ALTER|DROP|ADD|COLUMN|PRIMARY|KEY|REFERENCES|FOREIGN|UNIQUE|NULL|DEFAULT|CHECK|ON|INNER|LEFT|OUTER|JOIN|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|AS|IN|LIKE|ESCAPE|BEGIN|COMMIT|DEFERRABLE|INITIALLY|DEFERRED|COUNT|SUM|AVG|MAX|MIN|DISTINCT|ASC|DESC|IS|BETWEEN|CASCADE|RENAME|TO|AUTOINCREMENT)\b/g;
const PY_KEYWORDS =
  /\b(from|import|class|def|return|if|elif|else|for|in|while|with|as|try|except|finally|raise|pass|None|True|False|and|or|not|is|lambda|yield|self)\b/g;

function highlight(text: string, lang: string): ReactNode[] {
  const rules: [RegExp, string][] =
    lang === "sql"
      ? [
          [/--[^\n]*/g, "lab-c"],
          [/'(?:[^']|'')*'/g, "lab-s"],
          [SQL_KEYWORDS, "lab-k"],
        ]
      : lang === "python"
        ? [
            [/#[^\n]*/g, "lab-c"],
            [/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/g, "lab-s"],
            [PY_KEYWORDS, "lab-k"],
          ]
        : lang === "html"
          ? [
              [/<!--[\s\S]*?-->/g, "lab-c"],
              [/"[^"\n]*"/g, "lab-s"],
              [/<\/?[a-zA-Z][\w-]*|\/?>/g, "lab-k"],
            ]
          : [];
  if (!rules.length) return [text];

  type Hit = { start: number; end: number; cls: string };
  const hits: Hit[] = [];
  for (const [re, cls] of rules) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (!hits.some((h) => start < h.end && end > h.start)) hits.push({ start, end, cls });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let at = 0;
  hits.forEach((h, i) => {
    if (h.start > at) out.push(text.slice(at, h.start));
    out.push(
      <span key={i} className={h.cls}>
        {text.slice(h.start, h.end)}
      </span>,
    );
    at = h.end;
  });
  out.push(text.slice(at));
  return out;
}

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

function JsonView({ value }: { value: unknown }) {
  const nodes = useMemo(() => {
    const pretty = JSON.stringify(value, null, 2) ?? "null";
    const out: ReactNode[] = [];
    let last = 0;
    for (const m of pretty.matchAll(JSON_TOKEN)) {
      const at = m.index ?? 0;
      if (at > last) out.push(pretty.slice(last, at));
      if (m[1]) {
        out.push(
          <span key={at} className={m[2] ? "lab-k" : "lab-s"}>
            {m[1]}
          </span>,
        );
        if (m[2]) out.push(m[2]);
      } else {
        out.push(
          <span key={at} className="lab-k">
            {m[0]}
          </span>,
        );
      }
      last = at + m[0].length;
    }
    out.push(pretty.slice(last));
    return out;
  }, [value]);
  return <pre className="lab-pre">{nodes}</pre>;
}

// Keeps rendered pages from navigating away inside the preview.
const FREEZE = `<script>document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a");if(a)e.preventDefault()},true);document.addEventListener("submit",function(e){e.preventDefault()},true);</script>`;

function HtmlView({ html, height }: { html: string; height?: number }) {
  const doc = useMemo(() => (/<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${FREEZE}</body>`) : html + FREEZE), [html]);
  return (
    <div className="lab-browser">
      <div className="lab-browser-bar">
        <span />
        <span />
        <span />
      </div>
      <iframe
        title="Rendered page"
        srcDoc={doc}
        sandbox="allow-scripts"
        className="block w-full border-0 bg-white"
        style={{ height: height ?? 460 }}
      />
    </div>
  );
}

function toneClass(tone?: Tone) {
  switch (tone) {
    case "ok":
      return "lab-tone-ok";
    case "warn":
      return "lab-tone-warn";
    case "bad":
      return "lab-tone-bad";
    case "muted":
      return "lab-tone-muted";
    default:
      return "";
  }
}

export function OutputView({ output }: { output: Output }) {
  switch (output.kind) {
    case "html":
      return <HtmlView html={output.html} height={output.height} />;
    case "json":
      return <JsonView value={output.value} />;
    case "code":
      return <pre className="lab-pre">{highlight(output.text, output.lang)}</pre>;
    case "text":
      return <pre className="lab-pre whitespace-pre-wrap">{output.text}</pre>;
    case "kv":
      return (
        <dl className="lab-kv">
          {output.items.map(([k, v], i) => (
            <Fragment key={i}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </Fragment>
          ))}
        </dl>
      );
    case "table":
      return (
        <div>
          {output.caption && <p className="lab-caption">{output.caption}</p>}
          <div className="lab-table-wrap">
            <table className="lab-table">
              <thead>
                <tr>
                  {output.columns.map((c, i) => (
                    <th key={i}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {output.rows.length === 0 ? (
                  <tr>
                    <td colSpan={Math.max(1, output.columns.length)} className="text-faint">
                      (no rows)
                    </td>
                  </tr>
                ) : (
                  output.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "matrix":
      return (
        <div>
          {output.caption && <p className="lab-caption">{output.caption}</p>}
          <div className="lab-table-wrap">
            <table className="lab-table">
              <thead>
                <tr>
                  <th />
                  {output.columns.map((c, i) => (
                    <th key={i}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {output.rows.map((row, i) => (
                  <tr key={i}>
                    <th scope="row">{row.label}</th>
                    {row.cells.map((cell, j) => (
                      <td key={j}>
                        <span className={toneClass(cell.tone)}>{cell.text}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
  }
}

/** Tab key that survives "SQL (3)" becoming "SQL (5)". */
export function outputKey(title: string) {
  return title.replace(/\s*\(.*\)\s*$/, "");
}
