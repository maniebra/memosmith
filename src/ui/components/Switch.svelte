<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let checked = false;
  export let label: string;
  export let className = "";
  export let onChange: (checked: boolean) => void = () => {};
  /** Set when the row has details of its own: the label opens them, the knob toggles. */
  export let onLabel: (() => void) | null = null;

  function toggle() {
    checked = !checked;
    onChange(checked);
  }
</script>

<div
  class={cn(
    "inline-flex items-center gap-3 text-sm text-stone-800 dark:text-stone-200",
    className,
  )}
>
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    class="shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:outline-none"
    onclick={toggle}
  >
    <span
      class={cn(
        "flex h-6 w-11 items-center rounded-full border p-0.5 transition-colors",
        checked
          ? "border-emerald-700 bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-600"
          : "border-stone-300 bg-stone-200 dark:border-stone-700 dark:bg-stone-800",
      )}
    >
      <span
        class={cn(
          "size-4 rounded-full bg-surface shadow transition-transform",
          checked && "translate-x-5",
        )}
      ></span>
    </span>
  </button>
  <button
    type="button"
    class="min-w-0 flex-1 truncate rounded-md py-1 text-left focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:outline-none"
    onclick={onLabel ?? toggle}>{label}</button
  >
</div>
