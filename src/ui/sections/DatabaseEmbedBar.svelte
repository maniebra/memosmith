<script lang="ts">
  import { Lock, LockOpen } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import type { Database, Table, View } from "../../lib/utils/database";

  export let database: Database;
  export let table: Table;
  export let view: View;
  export let onRenameDatabase: (name: string) => void;
  export let onOpen: (() => void) | null = null;
  /** Pinned to this one table view, with the tabs and toolbar hidden. */
  export let locked = false;
  export let onLock: ((locked: boolean) => void) | null = null;

  $: lockLabel = $i18n.t(locked ? "database.unlockView" : "database.lockView");
</script>

<div class="flex items-center gap-2">
  {#if locked}
    <span
      class="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800 dark:text-stone-100"
      >{table.name} · {view.name}</span
    >
  {:else}
    <input
      class="min-w-0 flex-1 bg-transparent text-sm font-semibold text-stone-800 outline-none dark:text-stone-100"
      value={database.name}
      oninput={(event) => onRenameDatabase(event.currentTarget.value)}
    />
  {/if}
  {#if onLock}
    <button
      type="button"
      class="flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
      aria-label={lockLabel}
      title={lockLabel}
      onclick={() => onLock?.(!locked)}
    >
      <svelte:component
        this={locked ? Lock : LockOpen}
        class="size-3.5"
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </button>
  {/if}
  {#if onOpen}
    <button
      type="button"
      class="rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
      onclick={onOpen}>{$i18n.t("common.open")}</button
    >
  {/if}
</div>
