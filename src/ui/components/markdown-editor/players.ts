import type { Editor } from "./types";

/**
 * Embedded players (YouTube, Spotify) are iframes, and an iframe reloads
 * whenever it leaves the document, which every re-render of the note does.
 * The live iframe is parked in the editor's overlay layer instead, over a
 * placeholder of the same size that the note re-renders freely.
 */
type Player = { frame: HTMLIFrameElement; slot: HTMLElement };

const PLAYER_SELECTOR = "iframe.md-youtube, iframe.md-spotify";
const players = new WeakMap<Editor, Map<string, Player>>();
const slots = new WeakMap<Element, HTMLElement>();

/** The placeholder a parked player sits on, for events that land on the player. */
export function playerSlotFor(target: Element) {
  const frame = target.closest?.(".md-player-portal");

  return frame ? (slots.get(frame) ?? null) : null;
}

export function paintPlayers(e: Editor) {
  const layer = e.databaseLayer;
  const current = players.get(e) ?? new Map<string, Player>();
  const next = new Map<string, Player>();
  const seen = new Map<string, number>();

  players.set(e, next);

  for (const node of Array.from(
    e.element?.querySelectorAll(PLAYER_SELECTOR) ?? [],
  )) {
    const rendered = node as HTMLIFrameElement;
    const count = seen.get(rendered.src) ?? 0;
    const key = `${rendered.src}#${count}`;
    const slot = document.createElement("span");

    seen.set(rendered.src, count + 1);
    // Same classes and inline width, so the placeholder takes the player's box.
    slot.className = `${rendered.className} md-player-slot`;
    slot.setAttribute("style", rendered.getAttribute("style") ?? "");
    rendered.replaceWith(slot);

    let player = current.get(key);

    if (player) {
      current.delete(key);
    } else if (layer) {
      rendered.classList.add("md-player-portal");
      layer.append(rendered);
      player = { frame: rendered, slot };
    } else {
      continue;
    }

    player.frame.title = rendered.title;
    player.slot = slot;
    slots.set(player.frame, slot);
    next.set(key, player);
  }

  for (const stale of current.values()) {
    stale.frame.remove();
  }

  layoutPlayers(e);
}

export function layoutPlayers(e: Editor) {
  const layer = e.databaseLayer;

  if (!layer) {
    return;
  }

  const box = layer.getBoundingClientRect();

  for (const { frame, slot } of players.get(e)?.values() ?? []) {
    const rect = slot.getBoundingClientRect();
    const style = frame.style;

    // A collapsed or hidden block has no box; the player hides with it.
    style.display = rect.width ? "" : "none";
    style.left = `${rect.left - box.left}px`;
    style.top = `${rect.top - box.top}px`;
    style.width = `${rect.width}px`;
    style.height = `${rect.height}px`;
  }
}

export function disposePlayers(e: Editor) {
  for (const { frame } of players.get(e)?.values() ?? []) {
    frame.remove();
  }

  players.delete(e);
}
