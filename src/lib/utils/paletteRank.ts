/** Command palette matching: subsequence search with a VS Code style score. */

const SEPARATORS = new Set([" ", "/", "-", "_", ".", ":"]);

/**
 * Score `needle` against `label`, or `null` when the letters are missing.
 *
 * Matches earlier, at word starts, and in unbroken runs score higher, so
 * "todo" ranks "Todo" over "To-do items of the day".
 */
export function scorePaletteMatch(label: string, needle: string) {
  const haystack = label.toLowerCase();
  const query = needle.toLowerCase();
  let at = 0;
  let score = 0;
  let previous = -2;

  for (const character of query) {
    const found = haystack.indexOf(character, at);

    if (found < 0) {
      return null;
    }
    score += 1;
    if (found === 0) {
      score += 10;
    } else if (SEPARATORS.has(haystack[found - 1])) {
      score += 6;
    }
    if (found === previous + 1) {
      score += 8;
    }
    previous = found;
    at = found + 1;
  }

  // Shorter labels win ties: less text around the same match.
  return score - label.length * 0.01;
}

export function paletteMatches(label: string, needle: string) {
  return scorePaletteMatch(label, needle) !== null;
}

/**
 * Rank `items` for `needle`, most recently used first among equal matches.
 * An empty needle keeps the source order but floats recent picks to the top.
 */
export function rankPaletteItems<T extends { id: string; label: string }>(
  items: T[],
  needle: string,
  recent: string[] = [],
): T[] {
  const recencyBonus = (id: string) => {
    const position = recent.indexOf(id);
    return position < 0 ? 0 : 20 - Math.min(position, 19);
  };
  const scored = items.map((item, order) => ({
    item,
    order,
    score: needle ? scorePaletteMatch(item.label, needle) : 0,
  }));

  return scored
    .filter((entry) => entry.score !== null)
    .sort(
      (left, right) =>
        (right.score as number) +
        recencyBonus(right.item.id) -
        ((left.score as number) + recencyBonus(left.item.id)) ||
        left.order - right.order,
    )
    .map((entry) => entry.item);
}

/**
 * Scroll the block for source `line` into view. Editable blocks map
 * one-to-one to source lines; preview cards are rendered output.
 */
export function scrollToSourceLine(
  editor: HTMLElement | undefined,
  line: number,
) {
  const blocks = Array.from(editor?.children ?? []).filter(
    (block) => !block.classList.contains("md-preview"),
  );

  blocks[line]?.scrollIntoView({ block: "center", behavior: "smooth" });
}
