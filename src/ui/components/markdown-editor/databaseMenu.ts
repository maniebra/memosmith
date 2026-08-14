import type { ContextMenuItem } from "../ContextMenu.svelte";

export const DATABASE_SELECTOR = ".md-database-preview";
const PORTAL_CLASS = "md-database-portal";

/**
 * The live view is mounted in a layer of its own, so a right click lands on the
 * portal, not on the card the fence rendered. Everything the menu does — delete
 * above all — is done to that card, which is the one the note owns.
 */
export function databaseAnchorFor(
  target: HTMLElement,
  note: HTMLElement | null | undefined,
) {
  const card = target.closest?.(DATABASE_SELECTOR) as HTMLElement | null;

  if (!card) {
    return null;
  }

  if (!card.className.includes(PORTAL_CLASS)) {
    return card;
  }

  return (
    (note?.querySelector(
      `${DATABASE_SELECTOR}[data-code="${card.dataset.code}"]:not(.${PORTAL_CLASS})`,
    ) as HTMLElement | null) ?? null
  );
}

export function databaseMenuItems(
  anchor: HTMLElement,
  deps: {
    editable: boolean;
    label: (key: string) => string;
    icon: unknown;
    onDelete: (anchor: HTMLElement) => void;
  },
): ContextMenuItem[] {
  if (!deps.editable) {
    return [];
  }

  return [
    {
      label: deps.label("common.delete"),
      icon: deps.icon,
      danger: true,
      onSelect: () => deps.onDelete(anchor),
    },
  ];
}
