import {
  BookOpen,
  Clapperboard,
  FolderOpen,
  FolderPlus,
  Plus,
  RotateCcw,
} from "@lucide/svelte";
import type { I18nKey } from "../../lib/i18n";
import type { ContextMenuItem } from "../components/ContextMenu.svelte";

/** What the sidebar hands its own context menu. */
export type SidebarMenuDeps = {
  root: string | null;
  scoped: boolean;
  /** False when the Readables feature is off. */
  readables: boolean;
  t: (key: I18nKey, values?: Record<string, string | number>) => string;
  onChooseSpace: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onAddNote: () => void;
  onAddFolder: () => void;
  onAddReadables: (group: "books" | "media") => void;
  onResetScope: () => void;
};

/** Shortcut entries, when the Readables feature is on. */
function readableItems(deps: SidebarMenuDeps): ContextMenuItem[] {
  return deps.readables
    ? [
        {
          label: deps.t("readables.add"),
          icon: BookOpen,
          onSelect: () => deps.onAddReadables("books"),
        },
        {
          label: deps.t("readables.addMedia"),
          icon: Clapperboard,
          onSelect: () => deps.onAddReadables("media"),
        },
      ]
    : [];
}

/** Entries that only show while the sidebar is scoped to a folder. */
function scopeItems(deps: SidebarMenuDeps): ContextMenuItem[] {
  return deps.scoped
    ? [
        { separator: true },
        {
          label: deps.t("sidebar.resetScope"),
          icon: RotateCcw,
          onSelect: deps.onResetScope,
        },
      ]
    : [];
}

export function sidebarMenuItems(deps: SidebarMenuDeps): ContextMenuItem[] {
  if (!deps.root) {
    return [
      {
        label: deps.t("sidebar.chooseSpace"),
        icon: FolderOpen,
        onSelect: deps.onChooseSpace,
      },
    ];
  }

  return [
    {
      label: deps.t("sidebar.addNote"),
      icon: Plus,
      onSelect: deps.onAddNote,
    },
    {
      label: deps.t("sidebar.addFolder"),
      shortcut: "Ctrl Shift N",
      icon: FolderPlus,
      onSelect: deps.onAddFolder,
    },
    ...readableItems(deps),
    ...scopeItems(deps),
    { separator: true },
    {
      label: deps.t("common.refresh"),
      shortcut: "Ctrl R",
      icon: RotateCcw,
      onSelect: deps.onRefresh,
    },
    {
      label: deps.t("sidebar.changeSpace"),
      icon: FolderOpen,
      onSelect: deps.onChooseSpace,
    },
  ];
}
