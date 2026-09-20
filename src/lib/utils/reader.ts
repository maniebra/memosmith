/** Shared reader vocabulary: where something sits inside a book. */
export type ReaderLocation = string;

export type OutlineItem = {
  label: string;
  location: ReaderLocation;
  depth: number;
};

export type SearchHit = {
  label: string;
  excerpt: string;
  location: ReaderLocation;
};

/** Every text node under `root`, in document order, with the text they form. */
function textNodes(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let text = "";

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node as Text);
    text += node.nodeValue ?? "";
  }

  return { nodes, text };
}

/** Turns an offset into the concatenated text back into a node and offset. */
function nodeAt(nodes: Text[], offset: number) {
  let remaining = offset;

  for (const node of nodes) {
    const length = node.nodeValue?.length ?? 0;

    if (remaining <= length) {
      return { node, offset: remaining };
    }

    remaining -= length;
  }

  const last = nodes[nodes.length - 1];

  return { node: last, offset: last?.nodeValue?.length ?? 0 };
}

/** The text without its spaces, and where each kept character came from. */
function compact(text: string) {
  const kept: string[] = [];
  const index: number[] = [];

  for (let at = 0; at < text.length; at++) {
    if (!/\s/.test(text[at])) {
      kept.push(text[at]);
      index.push(at);
    }
  }

  return { text: kept.join("").toLowerCase(), index };
}

/**
 * Where `quote` sits in `text`, as `[start, end]` pairs, ignoring whitespace on
 * both sides: a PDF text layer breaks its lines with `<br>` and drops the
 * spaces a selection reports, so the quote a reader highlighted rarely matches
 * the page's own text character for character.
 */
export function quoteMatches(text: string, quote: string) {
  const haystack = compact(text);
  const needle = compact(quote);
  const spans: [number, number][] = [];

  if (!needle.text) {
    return spans;
  }

  for (
    let at = haystack.text.indexOf(needle.text);
    at !== -1;
    at = haystack.text.indexOf(needle.text, at + needle.text.length)
  ) {
    spans.push([
      haystack.index[at],
      haystack.index[at + needle.text.length - 1] + 1,
    ]);
  }

  return spans;
}

/**
 * Ranges covering every occurrence of `quote` under `root`, even when the text
 * is split across spans, as a PDF text layer splits it.
 */
export function quoteRanges(root: HTMLElement, quote: string): Range[] {
  const { nodes, text } = textNodes(root);

  return quoteMatches(text, quote).map(([from, to]) => {
    const start = nodeAt(nodes, from);
    const end = nodeAt(nodes, to);
    const range = document.createRange();

    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    return range;
  });
}

/**
 * Paints ranges with the CSS Custom Highlight API, which needs no DOM surgery
 * on the text layer. Browsers without it simply show no tint.
 */
export function paintRanges(name: string, ranges: Range[]) {
  const registry = (CSS as unknown as { highlights?: Map<string, unknown> })
    .highlights;
  const Highlight = (globalThis as unknown as {
    Highlight?: new (...ranges: Range[]) => unknown;
  }).Highlight;

  if (!registry || !Highlight) {
    return;
  }

  if (ranges.length) {
    registry.set(name, new Highlight(...ranges));
  } else {
    registry.delete(name);
  }
}
