import { dirNoteName } from "./path";

export type TreeNode = {
  name: string;
  /** Space-relative path; folders included so they can be keyed and toggled. */
  path: string;
  /** Markdown file backing this node — a folder's own page, when it has one. */
  note?: string;
  children?: TreeNode[];
};

/** Builds a folder tree from sorted space-relative note paths. */
export function buildTree(paths: string[]): TreeNode[] {
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

  return sortNodes(roots);
}

function sortNodes(nodes: TreeNode[]): TreeNode[] {
  for (const node of nodes) {
    if (node.children) {
      sortNodes(node.children);
    }
  }

  nodes.sort(
    (a, b) =>
      Number(Boolean(b.children)) - Number(Boolean(a.children)) ||
      a.name.localeCompare(b.name),
  );

  return nodes;
}
