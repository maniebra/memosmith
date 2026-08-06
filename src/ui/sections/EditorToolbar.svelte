<script lang="ts">
  import Button from "../components/Button.svelte";

  export let title: string;
  export let displayName: string;
  export let onNew: () => void;
  export let onOpen: () => void | Promise<void>;
  export let onSave: () => void | Promise<void>;
  export let onSaveAs: () => void | Promise<void>;
</script>

<header
  class="flex flex-col gap-4 border-b border-stone-300 bg-stone-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800 dark:bg-stone-900"
  aria-label="Editor toolbar"
>
  <div class="min-w-0">
    <h1 class="m-0 text-xl font-bold tracking-normal text-stone-950 dark:text-stone-50">{title}</h1>
    <p class="mt-0.5 truncate text-sm text-stone-500 dark:text-stone-300">{displayName}</p>
  </div>

  <div class="flex flex-wrap gap-2 sm:justify-end">
    <Button label="New" onClick={onNew} className="flex-1 sm:flex-none" />
    <Button label="Open" onClick={onOpen} className="flex-1 sm:flex-none" />
    <Button label="Save" onClick={onSave} variant="primary" className="flex-1 sm:flex-none" />
    <Button label="Save As" onClick={onSaveAs} className="flex-1 sm:flex-none" />
  </div>
</header>
