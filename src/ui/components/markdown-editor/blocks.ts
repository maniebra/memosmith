import type { BlockApi, BlockUnit, Editor } from "./types";

export function createBlocks(e: Editor): BlockApi {
  const service = new EditorBlocks(e);

  return {
    clearBlockToolbarHide: service.clearBlockToolbarHide.bind(service),
    closeBlockMenu: service.closeBlockMenu.bind(service),
    commitChunks: service.commitChunks.bind(service),
    currentBlock: service.currentBlock.bind(service),
    handleBlockDragEnd: service.handleBlockDragEnd.bind(service),
    handleBlockDragMove: service.handleBlockDragMove.bind(service),
    openBlockMenu: service.openBlockMenu.bind(service),
    scheduleBlockToolbarHide: service.scheduleBlockToolbarHide.bind(service),
    sourceUnits: service.sourceUnits.bind(service),
    startBlockDrag: service.startBlockDrag.bind(service),
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
  private suppressBlockMenuClick = false;

  constructor(private e: Editor) {}

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

  private unitVisualElements(unit: BlockUnit) {
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

    if (this.suppressBlockMenuClick) {
      this.suppressBlockMenuClick = false;
      return;
    }

    this.e.element?.focus();
    this.e.ui.blockMenu = { x: event.clientX, y: event.clientY };
  }

  startBlockDrag(event: PointerEvent) {
    const context = this.unitContext();

    if (!context) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.e.element?.focus();
    this.e.closeMenu();
    this.e.ui.blockMenu = null;
    this.e.ui.draggingUnit = {
      key: context.unit.key,
      startY: event.clientY,
      moved: false,
      targetIndex: context.index,
    };
    this.draggedElements = this.unitVisualElements(context.unit);
    this.dragClientX = event.clientX;
    this.dragClientY = event.clientY;
  }

  private draggedElements: HTMLElement[] = [];
  private dragClientX = 0;
  private dragClientY = 0;
  private dragFrame = 0;
  private ghost: HTMLElement | null = null;
  private ghostOffset = { x: 0, y: 0 };

  /**
   * Copies the dragged blocks into a floating surface that follows the pointer.
   * It reuses the editor's classes and inline style so the blocks render the same.
   */
  private createGhost() {
    const surface = this.e.element;
    const first = this.draggedElements[0];

    if (!surface || !first) {
      return;
    }

    const surfaceRect = surface.getBoundingClientRect();
    const top = Math.min(
      ...this.draggedElements.map((node) => node.getBoundingClientRect().top),
    );
    const ghost = document.createElement("div");

    ghost.className = `${surface.className} md-block-ghost`;
    ghost.style.cssText = surface.style.cssText;
    ghost.style.width = `${surfaceRect.width}px`;
    ghost.setAttribute("aria-hidden", "true");
    ghost.dir = getComputedStyle(surface).direction;
    this.draggedElements.forEach((node) =>
      ghost.appendChild(node.cloneNode(true)),
    );

    // Keep the block where it was grabbed relative to the pointer.
    this.ghostOffset = {
      x: this.dragClientX - surfaceRect.left,
      y: this.dragClientY - top,
    };
    document.body.appendChild(ghost);
    this.ghost = ghost;
    this.moveGhost();
  }

  private moveGhost() {
    if (this.ghost) {
      this.ghost.style.transform = `translate(${this.dragClientX - this.ghostOffset.x}px, ${this.dragClientY - this.ghostOffset.y}px)`;
    }
  }

  /** Nearest ancestor that actually scrolls, so dragging near an edge can scroll it. */
  private scrollParent() {
    for (
      let node = this.e.element?.parentElement;
      node;
      node = node.parentElement
    ) {
      const { overflowY } = getComputedStyle(node);

      if (
        /(auto|scroll)/.test(overflowY) &&
        node.scrollHeight > node.clientHeight
      ) {
        return node;
      }
    }

    return document.scrollingElement as HTMLElement | null;
  }

  /** One layout read per frame, plus edge auto-scroll while the pointer is held. */
  private dragTick() {
    this.dragFrame = 0;
    const dragging = this.e.ui.draggingUnit;

    if (!dragging) {
      return;
    }

    const clientY = this.dragClientY;
    const moved = dragging.moved || Math.abs(clientY - dragging.startY) > 4;

    if (moved && !dragging.moved) {
      this.createGhost();
      document.body.classList.add("md-block-dragging-active");
      this.draggedElements.forEach((node) =>
        node.classList.add("md-block-dragging"),
      );
    }

    const scroller = moved ? this.scrollParent() : null;

    if (scroller) {
      const box =
        scroller === document.scrollingElement
          ? { top: 0, bottom: window.innerHeight }
          : scroller.getBoundingClientRect();
      const edge = 64;
      const speed =
        clientY < box.top + edge
          ? -(box.top + edge - clientY)
          : clientY > box.bottom - edge
            ? clientY - (box.bottom - edge)
            : 0;

      if (speed) {
        scroller.scrollTop += Math.max(-24, Math.min(24, speed / 3));
        this.dragFrame = requestAnimationFrame(() => this.dragTick());
      }
    }

    if (!moved) {
      return;
    }

    const units = this.sourceUnits();
    const targetIndex = this.dragTargetIndex(clientY, units);

    if (!dragging.moved || dragging.targetIndex !== targetIndex) {
      this.e.ui.draggingUnit = { ...dragging, moved, targetIndex };
    }

    this.updateDragIndicator(units, targetIndex);
  }

  private updateDragIndicator(units: BlockUnit[], targetIndex: number) {
    const e = this.e;

    if (!e.shell || !units.length) {
      e.ui.dragIndicatorTop = null;
      return;
    }

    const shellRect = e.shell.getBoundingClientRect();
    const target = units[targetIndex]
      ? this.unitVisualRect(units[targetIndex])
      : null;

    if (target) {
      e.ui.dragIndicatorTop = target.top - shellRect.top;
      return;
    }

    const last = this.unitVisualRect(units[units.length - 1]);

    e.ui.dragIndicatorTop = last ? last.bottom - shellRect.top : null;
  }

  private dragTargetIndex(clientY: number, units: BlockUnit[]) {
    for (const [index, unit] of units.entries()) {
      const rect = this.unitVisualRect(unit);

      if (!rect) {
        continue;
      }

      if (clientY < rect.top + rect.height / 2) {
        return index;
      }
    }

    return units.length;
  }

  handleBlockDragMove(event: PointerEvent) {
    if (!this.e.ui.draggingUnit) {
      return;
    }

    this.dragClientX = event.clientX;
    this.dragClientY = event.clientY;
    this.moveGhost();
    this.dragFrame ||= requestAnimationFrame(() => this.dragTick());
  }

  private dropDraggedUnit(units: BlockUnit[], moved: boolean, target: number) {
    const dragging = this.e.ui.draggingUnit;
    const currentIndex = units.findIndex((unit) => unit.key === dragging?.key);
    const chunks = this.unitChunks(units);
    const [chunk] = currentIndex === -1 ? [] : chunks.splice(currentIndex, 1);
    let targetIndex = target;

    if (currentIndex === -1 || chunk === undefined) {
      return;
    }

    if (targetIndex > currentIndex) {
      targetIndex--;
    }

    if (targetIndex !== currentIndex && moved) {
      const index = Math.max(0, Math.min(targetIndex, chunks.length));

      chunks.splice(index, 0, chunk);
      this.commitChunks(chunks, Math.min(index, chunks.length - 1));
    }
  }

  handleBlockDragEnd() {
    const dragging = this.e.ui.draggingUnit;

    if (!dragging) {
      return;
    }

    const { moved, targetIndex } = dragging;

    cancelAnimationFrame(this.dragFrame);
    this.dragFrame = 0;
    document.body.classList.remove("md-block-dragging-active");
    this.draggedElements.forEach((node) =>
      node.classList.remove("md-block-dragging"),
    );
    this.draggedElements = [];
    this.ghost?.remove();
    this.ghost = null;
    this.dropDraggedUnit(this.sourceUnits(), moved, targetIndex);
    this.suppressBlockMenuClick = dragging.moved;

    if (this.suppressBlockMenuClick) {
      window.setTimeout(() => {
        this.suppressBlockMenuClick = false;
      }, 250);
    }

    this.e.ui.draggingUnit = null;
    this.e.ui.dragIndicatorTop = null;
    this.syncBlockToolbar();
  }
}
