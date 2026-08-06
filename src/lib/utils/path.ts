export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || "Note";
}

const NOTE_EXTENSIONS = /\.(md|markdown|txt)$/i;

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
