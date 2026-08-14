/** A live database view parked over the card the note keeps space for. */
export type PortalBox = { card: HTMLElement; host: HTMLElement };

/**
 * Cards keep the space their live views need, then the views move onto them.
 * Two passes, because one would read a card's position before a card above it
 * had grown — and the views would overlap. Entry order is not document order.
 */
export function layoutPortals(entries: PortalBox[], layer: HTMLElement) {
  for (const entry of entries) {
    entry.host.style.width = `${entry.card.getBoundingClientRect().width}px`;

    const height = entry.host.getBoundingClientRect().height;

    if (height > 0) {
      // The card knows its real height now, so the placeholder floor that kept
      // the space before the view mounted must not pad it out any more.
      entry.card.style.height = `${height}px`;
      entry.card.style.minHeight = "0px";
    }
  }

  const box = layer.getBoundingClientRect();

  for (const entry of entries) {
    const card = entry.card.getBoundingClientRect();

    entry.host.style.left = `${card.left - box.left}px`;
    entry.host.style.top = `${card.top - box.top}px`;
  }
}
