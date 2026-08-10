const TABS_KEY = "memosmith:tabs";

export type TabState = {
  open: string[];
  pinned: string[];
  active: string | null;
};

const emptyTabs: TabState = { open: [], pinned: [], active: null };

const stringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];

export function loadTabs(): TabState {
  const raw = localStorage.getItem(TABS_KEY);
  if (!raw) {
    return { ...emptyTabs };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<TabState>;
    return {
      open: stringList(parsed.open),
      pinned: stringList(parsed.pinned),
      active: typeof parsed.active === "string" ? parsed.active : null,
    };
  } catch {
    return { ...emptyTabs };
  }
}

export function saveTabs(state: TabState) {
  localStorage.setItem(TABS_KEY, JSON.stringify(state));
}
