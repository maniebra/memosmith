<script lang="ts">
  import Button from "../components/Button.svelte";

  export let title: string;
  export let fileLabel: string;
  export let isDirty: boolean;
  export let onToggleSettings: () => void;
</script>

<header
  class="flex h-12 items-center gap-3 border-b border-stone-200/70 bg-stone-50/80 px-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/70"
  aria-label="Editor toolbar"
>
  <span class="shrink-0 text-sm font-semibold tracking-tight text-stone-400 dark:text-stone-500">
    {title}
  </span>
  <span class="shrink-0 text-stone-300 dark:text-stone-700">/</span>

  <div class="flex min-w-0 items-center gap-2">
    <span class="truncate text-sm font-medium text-stone-800 dark:text-stone-100">{fileLabel}</span>
    {#if isDirty}
      <span
        class="size-1.5 shrink-0 rounded-full bg-amber-500"
        title="Unsaved changes"
        aria-label="Unsaved changes"
      ></span>
    {/if}
  </div>

  <div class="ml-auto flex shrink-0 items-center gap-0.5">
    <Button label="Settings" onClick={onToggleSettings} variant="ghost" size="sm" />
  </div>
</header>
