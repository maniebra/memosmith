import type { SpaceMeta } from "./pageMeta";
import { dirNoteName } from "./path";

export type TreeNode = {
  name: string;
  /** Space-relative path; folders included so they can be keyed and toggled. */
  path: string;
  /** Markdown file backing this node — a folder's own page, when it has one. */
  note?: string;
  /** Disk path of the readable this row is a shortcut to. */
  readable?: string;
  /** Folder a readable row sits in ("" = space root). */
  folder?: string;
  children?: TreeNode[];
};

/**
 * Builds a folder tree from sorted space-relative note paths. Siblings with a
 * manual `order` in `meta` come first, in that order; the rest sort by name.
 */
export function buildTree(paths: string[], meta: SpaceMeta = {}): TreeNode[] {
  const roots: TreeNode[] = [];

  for (const path of paths) {
    const segments = path.split("/");
    let level = roots;
    let parent: TreeNode | undefined;
    let prefix = "";

    segments.forEach((name, index) => {
      prefix = prefix ? `${prefix}/${name}` : name;

      if (index === segments.length - 1) {
        // A folder's own markdown belongs on the folder row, not as a child of it.
        if (parent && name === dirNoteName(parent.name)) {
          parent.note = path;
        } else {
          level.push({ name, path: prefix, note: path });
        }

        return;
      }

      let folder = level.find((node) => node.children && node.name === name);

      if (!folder) {
        folder = { name, path: prefix, children: [] };
        level.push(folder);
      }

      parent = folder;
      level = folder.children!;
    });
  }

  return sortNodes(roots, meta);
}

/** Adds readable shortcuts as rows in their folder ("" = space root). */
export function withReadables(
  nodes: TreeNode[],
  readables: { path: string; name: string; folder?: string }[],
  meta: SpaceMeta = {},
): TreeNode[] {
  if (!readables.length) {
    return nodes;
  }

  const clone = (level: TreeNode[], folder: string): TreeNode[] =>
    sortNodes(
      [
        ...level.map((node) =>
          node.children
            ? { ...node, children: clone(node.children, node.path) }
            : node,
        ),
        ...readables
          .filter((entry) => (entry.folder ?? "") === folder)
          .map((entry) => ({
            name: entry.name,
            path: `read:${entry.path}`,
            readable: entry.path,
            folder: entry.folder ?? "",
          })),
      ],
      meta,
    );

  return clone(nodes, "");
}

/** The node at `path`, at any depth. */
export function findNode(nodes: TreeNode[], path: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === path) {
      return node;
    }

    const child = node.children ? findNode(node.children, path) : null;

    if (child) {
      return child;
    }
  }

  return null;
}

/** Where `source` lands when dropped into `destFolder` ("" = space root). */
export function movedPath(source: string, destFolder: string) {
  const name = source.slice(source.lastIndexOf("/") + 1);

  return destFolder ? `${destFolder}/${name}` : name;
}

/** `siblings` with `source` placed just before or after `target`. */
export function reorderedSiblings(
  siblings: string[],
  source: string,
  target: string,
  after: boolean,
) {
  const rest = siblings.filter((path) => path !== source);
  const index = rest.indexOf(target);

  if (index === -1) {
    return siblings;
  }

  rest.splice(index + (after ? 1 : 0), 0, source);

  return rest;
}

function sortNodes(nodes: TreeNode[], meta: SpaceMeta): TreeNode[] {
  for (const node of nodes) {
    if (node.children) {
      sortNodes(node.children, meta);
    }
  }

  const order = (node: TreeNode) => meta[node.path]?.order ?? null;

  nodes.sort((a, b) => {
    const left = order(a);
    const right = order(b);

    if (left !== null || right !== null) {
      return (left ?? Infinity) - (right ?? Infinity);
    }

    return (
      Number(Boolean(b.children)) - Number(Boolean(a.children)) ||
      a.name.localeCompare(b.name)
    );
  });

  return nodes;
}
