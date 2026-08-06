<script lang="ts" context="module">
  export type SelectOption = {
    label: string;
    value: string;
  };
</script>

<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let value = "";
  export let options: SelectOption[] = [];
  export let className = "";
</script>

<select
  bind:value
  class={cn(
    "h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-950 shadow-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30",
    "dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100",
    className,
  )}
>
  {#each options as option}
    <option value={option.value}>{option.label}</option>
  {/each}
</select>
