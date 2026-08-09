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
