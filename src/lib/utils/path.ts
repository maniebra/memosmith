export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || "Untitled note";
}

const NOTE_EXTENSIONS = /\.(md|markdown|txt)$/i;

export function withNoteExtension(name: string): string {
  return NOTE_EXTENSIONS.test(name) ? name : `${name}.md`;
}
