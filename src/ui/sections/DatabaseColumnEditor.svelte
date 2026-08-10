<script lang="ts">
  import { onMount } from "svelte";
  import { Trash2 } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import type { I18nKey } from "../../lib/i18n";
  import { aggregateOptions } from "../../lib/utils/database";
  import type { Column, ColumnType } from "../../lib/utils/database";
  import { portal } from "../../lib/utils/portal";
  import Select from "../components/Select.svelte";
  import DatabaseOptionColors from "./DatabaseOptionColors.svelte";

  export let column: Column;
  export let databaseOptions: { id: string; name: string }[] = [];
  export let left = 0;
  export let top = 0;
  export let width = 240;
  export let columnTypes: { value: ColumnType; label: string }[] = [];
  /** Every column of this table, so rollups can name the relation they walk. */
  export let columns: Column[] = [];
  /** Relation column id -> columns of the table it links to. */
  export let relationColumns: Record<string, Column[]> = {};
  export let onUpdate: (patch: Partial<Column>) => void;
  export let onDelete: () => void;
  export let onClose: () => void = () => {};

  /** Menu-flat fields: no chrome at rest, a soft fill only on focus, like Notion. */
  const fieldClass =
    "w-full rounded-md bg-stone-500/6 px-2 py-1.5 text-sm font-normal " +
    "text-stone-800 outline-none placeholder:text-stone-400 " +
    "focus:bg-stone-500/10 dark:bg-white/5 dark:text-stone-100 " +
    "dark:focus:bg-white/10";
  const rowClass = "flex items-center gap-2 rounded-md px-1";
  const labelClass = "w-24 shrink-0 truncate text-xs text-stone-400";
  const selectClass =
    "h-7 rounded-md border-transparent bg-transparent px-1.5 shadow-none " +
    "hover:bg-stone-500/10 dark:hover:bg-white/8";
  const captionClass = "px-1 text-[0.6875rem] leading-snug text-stone-400";

  let panel: HTMLElement;

  onMount(() => {
    /**
     * Closes on any click outside. Two things are not outside: the header button
     * that opened this panel, so its own click toggles rather than reopening
     * what this closed, and any portalled popup — a select menu of this very
     * panel lives on `<body>`, and closing on it would destroy the panel before
     * the option's click could land.
     */
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || panel.contains(target)) {
        return;
      }
      if (
        target instanceof Element &&
        target.closest("[data-portal],[data-column-editor-toggle]")
      ) {
        return;
      }
      onClose();
    }

    // Capture phase: a select inside a cell can stop the event before it bubbles.
    window.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      window.removeEventListener("pointerdown", handlePointerDown, true);
  });

  $: relationOptions = columns
    .filter((entry) => entry.type === "relation")
    .map((entry) => ({ value: entry.id, label: entry.name }));
  $: targetOptions = (relationColumns[column.rollupRelation ?? ""] ?? []).map(
    (entry) => ({ value: entry.id, label: entry.name }),
  );
  $: hasOptions =
    column.type === "select" ||
    column.type === "multi_select" ||
    column.type === "status";
</script>

<div
  bind:this={panel}
  use:portal
  class="fixed z-50 flex flex-col gap-2 rounded-lg border border-stone-200/70 bg-white p-2 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.35),0_10px_20px_-15px_rgba(22,23,24,0.2)] dark:border-white/10 dark:bg-stone-900"
  style="left: {left}px; top: {top}px; width: {width}px;"
