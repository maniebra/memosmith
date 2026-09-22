const DETACHED_TAB_PARAM = "detachedTab";

/** The launch URL identifies the single tab a child window should restore. */
export function detachedTabFromSearch(search: string) {
  const tab = new URLSearchParams(search).get(DETACHED_TAB_PARAM);
  return tab || null;
}

export function detachedTabUrl(tab: string) {
  return `/?${DETACHED_TAB_PARAM}=${encodeURIComponent(tab)}`;
}

/** Browser drag coordinates leave the viewport once a tab is pulled out. */
export function tabDroppedOutsideViewport(
  clientX: number,
  clientY: number,
  width: number,
  height: number,
) {
  return clientX < 0 || clientX >= width || clientY < 0 || clientY >= height;
}
