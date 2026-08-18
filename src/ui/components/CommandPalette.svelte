<script lang="ts">
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { cn } from "../../lib/utils/cn";
  import { i18n } from "../../lib/i18n";
  import { shortcutKey } from "../../lib/utils/shortcutKey";
  import {
    commandPaletteItems,
    palettePrefix,
    type PaletteItem,
  } from "../pages/editorPageCommands";
  import {
    rankPaletteItems,
    scrollToSourceLine,
  } from "../../lib/utils/paletteRank";
  import {
    loadCommandHistory,
    recordCommandUse,
  } from "../../lib/storage/commandHistory";
  import type { EditorPageActions } from "../pages/editorPageContext";
  import type { DatabaseSummary } from "../../lib/tauri/databases";

  export let actions: EditorPageActions;
  export let databases: DatabaseSummary[];
  export let spaceNotes: string[];
  export let contents: string;
  export let editor: HTMLElement | undefined;
  export let path: string | null;
  export let settings: { features: { databases: boolean } };
  export let settingsOpen: boolean;
  export let pdfPreviewOpen: boolean;
  export let toggleReadOnly: () => void;

  let open = false;
  let recent = loadCommandHistory();
  let query = "";
  let index = 0;
  let nodes: HTMLElement[] = [];

  $: items = commandPaletteItems({
    actions,
    databases,
    databasesEnabled: settings.features.databases,
    hasNote: Boolean(path),
    spaceNotes,
    contents,
    jumpToLine: (line: number) => scrollToSourceLine(editor, line),
    t: $i18n.t,
    openSettings: () => (settingsOpen = true),
    toggleReadOnly,
    exportPdf: () => (pdfPreviewOpen = true),
  });
  $: placeholder = $i18n.t("command.placeholder");
  $: mode = palettePrefix(query);
  $: pool = mode.kind
    ? items.filter((item) => item.kind === mode.kind)
    : items;
  $: filtered = rankPaletteItems(pool, mode.needle, recent);
  $: index = Math.min(index, Math.max(filtered.length - 1, 0));
  $: nodes[index]?.scrollIntoView({ block: "nearest" });

  /** Dynamically inserted inputs never autofocus, so take focus on mount. */
  function focusOnOpen(node: HTMLInputElement) {
    node.focus();
  }

  function onClose() {
    open = false;
    query = "";
    index = 0;
  }

  /** Ctrl+P opens the palette from anywhere in the app. */
  function handleWindowKey(event: KeyboardEvent) {
    if (
      !event.defaultPrevented &&
      (event.ctrlKey || event.metaKey) &&
      shortcutKey(event) === "p"
    ) {
      event.preventDefault();
      open = !open;
    }
  }

  function pick(item: PaletteItem | undefined) {
    if (!item) {
      return;
    }
    onClose();
    recent = recordCommandUse(item.id, recent);
    item.run();
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      const count = filtered.length || 1;
      index = (index + step + count) % count;
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      pick(filtered[index]);
    }
  }
</script>

<svelte:window onkeydown={handleWindowKey} />
{#if open}
  <div
    class="fixed inset-0 z-50 flex justify-center bg-stone-900/30 pt-[12vh] backdrop-blur-sm"
    role="presentation"
    onmousedown={(event) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    }}
  >
    <div
      class="h-fit w-[32rem] max-w-[90vw] overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl shadow-stone-900/20 dark:border-stone-700 dark:bg-stone-900"
      in:scale={{ start: 0.97, duration: 110, easing: cubicOut }}
    >
      <input
        use:focusOnOpen
        bind:value={query}
        {placeholder}
        onkeydown={handleKey}
        oninput={() => (index = 0)}
        class="w-full border-b border-stone-200 bg-transparent px-4 py-3 text-sm outline-none dark:border-stone-700"
      />
      <ul
        class="max-h-80 overflow-y-auto p-1"
        role="listbox"
        aria-label={placeholder}
      >
        {#each filtered as item, itemIndex (item.id)}
          <li>
            <button
              type="button"
              role="option"
              bind:this={nodes[itemIndex]}
              aria-selected={itemIndex === index}
              class={cn(
                "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                itemIndex === index
                  ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
                  : "text-stone-700 dark:text-stone-200",
              )}
              onmousemove={() => (index = itemIndex)}
              onmousedown={(event) => {
                event.preventDefault();
                pick(item);
              }}
            >
              <span class="truncate">{item.label}</span>
              {#if item.hint}
                <span class="shrink-0 text-xs text-stone-400">{item.hint}</span>
              {/if}
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>
{/if}
