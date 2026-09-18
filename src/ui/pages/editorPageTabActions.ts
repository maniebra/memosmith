import { cycleTab, moveTab, syncTabs } from "./editorPageUtils";

/** A tab id is a note's relative path, or `db:<id>` for a database. */
export type TabsState = {
  openTabs: string[];
  pinnedTabs: string[];
  readonly activeTab: string | null;
  readonly spaceNotes: string[];
  readonly databases: { id: string }[];
};

export type TabsDeps = {
  /** Opens the note or database a tab points at. */
  select: (id: string) => Promise<void>;
  /** Leaves the editor with no note open, after the last tab closes. */
  clearActive: () => void;
  flushNoteSave: () => Promise<void>;
  runWithStatus: (action: () => Promise<void>) => Promise<void>;
};

function tabExists(state: TabsState, id: string) {
  return id.startsWith("db:")
    ? state.databases.some((entry) => `db:${entry.id}` === id)
    : state.spaceNotes.includes(id);
}

/** Closing the active tab falls through to its neighbour, or to no note. */
async function closeTab(
  state: TabsState,
  deps: TabsDeps,
  closingTabs: Set<string>,
  id: string,
) {
  await deps.flushNoteSave();
  const index = state.openTabs.indexOf(id);
  const remaining = state.openTabs.filter((tab) => tab !== id);
  if (id !== state.activeTab) {
    state.openTabs = remaining;
    return;
  }
  const next = remaining[index] ?? remaining[index - 1];
  if (next) {
    closingTabs.add(id);
    state.openTabs = remaining;
    try {
      await deps.runWithStatus(async () => {
        await deps.select(next);
        state.openTabs = remaining;
      });
    } finally {
      if (state.activeTab !== id) {
        closingTabs.delete(id);
      }
    }
    return;
  }
  state.openTabs = remaining;
  deps.clearActive();
}

function togglePinned(pinned: string[], id: string) {
  return pinned.includes(id)
    ? pinned.filter((tab) => tab !== id)
    : [...pinned, id];
}

export function createTabActions(state: TabsState, deps: TabsDeps) {
  const closingTabs = new Set<string>();
  const openTab = (id: string) => {
    closingTabs.delete(id);
    return deps.runWithStatus(() => deps.select(id));
  };

  /** Recomputed whenever the active tab, the space, or pinning changes. */
  const sync = (
    activeTab: string | null,
    notes: string[],
    databases: { id: string }[],
    pinned: string[],
  ) =>
    syncTabs(
      state.openTabs,
      activeTab,
      notes,
      databases,
      pinned,
      [...closingTabs],
    );

  return {
    openTab,
    togglePinTab: (id: string) => {
      state.pinnedTabs = togglePinned(state.pinnedTabs, id);

      return sync(
        state.activeTab,
        state.spaceNotes,
        state.databases,
        state.pinnedTabs,
      );
    },
    closeTab: (id: string) => closeTab(state, deps, closingTabs, id),
    sync,
    reorderTabs: (id: string, target: string) =>
      moveTab(state.openTabs, id, target, state.pinnedTabs),
    cycleTabs(step: number) {
      const next = cycleTab(state.openTabs, state.activeTab, step);
      if (next) {
        openTab(next);
      }
    },
    /** Reopens the tab that was active last run, once the space has loaded. */
    async restoreTab(id: string | null) {
      if (id && tabExists(state, id)) {
        await deps.select(id);
      }
    },
  };
}
