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

/**
 * Ranges covering every case-insensitive occurrence of `quote` under `root`,
 * even when the text is split across spans, as a PDF text layer splits it.
 */
export function quoteRanges(root: HTMLElement, quote: string): Range[] {
  const needle = quote.trim().toLowerCase();

  if (!needle) {
    return [];
  }

  const { nodes, text } = textNodes(root);
  const haystack = text.toLowerCase();
  const ranges: Range[] = [];

  for (
    let at = haystack.indexOf(needle);
    at !== -1;
    at = haystack.indexOf(needle, at + needle.length)
  ) {
    const start = nodeAt(nodes, at);
    const end = nodeAt(nodes, at + needle.length);
    const range = document.createRange();

    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    ranges.push(range);
  }

  return ranges;
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
