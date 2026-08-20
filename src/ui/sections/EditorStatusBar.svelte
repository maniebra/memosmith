<script lang="ts">
  import { i18n } from "../../lib/i18n";
  import { vimSubMode } from "../../lib/utils/vimMode";

  export let statusMessage: string;
  export let words: number;
  export let characters: number;
</script>

<footer
  class="flex h-9 items-center gap-4 border-t border-stone-200/70 bg-stone-50/80 px-4 text-xs text-stone-400 backdrop-blur dark:border-stone-800 dark:bg-stone-900/70 dark:text-stone-500"
>
  <span class="min-w-0 truncate">{statusMessage}</span>
  {#if $vimSubMode}
    <span
      class="ml-auto shrink-0 rounded border border-stone-300 px-1.5 py-0.5 font-medium tracking-wide text-stone-500 uppercase dark:border-stone-700 dark:text-stone-400"
    >
      {$vimSubMode}
    </span>
  {/if}
  <span class="shrink-0 tabular-nums {$vimSubMode ? '' : 'ml-auto'}">
    {$i18n.t("status.counts", { words, characters })}
  </span>
</footer>
