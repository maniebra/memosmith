import { kernelFor } from "./runner";

export type Completion = {
  label: string;
  detail: string;
  insert: string;
  filter: string;
};

/** The fenced block holding an offset: its source is the whole document a language server sees. */
export type FenceContext = {
  language: string;
  code: string;
  line: number;
  character: number;
};

const FENCE = /^[ \t]*```(.*)$/;

export function fenceContext(value: string, offset: number): FenceContext | null {
  const before = value.slice(0, offset);
  const lines = value.split("\n");
  const lineIndex = before.split("\n").length - 1;
  const character = offset - (before.lastIndexOf("\n") + 1);

  let open: number | null = null;
  let language = "";

  for (let index = 0; index < lines.length; index++) {
    const fence = FENCE.exec(lines[index]);

    if (!fence) {
      continue;
    }

    if (open === null) {
      open = index;
      language = fence[1].trim().toLowerCase();
      continue;
    }

    if (open < lineIndex && lineIndex < index) {
      return {
        language,
        code: lines.slice(open + 1, index).join("\n"),
        line: lineIndex - open - 1,
        character,
      };
    }

    open = null;
    language = "";
  }

  // A fence still being typed has no closing line yet, and its caret still deserves completions.
  if (open !== null && open < lineIndex) {
    return {
      language,
      code: lines.slice(open + 1).join("\n"),
      line: lineIndex - open - 1,
      character,
    };
  }

  return null;
}

export function hasLanguageServer(language: string) {
  return kernelFor(language) !== null;
}

/** The word being typed, which is what a picked completion replaces. */
export function wordPrefix(line: string, character: number) {
  return /[A-Za-z_$][\w$]*$/.exec(line.slice(0, character))?.[0] ?? "";
}

/** Completions are asked for on a word or right after a member access, not on every keystroke. */
export function shouldComplete(line: string, character: number) {
  const before = line.slice(0, character);

  return Boolean(wordPrefix(line, character)) || /[.:>]$/.test(before);
}

export function rankCompletions(items: Completion[], prefix: string, limit = 40) {
  if (!prefix) {
    return items.slice(0, limit);
  }

  const query = prefix.toLowerCase();
  const matching = items.filter((item) =>
    (item.filter || item.label).toLowerCase().includes(query),
  );

  return matching
    .sort((left, right) => {
      const leftFirst = (left.filter || left.label).toLowerCase().startsWith(query) ? 0 : 1;
      const rightFirst = (right.filter || right.label).toLowerCase().startsWith(query) ? 0 : 1;

      return leftFirst - rightFirst;
    })
    .slice(0, limit);
}
