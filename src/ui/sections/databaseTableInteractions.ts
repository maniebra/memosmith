import type { Column } from "../../lib/utils/database";

/** Column resize in progress: `width` is the live size, `x` the guide position. */
export type Resize = {
  id: string;
  startX: number;
  startWidth: number;
  width: number;
  x: number;
};

const MIN_WIDTH = 80;

export function beginResize(
  clientX: number,
  column: Column,
  header: HTMLElement,
): Resize {
  const width = column.width ?? header.getBoundingClientRect().width;
  return {
    id: column.id,
    startX: clientX,
    startWidth: width,
    width,
    x: clientX,
  };
}

export function resizeTo(resize: Resize, clientX: number): Resize {
  const width = Math.max(
    MIN_WIDTH,
    Math.round(resize.startWidth + clientX - resize.startX),
  );
  // The guide sticks to the column edge, so it stops where the minimum width does.
  return { ...resize, width, x: resize.startX + width - resize.startWidth };
}

/** Keeps the column panel inside the window, below the header it belongs to. */
export function editorPosition(
  id: string,
  bounds: DOMRect,
  panelWidth: number,
) {
  return {
    id,
    x: Math.max(
      8,
      Math.min(bounds.right - panelWidth, window.innerWidth - panelWidth - 8),
    ),
    y: bounds.bottom + 4,
  };
}

/** `entries` with the item at `from` moved to `to`. */
export function moved<T>(entries: T[], from: number, to: number) {
  const next = [...entries];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}
