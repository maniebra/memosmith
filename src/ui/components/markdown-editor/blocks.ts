import { BlockDrag } from "./blockDrag";
import type { BlockApi, BlockUnit, Editor } from "./types";

export function createBlocks(e: Editor): BlockApi {
  const service = new EditorBlocks(e);
  const drag = service.drag;

  return {
    clearBlockToolbarHide: service.clearBlockToolbarHide.bind(service),
    closeBlockMenu: service.closeBlockMenu.bind(service),
    commitChunks: service.commitChunks.bind(service),
    currentBlock: service.currentBlock.bind(service),
    handleBlockDragEnd: drag.handleBlockDragEnd.bind(drag),
    handleBlockDragMove: drag.handleBlockDragMove.bind(drag),
    openBlockMenu: service.openBlockMenu.bind(service),
    scheduleBlockToolbarHide: service.scheduleBlockToolbarHide.bind(service),
    sourceUnits: service.sourceUnits.bind(service),
    startBlockDrag: drag.startBlockDrag.bind(drag),
    syncBlockToolbar: service.syncBlockToolbar.bind(service),
    syncTailAdd: service.syncTailAdd.bind(service),
    trackHoveredBlock: service.trackHoveredBlock.bind(service),
    unitChunks: service.unitChunks.bind(service),
    unitContext: service.unitContext.bind(service),
    unitVisualRect: service.unitVisualRect.bind(service),
  };
}

/** Blocks as the user sees them: the hover toolbar, dragging, and their source. */
class EditorBlocks {
  private blockToolbarHideTimer: ReturnType<typeof setTimeout> | undefined;
  private blockResize: ResizeObserver | undefined;
  private watchedBlocks: Element[] = [];
  readonly drag: BlockDrag;

  constructor(private e: Editor) {
    this.drag = new BlockDrag(e, this);
  }

  private blockUnitKey(block: HTMLElement, fallback: number) {
    for (const name of [
      "code",
      "math",
      "table",
      "callout",
      "subblocks",
      "list",
    ] as const) {
      if (block.dataset[name] !== undefined) {
        return `${name}:${block.dataset[name]}`;
      }
    }

    return `block:${fallback}`;
  }

  sourceUnits(): BlockUnit[] {
    const e = this.e;
    const units: BlockUnit[] = [];

    for (const [index, block] of e.blocks().entries()) {
      const key = this.blockUnitKey(block, index);
      const previous = units[units.length - 1];

      if (previous?.key === key) {
        previous.blocks.push(block);
        continue;
      }

      const start = e.offsetForPosition(block, 0);

      if (start === null) {
        continue;
      }

      units.push({
        key,
        blocks: [block],
        start,
        end: start + e.sourceLength(block),
      });
    }

    for (const unit of units) {
      const last = unit.blocks[unit.blocks.length - 1];
      const end = last ? e.offsetForPosition(last, e.sourceLength(last)) : null;

      if (end !== null) {
        unit.end = end;
      }
    }

    return units;
  }

  currentBlock() {
    return this.e.ui.hoveredBlock ?? this.e.ui.activeBlock;
  }

  private currentUnit() {
    const block = this.currentBlock();

    return block
      ? this.sourceUnits().find((unit) => unit.blocks.includes(block))
      : undefined;
  }

  unitContext() {
    const block = this.currentBlock();
    const units = this.sourceUnits();
    const index = block
      ? units.findIndex((unit) => unit.blocks.includes(block))
      : -1;

    return index === -1 ? null : { units, unit: units[index], index };
  }

  unitChunks(units: BlockUnit[]) {
    return units.map((unit) => this.e.value.slice(unit.start, unit.end));
  }

  private offsetForChunk(chunks: string[], index: number) {
    return chunks
      .slice(0, index)
      .reduce((offset, chunk) => offset + chunk.length + 1, 0);
  }

  commitChunks(chunks: string[], caretIndex: number, caretColumn = 0) {
    const e = this.e;
    const nextChunks = chunks.length ? chunks : [""];
    const caret = this.offsetForChunk(nextChunks, caretIndex) + caretColumn;

    e.value = nextChunks.join("\n");
    e.render(Math.min(e.value.length, caret));
    e.ui.blockMenu = null;
    e.props.onInput();
  }

