<script lang="ts">
  import Button from "../components/Button.svelte";
  import { basename } from "../../lib/utils/path";
  import { buildTree } from "../../lib/utils/tree";
  import ContextMenu, { type ContextMenuItem } from "../components/ContextMenu.svelte";
  import SpaceTree from "./SpaceTree.svelte";
  import TreeNameInput from "./TreeNameInput.svelte";

  export let root: string | null;
  export let notes: string[];
  export let activePath: string | null;
  export let onChooseSpace: () => void | Promise<void>;
  export let onRefresh: () => void | Promise<void>;
  export let onSelect: (relativePath: string) => void;
  export let onRename: (relativePath: string, name: string) => void;
  export let onCreate: (parentPath: string, name: string, folder: boolean) => void;
  export let onDelete: (relativePath: string) => void;
  export let width = 240;

  let renaming: string | null = null;
  let creating: string | null = null;
  let creatingFolder = false;
  let contextMenu:
    | {
        x: number;
        y: number;
      }
    | null = null;

  $: tree = buildTree(notes);

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
          onSelect: onChooseSpace,
        },
      ];
    }

    return [
      {
        label: "Add note",
        onSelect: () => startCreate(""),
      },
      {
        label: "Add folder",
        onSelect: () => startCreate("", true),
      },
      { separator: true },
      {
        label: "Refresh",
        onSelect: onRefresh,
      },
      {
        label: "Change space",
        onSelect: onChooseSpace,
      },
    ];
  }
</script>

<aside
  class="flex min-h-0 shrink-0 flex-col border-r border-stone-200/70 bg-stone-100/50 dark:border-stone-800 dark:bg-stone-900/40"
  style="width: {width}px;"
  aria-label="Space"
>
  <div class="flex h-12 shrink-0 items-center gap-1 border-b border-stone-200/70 px-2 dark:border-stone-800">
    <span class="min-w-0 flex-1 truncate px-1 text-xs font-semibold tracking-wide text-stone-500 uppercase">
      {root ? basename(root) : "No space"}
    </span>
    {#if root}
      <Button label="+" onClick={() => startCreate("")} variant="ghost" size="sm" className="px-2" />
      <Button label="+▸" onClick={() => startCreate("", true)} variant="ghost" size="sm" className="px-2" />
      <Button label="↻" onClick={onRefresh} variant="ghost" size="sm" className="px-2" />
    {/if}
    <Button label="Space…" onClick={onChooseSpace} variant="ghost" size="sm" />
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto p-1.5" role="presentation" oncontextmenu={openContextMenu}>
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
        <p class="px-2 py-6 text-center text-xs text-stone-400">No notes yet.</p>
      {/if}

      <SpaceTree
        nodes={tree}
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
