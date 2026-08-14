<script lang="ts">
  import {
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    FolderPlus,
    Pencil,
    Plus,
    Trash2,
  } from "@lucide/svelte";
  import { cn } from "../../lib/utils/cn";
  import { displayNoteName } from "../../lib/utils/path";
  import type { SpaceMeta } from "../../lib/utils/pageMeta";
  import {
    movedPath,
    reorderedSiblings,
    type TreeNode,
  } from "../../lib/utils/tree";
  import PageIcon from "../components/PageIcon.svelte";
  import ContextMenu, {
    type ContextMenuItem,
  } from "../components/ContextMenu.svelte";
  import Self from "./SpaceTree.svelte";
  import TreeNameInput from "./TreeNameInput.svelte";

  export let nodes: TreeNode[];
  export let meta: SpaceMeta = {};
  export let activePath: string | null;
  export let onSelect: (relativePath: string) => void;
  /** Relative path of the node being renamed, if any. */
  export let renaming: string | null;
  /** Relative path of the folder gaining a new note ("" = space root). */
  export let creating: string | null;
  export let onStartRename: (relativePath: string) => void;
  export let onStartCreate: (parentPath: string, folder?: boolean) => void;
  export let onRename: (relativePath: string, name: string) => void;
  export let onCreate: (parentPath: string, name: string) => void;
  export let onDelete: (relativePath: string) => void;
  export let onMove: (
    relativePath: string,
    destFolder: string,
    siblingOrder?: string[],
  ) => void;
  export let onCancelEdit: () => void;
  export let depth = 0;

  let collapsed: Record<string, boolean> = {};
  let dropHint: { path: string; where: "before" | "inside" | "after" } | null =
    null;
  let expandTimer: ReturnType<typeof setTimeout> | undefined;
  let contextMenu: {
    x: number;
    y: number;
    node: TreeNode;
  } | null = null;

  function label(node: TreeNode) {
    return node.children ? node.name : displayNoteName(node.name);
  }

  function toggle(node: TreeNode) {
    collapsed = { ...collapsed, [node.path]: !collapsed[node.path] };
  }

  /** Dropping on a folder moves into it; dropping on a note targets its parent. */
  function dropFolder(node: TreeNode) {
    if (node.children) {
      return node.path;
    }
    return node.path.includes("/")
      ? node.path.slice(0, node.path.lastIndexOf("/"))
      : "";
  }

  /** Parent folder of a node's row, used when dropping between rows. */
  function parentFolder(node: TreeNode) {
    return node.path.includes("/")
      ? node.path.slice(0, node.path.lastIndexOf("/"))
      : "";
  }

  function handleDragOver(event: DragEvent, node: TreeNode) {
    event.preventDefault();
    event.stopPropagation();

    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const offset = (event.clientY - box.top) / box.height;
    const where = offset < 0.25 ? "before" : offset > 0.75 ? "after" : "inside";

    if (dropHint?.path !== node.path || dropHint.where !== where) {
      dropHint = { path: node.path, where };
      clearTimeout(expandTimer);

      // Hovering a collapsed folder long enough opens it, so nested drops work.
      if (where === "inside" && node.children && collapsed[node.path]) {
        expandTimer = setTimeout(() => {
          collapsed = { ...collapsed, [node.path]: false };
        }, 700);
      }
    }
  }

  function clearHint() {
    clearTimeout(expandTimer);
    dropHint = null;
  }

  function handleDrop(event: DragEvent, node: TreeNode) {
    const source = event.dataTransfer?.getData("text/memosmith-path");
    const where = dropHint?.where ?? "inside";

    clearHint();

    if (!source || source === node.path) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (where === "inside") {
      onMove(source, dropFolder(node));
      return;
    }

    const destFolder = parentFolder(node);

    onMove(
      source,
      destFolder,
      reorderedSiblings(
        nodes.map((sibling) => sibling.path),
        movedPath(source, destFolder),
        node.path,
        where === "after",
      ),
    );
  }

  function openContextMenu(event: MouseEvent, node: TreeNode) {
    event.preventDefault();
    event.stopPropagation();
    contextMenu = { x: event.clientX, y: event.clientY, node };
  }

  function contextItems(node: TreeNode): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (node.note) {
      items.push({
        label: "Select",
        onSelect: () => onSelect(node.note!),
      });
    }

    if (node.children) {
      items.push({
        label: collapsed[node.path] ? "Expand" : "Collapse",
        icon: collapsed[node.path] ? ChevronRight : ChevronDown,
        onSelect: () => toggle(node),
      });
      items.push({ separator: true });
      items.push({
        label: "Add note",
        icon: Plus,
        onSelect: () => {
          collapsed = { ...collapsed, [node.path]: false };
          onStartCreate(node.path);
        },
      });
      items.push({
        label: "Add folder",
        icon: FolderPlus,
        onSelect: () => {
          collapsed = { ...collapsed, [node.path]: false };
          onStartCreate(node.path, true);
        },
      });
    }

    items.push({ separator: true });
    items.push({
      label: "Rename",
      icon: Pencil,
      onSelect: () => onStartRename(node.path),
    });
    items.push({
      label: "Delete",
      icon: Trash2,
      danger: true,
      onSelect: () => onDelete(node.path),
    });

    return items;
  }
