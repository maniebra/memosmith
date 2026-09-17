<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  let {
    value = $bindable(""),
    placeholder = "",
    type = "text" as "text" | "email" | "password" | "search" | "url",
    className = "",
    oninput = undefined as ((event: Event) => void) | undefined,
    onkeydown = undefined as ((event: KeyboardEvent) => void) | undefined,
  } = $props();
</script>

<input
  bind:value
  {type}
  dir="auto"
  {placeholder}
  {oninput}
  {onkeydown}
  class={cn(
    "h-10 w-full rounded-md border border-stone-300 bg-surface px-3 text-sm text-stone-950 shadow-sm transition-colors",
    "placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30",
    "dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500",
    className,
  )}
/>
