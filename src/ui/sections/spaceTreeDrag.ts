import { tabDroppedOutsideViewport } from "../../lib/utils/detachedTab";
import {
  movedPath,
  reorderedSiblings,
  type TreeNode,
} from "../../lib/utils/tree";

/**
 * A file let go clear of the window wants a window of its own; a drop inside
 * is a move, which the row's own `ondrop` has already dealt with. Folders have
 * no tab to open.
 */
export function draggedOutOfWindow(event: DragEvent, node: TreeNode) {
  return (
    !node.children &&
    tabDroppedOutsideViewport(
      event.clientX,
      event.clientY,
      window.innerWidth,
      window.innerHeight,
    )
  );
}

/** Dropping on a folder moves into it; dropping on a note targets its parent. */
export function dropFolder(node: TreeNode) {
  return node.children ? node.path : parentFolder(node);
}

/** Parent folder of a node's row, used when dropping between rows. */
export function parentFolder(node: TreeNode) {
  if (node.readable) {
    return node.folder ?? "";
  }

  return node.path.includes("/")
    ? node.path.slice(0, node.path.lastIndexOf("/"))
    : "";
}

/**
 * Where a dropped row lands: inside the folder it was dropped on, or beside
 * the row it was dropped between, which also fixes the sibling order.
 */
export function dropMove(
  source: string,
  node: TreeNode,
  where: "before" | "after" | "inside",
  nodes: TreeNode[],
) {
  if (where === "inside") {
    return { destFolder: dropFolder(node), order: undefined };
  }

  const destFolder = parentFolder(node);
  // A readable keeps its `read:` id wherever it lands; a note takes a new path.
  const moved = source.startsWith("read:")
    ? source
    : movedPath(source, destFolder);

  return {
    destFolder,
    order: reorderedSiblings(
      nodes.map((sibling) => sibling.path),
      moved,
      node.path,
      where === "after",
    ),
  };
}
