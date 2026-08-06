export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || "Untitled note";
}
