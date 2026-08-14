import type { DecorationBox, Editor, SelectionApi } from "./types";

const EMBED_LINE_CLASSES = [
  "md-database-line",
  "md-diagram-line",
  "md-drawing-line",
];

export function createSelection(e: Editor): SelectionApi {
  const service = new EditorSelection(e);

  return {
    markActiveBlock: service.markActiveBlock.bind(service),
    markActiveSubblock: service.setActiveSubblockBlock.bind(service),
    measureDecorations: service.measureDecorations.bind(service),
    repairPreviewNavigation: service.repairPreviewNavigation.bind(service),
    scheduleMeasure: service.scheduleMeasure.bind(service),
    setActiveBlock: service.setActiveBlock.bind(service),
  };
}

/** Which block owns the caret, and the underlines drawn over the document. */
class EditorSelection {
  private previewNavigation: {
    direction: "up" | "down";
    column: number;
  } | null = null;
  private normalizingSelection = false;

  constructor(private e: Editor) {}

  private groupNameOf(active: HTMLElement | undefined) {
    for (const name of [
      "code",
      "math",
      "table",
      "callout",
      "subblocks",
    ] as const) {
      if (active?.dataset[name] !== undefined) {
        return name;
      }
    }

    return null;
  }

  setActiveBlock(active: HTMLElement | undefined) {
    const e = this.e;

    // A read-only surface (no note open) never highlights a block.
    if (!e.props.editable) {
      active = undefined;
    }

    // selectionchange fires far more often than the active block moves.
    if (active === e.ui.activeBlock) {
      return;
    }

    e.ui.activeBlock = active;
    const groupName = this.groupNameOf(active);
    const group = groupName ? active?.dataset[groupName] : undefined;

    const children = Array.from(e.element?.children ?? []) as HTMLElement[];

    for (const block of children) {
      // An embed card is live UI, never source to unfold.
      block.toggleAttribute(
        "data-active",
        !EMBED_LINE_CLASSES.some((name) => block.classList.contains(name)) &&
          (block === active ||
            (groupName !== null && block.dataset[groupName] === group)),
      );
    }

    if (groupName !== "table") {
      e.ui.selectedTableCell = null;
      e.markSelectedTableCell();
    }

    e.syncBlockToolbar();
  }

  private adjacentSourceBlock(node: Element, direction: "previous" | "next") {
    let sibling =
      direction === "previous"
        ? node.previousElementSibling
        : node.nextElementSibling;

    while (sibling?.classList.contains("md-preview")) {
      sibling =
        direction === "previous"
          ? sibling.previousElementSibling
          : sibling.nextElementSibling;
    }

    return sibling instanceof HTMLElement ? sibling : null;
  }

  private offsetInBlock(block: HTMLElement, column: number) {
    const start = this.e.offsetForPosition(block, 0);

    return start === null
      ? null
      : start + Math.min(column, this.e.sourceLength(block));
  }

  private previewTarget(preview: Element, source: Element | null) {
    return this.previewNavigation?.direction === "down"
      ? this.adjacentSourceBlock(preview, "next") ?? source
      : source ?? this.adjacentSourceBlock(preview, "previous");
  }

  private clearSubblockActive(root = this.e.element) {
    for (const block of Array.from(
      root?.querySelectorAll(
        ".md-subblock-body .md-block[data-active]," +
          ".md-subblock-body .md-preview[data-active]",
      ) ?? [],
    )) {
      (block as HTMLElement).removeAttribute("data-active");
    }
  }

  private subblockSourceForPreview(preview: Element | null) {
    if (!preview?.classList.contains("md-preview")) {
      return null;
    }

    return preview.previousElementSibling instanceof HTMLElement
      ? preview.previousElementSibling
      : null;
  }

