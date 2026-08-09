import { DEFAULT_TABLE_MARKDOWN } from "./markdownTableModel";

export const SLASH_COMMANDS = [
  { label: "Heading 1", hint: "#", prefix: "# " },
  { label: "Heading 2", hint: "##", prefix: "## " },
  { label: "Heading 3", hint: "###", prefix: "### " },
  { label: "Bulleted list", hint: "-", prefix: "- " },
  { label: "Numbered list", hint: "1.", prefix: "1. " },
  { label: "To-do", hint: "[ ]", prefix: "- [ ] " },
  { label: "Quote", hint: ">", prefix: "> " },
  { label: "Code", hint: "```", prefix: "```" },
  { label: "Equation", hint: "$$", prefix: "$$" },
  { label: "Table", hint: "2x2", prefix: DEFAULT_TABLE_MARKDOWN },
  { label: "Divider", hint: "---", prefix: "---" },
  { label: "Text", hint: "plain", prefix: "" },
];

export function continueList(line: string): string {
  const match = /^(\s*)([-*+]|(\d+)\.)( \[[ x]\])? /.exec(line);

  if (!match) {
    return "";
  }

  const [prefix, indent, bullet, ordinal, task] = match;

  if (line.length === prefix.length) {
    return "";
  }

  const nextBullet = ordinal ? `${Number(ordinal) + 1}.` : bullet;

  return `${indent}${nextBullet}${task ? " [ ]" : ""} `;
}

/** Prefix to start the next line with when Enter is pressed inside a blockquote/callout. */
export function continueQuote(line: string): string {
  const match = /^(\s*>\s?)/.exec(line);

  if (!match || line.length === match[0].length) {
    return "";
  }

  return match[0].endsWith(" ") ? match[0] : `${match[0]} `;
}

export function stripPrefix(line: string) {
  return line.replace(
    /^\s*(#{1,6} |> |([-*+]|\d+\.)( \[[ x]\])? |```|\$\$ ?)/,
    "",
  );
}

export function applyPrefix(line: string, prefix: string) {
  return prefix + stripPrefix(line);
}
