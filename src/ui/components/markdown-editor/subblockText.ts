import type { Editor } from "./types";

/**
 * Text and caret mapping for one column body: the body holds rendered blocks,
 * so every offset is counted over their source text, previews excluded.
 */
export class SubblockText {
  constructor(private e: Editor) {}

  text(body: HTMLElement) {
    const lines = Array.from(body.childNodes).flatMap((child) => {
      if (child instanceof HTMLElement) {
        if (child.classList.contains("md-preview")) {
          return [];
        }

        if (child.classList.contains("md-block")) {
          return [this.e.sourceText(child)];
        }
      }

      return this.e.sourceText(child).replace(/\n$/, "").split("\n");
    });

    if (lines.length) {
      return lines.join("\n");
    }

    return body.innerText.replace(/\n$/, "");
  }

  private entries(body: HTMLElement) {
    return Array.from(body.childNodes).flatMap((child) => {
      if (
        child instanceof HTMLElement &&
        child.classList.contains("md-preview")
      ) {
        return [];
      }

      return this.e.sourceText(child).replace(/\n$/, "").split("\n");
    });
  }

  /** Source offset of a DOM position inside the body, counted like text(). */
  private offsetAt(
    body: HTMLElement,
    node: Node | null | undefined,
    nodeOffset: number,
  ) {
    if (!node || !body.contains(node)) {
      return null;
    }

    const range = document.createRange();

    range.setStart(body, 0);
    range.setEnd(node, nodeOffset);

    const holder = document.createElement("div");

    holder.append(range.cloneContents());
    return this.entries(holder).join("\n").length;
  }

  caretOffset(body: HTMLElement) {
    const selection = getSelection();
    const focus = selection?.focusNode;

    return (
      this.offsetAt(body, focus, selection?.focusOffset ?? 0) ??
      this.text(body).length
    );
  }

  selection(body: HTMLElement) {
    const selection = getSelection();
    const focus = this.caretOffset(body);
    const anchor =
      this.offsetAt(
        body,
        selection?.anchorNode,
        selection?.anchorOffset ?? 0,
      ) ?? focus;

    return { start: Math.min(anchor, focus), end: Math.max(anchor, focus) };
  }

  position(body: HTMLElement, offset: number) {
    let remaining = offset;

    for (const child of Array.from(body.childNodes)) {
      if (
        child instanceof HTMLElement &&
        child.classList.contains("md-preview")
      ) {
        continue;
      }

      const length = this.e.sourceText(child).length;

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      const position = this.e.caretPositionIn(child, remaining);

      return { node: position?.node ?? child, offset: position?.offset ?? 0 };
    }

    return null;
  }

  restoreCaret(body: HTMLElement, offset: number) {
    const position = this.position(body, offset);

    // A re-render replaces the node the caret lived in, so focus comes first.
    body.focus({ preventScroll: true });

    if (!position) {
      return;
    }

    const range = document.createRange();

    range.setStart(position.node, position.offset);
    range.collapse(true);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
  }

  selectRange(body: HTMLElement, start: number, end: number) {
    const from = this.position(body, start);
    const to = this.position(body, end);

    if (!from || !to) {
      return;
    }

    const range = document.createRange();

    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
  }
}
