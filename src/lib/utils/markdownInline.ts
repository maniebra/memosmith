import hljs from "highlight.js/lib/common";
import katex from "katex";
import {
  defaultDatabasePalette,
  defaultHighlightPalette,
} from "../storage/settingsDefaults";
import { chipStyle } from "./optionColors";
import type { PaletteColor } from "../storage/settingsTypes";
import { parseHighlightSpec } from "./markdownHighlight";
import { parseWikilink, type WikilinkResolution } from "./wikilinks";

type BlockRule = {
  match: RegExp;
  className: string;
  /** Hide the markdown marker when the caret is elsewhere. */
  hideMark?: boolean;
};

const BLOCK_RULES: BlockRule[] = [
  { match: /^# /, className: "md-h1", hideMark: true },
  { match: /^## /, className: "md-h2", hideMark: true },
  { match: /^### /, className: "md-h3", hideMark: true },
  { match: /^#{4,6} /, className: "md-h4", hideMark: true },
  {
    match: /^\s*[-*+] \[x\] /i,
    className: "md-task md-task-done",
    hideMark: true,
  },
  { match: /^\s*[-*+] \[ \] /, className: "md-task", hideMark: true },
  { match: /^\s*[-*+] /, className: "md-bullet", hideMark: true },
  { match: /^\s*\d+\. /, className: "md-ordered" },
  { match: /^> /, className: "md-quote", hideMark: true },
  { match: /^(-{3,}|\*{3,}|_{3,})$/, className: "md-rule", hideMark: true },
];

/** One pass so replacements are never rescanned as markdown. */
const INLINE =
  /`([^`\n]+)`|\$([^$\n]+)\$|\[\[([^\]\n]+)\]\]|\*\*([^*\n]+)\*\*|~~([^~\n]+)~~|__([^_\n]+)__|(?<![*\w])\*(\S|\S[^*\n]*\S)\*(?!\*)|\[([^\]\n]*)\]\(([^)\n]*)\)|(?<![\w#])#(\p{L}[\p{L}\p{N}_-]*)|==(?:((?:[a-z][\w-]*)?(?::[a-z][\w-]*)?)\|)?(\S|\S[^\n]*?\S)==/gu;

/** Stable per-name colour, so a tag keeps the same pill everywhere. */
function badgeStyle(name: string) {
  let hash = 0;
  for (const character of name) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1_000_003;
  }
  return chipStyle(
    defaultDatabasePalette[hash % defaultDatabasePalette.length]!.hex,
  );
}

function mark(text: string) {
  return `<span class="md-mark">${text}</span>`;
}

function renderKatex(source: string, displayMode: boolean) {
  try {
    return katex.renderToString(source, {
      displayMode,
      output: "html",
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    return escapeHtml(source);
  }
}

function unescapeHtml(text: string) {
  return text.replace(
    /&(amp|lt|gt);/g,
    (entity) => ({ "&amp;": "&", "&lt;": "<", "&gt;": ">" })[entity]!,
  );
}

function renderInlineMath(source: string) {
  return [
    '<span class="md-math-inline">',
    '<span class="md-math-source" spellcheck="false">',
    mark("$"),
    source,
    mark("$"),
    '</span><span class="md-math-rendered" contenteditable="false">',
    renderKatex(unescapeHtml(source), false),
    "</span></span>",
  ].join("");
}

/** Source stays an ordinary editable line; the preview is a sibling the caret never enters. */
export function mathLine(line: string, group: number, closed: boolean) {
  // Only a closed block may hide its source, since only then is there a preview to hide behind.
  return `<div dir="auto" class="md-block md-math-line" data-math="${group}"${closed ? " data-closed" : ""}>${escapeHtml(line) || "<br>"}</div>`;
}

export function mathPreview(source: string, group: number) {
  return `<div class="md-preview md-math-preview" data-math="${group}" contenteditable="false">${renderKatex(source, true)}</div>`;
}

export type WikilinkResolver = (target: string) => WikilinkResolution;
export type WikilinkEmbed = {
  title: string;
  html: string;
  exists: boolean;
};

export type RenderInlineOptions = {
  resolveWikilink?: WikilinkResolver;
  /** Swatches `==bg:fg|text==` draws from; settings own them. */
  highlightColors?: PaletteColor[];
};

/** An unknown or missing id falls back to the first swatch, never to no colour. */
function swatch(id: string | undefined, colors: PaletteColor[]) {
  return (
    (id ? colors.find((color) => color.id === id) : undefined) ??
    colors[0] ??
    defaultHighlightPalette[0]!
  );
}

/** The fill comes from the chip pipeline; a picked text colour overrides its pair. */
function highlightStyle(spec: string | undefined, colors: PaletteColor[]) {
  const { bg, fg } = parseHighlightSpec(spec);
  const fill = chipStyle(swatch(bg, colors).hex);

  if (!fg) {
    return fill;
  }

  const text = swatch(fg, colors).hex;
  return `${fill}; --chip-fg: ${text}; --chip-fg-dark: ${text}`;
}

/** Bold, strikethrough, underline and italic: same span, different marker. */
const SYMMETRIC: [string, string][] = [
  ["md-bold", "**"],
  ["md-strike", "~~"],
  ["md-underline", "__"],
  ["md-italic", "*"],
];

function renderSymmetric(bodies: (string | undefined)[]) {
  const index = bodies.findIndex((body) => body);

  if (index === -1) {
    return "";
  }

  const [className, marker] = SYMMETRIC[index]!;
  return `<span class="${className}">${mark(marker)}${bodies[index]}${mark(marker)}</span>`;
}

function renderHighlight(
  spec: string | undefined,
  body: string,
  options: RenderInlineOptions,
) {
  const style = highlightStyle(
    spec,
    options.highlightColors ?? defaultHighlightPalette,
  );

  return `<span class="md-highlight" style="${style}">${mark(spec ? `==${spec}|` : "==")}${body}${mark("==")}</span>`;
}

function renderWikilink(raw: string, options: RenderInlineOptions) {
  const rawText = unescapeHtml(raw);
  const link = parseWikilink(rawText);
  const aliasIndex = rawText.indexOf("|");
  const sourceStart =
    aliasIndex === -1 ? "[[" : `[[${rawText.slice(0, aliasIndex + 1)}`;
  const label = aliasIndex === -1 ? rawText : rawText.slice(aliasIndex + 1);
  const resolution = options.resolveWikilink?.(link.raw);
  const missing =
    resolution && !resolution.exists ? " md-wikilink-missing" : "";

  return `<span class="md-wikilink${missing}" data-wikilink-target="${attribute(link.raw)}">${mark(
    escapeHtml(sourceStart),
  )}${escapeHtml(label)}${mark("]]")}</span>`;
}

export function renderInline(
  escaped: string,
  options: RenderInlineOptions = {},
) {
  return escaped.replace(
    INLINE,
    (
      all,
      code,
      math,
      wiki,
      bold,
      strike,
      underline,
      italic,
      linkText,
      href,
      badge,
      highlightColor,
      highlighted,
    ) => {
      if (code) {
        return `<span class="md-code">${mark("`")}${code}${mark("`")}</span>`;
      }

      if (math) {
        return renderInlineMath(math);
      }

      if (wiki) {
        return renderWikilink(wiki, options);
      }

      const symmetric = renderSymmetric([bold, strike, underline, italic]);

      if (symmetric) {
        return symmetric;
      }

      if (linkText !== undefined) {
        return `<span class="md-link">${mark("[")}${linkText}${mark(`](${href})`)}</span>`;
      }

      if (highlighted) {
        return renderHighlight(highlightColor, highlighted, options);
      }

      if (badge) {
        return `<span class="md-badge" style="${badgeStyle(badge)}">#${badge}</span>`;
      }

      return all;
    },
  );
}

