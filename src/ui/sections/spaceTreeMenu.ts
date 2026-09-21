import {
  BookOpen,
  Clapperboard,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  FolderPlus,
  FolderSymlink,
  Pencil,
  Plus,
  Trash2,
} from "@lucide/svelte";
import type { TreeNode } from "../../lib/utils/tree";
import type { ContextMenuItem } from "../components/ContextMenu.svelte";

/** What the tree hands the menu so an entry can act on the row it came from. */
export type TreeMenuDeps = {
  collapsed: Record<string, boolean>;
  scopeLabel: string;
  onSelect: (relativePath: string) => void;
  onToggle: (node: TreeNode) => void;
  onScopeDirectory: (relativePath: string) => void;
  onStartCreate: (parentPath: string, folder?: boolean) => void;
  onExpand: (relativePath: string) => void;
  onStartRename: (relativePath: string) => void;
  /** Turns a plain note into a folder holding it as the folder's own page. */
  onConvertToFolder: (notePath: string) => void;
  /** Absent when the Readables feature is off. */
  onAddReadables?: (folder: string, group: "books" | "media") => void;
  onDelete: (relativePath: string) => void;
};

/** Shortcut entries: a book or a media file from somewhere on disk. */
function readableItems(
  node: TreeNode,
  deps: TreeMenuDeps,
): ContextMenuItem[] {
  const add = (group: "books" | "media") => () => {
    deps.onExpand(node.path);
    deps.onAddReadables!(node.path, group);
  };

  return [
    { label: "Add readable", icon: BookOpen, onSelect: add("books") },
    { label: "Add media", icon: Clapperboard, onSelect: add("media") },
  ];
}

/** Folder-only entries: expanding, scoping, and adding children. */
function folderItems(node: TreeNode, deps: TreeMenuDeps): ContextMenuItem[] {
  return [
    {
      label: deps.collapsed[node.path] ? "Expand" : "Collapse",
      icon: deps.collapsed[node.path] ? ChevronRight : ChevronDown,
      onSelect: () => deps.onToggle(node),
    },
    {
      label: deps.scopeLabel,
      icon: FolderOpen,
      onSelect: () => deps.onScopeDirectory(node.path),
    },
    { separator: true },
    {
      label: "Add note",
      icon: Plus,
      onSelect: () => {
        deps.onExpand(node.path);
        deps.onStartCreate(node.path);
      },
    },
    ...(deps.onAddReadables ? readableItems(node, deps) : []),
    {
      label: "Add folder",
      icon: FolderPlus,
      onSelect: () => {
        deps.onExpand(node.path);
        deps.onStartCreate(node.path, true);
      },
    },
  ];
}

export function treeContextItems(
  node: TreeNode,
  deps: TreeMenuDeps,
): ContextMenuItem[] {
  return [
    ...(node.note
      ? [{ label: "Select", onSelect: () => deps.onSelect(node.note!) }]
      : []),
    ...(node.children ? folderItems(node, deps) : []),
    { separator: true },
    ...(node.note && !node.children && !node.readable
      ? [
          {
            label: "Convert to folder",
            icon: FolderSymlink,
            onSelect: () => deps.onConvertToFolder(node.note!),
          } as ContextMenuItem,
        ]
      : []),
    ...(node.readable
      ? []
      : [
          {
            label: "Rename",
            icon: Pencil,
            onSelect: () => deps.onStartRename(node.path),
          } as ContextMenuItem,
        ]),
    {
      label: "Delete",
      icon: Trash2,
      danger: true,
      onSelect: () => deps.onDelete(node.path),
    },
  ];
}
