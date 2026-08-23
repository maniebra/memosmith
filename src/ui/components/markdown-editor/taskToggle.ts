import type { Editor } from "./types";

const MARKER = /^\s*[-*+] \[( |x|X)\] /;

/** Flip the source marker for the task line the checkbox belongs to. */
function toggleBlock(e: Editor, block: HTMLElement, refocus: boolean) {
  const start = e.offsetForPosition(block, 0);
  const marker = MARKER.exec(e.sourceText(block));

  if (start === null || !marker) {
    return false;
  }

  const at = start + marker[0].indexOf("[") + 1;

  e.replace(
    at,
    at + 1,
    marker[1] === " " ? "x" : " ",
    // Read mode has no caret to restore.
    e.props.editable ? at + 1 : null,
  );

  if (refocus) {
    // The line is re-rendered, so the focused node is a fresh one.
    requestAnimationFrame(() => {
      const box = e.blockAtOffset(at)?.querySelector(".md-check");

      (box as HTMLElement | null)?.focus();
    });
  }

  return true;
}

/** The checkbox is its own node, so a click on it is the whole hit test. */
export function toggleTaskAt(
  e: Editor,
  event: PointerEvent,
  handle: HTMLElement,
) {
  const box = handle.closest?.(".md-check") as HTMLElement | null;
  const block = box?.closest(".md-task") as HTMLElement | null;

  if (!box || !block) {
    return false;
  }

  event.preventDefault();
  box.focus();

  return toggleBlock(e, block, true);
}

/** Space or Enter on a focused checkbox toggles it, like a native one. */
export function toggleTaskKey(e: Editor, event: KeyboardEvent) {
  if (event.key !== " " && event.key !== "Enter") {
    return false;
  }

  const box = (event.target as HTMLElement | null)?.closest?.(
    ".md-check",
  ) as HTMLElement | null;
  const block = box?.closest(".md-task") as HTMLElement | null;

  if (!box || !block) {
    return false;
  }

  event.preventDefault();

  return toggleBlock(e, block, true);
}