export function emptyAnchor() {
  return "&#8203;";
}

export function attribute(text: string) {
  return escapeHtml(text).replace(/"/g, "&quot;");
}

/** Source stays editable; the media sits in a sibling preview the caret never enters. */

export function escapeHtml(text: string) {
  return text.replace(
    /[&<>]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!,
  );
}

function blockRule(line: string) {
  return BLOCK_RULES.find((rule) => rule.match.test(line));
}

export function lineClass(line: string) {
  return blockRule(line)?.className ?? "";
}

/**
 * A real focusable node instead of a `::before` glyph, so the checkbox can hold
 * focus and answer the keyboard. It carries no source text, so caret offsets
 * are unchanged.
 */
function taskCheckbox(done: boolean) {
  return `<span class="md-check" contenteditable="false" role="checkbox" tabindex="0" aria-checked="${done}"></span>`;
}

export function renderLine(line: string, options: RenderInlineOptions = {}) {
  if (!line) {
    return emptyAnchor();
  }

  const rule = blockRule(line);
  const prefix = rule?.hideMark ? rule.match.exec(line)![0] : "";
  const body = renderInline(escapeHtml(line.slice(prefix.length)), options);
  const checkbox = rule?.className.startsWith("md-task")
    ? taskCheckbox(rule.className.includes("md-task-done"))
    : "";

  return `${checkbox}${prefix ? mark(escapeHtml(prefix)) : ""}${body || emptyAnchor()}`;
}

/** Highlighting is per line so each line stays one block the caret can map onto. */
export function renderCode(line: string, language: string) {
  if (!line) {
    return emptyAnchor();
  }

  if (!language || !hljs.getLanguage(language)) {
    return escapeHtml(line);
  }

  return hljs.highlight(line, { language, ignoreIllegals: true }).value;
}

/** True when the document has a `$$` line with no partner, so typing one should close it. */
export function mathUnclosed(text: string) {
  return (text.match(/^[ \t]*\$\$[ \t]*$/gm) ?? []).length % 2 === 1;
}

/** True when the text ends inside an unclosed fence. */
export function insideFence(text: string) {
  return (text.match(/^[ \t]*```/gm) ?? []).length % 2 === 1;
}
