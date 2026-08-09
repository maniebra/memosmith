<script lang="ts">
  export let value = 0;
  export let label = "";

  $: clampedValue = Math.min(100, Math.max(0, value));
</script>

<div class="grid gap-2">
  {#if label}
    <div
      class="flex justify-between text-sm font-medium text-stone-800 dark:text-stone-200"
    >
      <span>{label}</span>
      <span class="text-stone-500 dark:text-stone-400">{clampedValue}%</span>
    </div>
  {/if}

  <div class="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
    <div
      class="h-full rounded-full bg-emerald-700 dark:bg-emerald-500"
      style={`width: ${clampedValue}%`}
    ></div>
  </div>
</div>
