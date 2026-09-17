<script lang="ts">
  import { Plus } from "@lucide/svelte";
  import { i18n } from "../../../lib/i18n";

  export let top = 0;
  export let onAdd: () => void = () => {};
</script>

<div
  class="absolute right-0 left-0 z-20 flex h-7 items-start"
  style={`top: ${top}px;`}
  role="presentation"
  onpointerdown={(event) => {
    if (event.target === event.currentTarget) {
      event.preventDefault();
      onAdd();
    }
  }}
>
  <button
    type="button"
    class="flex h-7 w-full items-center justify-center rounded-md border border-dashed border-stone-300 bg-canvas/90 text-stone-400 opacity-0 shadow-sm backdrop-blur transition-[border-color,background-color,color,opacity] hover:border-emerald-600/40 hover:bg-emerald-50/80 hover:text-emerald-700 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:border-stone-700 dark:bg-canvas/90 dark:text-stone-500 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
    title={$i18n.t("editor.addBlock")}
    aria-label={$i18n.t("editor.addBlock")}
    onmousedown={(event) => event.preventDefault()}
    onclick={(event) => {
      event.stopPropagation();
      onAdd();
    }}
  >
    <Plus class="size-4" strokeWidth={1.8} aria-hidden="true" />
  </button>
</div>
