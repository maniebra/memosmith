<script lang="ts">
  import type { CellValue, Choice, Column } from "../../lib/utils/database";
  import Select from "./Select.svelte";

  export let column: Column;
  export let value: CellValue;
  export let onChange: (value: CellValue) => void;
  /** Options for select columns, or the linked rows of a relation column. */
  export let choices: Choice[] = [];

  const inputClass =
    "w-full bg-transparent px-2 py-1.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/30 dark:text-stone-100";

  $: multi = column.type === "multi_select" || column.type === "relation";
  $: selected = Array.isArray(value) ? value.map(String) : [];

  function toggleChoice(choice: string) {
    onChange(selected.includes(choice) ? selected.filter((entry) => entry !== choice) : [...selected, choice]);
  }
</script>

{#if column.type === "checkbox"}
  <div class="flex px-2 py-1.5">
    <input
      type="checkbox"
      checked={Boolean(value)}
      class="size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-950"
      onchange={(event) => onChange(event.currentTarget.checked)}
    />
  </div>
{:else if column.type === "select"}
  <div class="px-1 py-1">
    <Select
      value={value === null || value === undefined ? "" : String(value)}
      options={[{ value: "", label: "—" }, ...choices]}
      className="h-8 rounded-md border-transparent bg-transparent shadow-none"
      onChange={(next) => onChange(next || null)}
    />
  </div>
{:else if multi}
  <div class="flex flex-wrap gap-1 px-2 py-1">
    {#each choices as choice}
      <button
        type="button"
        class="rounded-full border px-2 py-0.5 text-[0.6875rem] transition-colors {selected.includes(choice.value)
          ? 'border-emerald-600/40 bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
          : 'border-stone-200 text-stone-500 hover:bg-stone-500/10 dark:border-stone-700'}"
        onclick={() => toggleChoice(choice.value)}
      >
        {choice.label}
      </button>
    {/each}
    {#if !choices.length}
      <span class="text-xs text-stone-400">
        {column.type === "relation" ? "No linked database" : "No options"}
      </span>
    {/if}
  </div>
{:else if column.type === "number"}
  <input
    type="number"
    class={inputClass}
    value={value === null || value === undefined ? "" : String(value)}
    oninput={(event) => onChange(event.currentTarget.value === "" ? null : Number(event.currentTarget.value))}
  />
{:else if column.type === "date"}
  <input
    type="date"
    class={inputClass}
    value={value ? String(value) : ""}
    oninput={(event) => onChange(event.currentTarget.value || null)}
  />
{:else}
  <input
    type={column.type === "url" ? "url" : "text"}
    class={inputClass}
    placeholder="Empty"
    value={value === null || value === undefined ? "" : String(value)}
    oninput={(event) => onChange(event.currentTarget.value)}
  />
{/if}
