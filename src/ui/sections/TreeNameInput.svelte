<script lang="ts">
  export let value: string;
  export let depth: number;
  export let onCommit: (name: string) => void;
  export let onCancel: () => void;

  let input: HTMLInputElement | undefined;
  let settled = false;

  $: if (input) {
    input.focus();
    input.select();
  }

  function commit() {
    if (settled) {
      return;
    }

    settled = true;
    const name = value.trim();

    if (name) {
      onCommit(name);
    } else {
      onCancel();
    }
  }
</script>

<input
  bind:this={input}
  bind:value
  class="w-full rounded-md border border-emerald-600/40 bg-white py-0.5 pr-1 text-[0.8125rem] text-stone-800 outline-none dark:bg-stone-900 dark:text-stone-100"
  style="padding-left: {depth * 0.75 + 0.75}rem"
  onkeydown={(event) => {
    if (event.key === "Enter") {
      commit();
    }

    if (event.key === "Escape") {
      settled = true;
      onCancel();
    }
  }}
  onblur={commit}
/>
