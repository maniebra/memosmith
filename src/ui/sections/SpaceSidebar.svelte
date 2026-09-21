<script lang="ts">
  import { onMount } from "svelte";
  import { Plus, RotateCcw, Search } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { basename, displayNotePath } from "../../lib/utils/path";
  import {
    registerKeybindings,
    type Keybinding,
  } from "../../lib/utils/keybindings";
  import type { SpaceMeta } from "../../lib/utils/pageMeta";
  import { buildTree, findNode, withReadables } from "../../lib/utils/tree";
  import { searchNotes } from "../../lib/tauri/files";
  import Input from "../components/Input.svelte";
  import ContextMenu, {
    type ContextMenuItem,
  } from "../components/ContextMenu.svelte";
  import { sidebarMenuItems } from "./spaceSidebarMenu";
  import SpaceTree from "./SpaceTree.svelte";
  import {
    isReadableTab,
    readableTabPath,
    type Readable,
  } from "../../lib/storage/readables";
  import TreeNameInput from "./TreeNameInput.svelte";

  export let root: string | null;
  export let notes: string[];
  export let meta: SpaceMeta = {};
  export let activePath: string | null;
  export let openPaths: string[] = [];
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
  export let onConvertToFolder: (notePath: string) => void;
  export let onMove: (
    relativePath: string,
    destFolder: string,
    siblingOrder?: string[],
  ) => void;
  export let width = 240;
  /** null keeps readables out of the tree: the feature is switched off. */
  export let readables: Readable[] | null = null;
  export let activeReadablePath: string | null = null;
  export let onAddReadables: (
    folder?: string,
    group?: "books" | "media",
  ) => void = () => {};
  export let onOpenReadable: (path: string) => void = () => {};
  export let onRemoveReadable: (path: string) => void = () => {};
  export let onMoveReadable: (
    path: string,
    folder: string,
    siblingOrder?: string[],
  ) => void = () => {};

  let renaming: string | null = null;
  let creating: string | null = null;
  let creatingFolder = false;
  let isSearching = false;
  let scopePath: string | null = null;
  let lastRoot: string | null = root;
  let contextMenu: {
    x: number;
    y: number;
  } | null = null;

  let searchQuery = "";
  let searchResults: string[] | null = null;

  $: tree = buildTree(notes, meta);
  $: sourceTree = buildTree(searchQuery ? (searchResults ?? []) : notes, meta);
  $: scopeNode = scopePath ? findNode(tree, scopePath) : null;
  $: scopeRoot = scopePath && scopeNode ? scopePath : "";
  $: matchedReadables = (readables ?? []).filter(
    (entry) =>
      !searchQuery ||
      entry.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  $: displayTree = withReadables(
    scopeRoot ? (findNode(sourceTree, scopeRoot)?.children ?? []) : sourceTree,
    matchedReadables,
    meta,
  );
  $: scopeLabel = scopePath ? displayNotePath(scopePath) : "";
  $: currentParent = scopeRoot;
  $: if (root !== lastRoot) {
    lastRoot = root;
    resetScope();
    searchResults = null;
  }
  $: if (scopePath && !scopeNode) {
    resetScope();
  }

  let searchTimeout: ReturnType<typeof setTimeout>;

  async function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      if (!root || !searchQuery) {
        searchResults = null;
        return;
      }
      try {
        searchResults = await searchNotes(root, searchQuery);
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
    startCreate(currentParent, true);
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

  function scopeDirectory(relativePath: string) {
    scopePath = relativePath;
  }

  function resetScope() {
    scopePath = null;
  }

  const selectNode = (path: string) =>
    isReadableTab(path)
      ? onOpenReadable(readableTabPath(path))
      : onSelect(path);

  const deleteNode = (path: string) =>
    isReadableTab(path)
      ? onRemoveReadable(readableTabPath(path))
      : onDelete(path);

  const moveNode = (
    path: string,
    destFolder: string,
    siblingOrder?: string[],
  ) =>
    isReadableTab(path)
      ? onMoveReadable(readableTabPath(path), destFolder, siblingOrder)
      : onMove(path, destFolder, siblingOrder);

  function contextItems(): ContextMenuItem[] {
    return sidebarMenuItems({
      root,
      scoped: Boolean(scopePath),
      readables: Boolean(readables),
      t: $i18n.t,
      onChooseSpace,
      onRefresh,
      onAddNote: () => startCreate(currentParent),
      onAddFolder: startRootFolder,
      onAddReadables: (group) => onAddReadables(currentParent, group),
      onResetScope: resetScope,
    });
  }

  const sidebarKeybindings: Keybinding[] = [
    {
      combination: "mod+r",
      type: "combinational",
      name: "sidebar.refresh",
      description: "Reload the space tree.",
      action: (event) => {
        event.preventDefault();
        contextMenu = null;
        onRefresh();
      },
    },
    {
      combination: "mod+shift+n",
      type: "combinational",
      name: "sidebar.newRootFolder",
      description: "Create a folder at the root of the space.",
      action: (event) => {
        event.preventDefault();
        contextMenu = null;
        startRootFolder();
      },
    },
    {
      combination: "mod+k mod+n",
      type: "sequential",
      name: "sidebar.newRootFolderChord",
      description: "Create a folder at the root of the space.",
      action: (event) => {
        event.preventDefault();
        contextMenu = null;
        startRootFolder();
      },
    },
  ];

  onMount(() => registerKeybindings(sidebarKeybindings));
</script>


<aside
  class="ms-island flex min-h-0 shrink-0 flex-col border-r border-stone-200/70 bg-stone-100/50 dark:border-stone-800 dark:bg-stone-900/40"
  style="width: {width}px;"
  aria-label={$i18n.t("sidebar.space")}
>
  <div
    class="flex h-12 shrink-0 items-center gap-1 border-b border-stone-200/70 px-2 dark:border-stone-800"
  >
    <button
      type="button"
      class="min-w-0 flex-1 truncate rounded-md px-1 py-1 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase hover:bg-stone-500/10 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-300"
      title={root
        ? $i18n.t("sidebar.changeSpace")
        : $i18n.t("sidebar.chooseSpace")}
      onclick={onChooseSpace}
    >
      {root ? basename(root) : $i18n.t("app.noSpace")}
    </button>
    {#if root}
      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md border border-transparent text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-400 dark:hover:text-stone-100"
        aria-label={$i18n.t("sidebar.addNote")}
        title={$i18n.t("sidebar.addNote")}
        onclick={() => startCreate(currentParent)}
      >
        <Plus class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>

      <button
        type="button"
        class="flex size-8 items-center justify-center rounded-md border border-transparent text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-400 dark:hover:text-stone-100"
        aria-label={$i18n.t("sidebar.toggleSearch")}
        title={$i18n.t("sidebar.toggleSearch")}
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
        placeholder={$i18n.t("sidebar.searchPlaceholder")}
        bind:value={searchQuery}
        oninput={handleSearch}
        className="h-8"
      />
    </div>
  {/if}
  {#if root && scopePath}
    <div
      class="flex items-center gap-1 border-b border-stone-200/70 px-2 py-1.5 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400"
    >
      <span class="min-w-0 flex-1 truncate" title={scopeLabel}>
        {$i18n.t("sidebar.scopeLabel", { path: scopeLabel })}
      </span>
      <button
        type="button"
        class="flex size-6 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-100"
        aria-label={$i18n.t("sidebar.resetScope")}
        title={$i18n.t("sidebar.resetScope")}
        onclick={resetScope}
      >
        <RotateCcw class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  {/if}

  <div
    class="min-h-0 flex-1 overflow-y-auto p-1.5"
    role="presentation"
    oncontextmenu={openContextMenu}
    ondragover={(event) => event.preventDefault()}
    ondrop={(event) => {
      const source = event.dataTransfer?.getData("text/memosmith-path");
      if (source) {
        event.preventDefault();
        moveNode(source, currentParent);
      }
    }}
  >
    {#if !root}
      <p class="px-2 py-6 text-center text-xs leading-relaxed text-stone-400">
        {$i18n.t("sidebar.chooseFolder")}
      </p>
    {:else}
      {#if creating === currentParent}
        <TreeNameInput
          value=""
          depth={0}
          onCommit={(name) => commitCreate(currentParent, name)}
          onCancel={cancelEdit}
        />
      {/if}

      {#if !displayTree.length && creating !== currentParent}
        <p class="px-2 py-6 text-center text-xs text-stone-400">
          {$i18n.t("sidebar.noNotes")}
        </p>
      {/if}

      <SpaceTree
        nodes={displayTree}
        {meta}
        {activePath}
        {openPaths}
        onAddReadables={readables ? onAddReadables : undefined}
        activeReadableTab={activeReadablePath
          ? `read:${activeReadablePath}`
          : null}
        onSelect={selectNode}
        {renaming}
        {creating}
        onStartRename={startRename}
        onStartCreate={startCreate}
        onScopeDirectory={scopeDirectory}
        onRename={commitRename}
        onCreate={commitCreate}
        onDelete={deleteNode}
        {onConvertToFolder}
        onMove={moveNode}
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
