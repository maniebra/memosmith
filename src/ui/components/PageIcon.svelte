<script lang="ts">
  import {
    BookOpen,
    Briefcase,
    Calendar,
    CheckSquare,
    Code,
    FileText,
    Folder,
    Heart,
    Image as ImageIcon,
    Lightbulb,
    ListTodo,
    Map,
    Music,
    PenLine,
    Rocket,
    Sparkles,
    Star,
    Tag,
    Target,
    Users,
  } from "@lucide/svelte";
  import type { PageIcon } from "../../lib/utils/pageMeta";
  import { cn } from "../../lib/utils/cn";

  export let icon: PageIcon | null | undefined = null;
  export let fallback: any = FileText;
  export let className = "";

  const lucideIcons: Record<string, any> = {
    BookOpen,
    Briefcase,
    Calendar,
    CheckSquare,
    Code,
    FileText,
    Folder,
    Heart,
    Image: ImageIcon,
    Lightbulb,
    ListTodo,
    Map,
    Music,
    PenLine,
    Rocket,
    Sparkles,
    Star,
    Tag,
    Target,
    Users,
  };

  $: component = icon?.type === "lucide" ? (lucideIcons[icon.value] ?? fallback) : fallback;
</script>

{#if icon?.type === "emoji"}
  <span
    class={cn("inline-flex shrink-0 items-center justify-center leading-none", className)}
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
