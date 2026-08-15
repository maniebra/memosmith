import type { Editor } from "./types";

const MARKER = /^\s*[-*+] \[( |x|X)\] /;

/**
 * The checkbox is a `::before` glyph, so a click on it lands on the block
 * itself, outside where the line text starts. That click toggles the source
 * marker instead of moving the caret, in read mode too.
 */
export function toggleTaskAt(
  e: Editor,
  event: PointerEvent,
  handle: HTMLElement,
) {
  const block = handle.closest?.(".md-task") as HTMLElement | null;

  if (!block || handle !== block) {
    return false;
  }

  const range = document.createRange();
  range.selectNodeContents(block);
  const text = range.getBoundingClientRect();
  // In an RTL line the glyph sits to the right of the text instead.
  const rtl = getComputedStyle(block).direction === "rtl";
  const onBox = rtl ? event.clientX > text.right : event.clientX < text.left;

  if (!onBox) {
    return false;
  }

  const start = e.offsetForPosition(block, 0);
  const marker = MARKER.exec(e.sourceText(block));

  if (start === null || !marker) {
    return false;
  }

  const at = start + marker[0].indexOf("[") + 1;
  event.preventDefault();
  e.replace(
    at,
    at + 1,
    marker[1] === " " ? "x" : " ",
    // Read mode has no caret to restore.
    e.props.editable ? at + 1 : null,
  );
  return true;
}
