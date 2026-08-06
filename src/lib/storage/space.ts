const SPACE_KEY = "memosmith:space";

export function loadSpaceRoot() {
  return localStorage.getItem(SPACE_KEY);
}

export function saveSpaceRoot(root: string | null) {
  if (root) {
    localStorage.setItem(SPACE_KEY, root);
  } else {
    localStorage.removeItem(SPACE_KEY);
  }
}
