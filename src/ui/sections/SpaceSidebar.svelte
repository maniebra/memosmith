<script lang="ts">
import { FolderOpen, FolderPlus, Plus, RotateCcw, Search } from "@lucide/svelte";
import { basename } from "../../lib/utils/path";
import { buildTree } from "../../lib/utils/tree";
import type { TreeNode } from "../../lib/utils/tree";
import { searchNotes } from "../../lib/tauri/files";
import Input from "../components/Input.svelte";
import ContextMenu, {
    type ContextMenuItem,
  } from "../components/ContextMenu.svelte";
  import SpaceTree from "./SpaceTree.svelte";
  import TreeNameInput from "./TreeNameInput.svelte";

  export let root: string | null;
  export let notes: string[];
  export let activePath: string | null;
  export let onChooseSpace: () => void | Promise<void>;
  export let onRefresh: () => void | Promise<void>;
  export let onSelect: (relativePath: string) => void;
  export let onRename: (relativePath: string, name: string) => void;
  export let onCreate: (
    parentPath: string,
    name: string,
    folder: boolean,
  ) => void;
  export let onDelete: (relativePath: string) => void;
  export let width = 240;

  let renaming: string | null = null;
  let creating: string | null = null;
  let creatingFolder = false;
  let isSearching = false;
  let contextMenu: {
    x: number;
    y: number;
  } | null = null;

  let searchQuery = "";
  let searchResults: TreeNode[] | null = null;

  $: tree = buildTree(notes);
  $: displayTree = searchQuery ? searchResults : tree;

  let searchTimeout: ReturnType<typeof setTimeout>;

  async function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (!root || !searchQuery) {
        searchResults = null;
        return;
      }
      try {
        const paths = await searchNotes(root, searchQuery);
        searchResults = buildTree(paths);
      } catch (e) {
        console.error("Search failed:", e);
        searchResults = null;
      }
    }, 300);
  }

  function cancelEdit() {
    renaming = null;
    creating = null;
    creatingFolder = false;
  }

  function startRename(relativePath: string) {
    creating = null;
    renaming = relativePath;
  }

  function startCreate(parentPath: string, folder = false) {
    renaming = null;
    creating = parentPath;
    creatingFolder = folder;
  }

  function startRootFolder() {
    startCreate("", true);
  }

  function commitRename(relativePath: string, name: string) {
    cancelEdit();
    onRename(relativePath, name);
  }

  function commitCreate(parentPath: string, name: string) {
    const folder = creatingFolder;

    cancelEdit();
    onCreate(parentPath, name, folder);
  }

  function openContextMenu(event: MouseEvent) {
    event.preventDefault();
    contextMenu = { x: event.clientX, y: event.clientY };
  }

  function contextItems(): ContextMenuItem[] {
    if (!root) {
      return [
        {
          label: "Choose space",
          icon: FolderOpen,
          onSelect: onChooseSpace,
        },
      ];
    }

    return [
      {
        label: "Add note",
        icon: Plus,
        onSelect: () => startCreate(""),
      },
      {
        label: "Add folder",
        shortcut: "Ctrl Shift N",
        icon: FolderPlus,
        onSelect: startRootFolder,
      },
      { separator: true },
      {
        label: "Refresh",
        shortcut: "Ctrl R",
        icon: RotateCcw,
        onSelect: onRefresh,
      },
      {
        label: "Change space",
        icon: FolderOpen,
        onSelect: onChooseSpace,
      },
    ];
  }

  function handleShortcut(event: KeyboardEvent) {
    const isPrimaryShortcut = event.ctrlKey || event.metaKey;

    if (!root || !isPrimaryShortcut) {
      return;
    }

    if (event.key.toLowerCase() === "r") {
      event.preventDefault();
      contextMenu = null;
      onRefresh();
    }

    if (event.shiftKey && event.key.toLowerCase() === "n") {
      event.preventDefault();
      contextMenu = null;
      startRootFolder();
    }
  }
</script>

<svelte:window onkeydown={handleShortcut} />

<aside
  class="flex min-h-0 shrink-0 flex-col border-r border-stone-200/70 bg-stone-100/50 dark:border-stone-800 dark:bg-stone-900/40"
  style="width: {width}px;"
  aria-label="Space"
>
  <div
    class="flex h-12 shrink-0 items-center gap-1 border-b border-stone-200/70 px-2 dark:border-stone-800"
  >
    <button
      type="button"
      class="min-w-0 flex-1 truncate rounded-md px-1 py-1 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase hover:bg-stone-500/10 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-300"
      title={root ? "Change space" : "Choose space"}
      onclick={onChooseSpace}
    >
      {root ? basename(root) : "No space"}
    </button>
    {#if root}
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md border border-transparent text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-400 dark:hover:text-stone-100"
        aria-label="Add note"
        title="Add note"
        onclick={() => startCreate("")}
      >
        <Plus class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>

      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md border border-transparent text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-400 dark:hover:text-stone-100"
        aria-label="Toggle search"
        title="Toggle search"
        onclick={() => (isSearching = !isSearching)}
      >
        <Search class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>
    {/if}
  </div>
  {#if isSearching}
    <div class="px-2 py-1">
      <Input
        type="search"
        placeholder="Search notes..."
        bind:value={searchQuery}
        oninput={handleSearch}
        class="h-8"
      />
    </div>
  {/if}

  <div
    class="min-h-0 flex-1 overflow-y-auto p-1.5"
    role="presentation"
    oncontextmenu={openContextMenu}
  >
    {#if !root}
      <p class="px-2 py-6 text-center text-xs leading-relaxed text-stone-400">
        Choose a folder to use as your space.
      </p>
    {:else}
      {#if creating === ""}
        <TreeNameInput
          value=""
          depth={0}
          onCommit={(name) => commitCreate("", name)}
          onCancel={cancelEdit}
        />
      {/if}

      {#if !notes.length && creating !== ""}
        <p class="px-2 py-6 text-center text-xs text-stone-400">
          No notes yet.
        </p>
      {/if}

        <SpaceTree
        nodes={displayTree}
        {activePath}
        {onSelect}
        {renaming}
        {creating}
        onStartRename={startRename}
        onStartCreate={startCreate}
        onRename={commitRename}
        onCreate={commitCreate}
        {onDelete}
        onCancelEdit={cancelEdit}
      />
    {/if}
  </div>

  {#if contextMenu}
    <ContextMenu
      x={contextMenu.x}
      y={contextMenu.y}
      items={contextItems()}
      onClose={() => (contextMenu = null)}
    />
  {/if}
</aside>
