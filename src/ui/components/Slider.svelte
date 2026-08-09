<script lang="ts">
  export let value = 50;
  export let min = 0;
  export let max = 100;
  export let step = 1;
  export let label = "";
  export let onChange: (value: number) => void = () => {};

  function handleInput() {
    onChange(value);
  }
</script>

<label class="grid gap-2">
  {#if label}
    <span
      class="flex items-center justify-between text-sm font-medium text-stone-800 dark:text-stone-200"
    >
      <span>{label}</span>
      <span class="text-stone-500 dark:text-stone-400">{value}</span>
    </span>
  {/if}

  <input
    type="range"
    bind:value
    {min}
    {max}
    {step}
    oninput={handleInput}
    class="h-2 w-full cursor-pointer accent-emerald-700"
  />
</label>
