const DRAFT_KEY = "tauri-svelte-ui-template:draft";
const DRAFT_PATH_KEY = "tauri-svelte-ui-template:path";

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
