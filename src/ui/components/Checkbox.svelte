<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let checked = false;
  export let label: string;
  export let className = "";
</script>

<label
  class={cn(
    "inline-flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200",
    className,
  )}
>
  <input
    type="checkbox"
    bind:checked
    class="size-4 rounded border-stone-300 text-emerald-700 focus:ring-emerald-700 dark:border-stone-700 dark:bg-stone-950"
  />
  <span>{label}</span>
</label>
