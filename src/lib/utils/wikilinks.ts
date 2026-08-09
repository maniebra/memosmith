import {
  displayNoteName,
  displayNotePath,
  stripNoteExtension,
  withNoteExtension,
} from "./path";

export type Wikilink = {
  raw: string;
  target: string;
  heading?: string;
  alias?: string;
  label: string;
};

export type WikilinkResolution = {
  path: string | null;
  exists: boolean;
};

export type Backlink = {
  path: string;
  title: string;
  matches: { line: number; snippet: string }[];
};

const WIKILINK = /\[\[([^\]\n]+)\]\]/g;

function normalizedPath(path: string) {
  return path
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/")
    .trim();
}

function currentDir(currentNote: string | null) {
  return currentNote?.includes("/")
    ? currentNote.slice(0, currentNote.lastIndexOf("/"))
    : "";
}

function splitTarget(rawTarget: string) {
  const hashIndex = rawTarget.indexOf("#");

  return hashIndex === -1
    ? { target: rawTarget.trim() }
    : {
        target: rawTarget.slice(0, hashIndex).trim(),
        heading: rawTarget.slice(hashIndex + 1).trim() || undefined,
      };
}

export function parseWikilink(raw: string): Wikilink {
  const [targetPart, ...aliasParts] = raw.split("|");
  const alias = aliasParts.join("|").trim() || undefined;
  const { target, heading } = splitTarget(targetPart);
  const targetLabel = target
    ? stripNoteExtension(target.split("/").pop() ?? target)
    : heading;

  return {
    raw,
    target: normalizedPath(target),
    heading,
    alias,
    label: alias ?? targetLabel ?? raw,
  };
}

export function parseWikilinks(text: string): Wikilink[] {
  const links: Wikilink[] = [];

  for (const match of text.matchAll(WIKILINK)) {
    if (match.index !== undefined && text[match.index - 1] === "!") {
      continue;
    }

    links.push(parseWikilink(match[1]));
  }

  return links;
}

function hasUnsafePathSegment(path: string) {
  return path
    .split("/")
    .some((segment) => !segment || segment === "." || segment === "..");
}

export function wikilinkCreatePath(
  rawTarget: string,
  currentNote: string | null,
) {
  const link = parseWikilink(rawTarget);

  if (!link.target) {
    return currentNote;
  }

  const targetPath = link.target.includes("/")
    ? link.target
    : [currentDir(currentNote), link.target].filter(Boolean).join("/");

  return hasUnsafePathSegment(targetPath)
    ? null
    : withNoteExtension(targetPath);
}

export function resolveWikilinkTarget(
  rawTarget: string,
  notes: string[],
  currentNote: string | null = null,
): WikilinkResolution {
  const link = parseWikilink(rawTarget);

  if (!link.target) {
    return { path: currentNote, exists: Boolean(currentNote) };
  }

  const target = link.target.toLowerCase();
  const noteByPath = new Map(notes.map((note) => [note.toLowerCase(), note]));
  const sameDirPath = [currentDir(currentNote), withNoteExtension(link.target)]
    .filter(Boolean)
    .join("/");
  const directCandidates = link.target.includes("/")
    ? [link.target, withNoteExtension(link.target)]
    : [sameDirPath, link.target, withNoteExtension(link.target)];

  for (const candidate of directCandidates) {
    const match = noteByPath.get(candidate.toLowerCase());

    if (match) {
      return { path: match, exists: true };
    }
  }

  const displayMatch = notes.find(
    (note) => displayNotePath(note).toLowerCase() === target,
  );

  if (displayMatch) {
    return { path: displayMatch, exists: true };
  }

  if (!link.target.includes("/")) {
    const nameMatches = notes.filter(
      (note) => displayNoteName(note).toLowerCase() === target,
    );

    if (nameMatches.length) {
      const sameFolderMatch = nameMatches.find(
        (note) => currentDir(note) === currentDir(currentNote),
      );

      return { path: sameFolderMatch ?? nameMatches[0], exists: true };
    }
  }

  return { path: null, exists: false };
}

function lineSnippet(line: string) {
  const snippet = line.trim().replace(/\s+/g, " ");

  return snippet.length > 180 ? `${snippet.slice(0, 177)}...` : snippet;
}

export function backlinksForNote(
  activeNote: string | null,
  notes: string[],
  contentsByPath: Record<string, string>,
): Backlink[] {
  if (!activeNote) {
    return [];
  }

  return notes
    .filter((note) => note !== activeNote)
    .map((note) => {
      const matches = (contentsByPath[note] ?? "")
        .split("\n")
        .map((line, index) => ({
          line: index + 1,
          snippet: lineSnippet(line),
          linksHere: parseWikilinks(line).some(
            (link) =>
              resolveWikilinkTarget(link.raw, notes, note).path === activeNote,
          ),
        }))
        .filter((match) => match.linksHere && match.snippet)
        .map(({ line, snippet }) => ({ line, snippet }));

      return {
        path: note,
        title: displayNotePath(note),
        matches,
      };
    })
    .filter((backlink) => backlink.matches.length > 0);
}
