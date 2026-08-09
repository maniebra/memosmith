<script lang="ts">
  export let label: string;
  export let hint = "";
  export let forId = "";
</script>

<div class="grid gap-1.5">
  {#if forId}
    <label
      class="text-sm font-medium text-stone-800 dark:text-stone-200"
      for={forId}>{label}</label
    >
  {:else}
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200"
      >{label}</span
    >
  {/if}

  <slot />

  {#if hint}
    <span class="text-xs text-stone-500 dark:text-stone-400">{hint}</span>
  {/if}
</div>
