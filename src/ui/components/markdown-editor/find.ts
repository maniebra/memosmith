import type { Editor } from "./types";

export type FindState = {
  replaceMode: boolean;
  query: string;
  replacement: string;
  matches: { start: number; end: number }[];
  index: number;
};

export type FindApi = {
  openFind: (replaceMode: boolean) => void;
  closeFind: () => void;
  setFindQuery: (query: string) => void;
  setFindReplacement: (replacement: string) => void;
  gotoMatch: (delta: number) => void;
  replaceCurrent: () => void;
  replaceAll: () => void;
};

/** Plain case-insensitive matches over the note's source text. */
function findMatches(value: string, query: string) {
  if (!query) {
    return [];
  }

  const haystack = value.toLowerCase();
  const needle = query.toLowerCase();
  const matches: { start: number; end: number }[] = [];

  for (
    let at = haystack.indexOf(needle);
    at !== -1;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    matches.push({ start: at, end: at + needle.length });
  }

  return matches;
}

/** Every write replaces the state object, so the component re-renders. */
function write(e: Editor, next: Partial<FindState>) {
  const find = e.ui.find;

  if (!find) {
    return null;
  }

  const merged = { ...find, ...next };

  e.ui.find = merged;
  return merged;
}

function reveal(e: Editor, match: { start: number; end: number } | undefined) {
  if (!match) {
    return;
  }

  e.element?.focus({ preventScroll: true });
  e.selectRange(match.start, match.end);
  e.blockAtOffset(match.start)?.scrollIntoView({
    block: "nearest",
    behavior: "smooth",
  });
}

function rescan(e: Editor, query: string, index = 0) {
  const matches = findMatches(e.value, query);

  return write(e, {
    query,
    matches,
    index: matches.length ? Math.min(index, matches.length - 1) : 0,
  });
}

/** A single-line selection is what the user most likely wants to search for. */
function initialQuery(e: Editor) {
  const selection = e.selectionOffsets();
  const selected =
    selection && selection.end > selection.start
      ? e.value.slice(selection.start, selection.end)
      : "";

  return (selected.includes("\n") ? "" : selected) || (e.ui.find?.query ?? "");
}

function openFind(e: Editor, replaceMode: boolean) {
  const query = initialQuery(e);

  e.ui.find = {
    replaceMode,
    query,
    replacement: e.ui.find?.replacement ?? "",
    matches: findMatches(e.value, query),
    index: 0,
  };
  e.closeMenu();
  e.closeCompletions();
}

/** Steps through the matches, wrapping around at either end. */
function gotoMatch(e: Editor, delta: number) {
  const find = e.ui.find;

  if (!find?.matches.length) {
    return;
  }

  const count = find.matches.length;
  const index = (((find.index + delta) % count) + count) % count;

  write(e, { index });
  reveal(e, find.matches[index]);
}

function replaceCurrent(e: Editor) {
  const find = e.ui.find;
  const match = find?.matches[find.index];

  if (!find || !match || !e.props.editable) {
    return;
  }

  e.replace(match.start, match.end, find.replacement);

  const next = rescan(e, find.query, find.index);

  reveal(e, next?.matches[next.index]);
}

function replaceAll(e: Editor) {
  const find = e.ui.find;

  if (!find?.matches.length || !e.props.editable) {
    return;
  }

  let next = "";
  let at = 0;

  for (const match of find.matches) {
    next += e.value.slice(at, match.start) + find.replacement;
    at = match.end;
  }

  e.replace(0, e.value.length, next + e.value.slice(at), 0);
  rescan(e, find.query);
}

export function createFind(e: Editor): FindApi {
  return {
    openFind: (replaceMode) => openFind(e, replaceMode),
    closeFind: () => {
      e.ui.find = null;
    },
    setFindQuery: (query) => {
      rescan(e, query);
    },
    setFindReplacement: (replacement) => {
      write(e, { replacement });
    },
    gotoMatch: (delta) => gotoMatch(e, delta),
    replaceCurrent: () => replaceCurrent(e),
    replaceAll: () => replaceAll(e),
  };
}
