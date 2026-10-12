import type { ThemeRegistration } from "shiki";

// Two strictly monochrome code themes. Contrast comes from weight,
// italics and shades of grey instead of colour.

function monoTheme(
  name: string,
  type: "dark" | "light",
  c: {
    fg: string;
    strong: string;
    soft: string;
    faint: string;
    punct: string;
  },
): ThemeRegistration {
  return {
    name,
    type,
    colors: {
      "editor.background": "#00000000",
      "editor.foreground": c.fg,
    },
    tokenColors: [
      { settings: { foreground: c.fg } },
      {
        scope: ["comment", "punctuation.definition.comment", "string.quoted.docstring"],
        settings: { foreground: c.faint, fontStyle: "italic" },
      },
      {
        scope: [
          "keyword",
          "storage",
          "storage.type",
          "storage.modifier",
          "keyword.control",
          "keyword.operator.logical",
          "keyword.operator.new",
          "constant.language",
          "variable.language.self",
          "support.type.property-name.json",
        ],
        settings: { foreground: c.strong, fontStyle: "bold" },
      },
      {
        scope: [
          "entity.name.function",
          "entity.name.class",
          "entity.name.type",
          "support.function",
          "meta.function-call.generic",
          "entity.name.function.decorator",
          "meta.decorator",
          "entity.name.tag",
          "support.class",
        ],
        settings: { foreground: c.strong },
      },
      {
        scope: [
          "string",
          "string.quoted",
          "string.template",
          "punctuation.definition.string",
          "markup.inline.raw",
        ],
        settings: { foreground: c.soft },
      },
      {
        scope: ["constant.numeric", "constant.other", "support.constant"],
        settings: { foreground: c.strong },
      },
      {
        scope: ["entity.other.attribute-name", "variable.parameter", "meta.attribute"],
        settings: { foreground: c.fg, fontStyle: "italic" },
      },
      {
        scope: [
          "punctuation",
          "meta.brace",
          "keyword.operator",
          "punctuation.separator",
          "punctuation.definition.tag",
        ],
        settings: { foreground: c.punct },
      },
      {
        scope: ["markup.deleted", "punctuation.definition.deleted"],
        settings: { foreground: c.faint },
      },
      {
        scope: ["markup.inserted", "punctuation.definition.inserted"],
        settings: { foreground: c.strong, fontStyle: "bold" },
      },
    ],
  };
}

// Keep in sync with the --code-* variables in app/globals.css.
export const DARK_PALETTE = {
  fg: "#d4d4d4",
  strong: "#ffffff",
  soft: "#a3a3a3",
  faint: "#6e6e6e",
  punct: "#8f8f8f",
};

export const monoDark = monoTheme("mono-dark", "dark", DARK_PALETTE);

export const monoLight = monoTheme("mono-light", "light", {
  fg: "#262626",
  strong: "#000000",
  soft: "#5c5c5c",
  faint: "#8f8f8f",
  punct: "#707070",
});
