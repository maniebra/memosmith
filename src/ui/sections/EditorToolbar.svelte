<script lang="ts">
  import { Database, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from "@lucide/svelte";
  import Button from "../components/Button.svelte";

  export let title: string;
  export let fileLabel: string;
  export let isDirty: boolean;
  export let spacePaneOpen: boolean;
  export let onToggleSpacePane: () => void;
  export let onToggleSettings: () => void;
  export let onToggleDatabases: () => void;
  export let onToggleGrammar: () => void;
</script>

<header
  class="flex h-12 items-center gap-3 border-b border-stone-200/70 bg-stone-50/80 px-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/70"
  aria-label="Editor toolbar"
>
  <button
    type="button"
    class="group flex size-7 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
    aria-label="Toggle space pane"
    aria-pressed={spacePaneOpen}
    title="Toggle space pane (Ctrl B)"
    onclick={onToggleSpacePane}
  >
    {#if spacePaneOpen}
      <PanelLeftClose class="size-4" strokeWidth={1.8} aria-hidden="true" />
    {:else}
      <PanelLeftOpen class="size-4" strokeWidth={1.8} aria-hidden="true" />
    {/if}
  </button>

  <span
    class="shrink-0 text-sm font-semibold tracking-tight text-stone-400 dark:text-stone-500"
  >
    {title}
  </span>
  <span class="shrink-0 text-stone-300 dark:text-stone-700">/</span>

  <div class="flex min-w-0 items-center gap-2">
    <span
      class="truncate text-sm font-medium text-stone-800 dark:text-stone-100"
      >{fileLabel}</span
    >
    {#if isDirty}
      <span
        class="size-1.5 shrink-0 rounded-full bg-amber-500"
        title="Unsaved changes"
        aria-label="Unsaved changes"
      ></span>
    {/if}
  </div>

  <div class="ml-auto flex shrink-0 items-center gap-0.5">
    <Button
      label="Grammar Police"
      icon={ShieldCheck}
      onClick={onToggleGrammar}
      variant="ghost"
      size="sm"
    />
    <Button
      label="Databases"
      icon={Database}
      onClick={onToggleDatabases}
      variant="ghost"
      size="sm"
    />
    <Button
      label="Settings"
      icon={Settings}
      onClick={onToggleSettings}
      variant="ghost"
      size="sm"
    />
  </div>
</header>
