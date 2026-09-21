import { basename } from "../utils/path";

export type ReadableKind =
  | "pdf"
  | "epub"
  | "image"
  | "video"
  | "audio";

/** Extensions per kind; the reader picks its viewer from the kind. */
const KIND_EXTENSIONS: Record<ReadableKind, string[]> = {
  pdf: ["pdf"],
  epub: ["epub"],
  image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "svg"],
  video: ["mp4", "webm", "mkv", "mov", "m4v"],
  audio: ["mp3", "wav", "ogg", "oga", "flac", "m4a", "aac", "opus"],
};

/** Every extension the file picker offers. */
export const readableExtensions = Object.values(KIND_EXTENSIONS).flat();

/** Media plays or displays itself; pdf and epub go through a reader. */
export const isMediaKind = (kind: ReadableKind) =>
  kind === "image" || kind === "video" || kind === "audio";

/** A shortcut to a file somewhere on disk; the file itself is never copied. */
export type Readable = {
  path: string;
  name: string;
  kind: ReadableKind;
  /** Space-relative folder the shortcut sits in ("" = space root); unset = unfiled. */
  folder?: string;
};

const READABLES_KEY = "memosmith:readables";
const POSITIONS_KEY = "memosmith:readablePositions";

export const READABLE_PREFIX = "read:";

export const isReadableTab = (id: string) => id.startsWith(READABLE_PREFIX);

export const readableTabId = (path: string) => `${READABLE_PREFIX}${path}`;

export const readableTabPath = (id: string) =>
  id.slice(READABLE_PREFIX.length);

export function readableKind(path: string): ReadableKind | null {
  const extension = path.slice(path.lastIndexOf(".") + 1).toLowerCase();

  const match = Object.entries(KIND_EXTENSIONS).find(([, extensions]) =>
    extensions.includes(extension),
  );

  return match ? (match[0] as ReadableKind) : null;
}

export function loadReadables(): Readable[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(READABLES_KEY) ?? "[]");

    return Array.isArray(parsed)
      ? parsed.flatMap((entry) => {
          const path = typeof entry?.path === "string" ? entry.path : "";
          const kind = readableKind(path);

          return path && kind
            ? [{
                path,
                kind,
                ...(typeof entry?.folder === "string"
                  ? { folder: entry.folder }
                  : {}),
                name:
                  typeof entry?.name === "string" && entry.name
                    ? entry.name
                    : basename(path),
              }]
            : [];
        })
      : [];
  } catch {
    return [];
  }
}

export function saveReadables(readables: Readable[]) {
  try {
    localStorage.setItem(READABLES_KEY, JSON.stringify(readables));
  } catch {
    // The shortcut list is a convenience; reading still works without it.
  }
}

/** Adds the file unless its type is unsupported or it is already on the list. */
export function addReadable(readables: Readable[], path: string): Readable[] {
  const kind = readableKind(path);

  return !kind || readables.some((entry) => entry.path === path)
    ? readables
    : [...readables, { path, kind, name: basename(path) }];
}

/** Files the shortcut under a space folder, so it shows up in the note tree. */
export function moveReadable(
  readables: Readable[],
  path: string,
  folder: string,
) {
  return readables.map((entry) =>
    entry.path === path ? { ...entry, folder } : entry,
  );
}

export function removeReadable(readables: Readable[], path: string) {
  return readables.filter((entry) => entry.path !== path);
}

/** Where the reader left off: a page number for PDFs, a CFI for EPUBs. */
export function loadPositions(): Record<string, string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(POSITIONS_KEY) ?? "{}");

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function savePosition(path: string, position: string) {
  try {
    localStorage.setItem(
      POSITIONS_KEY,
      JSON.stringify({ ...loadPositions(), [path]: position }),
    );
  } catch {
    // Losing the last position only costs the reader a scroll.
  }
}

/** A highlight the reader made: where it sits, what it says, and any note. */
export type Annotation = {
  id: string;
  /** A page number for PDFs, an EPUB CFI for EPUBs. */
  location: string;
  text: string;
  note: string;
  created: number;
};

const ANNOTATIONS_KEY = "memosmith:readableAnnotations";

function allAnnotations(): Record<string, Annotation[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(ANNOTATIONS_KEY) ?? "{}");

    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAnnotations(path: string): Annotation[] {
  const stored = allAnnotations()[path];

  return Array.isArray(stored)
    ? stored.filter(
        (entry) =>
          typeof entry?.id === "string" &&
          typeof entry?.location === "string" &&
          typeof entry?.text === "string",
      )
    : [];
}

export function saveAnnotations(path: string, annotations: Annotation[]) {
  try {
    localStorage.setItem(
      ANNOTATIONS_KEY,
      JSON.stringify({ ...allAnnotations(), [path]: annotations }),
    );
  } catch {
    // Highlights are worth keeping, but not worth crashing the reader over.
  }
}

export function newAnnotation(location: string, text: string): Annotation {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    location,
    text: text.trim(),
    note: "",
    created: Date.now(),
  };
}
