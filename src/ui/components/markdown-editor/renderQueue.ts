import type { Editor } from "./types";

/** Long enough to swallow a burst of typing, short enough to feel live. */
const RENDER_IDLE_MS = 120;

/** A key that only inserts or deletes text in the block the caret is in. */
export function typingKey(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }

  return (
    event.key.length === 1 ||
    event.key === "Backspace" ||
    event.key === "Delete"
  );
}

/**
 * The caret sits in a hidden marker (`## `, `- `), so the character just typed
 * landed inside it and is wearing the marker's faded grey: that one renders now
 * rather than at the end of the burst.
 */
function inMark() {
  const node = window.getSelection()?.anchorNode;
  const element = node instanceof Element ? node : node?.parentElement;

  return Boolean(element?.closest(".md-mark"));
}

/** The pending render a burst of typing shares. */
export function createRenderQueue(e: Editor) {
  let timer = 0;

  /**
   * Typing lands in the block the browser already put the text in, so the note
   * is only re-rendered once the keys stop: markdown one letter behind beats a
   * repaint per letter.
   */
  function scheduleRender() {
    window.clearTimeout(timer);

    if (inMark()) {
      timer = 0;
      e.renderPreservingScroll(e.caretOffset());

      return;
    }

    timer = window.setTimeout(() => {
      timer = 0;
      e.renderPreservingScroll(e.caretOffset());
    }, RENDER_IDLE_MS);
  }

  /** Anything that reads or rewrites blocks needs the rendered document first. */
  function flushRender() {
    if (!timer) {
      return;
    }

    window.clearTimeout(timer);
    timer = 0;
    e.renderPreservingScroll(e.caretOffset());
  }

  return { scheduleRender, flushRender };
}
