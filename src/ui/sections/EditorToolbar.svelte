<script lang="ts">
  import { Database, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from "@lucide/svelte";
  import Button from "../components/Button.svelte";

  type ToolbarBreadcrumb = {
    label: string;
    path?: string;
  };

  export let title: string;
  export let fileLabel: string;
  export let breadcrumbs: ToolbarBreadcrumb[] = [];
  export let isDirty: boolean;
  export let spacePaneOpen: boolean;
  export let grammarEnabled = true;
  export let databasesEnabled = true;
  export let onSelectBreadcrumb: (path: string) => void;
  export let onToggleSpacePane: () => void;
  export let onToggleSettings: () => void;
  export let onToggleDatabases: () => void;
  export let onToggleGrammar: () => void;

  $: visibleBreadcrumbs = breadcrumbs.length ? breadcrumbs : [{ label: fileLabel }];
</script>

<header
  class="flex h-12 items-center gap-1.5 border-b border-stone-200/70 bg-stone-50/80 px-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/70"
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

  <nav class="flex min-w-0 items-center gap-0 text-sm font-medium leading-none" aria-label="Current note">
    <span class="shrink-0 text-stone-500 dark:text-stone-400">
      {title}
    </span>
    {#each visibleBreadcrumbs as crumb, index}
      <span class="mx-1.5 shrink-0 text-stone-300 dark:text-stone-600" aria-hidden="true">/</span>
      {#if crumb.path}
        <button
          type="button"
          class="min-w-0 truncate rounded-sm text-left text-stone-700 transition-colors hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-200 dark:hover:text-white"
          aria-current={index === visibleBreadcrumbs.length - 1 ? "page" : undefined}
          onclick={() => onSelectBreadcrumb(crumb.path!)}
        >
          {crumb.label}
        </button>
      {:else}
        <span
          class="min-w-0 truncate text-stone-700 dark:text-stone-200"
          aria-current={index === visibleBreadcrumbs.length - 1 ? "page" : undefined}
          >{crumb.label}</span
        >
      {/if}
    {/each}
    {#if isDirty}
      <span
        class="ml-0.5 size-1.5 shrink-0 rounded-full bg-amber-500"
        title="Unsaved changes"
        aria-label="Unsaved changes"
      ></span>
    {/if}
  </nav>

  <div class="ml-auto flex shrink-0 items-center gap-0.5">
    {#if grammarEnabled}
      <Button
        label="Grammar Police"
        icon={ShieldCheck}
        onClick={onToggleGrammar}
        variant="ghost"
        size="sm"
      />
    {/if}
    {#if databasesEnabled}
      <Button
        label="Databases"
        icon={Database}
        onClick={onToggleDatabases}
        variant="ghost"
        size="sm"
      />
    {/if}
    <Button
      label="Settings"
      icon={Settings}
      onClick={onToggleSettings}
      variant="ghost"
      size="sm"
    />
  </div>
</header>
