<script lang="ts">
  export let statusMessage: string;
  export let words: number;
  export let characters: number;
</script>

<footer
  class="flex min-h-11 flex-col gap-1 border-t border-stone-300 bg-stone-50 px-4 py-2 text-sm text-stone-500 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300"
>
  <span class="min-w-0 truncate">{statusMessage}</span>
  <span class="shrink-0">{words} words / {characters} characters</span>
</footer>
