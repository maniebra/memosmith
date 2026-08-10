<script lang="ts">
  import { X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { BODY, ICON, rowTitle } from "../../lib/utils/database";
  import type {
    CellValue,
    Choice,
    Column,
    Row,
  } from "../../lib/utils/database";
  import DatabaseCell from "../components/DatabaseCell.svelte";
  import MarkdownEditor from "../components/MarkdownEditor.svelte";

  export let row: Row;
  export let columns: Column[];
  export let choices: Record<string, Choice[]> = {};
  export let onCell: (
    rowId: string,
    columnId: string,
    value: CellValue,
  ) => void;
  export let onClose: () => void;

  $: icon = typeof row.data[ICON] === "string" ? String(row.data[ICON]) : "";
  /** The editor owns its text while open, so the row only hears about it on change. */
  let body = "";
  let loadedRow: string | null = null;

  $: if (row.id !== loadedRow) {
    loadedRow = row.id;
    body = typeof row.data[BODY] === "string" ? String(row.data[BODY]) : "";
  }
</script>

<svelte:window onkeydown={(event) => event.key === "Escape" && onClose()} />

<div
  class="fixed inset-0 z-40 flex items-start justify-center bg-stone-900/30 p-6 backdrop-blur-sm"
  role="presentation"
  onclick={(event) => event.target === event.currentTarget && onClose()}
>
  <div
    class="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900"
    role="dialog"
    aria-label={rowTitle(row, columns)}
  >
    <header
      class="flex items-center gap-2 border-b border-stone-200/70 px-4 py-3 dark:border-stone-800"
    >
      <input
        class="w-10 bg-transparent text-center text-xl outline-none"
        aria-label={$i18n.t("database.icon")}
        value={icon}
        placeholder="📄"
        oninput={(event) => onCell(row.id, ICON, event.currentTarget.value)}
      />
      <h2
        class="min-w-0 flex-1 truncate text-lg font-semibold text-stone-900 dark:text-stone-100"
      >
        {rowTitle(row, columns)}
      </h2>
      <button
        type="button"
        class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
        aria-label={$i18n.t("database.closeRow")}
        onclick={onClose}
      >
        <X class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-4 py-3">
      <div class="flex flex-col gap-1">
        {#each columns as column (column.id)}
          <div class="flex items-start gap-3">
            <span
              class="w-32 shrink-0 truncate pt-2 text-xs text-stone-400"
              title={column.name}>{column.name}</span
            >
            <div class="min-w-0 flex-1">
              <DatabaseCell
                {column}
                choices={choices[column.id] ?? []}
                value={row.data[column.id] ?? null}
                onChange={(value) => onCell(row.id, column.id, value)}
              />
            </div>
          </div>
        {/each}
      </div>

      <div class="mt-4 border-t border-stone-200/70 pt-3 dark:border-stone-800">
        <MarkdownEditor
          bind:value={body}
          placeholder={$i18n.t("database.bodyPlaceholder")}
          textSize={15}
          onInput={() => onCell(row.id, BODY, body)}
        />
      </div>
    </div>
  </div>
</div>
