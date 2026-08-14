<script lang="ts">
  import { Database, Plus, Trash2, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import type { DatabaseSummary } from "../../lib/tauri/databases";
  import Button from "../components/Button.svelte";
  import ContextMenu from "../components/ContextMenu.svelte";

  export let databases: DatabaseSummary[];
  export let activeDatabaseId: string | null;
  export let onSelect: (id: string) => void;
  export let onCreate: (name: string) => void;
  export let onDelete: (id: string) => void;
  export let onClose: () => void;

  let newName = "";
  let contextMenu: { x: number; y: number; id: string; name: string } | null =
    null;

  function create() {
    const name = newName.trim();

    if (!name) {
      return;
    }

    newName = "";
    onCreate(name);
  }
</script>

<div
  class="flex h-[70vh] w-[90vw] flex-col overflow-hidden rounded-xl bg-stone-50 shadow-xl md:max-h-[640px] md:w-[36rem] dark:bg-stone-900"
  aria-label={$i18n.t("database.title")}
>
  <div
    class="flex h-12 shrink-0 items-center justify-between border-b border-stone-200/50 px-4 dark:border-stone-800/80"
  >
    <h2 class="text-sm font-semibold text-stone-800 dark:text-stone-100">
      {$i18n.t("database.title")}
    </h2>
    <Button
      label={$i18n.t("common.close")}
      icon={X}
      onClick={onClose}
      variant="ghost"
      size="sm"
    />
  </div>

  <div
    class="flex shrink-0 gap-2 border-b border-stone-200/50 p-3 dark:border-stone-800/80"
  >
    <input
      class="h-9 min-w-0 flex-1 rounded-md border border-stone-200 bg-transparent px-2.5 text-sm text-stone-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:border-stone-700 dark:text-stone-100"
      placeholder={$i18n.t("database.newName")}
      bind:value={newName}
      onkeydown={(event) => event.key === "Enter" && create()}
    />
    <Button
      label={$i18n.t("common.create")}
      icon={Plus}
      onClick={create}
      variant="primary"
      size="sm"
    />
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#each databases as database (database.id)}
      <div
        class="group flex items-center gap-1"
        role="presentation"
        oncontextmenu={(event) => {
          event.preventDefault();
          contextMenu = {
            x: event.clientX,
            y: event.clientY,
            id: database.id,
            name: database.name,
          };
        }}
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors {database.id ===
          activeDatabaseId
            ? 'bg-emerald-600/12 font-medium text-emerald-800 dark:text-emerald-300'
            : 'text-stone-700 hover:bg-stone-500/10 dark:text-stone-200'}"
          onclick={() => onSelect(database.id)}
        >
          <Database
            class="size-4 shrink-0 opacity-70"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <span class="truncate">{database.name}</span>
        </button>

        <button
          type="button"
          class="flex size-8 shrink-0 items-center justify-center rounded-md text-stone-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-600"
          aria-label={$i18n.t("database.delete", { name: database.name })}
          onclick={() => onDelete(database.id)}
        >
          <Trash2 class="size-4" strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>
    {/each}

    {#if !databases.length}
      <p class="px-2 py-8 text-center text-sm text-stone-400">
        {$i18n.t("database.empty")}
      </p>
    {/if}
  </div>
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={[
      {
        label: $i18n.t("database.delete", { name: contextMenu.name }),
        icon: Trash2,
        danger: true,
        onSelect: () => onDelete(contextMenu!.id),
      },
    ]}
    onClose={() => (contextMenu = null)}
  />
{/if}
