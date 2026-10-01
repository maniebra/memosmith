import { indentWidth } from "../../../lib/utils/markdown";
import type { Editor } from "./types";

/**
 * Folded list items, per editor, keyed by the item's own text.
 * ponytail: two items with identical text fold together; key by position if
 * that ever bites.
 */
const foldedItems = new WeakMap<Editor, Set<string>>();

function folded(e: Editor) {
  let set = foldedItems.get(e);

  if (!set) {
    set = new Set();
    foldedItems.set(e, set);
  }

  return set;
}

/**
 * Marks items that have children as foldable and hides the children of folded
 * ones. Only classes change, so the source text and caret offsets are
 * untouched.
 */
export function paintListFolds(e: Editor) {
  const blocks = Array.from(
    e.element?.querySelectorAll<HTMLElement>(".md-block[data-list]") ?? [],
  );
  const widths = blocks.map((block) => indentWidth(e.sourceText(block)));
  const keys = folded(e);
  let hideDeeperThan = Infinity;

  blocks.forEach((block, index) => {
    const width = widths[index];
    const next = blocks[index + 1];
    const parent =
      next?.dataset.list === block.dataset.list && widths[index + 1] > width;
    const key = e.sourceText(block).trim();

    if (width <= hideDeeperThan) {
      hideDeeperThan = Infinity;
    }

    block.classList.toggle("md-fold-hidden", width > hideDeeperThan);
    block.toggleAttribute("data-foldable", parent);
    block.toggleAttribute("data-folded", parent && keys.has(key));

    if (parent && keys.has(key) && hideDeeperThan === Infinity) {
      hideDeeperThan = width;
    }
  });
}

/** The fold arrow sits in the 1rem just left of the bullet. */
export function toggleFoldAt(e: Editor, event: PointerEvent, handle: Element) {
  const block = handle.closest?.(
    ".md-block[data-foldable]",
  ) as HTMLElement | null;

  if (!block) {
    return false;
  }

  const style = getComputedStyle(block);
  const pad = parseFloat(style.paddingLeft);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const x = event.clientX - block.getBoundingClientRect().left;

  if (x < pad - rem || x >= pad) {
    return false;
  }

  event.preventDefault();
  const keys = folded(e);
  const key = e.sourceText(block).trim();

  if (!keys.delete(key)) {
    keys.add(key);
  }
  paintListFolds(e);

  return true;
}
