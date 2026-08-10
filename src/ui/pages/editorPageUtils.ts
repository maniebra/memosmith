import {
  dirNotePath,
  isDirNotePath,
  stripNoteExtension,
} from "../../lib/utils/path";
import type { SpaceMeta } from "../../lib/utils/pageMeta";

export type Breadcrumb = { label: string; path?: string };

export function countWords(text: string) {
  const trimmedText = text.trim();
  return trimmedText ? trimmedText.split(/\s+/).length : 0;
}

/**
 * Keeps the open tab list in sync: appends the active tab and drops tabs whose
 * note or database no longer exists (renamed or deleted). Returns the same
 * array when nothing changed so the reactive statement stays quiet.
 */
export function syncTabs(
  tabs: string[],
  activeTab: string | null,
  notes: string[],
  databases: { id: string }[],
  pinned: string[] = [],
): string[] {
  const exists = (tab: string) =>
    tab === activeTab ||
    (tab.startsWith("db:")
      ? databases.some((entry) => `db:${entry.id}` === tab)
      : notes.includes(tab));
  const kept = tabs.filter(exists);
  if (activeTab && !kept.includes(activeTab)) {
    return orderTabs([...kept, activeTab], pinned);
  }
  return orderTabs(kept.length === tabs.length ? tabs : kept, pinned);
}

/** Pinned tabs always sit first, keeping their relative order on both sides. */
export function orderTabs(tabs: string[], pinned: string[]): string[] {
  const ordered = [
    ...tabs.filter((tab) => pinned.includes(tab)),
    ...tabs.filter((tab) => !pinned.includes(tab)),
  ];
  return ordered.every((tab, index) => tab === tabs[index]) ? tabs : ordered;
}

/** Drag-and-drop reorder: drops `tab` at `target`'s slot, then re-applies pinning. */
export function moveTab(
  tabs: string[],
  tab: string,
  target: string,
  pinned: string[],
): string[] {
  const from = tabs.indexOf(tab);
  const to = tabs.indexOf(target);
  if (from < 0 || to < 0 || from === to) {
    return tabs;
  }
  const next = tabs.filter((entry) => entry !== tab);
  next.splice(to, 0, tab);
  return orderTabs(next, pinned);
}

/** Ctrl+Tab / Ctrl+Shift+Tab, wrapping around both ends. */
export function cycleTab(
  tabs: string[],
  active: string | null,
  step: number,
): string | null {
  if (!tabs.length) {
    return null;
  }
  const index = active ? tabs.indexOf(active) : -1;
  return tabs[(index + step + tabs.length) % tabs.length];
}

export function noteBreadcrumbs(
  relativePath: string | null,
  notes: string[],
  fallback: string,
): Breadcrumb[] {
  if (!relativePath) {
    return [{ label: fallback }];
  }

  const pathSegments = isDirNotePath(relativePath)
    ? relativePath.split("/").slice(0, -1)
    : relativePath.split("/");

  return pathSegments.map((segment, index) => {
    const isLast = index === pathSegments.length - 1;
    const folderPath = pathSegments.slice(0, index + 1).join("/");
    const folderNote = dirNotePath(folderPath);
    const path = isLast
      ? relativePath
      : notes.includes(folderNote)
        ? folderNote
        : undefined;

    return {
      label: isLast && !isDirNotePath(relativePath)
        ? stripNoteExtension(segment)
        : segment,
      path,
    };
  });
}

export function safeName(name: string) {
  if (/[\\/]/.test(name) || name === "." || name === "..") {
    throw new Error("Names cannot contain slashes");
  }

  return name;
}

export function renamedMeta(
  meta: SpaceMeta,
  from: string,
  to: string,
  folder: boolean,
): SpaceMeta {
  const next: SpaceMeta = {};
  const prefix = `${from}/`;

  for (const [key, value] of Object.entries(meta)) {
    if (key === from) {
      next[to] = value;
    } else if (folder && key.startsWith(prefix)) {
      next[`${to}/${key.slice(prefix.length)}`] = value;
    } else {
      next[key] = value;
    }
  }

  return next;
}

export function renamedNoteContents(
  contentsByPath: Record<string, string>,
  from: string,
  to: string,
  folder: boolean,
) {
  const next: Record<string, string> = {};
  const prefix = `${from}/`;

  for (const [key, value] of Object.entries(contentsByPath)) {
    if (key === from) {
      next[to] = value;
    } else if (folder && key.startsWith(prefix)) {
      next[`${to}/${key.slice(prefix.length)}`] = value;
    } else {
      next[key] = value;
    }
  }

  return next;
}

export function deletedMeta(
  meta: SpaceMeta,
  path: string,
  folder: boolean,
): SpaceMeta {
  const next: SpaceMeta = {};
  const prefix = `${path}/`;

  for (const [key, value] of Object.entries(meta)) {
    if (key !== path && !(folder && key.startsWith(prefix))) {
      next[key] = value;
    }
  }

  return next;
}

export function deletedNoteContents(
  contentsByPath: Record<string, string>,
  path: string,
  folder: boolean,
) {
  const next: Record<string, string> = {};
  const prefix = `${path}/`;

  for (const [key, value] of Object.entries(contentsByPath)) {
    if (key !== path && !(folder && key.startsWith(prefix))) {
      next[key] = value;
    }
  }

  return next;
}
