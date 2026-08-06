<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let checked = false;
  export let label: string;
  export let className = "";
  export let onChange: (checked: boolean) => void = () => {};

  function toggle() {
    checked = !checked;
    onChange(checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  class={cn("inline-flex items-center gap-3 text-sm text-stone-800 dark:text-stone-200", className)}
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
        "size-4 rounded-full bg-white shadow transition-transform",
        checked && "translate-x-5",
      )}
    ></span>
  </span>
  <span>{label}</span>
</button>
