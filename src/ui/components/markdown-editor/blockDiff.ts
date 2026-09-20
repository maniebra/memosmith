/**
 * Which already-rendered block each new block can reuse: an index into the old
 * list, or -1 for a block that has to be built. Identical blocks are matched in
 * order, so a block that only moved keeps its node (and its painted contents).
 */
export function reusePlan(old: string[], next: string[]) {
  const pool = new Map<string, number[]>();

  old.forEach((html, index) => {
    const bucket = pool.get(html);

    if (bucket) {
      bucket.push(index);
    } else {
      pool.set(html, [index]);
    }
  });

  return next.map((html) => pool.get(html)?.shift() ?? -1);
}

/**
 * The block's markup with its text taken out. Two blocks with the same skeleton
 * differ only in characters the browser has already typed into the live node,
 * so that node is left exactly as it is: no rebuild, no caret to restore, no
 * scroll to put back. Markdown that changes the markup (`#`, `**`, `[[`) does
 * change the skeleton, and renders.
 */
export function skeleton(html: string) {
  return html.replace(/>[^<]*</g, "><");
}

/**
 * Blocks are a flat list, so only the blocks that actually changed are built:
 * replacing the whole document reloads every image and embed in it, which is
 * the flash you see while typing.
 *
 * The comparison is against the HTML last rendered, not the live DOM, because
 * the paint passes (players, diagrams, drawings) mutate the nodes afterwards.
 */
export function paintBlocks(
  renderedBlocks: string[],
  html: string,
  element: HTMLElement,
) {
  const holder = document.createElement("div");

  holder.innerHTML = html;

  const fresh = Array.from(holder.children) as HTMLElement[];
  const freshHtml = fresh.map((node) => node.outerHTML);
  const old = Array.from(element.children) as HTMLElement[];

  if (old.length !== renderedBlocks.length) {
    element.innerHTML = html;

    return { blocks: freshHtml, changed: true };
  }

  const textOnly = old.length === fresh.length;

  const plan = reusePlan(renderedBlocks, freshHtml);
  // A node another position already claimed is not free to keep in place.
  const claimed = new Set(plan);
  const kept = new Set<HTMLElement>();
  let changed = false;
  let cursor: ChildNode | null = element.firstChild;

  plan.forEach((index, position) => {
    const live =
      index === -1 &&
      textOnly &&
      !claimed.has(position) &&
      skeleton(renderedBlocks[position]) === skeleton(freshHtml[position])
        ? old[position]
        : null;
    const node = live ?? (index === -1 ? fresh[position] : old[index]);

    if (index !== -1 || live) {
      kept.add(node);
    } else {
      changed = true;
    }

    if (node === cursor) {
      cursor = cursor.nextSibling;

      return;
    }

    element.insertBefore(node, cursor);
    changed = true;
  });

  for (const node of old) {
    if (!kept.has(node)) {
      node.remove();
      changed = true;
    }
  }

  return { blocks: freshHtml, changed };
}
