const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import { layoutPortals } from "../../../../src/ui/components/markdown-editor/databaseLayout";

/**
 * A stack of cards in one column: a card's top is what the cards above it take,
 * and a card takes what its own live view needs once it has been sized.
 */
const CONTENT = [200, 150];
const UNSIZED = 40;
const FIRST_TOP = 100;

function stack() {
  const heights = CONTENT.map(() => UNSIZED);
  const hosts = CONTENT.map(() => ({
    style: {} as Record<string, string>,
    getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
  }));

  const entries = CONTENT.map((content, index) => {
    const card = {
      style: {
        set height(value: string) {
          heights[index] = Number.parseFloat(value);
        },
        get height() {
          return `${heights[index]}px`;
        },
      },
      getBoundingClientRect: () => ({
        width: 600,
        height: heights[index],
        left: 0,
        top: FIRST_TOP + heights.slice(0, index).reduce((a, b) => a + b, 0),
      }),
    };

    hosts[index].getBoundingClientRect = () => ({
      width: 600,
      height: content,
      left: 0,
      top: 0,
    });

    return { card, host: hosts[index] };
  });

  return { entries, hosts, heights };
}

const layer = {
  getBoundingClientRect: () => ({ top: 0, left: 0, width: 800, height: 0 }),
};

// Mounted bottom-first: an embed added above an existing one lands here.
const reversed = stack();

layoutPortals([...reversed.entries].reverse() as never, layer as never);

const tops = reversed.hosts.map((host) => Number.parseFloat(host.style.top));

assert(
  reversed.heights[0] === CONTENT[0] && reversed.heights[1] === CONTENT[1],
  "each card is grown to the height of its view",
);
assert(tops[0] === FIRST_TOP, "the first view sits on its card");
assert(
  tops[1] === FIRST_TOP + CONTENT[0],
  "the second view sits below the first, not over it",
);
assert(
  tops[1] >= tops[0] + CONTENT[0],
  "views mounted out of document order do not overlap",
);

// Document order must land in exactly the same place.
const ordered = stack();

layoutPortals(ordered.entries as never, layer as never);

assert(
  ordered.hosts.map((host) => host.style.top).join() ===
    tops.join("px,") + "px",
  "layout does not depend on the order the views were mounted",
);

console.log("database layout ok");
