<script lang="ts">
  import { scale } from "svelte/transition";

  export let onClose: () => void;
</script>

<div
  class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
  role="presentation"
  onclick={onClose}
>
  <div
    class="relative z-50 overflow-hidden rounded-xl border border-stone-200/50 shadow-xl dark:border-stone-800/50"
    role="presentation"
    transition:scale={{ duration: 150, start: 0.95 }}
    onclick={(event) => event.stopPropagation()}
  >
    <slot />
  </div>
</div>
