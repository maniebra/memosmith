<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let label: string;
  export let tone: "neutral" | "success" | "warning" | "danger" = "neutral";
  export let className = "";

  $: classes = cn(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
    tone === "neutral" &&
      "border-stone-300 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200",
    tone === "success" &&
      "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    tone === "warning" &&
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200",
    tone === "danger" &&
      "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200",
    className,
  );
</script>

<span class={classes}>{label}</span>