>
  <input
    class="{fieldClass} font-medium"
    aria-label={$i18n.t("database.columnName")}
    placeholder={$i18n.t("database.columnName")}
    value={column.name}
    oninput={(event) => onUpdate({ name: event.currentTarget.value })}
  />

  <div class="flex flex-col gap-0.5">
    <label class={rowClass}>
      <span class={labelClass}>{$i18n.t("database.columnKind")}</span>
      <Select
        value={column.type}
        options={columnTypes}
        rootClassName="min-w-0 flex-1"
        className={selectClass}
        onChange={(type) => onUpdate({ type: type as ColumnType })}
      />
    </label>

    {#if column.type === "relation"}
      <label class={rowClass}>
        <span class={labelClass}>{$i18n.t("database.linkedDatabase")}</span>
        <Select
          value={column.relationDatabase ?? ""}
          options={[
            { value: "", label: $i18n.t("database.linkedDatabase") },
            ...databaseOptions.map((option) => ({
              value: option.id,
              label: option.name,
            })),
          ]}
          rootClassName="min-w-0 flex-1"
          className={selectClass}
          onChange={(id) => onUpdate({ relationDatabase: id || undefined })}
        />
      </label>
    {/if}

    {#if column.type === "rollup"}
      <label class={rowClass}>
        <span class={labelClass}>{$i18n.t("database.rollupRelation")}</span>
        <Select
          value={column.rollupRelation ?? ""}
          options={[
            { value: "", label: $i18n.t("database.rollupRelation") },
            ...relationOptions,
          ]}
          rootClassName="min-w-0 flex-1"
          className={selectClass}
          onChange={(id) =>
            onUpdate({
              rollupRelation: id || undefined,
              rollupTarget: undefined,
            })}
        />
      </label>
      <label class={rowClass}>
        <span class={labelClass}>{$i18n.t("database.rollupTarget")}</span>
        <Select
          value={column.rollupTarget ?? ""}
          options={[
            { value: "", label: $i18n.t("database.rollupTarget") },
            ...targetOptions,
          ]}
          rootClassName="min-w-0 flex-1"
          className={selectClass}
          onChange={(id) => onUpdate({ rollupTarget: id || undefined })}
        />
      </label>
      <label class={rowClass}>
        <span class={labelClass}>{$i18n.t("database.calculate")}</span>
        <Select
          value={column.rollupFunction ?? "show_original"}
          options={[
            {
              value: "show_original",
              label: $i18n.t("database.aggShowOriginal"),
            },
            ...aggregateOptions
              .filter((entry) => entry !== "none")
              .map((entry) => ({
                value: entry,
                label: $i18n.t(`database.agg.${entry}` as I18nKey),
              })),
          ]}
          rootClassName="min-w-0 flex-1"
          className={selectClass}
          onChange={(value) =>
            onUpdate({ rollupFunction: value as Column["rollupFunction"] })}
        />
      </label>
    {/if}
  </div>

  {#if hasOptions}
    <div class="flex flex-col gap-1">
      <span class="{captionClass} font-medium"
        >{$i18n.t("database.options")}</span
      >
      <textarea
        rows="3"
        placeholder={$i18n.t("database.oneOptionPerLine")}
        class="{fieldClass} resize-y leading-relaxed"
        value={(column.options ?? []).join("\n")}
        oninput={(event) =>
          onUpdate({
            options: event.currentTarget.value
              .split("\n")
              .map((option) => option.trim())
              .filter(Boolean),
          })}
      ></textarea>
      <DatabaseOptionColors {column} {onUpdate} />
    </div>
  {/if}

  {#if column.type === "formula"}
    <div class="flex flex-col gap-1">
      <textarea
        rows="3"
        placeholder={"if({Done}, 1, 0) * {Size}"}
        class="{fieldClass} resize-y font-mono text-xs leading-relaxed"
        value={column.formula ?? ""}
        oninput={(event) => onUpdate({ formula: event.currentTarget.value })}
      ></textarea>
      <span class={captionClass}>{$i18n.t("database.formulaHint")}</span>
    </div>
  {/if}

  <div class="border-t border-stone-200/70 pt-1 dark:border-white/10">
    <button
      type="button"
      class="flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-stone-600 transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:text-stone-300"
      onclick={onDelete}
    >
      <Trash2 class="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      {$i18n.t("database.deleteColumn")}
    </button>
  </div>
</div>
