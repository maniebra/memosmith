import { leaf, type TileNode } from "../utils/tiling";

const TABS_KEY = "memosmith:tabs";

export type TabState = {
  open: string[];
  pinned: string[];
  active: string | null;
  /** Pane layout; a bare leaf means a single pane. */
  tiles: TileNode;
};

const emptyTabs: TabState = {
  open: [],
  pinned: [],
  active: null,
  tiles: leaf(null),
};

/** Anything that is not a tile tree we stored falls back to a single pane. */
export function parseTiles(value: unknown): TileNode | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const node = value as Record<string, unknown>;
  if (node.kind === "leaf") {
    return typeof node.id === "string" || node.id === null
      ? leaf(node.id as string | null)
      : null;
  }
  if (node.kind !== "split") {
    return null;
  }
  const start = parseTiles(node.start);
  const end = parseTiles(node.end);
  const ratio = typeof node.ratio === "number" ? node.ratio : 0.5;
  if (!start || !end || (node.axis !== "row" && node.axis !== "column")) {
    return null;
  }
  return { kind: "split", axis: node.axis, ratio, start, end };
}

const stringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];

export function loadTabs(): TabState {
  const raw = localStorage.getItem(TABS_KEY);
  if (!raw) {
    return { ...emptyTabs };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TabState>;
    return {
      open: stringList(parsed.open),
      pinned: stringList(parsed.pinned),
      active: typeof parsed.active === "string" ? parsed.active : null,
      tiles: parseTiles(parsed.tiles) ?? leaf(null),
    };
  } catch {
    return { ...emptyTabs };
  }
}

export function saveTabs(state: TabState) {
  localStorage.setItem(TABS_KEY, JSON.stringify(state));
}
