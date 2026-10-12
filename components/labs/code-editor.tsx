"use client";

import { useEffect, useRef } from "react";
import { basicSetup } from "codemirror";
import { EditorState, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, keymap, type DecorationSet } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { tags as t } from "@lezer/highlight";

// Painted with the site's monochrome palette so it follows the light/dark toggle.
const editorTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "var(--lab-code)", color: "var(--code-fg)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7" },
  ".cm-content": { caretColor: "var(--fg)", padding: "12px 0" },
  ".cm-gutters": { backgroundColor: "var(--lab-code)", color: "var(--faint)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 10px", minWidth: "34px" },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--fg)" },
  ".cm-activeLine": { backgroundColor: "var(--lab-active-line)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--fg)", borderLeftWidth: "2px" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--lab-selection) !important",
  },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "transparent",
    outline: "1px solid var(--faint)",
    color: "inherit",
  },
  ".cm-foldGutter .cm-gutterElement": { color: "var(--faint)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--hover)", border: "none", color: "var(--muted)" },
  ".cm-tooltip": { backgroundColor: "var(--surface)", border: "1px solid var(--line-strong)", color: "var(--fg)" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--hover)", color: "var(--fg)" },
  ".cm-searchMatch": { backgroundColor: "var(--lab-selection)" },
  ".cm-panels": { backgroundColor: "var(--surface)", color: "var(--fg)" },
});

const highlight = HighlightStyle.define([
  {
    tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword, t.bool, t.null, t.self],
    color: "var(--code-strong)",
    fontWeight: "700",
  },
  { tag: [t.string, t.special(t.string), t.attributeValue, t.regexp], color: "var(--code-soft)" },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: "var(--code-faint)", fontStyle: "italic" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.className, t.definition(t.className), t.typeName],
    color: "var(--code-strong)",
  },
  { tag: [t.tagName, t.angleBracket], color: "var(--code-strong)" },
  { tag: [t.number, t.integer, t.float], color: "var(--code-strong)" },
  { tag: [t.attributeName, t.propertyName, t.definition(t.propertyName)], fontStyle: "italic" },
  { tag: [t.punctuation, t.bracket, t.operator, t.separator, t.derefOperator], color: "var(--code-punct)" },
  { tag: [t.meta, t.annotation], color: "var(--code-strong)" },
]);

// Lines changed by a control flash briefly, so you can see what moved.
const flashLines = StateEffect.define<number[]>();
const flashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(flashLines)) {
        const marks = effect.value
          .filter((n) => n >= 1 && n <= tr.state.doc.lines)
          .map((n) => Decoration.line({ class: "cm-flash" }).range(tr.state.doc.line(n).from));
        deco = Decoration.set(marks, true);
      }
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function languageFor(path: string): Extension[] {
  if (path.endsWith(".py") || path === "shell") return [python(), indentUnit.of("    ")];
  if (path.endsWith(".html")) return [html({ autoCloseTags: true }), indentUnit.of("  ")];
  return [];
}

type Props = {
  path: string;
  value: string;
  readOnly?: boolean;
  /** Line numbers (1-based) to flash, with a nonce so the same lines can flash again. */
  flash?: { lines: number[]; nonce: number } | null;
  onChange?: (value: string) => void;
};

export function CodeEditor({ path, value, readOnly, flash, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const changeRef = useRef(onChange);
  const applying = useRef(false);

  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  // (Re)create the editor when the file or its editability changes.
  useEffect(() => {
    if (!host.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        editorTheme,
        syntaxHighlighting(highlight),
        flashField,
        ...languageFor(path),
        EditorState.readOnly.of(!!readOnly),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({ "aria-label": `Code: ${path}` }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !applying.current) changeRef.current?.(update.state.doc.toString());
        }),
      ],
    });
    const v = new EditorView({ state, parent: host.current });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // The editor is recreated per file; later value changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, readOnly]);

  // Apply new code from the controls without losing the editor.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const doc = v.state.doc.toString();
    if (doc === value) return;
    applying.current = true;
    v.dispatch({ changes: { from: 0, to: doc.length, insert: value } });
    applying.current = false;
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v || !flash || !flash.lines.length) return;
    v.dispatch({ effects: flashLines.of(flash.lines) });
    const first = Math.min(...flash.lines);
    if (first <= v.state.doc.lines) {
      v.dispatch({ effects: EditorView.scrollIntoView(v.state.doc.line(first).from, { y: "nearest", yMargin: 48 }) });
    }
  }, [flash]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
