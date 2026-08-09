import type { DomApi, Editor } from "./types";

const EMPTY_CARET = String.fromCharCode(8203);

export function withoutEmptyCaret(text: string) {
  return text.split(EMPTY_CARET).join("");
}

export function createDom(e: Editor): DomApi {
  const service = new EditorDom(e);

  return {
    blockAtOffset: service.blockAtOffset.bind(service),
    blockFromTarget: service.blockFromTarget.bind(service),
    blocks: service.blocks.bind(service),
    caretLineRange: service.caretLineRange.bind(service),
    caretOffset: service.caretOffset.bind(service),
    caretPositionIn: service.caretPositionIn.bind(service),
    getText: service.getText.bind(service),
    lineRangeFor: service.lineRangeFor.bind(service),
    lineStartAt: service.lineStartAt.bind(service),
    offsetForPosition: service.offsetForPosition.bind(service),
    positionAtOffset: service.positionAtOffset.bind(service),
    previewForNode: service.previewForNode.bind(service),
    selectionOffsets: service.selectionOffsets.bind(service),
    setCaret: service.setCaret.bind(service),
    sourceLength: service.sourceLength.bind(service),
    sourceText: service.sourceText.bind(service),
    tableCellForNode: service.tableCellForNode.bind(service),
  };
}

/**
 * Source offsets are counted over the editable blocks only: preview cards are
 * rendered output and must never shift a caret offset or a line count.
 */
class EditorDom {
  constructor(private e: Editor) {}

  private isRenderedMath(node: Node) {
    return (
      node instanceof HTMLElement &&
      node.classList.contains("md-math-rendered")
    );
  }

  sourceText(node: Node): string {
    if (this.isRenderedMath(node)) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return withoutEmptyCaret(node.textContent ?? "");
    }

    return Array.from(node.childNodes)
      .map((child) => this.sourceText(child))
      .join("");
  }

  sourceLength(node: Node) {
    return this.sourceText(node).length;
  }

  private sourceLengthBefore(node: Node, offset: number) {
    if (node.nodeType === Node.TEXT_NODE) {
      return withoutEmptyCaret((node.textContent ?? "").slice(0, offset)).length;
    }

    return Array.from(node.childNodes)
      .slice(0, offset)
      .reduce((length, child) => length + this.sourceLength(child), 0);
  }

  private sourceOffsetWithin(root: Node, target: Node, targetOffset: number) {
    let offset = 0;
    let found = false;

    const visit = (node: Node) => {
      if (this.isRenderedMath(node)) {
        return;
      }

      if (node === target) {
        offset += this.sourceLengthBefore(node, targetOffset);
        found = true;
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        offset += node.textContent?.length ?? 0;
        return;
      }

      for (const child of Array.from(node.childNodes)) {
        if (found) {
          return;
        }

        visit(child);
      }
    };

    visit(root);

    return found ? offset : null;
  }

  caretPositionIn(
    node: Node,
    offset: number,
  ): { node: Node; offset: number } | null {
    if (this.isRenderedMath(node)) {
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return { node, offset: Math.min(offset, node.textContent?.length ?? 0) };
    }

    let remaining = offset;

    for (const [index, child] of Array.from(node.childNodes).entries()) {
      const length = this.sourceLength(child);

      if (remaining > length) {
        remaining -= length;
        continue;
      }

      if (length === 0) {
        if (
          child.nodeType === Node.TEXT_NODE &&
          child.textContent?.includes(EMPTY_CARET)
        ) {
          return { node: child, offset: 0 };
        }

        return { node, offset: index };
      }

      return this.caretPositionIn(child, remaining);
    }

    return { node, offset: node.childNodes.length };
  }

  blocks() {
    return (Array.from(this.e.element?.children ?? []) as HTMLElement[]).filter(
      (block) => !block.classList.contains("md-preview"),
    );
  }

  blockFromTarget(target: EventTarget | null) {
    const node = target instanceof HTMLElement ? target : null;
    const source =
      node?.closest(".md-block") ??
      node?.closest(".md-preview")?.previousElementSibling;

    return source instanceof HTMLElement ? source : undefined;
  }

  blockAtOffset(offset: number) {
    let remaining = offset;

    for (const block of this.blocks()) {
      const length = this.sourceLength(block);

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      return block;
    }

    const currentBlocks = this.blocks();

    return currentBlocks[currentBlocks.length - 1];
  }

  getText() {
    return this.blocks()
      .map((block) => this.sourceText(block))
      .join("\n");
  }

  caretOffset() {
    const selection = getSelection();

    return selection?.focusNode
      ? this.offsetForPosition(selection.focusNode, selection.focusOffset)
      : null;
  }

  previewForNode(node: Node | null) {
    return (
      node instanceof HTMLElement ? node : node?.parentElement
    )?.closest(".md-preview");
  }

  tableCellForNode(node: Node | null) {
    return (
      node instanceof HTMLElement ? node : node?.parentElement
    )?.closest("[data-table-cell]") as HTMLElement | null;
  }

  offsetForPosition(node: Node, nodeOffset: number): number | null {
    if (!this.e.element || !this.e.element.contains(node)) {
      return null;
    }

    // A caret parked in a preview belongs to the source line above it.
    const preview = this.previewForNode(node);

    if (preview) {
      const source = preview.previousElementSibling;

      return source
        ? this.offsetForPosition(source, source.childNodes.length)
        : null;
    }

    let offset = 0;

    for (const block of this.blocks()) {
      if (block.contains(node) || block === node) {
        const lineOffset = this.sourceOffsetWithin(block, node, nodeOffset);

        return lineOffset === null ? null : offset + lineOffset;
      }

      offset += this.sourceLength(block) + 1;
    }

    return null;
  }

  selectionOffsets() {
    const selection = getSelection();

    if (!selection?.anchorNode || !selection.focusNode) {
      return null;
    }

    const anchor = this.offsetForPosition(
      selection.anchorNode,
      selection.anchorOffset,
    );
    const focus = this.offsetForPosition(
      selection.focusNode,
      selection.focusOffset,
    );

    if (anchor === null || focus === null) {
      return null;
    }

    return {
      start: Math.min(anchor, focus),
      end: Math.max(anchor, focus),
    };
  }

  setCaret(offset: number) {
    let remaining = offset;

    for (const block of this.blocks()) {
      const length = this.sourceLength(block);

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      const position = this.caretPositionIn(block, remaining);
      const selection = getSelection();
      const range = document.createRange();

      range.setStart(position?.node ?? block, position?.offset ?? 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
  }

  /** A source offset resolves to a DOM position the same way the caret does. */
  positionAtOffset(offset: number) {
    let remaining = offset;

    for (const block of this.blocks()) {
      const length = this.sourceLength(block);

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      const position = this.caretPositionIn(block, remaining);

      return position ?? { node: block, offset: 0 };
    }

    return null;
  }

  lineStartAt(offset: number) {
    return this.e.value.lastIndexOf("\n", offset - 1) + 1;
  }

  caretLineRange() {
    const offset = this.caretOffset();

    if (offset === null) {
      return null;
    }

    const value = this.e.value;
    const end = value.indexOf("\n", offset);

    return {
      start: this.lineStartAt(offset),
      end: end === -1 ? value.length : end,
    };
  }

  lineRangeFor(preview: Element) {
    const source = preview.previousElementSibling;
    const start = source ? this.offsetForPosition(source, 0) : null;

    return start === null || !source
      ? null
      : { start, end: start + this.sourceLength(source) };
  }
}
