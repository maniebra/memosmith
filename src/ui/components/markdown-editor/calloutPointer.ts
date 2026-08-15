import type { Editor } from "./types";

/**
 * The callout card is not editable itself, so a click on it moves the caret
 * into the source line it was rendered from, which unfolds the callout.
 */
export function handleCalloutPointer(
  e: Editor,
  event: PointerEvent,
  handle: HTMLElement,
) {
  const preview = handle.closest?.(
    ".md-callout-preview",
  ) as HTMLElement | null;

  if (!e.props.editable || !preview) {
    return false;
  }

  const sources = (
    Array.from(e.element?.children ?? []) as HTMLElement[]
  ).filter(
    (block) =>
      block.dataset.callout === preview.dataset.callout &&
      !block.classList.contains("md-preview"),
  );
  const bodyLine = handle.closest(".md-callout-body-line");
  // The heading is the first source line, each body line the one after it.
  const index = bodyLine
    ? Array.from(preview.querySelectorAll(".md-callout-body-line")).indexOf(
        bodyLine,
      ) + 1
    : 0;
  const target = sources[Math.min(index, sources.length - 1)];
  const offset = target ? e.offsetForPosition(target, 0) : null;

  if (!target || offset === null) {
    return false;
  }

  event.preventDefault();
  e.element?.focus({ preventScroll: true });
  e.setActiveBlock(target);
  e.setCaret(offset + e.sourceLength(target));
  return true;
}

