<script lang="ts">
  export let statusMessage: string;
  export let words: number;
  export let characters: number;
</script>

<footer
  class="flex h-9 items-center gap-4 border-t border-stone-200/70 bg-stone-50/80 px-4 text-xs text-stone-400 backdrop-blur dark:border-stone-800 dark:bg-stone-900/70 dark:text-stone-500"
>
  <span class="min-w-0 truncate">{statusMessage}</span>
  <span class="ml-auto shrink-0 tabular-nums">
    {words} words · {characters} characters
  </span>
</footer>
