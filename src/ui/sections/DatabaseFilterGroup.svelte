<script lang="ts">
  import { Plus, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import {
    isGroup,
    needsValue,
    newId,
    operatorLabels,
    operatorsFor,
  } from "../../lib/utils/database";
  import type {
    CellValue,
    Choice,
    Column,
    FilterCondition,
    FilterGroup,
    FilterNode,
  } from "../../lib/utils/database";
  import Self from "./DatabaseFilterGroup.svelte";
  import DatePicker from "../components/DatePicker.svelte";
  import Select from "../components/Select.svelte";

  export let group: FilterGroup;
  export let columns: Column[];
  /** Column id -> selectable values, already resolved for relation columns. */
  export let choices: Record<string, Choice[]> = {};
  export let onChange: (group: FilterGroup) => void;
  export let onRemove: (() => void) | null = null;
  export let depth = 0;

  const dateTypes = ["date", "created_time", "edited_time"];
  const controlClass =
    "h-7 rounded-md border border-stone-200 bg-white px-1.5 text-xs text-stone-700 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200";

  function replaceChild(index: number, child: FilterNode) {
    onChange({
      ...group,
      children: group.children.map((entry, i) => (i === index ? child : entry)),
    });
  }

  function removeChild(index: number) {
    onChange({
      ...group,
      children: group.children.filter((_, i) => i !== index),
    });
  }

  function addCondition() {
    const column = columns[0];

    if (!column) {
      return;
    }

    const condition: FilterCondition = {
      id: newId(),
      column: column.id,
      operator: operatorsFor(column.type)[0],
      value: column.type === "checkbox" ? true : "",
    };

    onChange({ ...group, children: [...group.children, condition] });
  }

  function addGroup() {
    onChange({
      ...group,
      children: [
        ...group.children,
        { id: newId(), conjunction: "and", children: [] },
      ],
    });
  }

  function changeColumn(
    index: number,
    condition: FilterCondition,
    columnId: string,
  ) {
    const column = columns.find((entry) => entry.id === columnId);
    const operators = operatorsFor(column?.type ?? "text");

    replaceChild(index, {
      ...condition,
      column: columnId,
      operator: operators.includes(condition.operator)
        ? condition.operator
        : operators[0],
      value: column?.type === "checkbox" ? true : "",
    });
  }

  function conditionValue(condition: FilterCondition): string {
    return condition.value === null || condition.value === undefined
      ? ""
      : String(condition.value);
  }

  function parseValue(column: Column | undefined, raw: string): CellValue {
    return column?.type === "number" ? (raw === "" ? null : Number(raw)) : raw;
  }

  function columnOf(condition: FilterCondition) {
    return columns.find((entry) => entry.id === condition.column);
  }
</script>

<div
  class="flex flex-col gap-1.5 rounded-lg {depth
    ? 'border border-stone-200/80 bg-stone-500/5 p-1.5 dark:border-stone-700/60'
    : ''}"
>
  {#each group.children as child, index (child.id)}
    <div class="flex items-start gap-1.5">
      <div
        class="w-14 shrink-0 pt-1 text-right text-[0.6875rem] text-stone-500"
      >
        {#if index === 0}
          {$i18n.t("filter.where")}
        {:else if index === 1}
          <Select
            value={group.conjunction}
            options={[
              { value: "and", label: $i18n.t("filter.and") },
              { value: "or", label: $i18n.t("filter.or") },
            ]}
            className="{controlClass} w-full px-1"
            onChange={(conjunction) =>
              onChange({ ...group, conjunction: conjunction as "and" | "or" })}
          />
        {:else}
          {group.conjunction === "and"
            ? $i18n.t("filter.and")
            : $i18n.t("filter.or")}
        {/if}
      </div>

      {#if isGroup(child)}
        <div class="min-w-0 flex-1">
          <Self
            group={child}
            {columns}
            {choices}
            depth={depth + 1}
            onChange={(next) => replaceChild(index, next)}
            onRemove={() => removeChild(index)}
          />
        </div>
      {:else}
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Select
            value={child.column}
            options={columns.map((column) => ({
              value: column.id,
              label: column.name,
            }))}
            className="{controlClass} w-32"
            onChange={(columnId) => changeColumn(index, child, columnId)}
          />

          <Select
            value={child.operator}
            options={operatorsFor(columnOf(child)?.type ?? "text").map(
              (operator) => ({
                value: operator,
                label: operatorLabels[operator],
              }),
            )}
            className="{controlClass} w-36"
            onChange={(operator) =>
              replaceChild(index, {
                ...child,
                operator: operator as FilterCondition["operator"],
              })}
          />

          {#if needsValue(child.operator)}
            {#if columnOf(child)?.type === "checkbox"}
              <Select
                value={String(Boolean(child.value))}
                options={[
                  { value: "true", label: $i18n.t("filter.checked") },
                  { value: "false", label: $i18n.t("filter.unchecked") },
                ]}
                className="{controlClass} w-28"
                onChange={(checked) =>
                  replaceChild(index, { ...child, value: checked === "true" })}
              />
            {:else if choices[child.column]?.length}
              <Select
                value={conditionValue(child)}
                options={[
                  { value: "", label: $i18n.t("common.select") },
                  ...choices[child.column],
                ]}
                className="{controlClass} w-32"
                onChange={(value) => replaceChild(index, { ...child, value })}
              />
            {:else if dateTypes.includes(columnOf(child)?.type ?? "")}
              <DatePicker
                value={conditionValue(child)}
                rootClassName=""
                className="{controlClass} w-32"
                ariaLabel={$i18n.t("filter.value")}
                onChange={(value) => replaceChild(index, { ...child, value })}
              />
            {:else}
              <input
                class="{controlClass} w-32"
                type={columnOf(child)?.type === "number" ? "number" : "text"}
                value={conditionValue(child)}
                placeholder={$i18n.t("filter.value")}
                oninput={(event) =>
                  replaceChild(index, {
                    ...child,
                    value: parseValue(
                      columnOf(child),
                      event.currentTarget.value,
                    ),
                  })}
              />
            {/if}
          {/if}
        </div>
      {/if}

      <button
        type="button"
        class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-200"
        aria-label={$i18n.t("filter.remove")}
        onclick={() => removeChild(index)}
      >
        <X class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
      </button>
    </div>
  {/each}

  <div class="flex items-center gap-1.5 pl-[3.875rem]">
    <button
      type="button"
      class="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[0.6875rem] text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
      onclick={addCondition}
    >
      <Plus class="size-3" strokeWidth={2} aria-hidden="true" />
      {$i18n.t("filter.add")}
    </button>

    {#if depth < 2}
      <button
        type="button"
        class="rounded-md px-1.5 py-1 text-[0.6875rem] text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
        onclick={addGroup}
      >
        {$i18n.t("filter.addGroup")}
      </button>
    {/if}

    {#if onRemove}
      <button
        type="button"
        class="rounded-md px-1.5 py-1 text-[0.6875rem] text-stone-400 hover:bg-stone-500/10 hover:text-rose-600"
        onclick={onRemove}
      >
        {$i18n.t("filter.removeGroup")}
      </button>
    {/if}
  </div>
</div>
