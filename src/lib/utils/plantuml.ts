/** `!theme` only counts inside the diagram, so it goes right after the opening directive. */
export function themedSource(source: string, theme: string) {
  const name = theme.trim();

  if (!name || /^\s*!theme\s/m.test(source)) {
    return source;
  }

  const lines = source.split("\n");
  const start = lines.findIndex((line) => /^\s*@start/.test(line));

  lines.splice(start + 1, 0, `!theme ${name}`);

  return lines.join("\n");
}
