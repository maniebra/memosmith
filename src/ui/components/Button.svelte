<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let label: string;
  export let onClick: () => void | Promise<void>;
  export let variant: "primary" | "secondary" | "ghost" = "secondary";
  export let size: "sm" | "md" | "lg" = "md";
  export let disabled = false;
  export let className = "";

  $: classes = cn(
    "inline-flex min-w-20 items-center justify-center rounded-md border font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    size === "sm" && "h-8 px-2.5 text-xs",
    size === "md" && "h-9 px-3 text-sm",
    size === "lg" && "h-11 px-4 text-base",
    variant === "primary" &&
      "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 dark:border-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500",
    variant === "secondary" &&
      "border-stone-300 bg-white text-stone-900 hover:border-emerald-700 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:hover:border-emerald-400 dark:hover:bg-stone-700",
    variant === "ghost" &&
      "border-transparent bg-transparent text-stone-700 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800",
    className,
  );
</script>

<button type="button" class={classes} {disabled} onclick={onClick}>{label}</button>