  /** Unfolding the caret's block has to precede the caret: a hidden line drops it. */
  setActiveSubblockBlock(body: HTMLElement, node: Node | null) {
    const element = node instanceof HTMLElement ? node : node?.parentElement;
    // The body itself sits inside the columns preview: only an inner one counts.
    const nearest = element?.closest(".md-preview") ?? null;
    const preview = nearest && body.contains(nearest) ? nearest : null;
    const source = this.subblockSourceForPreview(preview);
    const active = source ?? element?.closest(".md-block");
    const activeBlock =
      active instanceof HTMLElement && body.contains(active)
        ? active
        : undefined;
    const groupName = this.groupNameOf(activeBlock);
    const group = groupName ? activeBlock?.dataset[groupName] : undefined;

    this.clearSubblockActive(body);

    for (const block of Array.from(
      body.querySelectorAll(".md-block, .md-preview"),
    )) {
      const item = block as HTMLElement;

      item.toggleAttribute(
        "data-active",
        item === activeBlock ||
          (groupName !== null && item.dataset[groupName] === group),
      );
    }
  }

  private normalizePreviewSelection() {
    const e = this.e;

    if (this.normalizingSelection) {
      return false;
    }

    const selection = getSelection();

    if (e.tableCellForNode(selection?.focusNode ?? null)) {
      return false;
    }

    const preview = e.previewForNode(selection?.focusNode ?? null);

    if (!preview) {
      return false;
    }

    const source = preview.previousElementSibling;
    const column =
      this.previewNavigation?.column ??
      (source instanceof HTMLElement ? e.sourceLength(source) : 0);
    const target = this.previewTarget(preview, source);
    const offset =
      target instanceof HTMLElement ? this.offsetInBlock(target, column) : null;

    if (offset === null) {
      return false;
    }

    this.normalizingSelection = true;
    e.setCaret(offset);
    this.normalizingSelection = false;
    this.previewNavigation = null;
    this.markActiveBlock();

    return true;
  }

  repairPreviewNavigation(direction: "up" | "down", offset: number) {
    this.previewNavigation = {
      direction,
      column: offset - this.e.lineStartAt(offset),
    };

    requestAnimationFrame(() => {
      if (!this.normalizePreviewSelection()) {
        this.previewNavigation = null;
      }
    });
  }

  /** Markdown markers stay hidden except on the block holding the caret. */
  markActiveBlock() {
    const e = this.e;
    const selection = getSelection();
    const subblockBody = e.subblockBodyForNode(selection?.focusNode ?? null);

    if (subblockBody) {
      this.setActiveSubblockBlock(subblockBody, selection?.focusNode ?? null);
      this.setActiveBlock(undefined);
      e.ui.selectedTableCell = null;
      e.markSelectedTableCell();
      return;
    }

    this.clearSubblockActive();

    if (this.normalizePreviewSelection()) {
      return;
    }

    const tableCell = e.tableCellForNode(selection?.focusNode ?? null);

    if (tableCell) {
      this.setActiveBlock(undefined);
      e.selectTableCell(tableCell);
      return;
    }

    const containing = e
      .blocks()
      .find((block) =>
        Boolean(selection?.focusNode && block.contains(selection.focusNode)),
      );
    const offset = containing ? null : e.caretOffset();

    this.setActiveBlock(
      containing ?? (offset === null ? undefined : e.blockAtOffset(offset)),
    );
  }

  private decorationRange(start: number, end: number) {
    const from = this.e.positionAtOffset(start);
    const to = this.e.positionAtOffset(end);

    if (!from || !to) {
      return null;
    }

    const range = document.createRange();

    try {
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
    } catch {
      return null;
    }

    return range;
  }

  /**
   * Underlines are drawn as boxes over the editor rather than as markup, so the
   * contenteditable DOM (and every caret offset from it) stays untouched.
   */
  measureDecorations() {
    const e = this.e;
    const decorations = e.props.decorations;

    if (!e.element || !decorations.length) {
      e.ui.decorationBoxes = [];
      return;
    }

    const origin = e.element.getBoundingClientRect();
    const boxes: DecorationBox[] = [];

    for (const decoration of decorations) {
      const range = this.decorationRange(decoration.start, decoration.end);

      for (const rect of Array.from(range?.getClientRects() ?? [])) {
        if (rect.width < 1) {
          continue;
        }

        boxes.push({
          left: rect.left - origin.left,
          top: rect.top - origin.top,
          width: rect.width,
          height: rect.height,
          tone: decoration.tone,
        });
      }
    }

    e.ui.decorationBoxes = boxes;
  }

  scheduleMeasure() {
    requestAnimationFrame(() => this.measureDecorations());
  }
}
