/**
 * Ranking for the slash menu. Matching is on more than the visible label: the
 * hint, and the English aliases below, so `/h1`, `/db` or `/bullet` find what
 * they obviously mean — including when the label itself is translated.
 */
export type Matchable = {
  label: string;
  hint?: string;
  /** English label, when `label` is translated; aliases are keyed by it. */
  source?: string;
};

/** Keyed by the English label, which is what every translation is derived from. */
const ALIASES: Record<string, string[]> = {
  Text: ["paragraph", "plain", "body"],
  "Heading 1": ["h1", "title", "heading"],
  "Heading 2": ["h2", "subtitle", "heading"],
  "Heading 3": ["h3", "heading"],
  "Bulleted list": ["bullet", "ul", "list", "unordered"],
  "Numbered list": ["number", "ol", "list", "ordered"],
  "To-do": ["todo", "task", "checkbox", "check"],
  Quote: ["blockquote", "citation"],
  Code: ["snippet", "fence", "pre"],
  Equation: ["math", "latex", "katex", "formula"],
  Table: ["grid", "rows", "columns"],
  Columns: ["column", "split", "side"],
  Divider: ["rule", "hr", "line", "separator"],
  Callout: ["admonition", "note", "aside"],
  Drawing: ["sketch", "excalidraw", "draw"],
  Diagram: ["drawio", "flowchart"],
  Database: ["db", "table", "data", "board"],
};

function aliasesFor(command: Matchable) {
  const names = [command.source, command.label].filter(Boolean) as string[];
  const key = Object.keys(ALIASES).find((label) =>
    names.some(
      (name) =>
        name === label ||
        // Parameterised labels ("Database Tasks") still map back.
        name.toLowerCase().startsWith(label.toLowerCase()),
    ),
  );
  return key ? ALIASES[key] : [];
}

/** True when every character of `query` appears in `text`, in order. */
function subsequence(text: string, query: string) {
  let index = 0;
  for (const character of text) {
    if (character === query[index]) {
      index += 1;
    }
  }
  return index === query.length;
}

/** Higher is a better match; 0 means the term does not match at all. */
function scoreTerm(text: string, query: string) {
  if (!text) {
    return 0;
  }
  if (text === query) {
    return 100;
  }
  if (text.startsWith(query)) {
    return 80;
  }
  // A word start beats a match buried mid-word: "list" should find "Bulleted list".
  if (text.split(/[\s-]+/).some((word) => word.startsWith(query))) {
    return 60;
  }
  if (text.includes(query)) {
    return 40;
  }
  return subsequence(text, query) ? 20 : 0;
}

export function scoreCommand(command: Matchable, query: string) {
  const label = command.label.toLowerCase();
  const terms = [
    scoreTerm(label, query),
    // A hint is a terse symbol, so it only counts on a solid match.
    Math.min(scoreTerm((command.hint ?? "").toLowerCase(), query), 80),
    ...aliasesFor(command).map((alias) =>
      Math.min(scoreTerm(alias, query), 70),
    ),
  ];
  return Math.max(...terms);
}

/**
 * Commands worth showing for `query`, best first. An empty query keeps the
 * original order, which is the authored one.
 */
export function matchCommands<T extends Matchable>(
  commands: T[],
  query: string,
) {
  const wanted = query.trim().toLowerCase();
  if (!wanted) {
    return commands;
  }
  return commands
    .map((command, index) => ({
      command,
      index,
      score: scoreCommand(command, wanted),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score === left.score
        ? left.index - right.index
        : right.score - left.score,
    )
    .map((entry) => entry.command);
}
