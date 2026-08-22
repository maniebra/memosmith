import type { TextEdit } from "./markdownCommands";

/** Background id, optional `:foreground` id: `==bg|x==`, `==bg:fg|x==`, `==:fg|x==`. */
const SPEC = String.raw`(?:[a-z][\w-]*)?(?::[a-z][\w-]*)?`;
const WRAPPED = new RegExp(`^==(?:(${SPEC})\\|)?([\\s\\S]*?)==$`);
const OPEN = new RegExp(`==(?:${SPEC}\\|)?$`);

/** Palette ids a highlight paints with; a missing half keeps the default. */
export type HighlightColor = { bg?: string; fg?: string };

export function parseHighlightSpec(spec: string | undefined): HighlightColor {
  const [bg, fg] = (spec ?? "").split(":");
  return { bg: bg || undefined, fg: fg || undefined };
}

function formatSpec({ bg, fg }: HighlightColor) {
  return bg || fg ? `${bg ?? ""}${fg ? `:${fg}` : ""}|` : "";
}

/**
 * Surrounding whitespace stays outside the markers, so a highlighted block
 * keeps its list bullets and indentation intact.
 */
function transformLine(line: string, color: HighlightColor | null) {
  const [, lead, body, trail] = /^(\s*)([\s\S]*?)(\s*)$/.exec(line)!;

  if (!body) {
    return line;
  }

  const wrapped = WRAPPED.exec(body);

  if (!color) {
    return wrapped ? `${lead}${wrapped[2]}${trail}` : line;
  }

  // Spreading over the parsed spec is what lets a text colour be set without
  // losing the background the highlight already had.
  const merged = wrapped
    ? { ...parseHighlightSpec(wrapped[1]), ...color }
    : color;

  return `${lead}==${formatSpec(merged)}${wrapped ? wrapped[2] : body}==${trail}`;
}

/** True when the selection already sits in a highlight, whole lines included. */
export function highlightedAt(value: string, start: number, end: number) {
  const selected = value.slice(start, end);

  if (!selected.trim()) {
    return false;
  }

  if (
    selected
      .split("\n")
      .every((line) => !line.trim() || WRAPPED.test(line.trim()))
  ) {
    return true;
  }

  return OPEN.test(value.slice(0, start)) && value.slice(end, end + 2) === "==";
}

/**
 * Wraps the selection in a highlight, recolours the one it already sits in, or
 * strips it when `color` is null. A multi-line selection is highlighted line by
 * line, since each line is rendered on its own.
 */
export function highlightEdit(
  value: string,
  start: number,
  end: number,
  color: HighlightColor | null,
): { edit: TextEdit; select: { start: number; end: number } | null } {
  const selected = value.slice(start, end);

  if (start === end) {
    return { edit: { start, end, text: "", caret: start }, select: null };
  }

  const replace = (from: number, to: number, text: string) => ({
    edit: { start: from, end: to, text, caret: from },
    select: { start: from, end: from + text.length },
  });

  if (selected.includes("\n")) {
    return replace(
      start,
      end,
      selected
        .split("\n")
        .map((line) => transformLine(line, color))
        .join("\n"),
    );
  }

  // The markers may sit just outside the selection, from a previous toggle.
  const opening = OPEN.exec(value.slice(0, start));

  if (
    opening &&
    value.slice(end, end + 2) === "==" &&
    !WRAPPED.test(selected)
  ) {
    const outer = start - opening[0].length;

    return replace(
      outer,
      end + 2,
      transformLine(`${opening[0]}${selected}==`, color),
    );
  }

  return replace(start, end, transformLine(selected, color));
}
