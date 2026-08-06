const BLOCK_RULES: Array<{ match: RegExp; className: string }> = [
  { match: /^# /, className: "text-3xl font-bold leading-tight mt-6 mb-1" },
  { match: /^## /, className: "text-2xl font-bold leading-tight mt-5 mb-1" },
  { match: /^### /, className: "text-xl font-semibold leading-snug mt-4 mb-1" },
  { match: /^#{4,6} /, className: "text-base font-semibold mt-3 mb-1" },
  {
    match: /^> /,
    className: "border-l-2 border-stone-400 pl-3 italic text-stone-600 dark:text-stone-300",
  },
  { match: /^(\s*)([-*+]|\d+\.) /, className: "pl-2" },
  { match: /^(-{3,}|\*{3,}|_{3,})$/, className: "border-b border-stone-300 dark:border-stone-700" },
];

const INLINE_RULES: Array<[RegExp, string]> = [
  [/`([^`\n]+)`/g, '<span class="rounded bg-stone-200 px-1 font-mono text-[0.9em] dark:bg-stone-800">`$1`</span>'],
  [/\*\*([^*\n]+)\*\*/g, '<span class="font-bold">**$1**</span>'],
  [/(?<![*\w])\*(\S|\S[^*\n]*\S)\*(?!\*)/g, '<span class="italic">*$1*</span>'],
  [/\[([^\]\n]*)\]\(([^)\n]*)\)/g, '<span class="text-emerald-700 underline dark:text-emerald-400">[$1]($2)</span>'],
];

export function escapeHtml(text: string) {
  return text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);
}

export function lineClass(line: string) {
  return BLOCK_RULES.find((rule) => rule.match.test(line))?.className ?? "";
}

export function renderLine(line: string) {
  if (!line) {
    return "<br>";
  }

  return INLINE_RULES.reduce(
    (html, [pattern, replacement]) => html.replace(pattern, replacement),
    escapeHtml(line),
  );
}

export function renderDocument(text: string) {
  return text
    .split("\n")
    .map((line) => `<div class="${lineClass(line)}">${renderLine(line)}</div>`)
    .join("");
}

/** Prefix to start the next line with when Enter is pressed inside a list. */
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
