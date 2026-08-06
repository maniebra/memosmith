<script lang="ts">
  import { cn } from "../../lib/utils/cn";
  import { displayNoteName } from "../../lib/utils/path";
  import type { TreeNode } from "../../lib/utils/tree";
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

  function label(node: TreeNode) {
    return node.children ? node.name : displayNoteName(node.name);
  }

  function toggle(node: TreeNode) {
    collapsed = { ...collapsed, [node.path]: !collapsed[node.path] };
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
        >
          {#if node.children}
            <button
              type="button"
              class={cn(
                "shrink-0 py-1 pr-1 text-[0.65rem] text-stone-400 transition-transform",
                collapsed[node.path] ? "" : "rotate-90",
              )}
              style="padding-left: {depth * 0.75 + 0.375}rem"
              title={collapsed[node.path] ? "Expand" : "Collapse"}
              onclick={() => toggle(node)}>▶</button
            >
          {/if}

          <button
            type="button"
            class="flex min-w-0 flex-1 items-center py-1 text-left text-[0.8125rem]"
            style={node.children ? "padding-left: 0.375rem" : `padding-left: ${depth * 0.75 + 1.375}rem`}
            onclick={() => (node.note ? onSelect(node.note) : toggle(node))}
          >
            <span class="truncate">{label(node)}</span>
          </button>

          <span class="flex shrink-0 items-center opacity-0 focus-within:opacity-100 group-hover:opacity-100">
            {#if node.children}
              <button
                type="button"
                class="rounded px-1 text-xs text-stone-400 hover:text-stone-800 dark:hover:text-stone-100"
                title="Add note here"
                onclick={() => {
                  collapsed = { ...collapsed, [node.path]: false };
                  onStartCreate(node.path);
                }}>+</button
              >
              <button
                type="button"
                class="rounded px-1 text-xs text-stone-400 hover:text-stone-800 dark:hover:text-stone-100"
                title="Add folder here"
                onclick={() => {
                  collapsed = { ...collapsed, [node.path]: false };
                  onStartCreate(node.path, true);
                }}>+▸</button
              >
            {/if}
            <button
              type="button"
              class="rounded px-1 text-xs text-stone-400 hover:text-stone-800 dark:hover:text-stone-100"
              title="Rename"
              onclick={() => onStartRename(node.path)}>✎</button
            >
            <button
              type="button"
              class="rounded px-1 text-xs text-stone-400 hover:text-rose-600"
              title="Delete"
              onclick={() => onDelete(node.path)}>✕</button
            >
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
