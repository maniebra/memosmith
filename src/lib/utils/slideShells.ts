import { listSlideShells } from "../tauri/files";

/** A Slide Shell: plain CSS styling the deck, from `.slide-shells/<name>.css`. */
export type SlideShell = { name: string; text: string };

/**
 * Imported shells plus the space's `.slide-shells/`; a space file shadows an
 * imported shell of the same name, since it is the one being edited.
 */
export async function loadSlideShells(
  root: string | null,
  imported: SlideShell[] = [],
) {
  const inSpace = root
    ? await listSlideShells(root).catch((): SlideShell[] => [])
    : [];
  const names = new Set(inSpace.map((shell) => shell.name));
  return [
    ...inSpace,
    ...imported.filter((shell) => !names.has(shell.name)),
  ];
}

/** File name without folders or `.css`, as the shell's name. */
export function slideShellName(path: string) {
  return (path.split(/[\\/]/).pop() ?? path).replace(/\.css$/i, "");
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
