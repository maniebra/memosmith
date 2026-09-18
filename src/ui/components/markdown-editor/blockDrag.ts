import type { BlockUnit, Editor } from "./types";

/** What dragging needs from the block service that owns the source units. */
export type DragHost = {
  unitContext: () => { unit: BlockUnit; index: number } | null;
  unitVisualElements: (unit: BlockUnit) => HTMLElement[];
  unitVisualRect: (
    unit: BlockUnit,
  ) => { top: number; bottom: number; height: number } | null;
  sourceUnits: () => BlockUnit[];
  unitChunks: (units: BlockUnit[]) => string[];
  commitChunks: (chunks: string[], caretIndex: number) => void;
  syncBlockToolbar: () => void;
};

/** Dragging a block: the ghost that follows the pointer and where it lands. */
export class BlockDrag {
  private suppressBlockMenuClick = false;

  constructor(
    private e: Editor,
    private blocks: DragHost,
  ) {}

  /** A drag that moved swallows the click that would open the block menu. */
  menuSuppressed() {
    if (!this.suppressBlockMenuClick) {
      return false;
    }

    this.suppressBlockMenuClick = false;

    return true;
  }

  startBlockDrag(event: PointerEvent) {
    const context = this.blocks.unitContext();

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
    this.draggedElements = this.blocks.unitVisualElements(context.unit);
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

    const units = this.blocks.sourceUnits();
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
      ? this.blocks.unitVisualRect(units[targetIndex])
      : null;

    if (target) {
      e.ui.dragIndicatorTop = target.top - shellRect.top;
      return;
    }

    const last = this.blocks.unitVisualRect(units[units.length - 1]);

    e.ui.dragIndicatorTop = last ? last.bottom - shellRect.top : null;
  }

  private dragTargetIndex(clientY: number, units: BlockUnit[]) {
    for (const [index, unit] of units.entries()) {
      const rect = this.blocks.unitVisualRect(unit);

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
    const chunks = this.blocks.unitChunks(units);
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
      this.blocks.commitChunks(chunks, Math.min(index, chunks.length - 1));
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
    this.dropDraggedUnit(this.blocks.sourceUnits(), moved, targetIndex);
    this.suppressBlockMenuClick = dragging.moved;

    if (this.suppressBlockMenuClick) {
      window.setTimeout(() => {
        this.suppressBlockMenuClick = false;
      }, 250);
    }

    this.e.ui.draggingUnit = null;
    this.e.ui.dragIndicatorTop = null;
    this.blocks.syncBlockToolbar();
  }
}