</script>

<ul class="m-0 list-none p-0">
  {#each nodes as node (node.path)}
    <li>
      {#if renaming === node.path}
        <TreeNameInput
          value={label(node)}
          {depth}
          onCommit={(name) => onRename(node.path, name)}
          onCancel={onCancelEdit}
        />
      {:else}
        <div
          class={cn(
            "group flex items-center rounded-md pr-1 transition-colors",
            node.note && node.note === activePath
              ? "bg-emerald-600/12 text-emerald-800 dark:text-emerald-300"
              : "text-stone-600 hover:bg-stone-500/10 dark:text-stone-400",
            dropHint?.path === node.path &&
              {
                inside: "ring-1 ring-emerald-600/50",
                before: "border-t border-emerald-600",
                after: "border-b border-emerald-600",
              }[dropHint.where],
          )}
          role="presentation"
          draggable="true"
          oncontextmenu={(event) => openContextMenu(event, node)}
          ondragstart={(event) => {
            event.dataTransfer?.setData("text/memosmith-path", node.path);
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
            }
          }}
          ondragend={clearHint}
          ondragover={(event) => handleDragOver(event, node)}
          ondragleave={clearHint}
          ondrop={(event) => handleDrop(event, node)}
        >
          {#if node.children}
            <button
              type="button"
              class={cn(
                "shrink-0 py-1 pr-1 text-stone-400 transition-colors hover:text-stone-700 dark:hover:text-stone-200",
              )}
              style="padding-left: {depth * 0.75 + 0.375}rem"
              title={collapsed[node.path] ? "Expand" : "Collapse"}
              aria-label={collapsed[node.path] ? "Expand" : "Collapse"}
              onclick={() => toggle(node)}
            >
              {#if collapsed[node.path]}
                <ChevronRight
                  class="size-3.5"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              {:else}
                <ChevronDown
                  class="size-3.5"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              {/if}
            </button>
          {/if}

          <button
            type="button"
            class="flex min-w-0 flex-1 items-center py-1 text-left text-[0.8125rem]"
            style={node.children
              ? "padding-left: 0.375rem"
              : `padding-left: ${depth * 0.75 + 1.375}rem`}
            onclick={() => (node.note ? onSelect(node.note) : toggle(node))}
          >
            <PageIcon
              icon={meta[node.path]?.icon}
              fallback={node.children ? Folder : FileText}
              className="mr-1.5 size-4 text-base text-stone-400 dark:text-stone-500"
            />
            <span class="truncate">{label(node)}</span>
          </button>

          <span
            class="flex shrink-0 items-center opacity-0 focus-within:opacity-100 group-hover:opacity-100"
          >
            {#if node.children}
              <button
                type="button"
                class="rounded p-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100"
                title="Add note here"
                aria-label="Add note here"
                onclick={() => {
                  collapsed = { ...collapsed, [node.path]: false };
                  onStartCreate(node.path);
                }}
              >
                <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              </button>
            {/if}
            <button
              type="button"
              class="rounded p-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100"
              title="Rename"
              aria-label="Rename"
              onclick={() => onStartRename(node.path)}
            >
              <Pencil class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </button>
            <button
              type="button"
              class="rounded p-1 text-stone-400 hover:text-rose-600"
              title="Delete"
              aria-label="Delete"
              onclick={() => onDelete(node.path)}
            >
              <Trash2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          </span>
        </div>
      {/if}

      {#if node.children && !collapsed[node.path]}
        {#if creating === node.path}
          <TreeNameInput
            value=""
            depth={depth + 1}
            onCommit={(name) => onCreate(node.path, name)}
            onCancel={onCancelEdit}
          />
        {/if}

        <Self
          nodes={node.children}
          {meta}
          {activePath}
          {onSelect}
          {renaming}
          {creating}
          {onStartRename}
          {onStartCreate}
          {onRename}
          {onCreate}
          {onDelete}
          {onMove}
          {onCancelEdit}
          depth={depth + 1}
        />
      {/if}
    </li>
  {/each}
</ul>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextItems(contextMenu.node)}
    onClose={() => (contextMenu = null)}
  />
{/if}
