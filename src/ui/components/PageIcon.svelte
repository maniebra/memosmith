<script lang="ts">
  import { FileText } from "@lucide/svelte";
  import type { PageIcon } from "../../lib/utils/pageMeta";
  import { lucideIconComponents } from "../../lib/utils/pageIconComponents";
  import type { LucideIconName } from "../../lib/utils/pageIcons";
  import { cn } from "../../lib/utils/cn";

  export let icon: PageIcon | null | undefined = null;
  export let fallback: any = FileText;
  export let className = "";

  $: component =
    icon?.type === "lucide"
      ? (lucideIconComponents[icon.value as LucideIconName] ?? fallback)
      : fallback;
</script>

{#if icon?.type === "emoji"}
  <span
    class={cn(
      "inline-flex shrink-0 items-center justify-center leading-none",
      className,
    )}
    aria-hidden="true"
  >
    {icon.value}
  </span>
{:else}
  <svelte:component
    this={component}
    class={cn("shrink-0", className)}
    strokeWidth={1.8}
    aria-hidden="true"
  />
{/if}
