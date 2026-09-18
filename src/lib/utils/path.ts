/** Keep paths exchanged with Tauri portable between Windows and Unix. */
export function normalizePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const prefix = normalized.startsWith("//") ? "//" : "";

  return `${prefix}${normalized.slice(prefix.length).replace(/\/{2,}/g, "/")}`;
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(Boolean).join("/"));
}

export function dirname(filePath: string): string {
  const path = normalizePath(filePath);
  const index = path.lastIndexOf("/");

  return index === -1 ? "" : path.slice(0, index);
}

export function isAbsolutePath(filePath: string): boolean {
  const path = normalizePath(filePath);

  return path.startsWith("/") || /^[a-z]:\//i.test(path);
}

/** Returns `path` relative to `directory`, or null when it lies elsewhere. */
export function relativePath(
  directory: string,
  filePath: string,
): string | null {
  const base = normalizePath(directory).replace(/\/+$/, "");
  const path = normalizePath(filePath);
  const prefix = `${base}/`;

  return base && path.startsWith(prefix) ? path.slice(prefix.length) : null;
}

export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || "Note";
}

const NOTE_EXTENSIONS = /\.(md|markdown|txt)$/i;

export function stripNoteExtension(name: string): string {
  return name.replace(NOTE_EXTENSIONS, "");
}

export function withNoteExtension(name: string): string {
  return NOTE_EXTENSIONS.test(name) ? name : `${name}.md`;
}

/** A folder is a note too: its markdown lives inside it as <folder>.dir.md. */
export function dirNoteName(folderName: string): string {
  return `${folderName}.dir.md`;
}

export function dirNotePath(folderPath: string): string {
  return `${folderPath}/${dirNoteName(basename(folderPath))}`;
}

export function isDirNotePath(notePath: string): boolean {
  const segments = notePath.split("/");
  const name = segments[segments.length - 1] ?? "";
  const parentName = segments[segments.length - 2];

  return Boolean(parentName && name === dirNoteName(parentName));
}

export function entryPathFromNote(notePath: string): string {
  return isDirNotePath(notePath)
    ? notePath.split("/").slice(0, -1).join("/")
    : notePath;
}

export function displayNotePath(notePath: string): string {
  if (isDirNotePath(notePath)) {
    return notePath.split("/").slice(0, -1).join("/");
  }

  const segments = notePath.split("/");
  const name = segments[segments.length - 1] ?? "";

  return [...segments.slice(0, -1), stripNoteExtension(name)].join("/");
}

export function displayNoteName(notePath: string): string {
  return basename(displayNotePath(notePath));
}
