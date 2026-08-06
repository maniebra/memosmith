<script lang="ts">
  import {
    ChevronDown,
    ChevronRight,
    FolderPlus,
    Pencil,
    Plus,
    Trash2,
  } from "@lucide/svelte";
  import { cn } from "../../lib/utils/cn";
  import { displayNoteName } from "../../lib/utils/path";
  import type { TreeNode } from "../../lib/utils/tree";
  import ContextMenu, {
    type ContextMenuItem,
  } from "../components/ContextMenu.svelte";
  import Self from "./SpaceTree.svelte";
  import TreeNameInput from "./TreeNameInput.svelte";

  export let nodes: TreeNode[];
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
  export let onCancelEdit: () => void;
  export let depth = 0;

  let collapsed: Record<string, boolean> = {};
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
          )}
          role="presentation"
          oncontextmenu={(event) => openContextMenu(event, node)}
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
          {activePath}
          {onSelect}
          {renaming}
          {creating}
          {onStartRename}
          {onStartCreate}
          {onRename}
          {onCreate}
          {onDelete}
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
