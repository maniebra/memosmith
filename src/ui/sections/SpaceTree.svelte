<script lang="ts">
  import {
    BookOpen,
    Image,
    Music,
    Video,
    ChevronDown,
    ChevronRight,
    FileText,
    Folder,
    Pencil,
    Plus,
    Trash2,
  } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import { displayNoteName } from "../../lib/utils/path";
  import type { SpaceMeta } from "../../lib/utils/pageMeta";
  import {
    movedPath,
    reorderedSiblings,
    type TreeNode,
  } from "../../lib/utils/tree";
  import PageIcon from "../components/PageIcon.svelte";
  import ContextMenu from "../components/ContextMenu.svelte";
  import { treeContextItems } from "./spaceTreeMenu";
  import { dropFolder, parentFolder } from "./spaceTreeDrag";
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
  export let onScopeDirectory: (relativePath: string) => void;
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
  /** Note paths with an open tab; their folders start expanded, others collapsed. */
  export let openPaths: string[] = [];
  /** Tab id of the readable being read, so its row can highlight. */
  export let activeReadableTab: string | null = null;
  /** Absent when the Readables feature is off. */
  export let onAddReadables: ((folder: string) => void) | undefined = undefined;

  let collapsed: Record<string, boolean> = {};
  let defaulted = new Set<string>();
  let lastActivePath: string | null = null;

  function holdsOpenNote(folder: string) {
    return openPaths.some((path) => path.startsWith(`${folder}/`));
  }

  // Folders arrive as the space loads, so each one gets its default once.
  $: for (const node of nodes) {
    if (node.children && !defaulted.has(node.path)) {
      defaulted.add(node.path);
      collapsed = { ...collapsed, [node.path]: !holdsOpenNote(node.path) };
    }
  }

  // Selecting a note reveals it, without fighting a manual collapse otherwise.
  $: if (activePath !== lastActivePath) {
    lastActivePath = activePath;
    for (const node of nodes) {
      if (node.children && activePath?.startsWith(`${node.path}/`)) {
        collapsed = { ...collapsed, [node.path]: false };
      }
    }
  }
  let dropHint: { path: string; where: "before" | "inside" | "after" } | null =
    null;
  let dragging: string | null = null;
  let expandTimer: ReturnType<typeof setTimeout> | undefined;
  let contextMenu: {
    x: number;
    y: number;
    node: TreeNode;
  } | null = null;

  const readableIcons: Record<string, typeof BookOpen> = {
    image: Image,
    video: Video,
    audio: Music,
  };

  function label(node: TreeNode) {
    return node.children || node.readable
      ? node.name
      : displayNoteName(node.name);
  }

  function toggle(node: TreeNode) {
    collapsed = { ...collapsed, [node.path]: !collapsed[node.path] };
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
        }, 500);
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

    // A readable keeps its `read:` id wherever it lands; a note takes a new path.
    const moved = source.startsWith("read:")
      ? source
      : movedPath(source, destFolder);

    onMove(
      source,
      destFolder,
      reorderedSiblings(
        nodes.map((sibling) => sibling.path),
        moved,
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

  function contextItems(node: TreeNode) {
    return treeContextItems(node, {
      collapsed,
      scopeLabel: $i18n.t("sidebar.scopeDirectory"),
      onSelect,
      onToggle: toggle,
      onScopeDirectory,
      onStartCreate,
      onExpand: (path) => (collapsed = { ...collapsed, [path]: false }),
      onStartRename,
      onDelete,
      onAddReadables,
    });
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
            "group flex items-center rounded-md pr-1 transition-[background-color,box-shadow,opacity] duration-150",
            dragging === node.path && "opacity-40",
            node.readable && `read:${node.readable}` === activeReadableTab
              ? "bg-emerald-600/12 text-emerald-800 dark:text-emerald-300"
              : node.note && node.note === activePath
              ? "bg-emerald-600/12 text-emerald-800 dark:text-emerald-300"
              : "text-stone-600 hover:bg-stone-500/10 dark:text-stone-400",
            dropHint?.path === node.path &&
              {
                inside: "bg-emerald-600/10 ring-1 ring-emerald-600/50",
                before: "shadow-[inset_0_2px_0_0_var(--color-emerald-600)]",
                after: "shadow-[inset_0_-2px_0_0_var(--color-emerald-600)]",
              }[dropHint.where],
          )}
          role="presentation"
          draggable="true"
          oncontextmenu={(event) => openContextMenu(event, node)}
          ondragstart={(event) => {
            dragging = node.path;
            event.dataTransfer?.setData("text/memosmith-path", node.path);
            if (!node.children) {
              // Lets the editor panes take the note as a tab drop.
              event.dataTransfer?.setData(
                "application/x-memosmith-tab",
                node.path,
              );
            }
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "move";
            }
          }}
          ondragend={() => {
            dragging = null;
            clearHint();
          }}
          ondragover={(event) => handleDragOver(event, node)}
          ondragleave={(event) => {
            // Crossing into the row's own buttons is not leaving the row.
            if (
              !(event.currentTarget as HTMLElement).contains(
                event.relatedTarget as Node | null,
              )
            ) {
              clearHint();
            }
          }}
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
            onclick={() =>
              node.note
                ? onSelect(node.note)
                : node.readable
                  ? onSelect(node.path)
                  : toggle(node)}
          >
            <PageIcon
              icon={meta[node.path]?.icon}
              fallback={node.children
                ? Folder
                : node.readable
                  ? (readableIcons[node.kind ?? ""] ?? BookOpen)
                  : FileText}
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
            {#if !node.readable}
            <button
              type="button"
              class="rounded p-1 text-stone-400 hover:text-stone-800 dark:hover:text-stone-100"
              title="Rename"
              aria-label="Rename"
              onclick={() => onStartRename(node.path)}
            >
              <Pencil class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </button>
            {/if}
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
          {openPaths}
          {activeReadableTab}
          {onAddReadables}
          {onSelect}
          {renaming}
          {creating}
          {onStartRename}
          {onStartCreate}
          {onScopeDirectory}
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
