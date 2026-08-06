<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let value: string;
  export let element: HTMLTextAreaElement | undefined = undefined;
  export let placeholder = "";
  export let className = "";
  export let size: "sm" | "md" | "lg" | "fill" = "md";
  export let onInput: () => void = () => {};

  $: sizeClass = {
    sm: "min-h-24",
    md: "min-h-36",
    lg: "min-h-[17.5rem]",
    fill: "h-full min-h-[17.5rem]",
  }[size];
</script>

<textarea
  bind:this={element}
  bind:value
  spellcheck="true"
  {placeholder}
  class={cn(
    "w-full resize-none rounded-lg border border-stone-300 bg-stone-50 px-5 py-4 font-mono text-base leading-relaxed text-stone-950 shadow-inner caret-emerald-700",
    "placeholder:text-stone-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30",
    "dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500",
    sizeClass,
    className,
  )}
  oninput={onInput}
></textarea>
