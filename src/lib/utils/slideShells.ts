import { listSlideShells } from "../tauri/files";

/** A Slide Shell: plain CSS styling the deck, from `.slide-shells/<name>.css`. */
export type SlideShell = { name: string; text: string };

/** Every Slide Shell in the space; none without a space or on a read error. */
export async function loadSlideShells(root: string | null) {
  return root ? listSlideShells(root).catch((): SlideShell[] => []) : [];
}

/**
 * Applies `css` as the active Slide Shell until the returned function runs.
 * It is unlayered, so it wins over the core and built-in shell layers.
 */
export function mountSlideShell(css: string) {
  const style = document.head.appendChild(document.createElement("style"));
  style.dataset.slideShell = "";
  style.textContent = css;
  return () => style.remove();
}
