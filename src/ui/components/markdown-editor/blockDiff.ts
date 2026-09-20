/**
 * The run of blocks that has to be rebuilt: everything between a matching head
 * and a matching tail. Blocks are only ever matched at their own position —
 * matching equal HTML across positions reuses the wrong node and leaves a ghost
 * copy of a block behind.
 */
export function changedSpan(old: string[], next: string[]) {
  const limit = Math.min(old.length, next.length);
  let head = 0;

  while (head < limit && old[head] === next[head]) {
    head++;
  }

  let tail = 0;

  while (
    tail < limit - head &&
    old[old.length - 1 - tail] === next[next.length - 1 - tail]
  ) {
    tail++;
  }

  return { head, tail };
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

/** Same block count: every block is patched where it stands. */
function patchInPlace(
  renderedBlocks: string[],
  freshHtml: string[],
  fresh: HTMLElement[],
  old: HTMLElement[],
) {
  let changed = false;

  freshHtml.forEach((html, index) => {
    if (
      html === renderedBlocks[index] ||
      skeleton(html) === skeleton(renderedBlocks[index])
    ) {
      return;
    }

    old[index].replaceWith(fresh[index]);
    changed = true;
  });

  return changed;
}

/** Blocks were added or removed: the changed run is swapped in one go. */
function swapSpan(
  renderedBlocks: string[],
  freshHtml: string[],
  fresh: HTMLElement[],
  old: HTMLElement[],
  element: HTMLElement,
) {
  const { head, tail } = changedSpan(renderedBlocks, freshHtml);
  const anchor = old[old.length - tail] ?? null;
  const fragment = document.createDocumentFragment();

  for (const node of old.slice(head, old.length - tail)) {
    node.remove();
  }

  for (const node of fresh.slice(head, fresh.length - tail)) {
    fragment.append(node);
  }

  element.insertBefore(fragment, anchor);
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

  if (old.length === fresh.length) {
    return {
      blocks: freshHtml,
      changed: patchInPlace(renderedBlocks, freshHtml, fresh, old),
    };
  }

  swapSpan(renderedBlocks, freshHtml, fresh, old, element);

  return { blocks: freshHtml, changed: true };
}
