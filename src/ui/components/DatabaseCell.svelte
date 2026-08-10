<script lang="ts">
  import { onDestroy } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import { i18n } from "../../lib/i18n";
  import { asDisplay, computedTypes } from "../../lib/utils/database";
  import { optionChipStyle, palette } from "../../lib/utils/optionColors";
  import type { CellValue, Choice, Column } from "../../lib/utils/database";
  import DatePicker from "./DatePicker.svelte";
  import Select from "./Select.svelte";

  export let column: Column;
  export let value: CellValue;
  export let onChange: (value: CellValue) => void;
  /** Options for select columns, or the linked rows of a relation column. */
  export let choices: Choice[] = [];
  /** Embedded cells commit on blur so the host editor does not rebuild the card while typing. */
  export let commitOnInput = true;

  const inputClass =
    "w-full bg-transparent px-2 py-1.5 text-sm text-stone-800 outline-none placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/30 dark:text-stone-100";

  $: multi = column.type === "multi_select" || column.type === "relation";
  $: selected = Array.isArray(value) ? value.map(String) : [];
  $: readOnly = computedTypes.includes(column.type);
  $: files = Array.isArray(value) ? value.map(String) : [];
  $: isEmpty = value === null || value === undefined || value === "";

  async function addFiles() {
    const picked = await open({ multiple: true });
    const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];

    if (paths.length) {
      onChange([...files, ...paths]);
    }
  }

  function fileName(path: string) {
    return path.split(/[\\/]/).pop() || path;
  }

  let draft = "";
  let committedDraft = "";
  let editing = false;

  function inputText(value: CellValue) {
    return value === null || value === undefined ? "" : String(value);
  }

  $: externalDraft = inputText(value);

  $: if (!editing) {
    draft = externalDraft;
    committedDraft = externalDraft;
  } else if (externalDraft === draft) {
    committedDraft = externalDraft;
  }

  function draftValue(): CellValue {
    if (column.type === "number") {
      return draft === "" ? null : Number(draft);
    }

    if (column.type === "date") {
      return draft || null;
    }

    return draft;
  }

  function commitDraft() {
    if (draft === committedDraft) {
      return;
    }

    committedDraft = draft;
    onChange(draftValue());
  }

  function updateDraft(next: string) {
    editing = true;
    draft = next;

    if (commitOnInput) {
      commitDraft();
    }
  }

  function finishDraft() {
    commitDraft();
    editing = false;
  }

  function updateTextDraft(event: Event) {
    event.stopPropagation();
    updateDraft((event.currentTarget as HTMLInputElement).value);
  }

  function stopEditorEvent(event: Event) {
    event.stopPropagation();
  }

  function toggleChoice(choice: string) {
    onChange(
      selected.includes(choice)
        ? selected.filter((entry) => entry !== choice)
        : [...selected, choice],
    );
  }

  onDestroy(commitDraft);
</script>

{#if readOnly}
  <div
    class="truncate px-2 py-1.5 text-sm text-stone-600 dark:text-stone-300"
    title={asDisplay(value)}
  >
    {asDisplay(value) || "—"}
  </div>
{:else if column.type === "files"}
  <div class="flex flex-wrap items-center gap-1 px-2 py-1">
    {#each files as path, index (path + index)}
      <span
        class="inline-flex max-w-full items-center gap-1 rounded-md bg-stone-500/10 px-1.5 py-0.5 text-[0.6875rem] text-stone-600 dark:text-stone-300"
      >
        <span class="truncate" title={path}>{fileName(path)}</span>
        <button
          type="button"
          class="text-stone-400 hover:text-rose-600"
          aria-label={$i18n.t("common.remove")}
          onclick={() =>
            onChange(files.filter((_, entry) => entry !== index))}>×</button
        >
      </span>
    {/each}
    <button
      type="button"
      class="rounded-md px-1.5 py-0.5 text-[0.6875rem] text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
      onclick={() => void addFiles()}>{$i18n.t("common.add")}</button
    >
  </div>
{:else if column.type === "checkbox"}
  <div class="flex px-2 py-1.5">
    <input
      type="checkbox"
      checked={Boolean(value)}
      class="size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-950"
      oninput={stopEditorEvent}
      onkeydown={stopEditorEvent}
      onchange={(event) => {
        event.stopPropagation();
        onChange(event.currentTarget.checked);
      }}
    />
  </div>
{:else if column.type === "select" || column.type === "status"}
  <div class="px-1 py-1">
    <Select
      value={value === null || value === undefined ? "" : String(value)}
      options={[{ value: "", label: "—" }, ...choices]}
      className="h-7 rounded-full border-transparent px-2.5 text-xs shadow-none {isEmpty
        ? 'bg-transparent text-stone-400'
        : 'db-chip'}"
      triggerStyle={isEmpty
        ? ""
        : optionChipStyle(column, String(value), $palette)}
      onChange={(next) => onChange(next || null)}
    />
  </div>
{:else if multi}
  <div class="flex flex-wrap gap-1 px-2 py-1">
    {#each choices as choice}
      <button
        type="button"
        class="rounded-full px-2 py-0.5 text-[0.6875rem] transition-colors {selected.includes(
          choice.value,
        )
          ? column.type === 'relation'
            ? 'bg-stone-500/15 text-stone-700 dark:text-stone-300'
            : 'db-chip'
          : 'text-stone-400 hover:bg-stone-500/10'}"
        style={selected.includes(choice.value) && column.type !== "relation"
          ? optionChipStyle(column, choice.value, $palette)
          : ""}
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
    value={draft}
    onbeforeinput={stopEditorEvent}
    oninput={updateTextDraft}
    onkeydown={stopEditorEvent}
    oncompositionstart={stopEditorEvent}
    oncompositionend={stopEditorEvent}
    onblur={finishDraft}
  />
{:else if column.type === "date"}
  <DatePicker
    value={typeof value === "string" ? value : ""}
    rootClassName=""
    className="border-transparent bg-transparent"
    onChange={(next) => onChange(next || null)}
  />
{:else}
  <input
    type={column.type === "url"
      ? "url"
      : column.type === "email"
        ? "email"
        : column.type === "phone"
          ? "tel"
          : "text"}
    class={inputClass}
    placeholder={$i18n.t("database.emptyCell")}
    value={draft}
    onbeforeinput={stopEditorEvent}
    oninput={updateTextDraft}
    onkeydown={stopEditorEvent}
    oncompositionstart={stopEditorEvent}
    oncompositionend={stopEditorEvent}
    onblur={finishDraft}
  />
{/if}
