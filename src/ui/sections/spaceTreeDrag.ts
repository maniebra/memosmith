import type { TreeNode } from "../../lib/utils/tree";

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
