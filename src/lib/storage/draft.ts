const DRAFT_KEY = "memosmith:draft";
const DRAFT_PATH_KEY = "memosmith:path";
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

export type Draft = {
  contents: string;
  path: string | null;
};

export function loadDraft(): Draft {
  return {
    contents: localStorage.getItem(DRAFT_KEY) || "",
    path: localStorage.getItem(DRAFT_PATH_KEY),
  };
}

export function saveDraft(draft: Draft) {
  localStorage.setItem(DRAFT_KEY, draft.contents);

  if (draft.path) {
    localStorage.setItem(DRAFT_PATH_KEY, draft.path);
  } else {
    localStorage.removeItem(DRAFT_PATH_KEY);
  }
}
