/**
 * Tiling tree for the editor panes: a binary tree like Hyprland's, where every
 * split holds two children and a ratio. The leaf with a `null` id is the main
 * pane (the active tab); every other leaf holds a note path.
 */

export type TileLeaf = { kind: "leaf"; id: string | null };

export type TileSplit = {
  kind: "split";
  axis: "row" | "column";
  ratio: number;
  start: TileNode;
  end: TileNode;
};

export type TileNode = TileLeaf | TileSplit;

export const leaf = (id: string | null): TileLeaf => ({ kind: "leaf", id });

/** Rebuilds the tree, keeping untouched branches identical. */
function mapLeaves(
  node: TileNode,
  fn: (node: TileLeaf) => TileNode,
): TileNode {
  if (node.kind === "leaf") {
    return fn(node);
  }
  const start = mapLeaves(node.start, fn);
  const end = mapLeaves(node.end, fn);
  return start === node.start && end === node.end
    ? node
    : { ...node, start, end };
}

export function leafIds(node: TileNode): string[] {
  if (node.kind === "leaf") {
    return node.id ? [node.id] : [];
  }
  return [...leafIds(node.start), ...leafIds(node.end)];
}

/** Splits the leaf holding `target`, putting `id` on the given side. */
export function splitLeaf(
  tree: TileNode,
  target: string | null,
  axis: "row" | "column",
  side: "start" | "end",
  id: string,
): TileNode {
  return mapLeaves(tree, (node) =>
    node.id !== target
      ? node
      : {
          kind: "split",
          axis,
          ratio: 0.5,
          start: side === "start" ? leaf(id) : node,
          end: side === "start" ? node : leaf(id),
        },
  );
}

/** Drops a note pane; its sibling takes the space back. */
export function removeLeaf(tree: TileNode, id: string): TileNode {
  if (tree.kind === "leaf") {
    return tree;
  }
  if (tree.start.kind === "leaf" && tree.start.id === id) {
    return tree.end;
  }
  if (tree.end.kind === "leaf" && tree.end.id === id) {
    return tree.start;
  }
  const start = removeLeaf(tree.start, id);
  const end = removeLeaf(tree.end, id);
  return start === tree.start && end === tree.end
    ? tree
    : { ...tree, start, end };
}

/** Swaps the note shown by one pane. */
export function replaceLeaf(
  tree: TileNode,
  target: string | null,
  id: string,
): TileNode {
  return mapLeaves(tree, (node) => (node.id === target ? leaf(id) : node));
}

export function setRatio(
  tree: TileNode,
  target: TileSplit,
  ratio: number,
): TileNode {
  if (tree.kind === "leaf") {
    return tree;
  }
  if (tree === target) {
    return { ...tree, ratio };
  }
  const start = setRatio(tree.start, target, ratio);
  const end = setRatio(tree.end, target, ratio);
  return start === tree.start && end === tree.end
    ? tree
    : { ...tree, start, end };
}

/** Panes for notes that are gone, or that the main pane now shows, close. */
export function pruneTiles(
  tree: TileNode,
  openTabs: string[],
  activeNote: string | null,
): TileNode {
  let next = tree;
  for (const id of leafIds(tree)) {
    if (!openTabs.includes(id) || id === activeNote) {
      next = removeLeaf(next, id);
    }
  }
  return next;
}
