<script lang="ts">
  import { onDestroy } from "svelte";
  import { i18n } from "../../lib/i18n";
  import type {
    DiagramPreview as DiagramPreviewData,
  } from "../../lib/utils/diagramPreview";
  import Slider from "./Slider.svelte";

  export let preview: DiagramPreviewData;

  let zoom = 100;
  let svgUrl = "";
  let renderedPreview: DiagramPreviewData | null = null;

  $: if (preview !== renderedPreview) {
    if (svgUrl) {
      URL.revokeObjectURL(svgUrl);
    }
    svgUrl =
      preview.kind === "svg"
        ? URL.createObjectURL(
            new Blob([preview.content], { type: "image/svg+xml" }),
          )
        : "";
    renderedPreview = preview;
  }

  $: imageSource = preview.kind === "svg" ? svgUrl : preview.content;

  onDestroy(() => {
    if (svgUrl) {
      URL.revokeObjectURL(svgUrl);
    }
  });
</script>

<section
  class="flex h-full min-h-0 flex-col bg-canvas"
  aria-label={$i18n.t("editor.diagramPreview")}
>
  <div
    class="shrink-0 border-b border-stone-200 bg-sidebar px-5 py-3 dark:border-stone-800"
  >
    <div class="max-w-56">
      <Slider
        label={$i18n.t("editor.zoom")}
        value={zoom}
        min={25}
        max={400}
        step={25}
        onChange={(value) => (zoom = value)}
      />
    </div>
  </div>
  <div class="min-h-0 flex-1 overflow-auto p-6">
    <div class="w-max" style={`zoom: ${zoom / 100};`}>
      {#if preview.kind === "text"}
        <pre
          class="m-0 whitespace-pre rounded-md border border-stone-200
            bg-surface p-4 font-mono text-sm leading-tight text-stone-700
            dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200"
        >{preview.content}</pre>
      {:else}
        <img
          class="block max-w-none"
          src={imageSource}
          alt={$i18n.t("editor.diagramPreview")}
        />
      {/if}
    </div>
  </div>
</section>
