<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let label: string;
  export let onClick: () => void | Promise<void>;
  export let icon: any = null;
  export let variant: "primary" | "secondary" | "ghost" = "secondary";
  export let size: "sm" | "md" | "lg" = "md";
  export let disabled = false;
  export let className = "";
  /** Icon buttons hide their label by default; this puts the text back beside it. */
  export let showLabel = false;

  $: classes = cn(
    "inline-flex items-center justify-center rounded-lg border font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
    "disabled:pointer-events-none disabled:opacity-50",
    icon && showLabel && "gap-2",
    icon && !showLabel && size === "sm" && "size-8 p-0",
    icon && !showLabel && size === "md" && "size-9 p-0",
    icon && !showLabel && size === "lg" && "size-11 p-0",
    icon && showLabel && size === "sm" && "h-8 px-2.5 text-[0.8125rem]",
    icon && showLabel && size === "md" && "h-9 px-3 text-sm",
    icon && showLabel && size === "lg" && "h-11 px-4 text-base",
    !icon && size === "sm" && "h-8 px-2.5 text-[0.8125rem]",
    !icon && size === "md" && "h-9 min-w-20 px-3 text-sm",
    !icon && size === "lg" && "h-11 min-w-20 px-4 text-base",
    variant === "primary" &&
      "border-emerald-700 bg-emerald-700 text-white shadow-sm hover:bg-emerald-800 dark:border-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-500",
    variant === "secondary" &&
      "border-stone-200 bg-white text-stone-800 shadow-sm hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700",
    variant === "ghost" &&
      "border-transparent bg-transparent text-stone-500 hover:bg-stone-500/10 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
    className,
  );
</script>

<button type="button" class={classes} {disabled} onclick={onClick}>
  {#if icon}
    <svelte:component
      this={icon}
      class="size-4 shrink-0"
      strokeWidth={1.8}
      aria-hidden="true"
    />
  {/if}
  <span class={icon && !showLabel ? "sr-only" : ""}>{label}</span>
</button>
