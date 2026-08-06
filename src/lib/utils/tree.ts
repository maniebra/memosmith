export type TreeNode = {
  name: string;
  /** Space-relative path; folders included so they can be keyed and toggled. */
  path: string;
  children?: TreeNode[];
};

/** Builds a folder tree from sorted space-relative note paths. */
export function buildTree(paths: string[]): TreeNode[] {
  const roots: TreeNode[] = [];

  for (const path of paths) {
    const segments = path.split("/");
    let level = roots;
    let prefix = "";

    segments.forEach((name, index) => {
      prefix = prefix ? `${prefix}/${name}` : name;

      if (index === segments.length - 1) {
        level.push({ name, path: prefix });
        return;
      }

      let folder = level.find((node) => node.children && node.name === name);

      if (!folder) {
        folder = { name, path: prefix, children: [] };
        level.push(folder);
      }

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

  nodes.sort((a, b) => Number(Boolean(b.children)) - Number(Boolean(a.children)) || a.name.localeCompare(b.name));

  return nodes;
}
