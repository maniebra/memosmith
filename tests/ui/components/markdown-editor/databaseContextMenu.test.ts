const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};

import {
  databaseAnchorFor,
  databaseMenuItems,
} from "../../../../src/ui/components/markdown-editor/databaseMenu";

/** The card in the note; the live view is a portal parked over it. */
const anchor = {
  dataset: { code: "c1" },
  className: "md-database-preview",
} as unknown as HTMLElement;

function target(className: string) {
  const element = {
    className,
    dataset: { code: "c1" },
    closest: (selector: string) =>
      selector.includes("md-database-preview") ? element : null,
  };

  return element as unknown as HTMLElement;
}

const note = {
  querySelector: (selector: string) =>
    selector.includes('"c1"') && selector.includes(":not(.md-database-portal)")
      ? anchor
      : null,
} as unknown as HTMLElement;

// A right click lands on the portal, which lives outside the note's own DOM.
assert(
  databaseAnchorFor(target("md-database-preview md-database-portal"), note) ===
    anchor,
  "a portal resolves to the card it is parked over",
);
assert(
  databaseAnchorFor(target("md-database-preview"), note) !== null,
  "a card resolves to itself",
);
assert(
  databaseAnchorFor({ closest: () => null } as unknown as HTMLElement, note) ===
    null,
  "anything else is not a database view",
);

let deleted: HTMLElement | null = null;

const items = databaseMenuItems(anchor, {
  editable: true,
  label: (key: string) => key,
  icon: null,
  onDelete: (preview) => {
    deleted = preview;
  },
});

const remove = items.find(
  (item) => !item.separator && item.label === "common.delete",
);

assert(Boolean(remove), "a database view offers delete");

void (remove as { onSelect: () => void }).onSelect();

assert(deleted === anchor, "delete removes the embed from the note");
assert(
  databaseMenuItems(anchor, {
    editable: false,
    label: (key: string) => key,
    icon: null,
    onDelete: () => {},
  }).length === 0,
  "a read-only note offers nothing to delete",
);

console.log("database context menu ok");
