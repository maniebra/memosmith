export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || "Note";
}

const NOTE_EXTENSIONS = /\.(md|markdown|txt)$/i;

export function withNoteExtension(name: string): string {
  return NOTE_EXTENSIONS.test(name) ? name : `${name}.md`;
}
