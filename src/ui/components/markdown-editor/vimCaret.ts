import type { Editor } from "./types";

/**
 * A painted block caret for webviews without `caret-shape: block`.
 *
 * It is a fixed-position box over the character under the caret, repainted
 * whenever the caret moves or the page scrolls.
 */
let block: HTMLElement | null = null;
let repaint: (() => void) | null = null;
let last: { e: Editor; offset: number } | null = null;

function supportsNativeBlockCaret() {
  return typeof CSS !== "undefined" && CSS.supports?.("caret-shape", "block");
}

function caretRect(e: Editor, offset: number) {
  const from = e.positionAtOffset(offset);
  const to = e.positionAtOffset(offset + 1) ?? from;

  if (!from) {
    return null;
  }

  const range = document.createRange();

  range.setStart(from.node, from.offset);
  range.setEnd(to!.node, to!.offset);

  const rect = range.getBoundingClientRect();

  return rect.width || rect.height ? rect : null;
}

function element() {
  if (!block) {
    block = document.createElement("div");
    block.className = "md-vim-caret";
    document.body.append(block);
  }

  return block;
}

export function hideBlockCaret() {
  block?.remove();
  block = null;
  last = null;

  if (repaint) {
    removeEventListener("scroll", repaint, true);
    removeEventListener("resize", repaint);
    document.removeEventListener("selectionchange", repaint);
    repaint = null;
  }
}

/** Shows the block caret at `offset`, or hides it when vim is not in normal mode. */
export function showBlockCaret(e: Editor, offset: number, visible: boolean) {
  if (supportsNativeBlockCaret()) {
    return;
  }

  if (!visible) {
    hideBlockCaret();

    return;
  }

  const rect = caretRect(e, offset);

  if (!rect) {
    hideBlockCaret();

    return;
  }

  const node = element();

  node.style.top = `${rect.top}px`;
  node.style.left = `${rect.left}px`;
  node.style.width = `${Math.max(rect.width, 8)}px`;
  node.style.height = `${rect.height}px`;

  last = { e, offset };

  if (!repaint) {
    // A click or a scroll moves the character box, so follow both.
    repaint = () => {
      if (last) {
        showBlockCaret(last.e, last.e.caretOffset() ?? last.offset, true);
      }
    };
    addEventListener("scroll", repaint, true);
    addEventListener("resize", repaint);
    document.addEventListener("selectionchange", repaint);
  }
}