  unitVisualElements(unit: BlockUnit) {
    const [kind, group] = unit.key.split(":");
    const grouped =
      kind === "code" ||
      kind === "math" ||
      kind === "table" ||
      kind === "callout" ||
      kind === "subblocks" ||
      kind === "list";

    if (this.e.element && group !== undefined && grouped) {
      return Array.from(
        this.e.element.querySelectorAll(
          `[data-${kind}="${CSS.escape(group)}"]`,
        ),
      ) as HTMLElement[];
    }

    return unit.blocks;
  }

  unitVisualRect(unit: BlockUnit) {
    const rects = this.unitVisualElements(unit)
      .map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.height > 0);
    const fallback = unit.blocks[0]?.getBoundingClientRect();

    if (!rects.length) {
      return fallback ?? null;
    }

    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return { top, bottom, height: bottom - top };
  }

  private lastVisualBlockRect() {
    const nodes = this.e.element?.children ?? [];
    const children = Array.from(nodes) as HTMLElement[];
    // The tallest bottom, not the last child: a block can render taller than
    // the ones after it (a diagram, a wrapped table).
    const bottoms = children
      .map((child) => child.getBoundingClientRect())
      .filter((rect) => rect.height > 0)
      .map((rect) => rect.bottom);

    return bottoms.length ? Math.max(...bottoms) : null;
  }

  /** Blocks that grow after they render (diagrams, images) move the tail. */
  private watchBlocks() {
    const children = Array.from(this.e.element?.children ?? []);
    const same =
      children.length === this.watchedBlocks.length &&
      children.every((child, index) => child === this.watchedBlocks[index]);

    if (same) {
      return;
    }

    this.blockResize ??= new ResizeObserver(() => this.syncTailAdd());
    this.blockResize.disconnect();
    this.watchedBlocks = children;
    children.forEach((child) => this.blockResize?.observe(child));
  }

  syncBlockToolbar() {
    requestAnimationFrame(() => {
      const e = this.e;
      const unit = this.currentUnit();
      const rect = unit ? this.unitVisualRect(unit) : null;

      if (!e.shell || !e.element || !unit || !rect || !e.props.editable) {
        e.ui.blockToolbar = { ...e.ui.blockToolbar, visible: false };
        return;
      }

      const shellRect = e.shell.getBoundingClientRect();

      e.ui.blockToolbar = {
        top: rect.top - shellRect.top + Math.max(0, (rect.height - 28) / 2),
        visible: true,
      };
    });
  }

  syncTailAdd() {
    requestAnimationFrame(() => {
      const e = this.e;

      if (!e.shell || !e.element || !e.props.editable) {
        e.ui.tailAddTop = 0;
        return;
      }

      this.watchBlocks();

      const lastBottom = this.lastVisualBlockRect();
      const shellRect = e.shell.getBoundingClientRect();
      const fallback = e.element.getBoundingClientRect();
      const bottom = lastBottom ?? fallback.top;

      e.ui.tailAddTop = Math.max(0, bottom - shellRect.top + 2);
    });
  }

  trackHoveredBlock(event: PointerEvent) {
    const e = this.e;

    if (e.ui.draggingUnit || !e.props.editable) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest(".md-block-toolbar")) {
      this.clearBlockToolbarHide();
      return;
    }

    const block = e.blockFromTarget(event.target);

    if (block !== e.ui.hoveredBlock) {
      this.clearBlockToolbarHide();
      e.ui.hoveredBlock = block;
      this.syncBlockToolbar();
    }
  }

  clearBlockToolbarHide() {
    if (this.blockToolbarHideTimer) {
      clearTimeout(this.blockToolbarHideTimer);
      this.blockToolbarHideTimer = undefined;
    }
  }

  scheduleBlockToolbarHide() {
    this.clearBlockToolbarHide();

    this.blockToolbarHideTimer = setTimeout(() => {
      if (!this.e.ui.blockMenu && !this.e.ui.draggingUnit) {
        this.e.ui.hoveredBlock = undefined;
        this.syncBlockToolbar();
      }

      this.blockToolbarHideTimer = undefined;
    }, 220);
  }

  closeBlockMenu() {
    this.e.ui.blockMenu = null;
  }

  openBlockMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (this.drag.menuSuppressed()) {
      return;
    }

    this.e.element?.focus();
    this.e.ui.blockMenu = { x: event.clientX, y: event.clientY };
  }
}
