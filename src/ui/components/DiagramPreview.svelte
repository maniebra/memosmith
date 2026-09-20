<script lang="ts">
  import { onDestroy } from "svelte";
  import { Image, Minus, Plus, RotateCcw } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import type {
    DiagramPreview as DiagramPreviewData,
  } from "../../lib/utils/diagramPreview";
  import Slider from "./Slider.svelte";

  export let preview: DiagramPreviewData;

  const MIN_ZOOM = 25;
  const MAX_ZOOM = 400;
  const ZOOM_STEP = 25;

  let zoom = 100;
  let svgUrl = "";
  let renderedPreview: DiagramPreviewData | null = null;
  let viewport: HTMLElement;
  let panning: {
    pointerId: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null = null;

  function setZoom(value: number) {
    zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
  }

  function adjustZoom(direction: -1 | 1) {
    setZoom(zoom + direction * ZOOM_STEP);
  }

  function resetView() {
    zoom = 100;
    requestAnimationFrame(() => viewport?.scrollTo({ left: 0, top: 0 }));
  }

  function zoomAtPointer(event: WheelEvent) {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }

    event.preventDefault();

    const next = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)),
    );

    if (next === zoom || !viewport) {
      return;
    }

    const bounds = viewport.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const { scrollLeft, scrollTop } = viewport;
    const scale = next / zoom;

    zoom = next;
    requestAnimationFrame(() =>
      viewport.scrollTo({
        left: (scrollLeft + x) * scale - x,
        top: (scrollTop + y) * scale - y,
      }),
    );
  }

  function startPan(event: PointerEvent) {
    if (event.button !== 0 || !viewport) {
      return;
    }

    event.preventDefault();
    viewport.setPointerCapture(event.pointerId);
    panning = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
  }

  function pan(event: PointerEvent) {
    if (!panning || event.pointerId !== panning.pointerId) {
      return;
    }

    viewport.scrollTo({
      left: panning.left - (event.clientX - panning.x),
      top: panning.top - (event.clientY - panning.y),
    });
  }

  function stopPan(event: PointerEvent) {
    if (!panning || event.pointerId !== panning.pointerId) {
      return;
    }

    if (viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    panning = null;
  }

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
    class="flex shrink-0 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-stone-200 bg-sidebar px-4 py-2.5 dark:border-stone-800 sm:px-5"
  >
    <div class="flex min-w-0 items-center gap-3">
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-surface text-emerald-700 shadow-sm dark:border-stone-700 dark:bg-stone-900 dark:text-emerald-400"
        aria-hidden="true"
      >
        <Image class="size-4" strokeWidth={1.8} />
      </span>
      <div class="min-w-0">
        <h2
          class="truncate text-sm font-semibold text-stone-800 dark:text-stone-100"
        >
          {$i18n.t("editor.diagramPreview")}
        </h2>
        <p class="hidden text-xs text-stone-500 dark:text-stone-400 sm:block">
          {$i18n.t("editor.previewInteractionHint")}
        </p>
      </div>
    </div>
    <div
      class="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-end"
      role="toolbar"
      aria-label={$i18n.t("editor.previewControls")}
    >
      <div class="hidden w-36 md:block">
        <Slider
          label=""
          value={zoom}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={ZOOM_STEP}
          onChange={setZoom}
        />
      </div>
      <div
        class="flex items-center rounded-lg border border-stone-200 bg-surface p-0.5 shadow-sm dark:border-stone-700 dark:bg-stone-900"
      >
        <button
          type="button"
          class="rounded-md p-1.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40 dark:text-stone-300 dark:hover:bg-stone-800"
          aria-label={$i18n.t("editor.zoomOut")}
          title={$i18n.t("editor.zoomOut")}
          disabled={zoom <= MIN_ZOOM}
          onclick={() => adjustZoom(-1)}
        >
          <Minus class="size-4" strokeWidth={1.8} />
        </button>
        <output
          class="min-w-14 px-1 text-center text-sm font-medium tabular-nums text-stone-700 dark:text-stone-200"
          aria-live="polite"
        >{zoom}%</output>
        <button
          type="button"
          class="rounded-md p-1.5 text-stone-600 transition-colors hover:bg-stone-100 disabled:opacity-40 dark:text-stone-300 dark:hover:bg-stone-800"
          aria-label={$i18n.t("editor.zoomIn")}
          title={$i18n.t("editor.zoomIn")}
          disabled={zoom >= MAX_ZOOM}
          onclick={() => adjustZoom(1)}
        >
          <Plus class="size-4" strokeWidth={1.8} />
        </button>
      </div>
      <button
        type="button"
        class="flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-1.5 text-sm text-stone-600 transition-colors hover:border-stone-200 hover:bg-surface hover:shadow-sm dark:text-stone-300 dark:hover:border-stone-700 dark:hover:bg-stone-900"
        aria-label={$i18n.t("editor.resetPreview")}
        title={$i18n.t("editor.resetPreview")}
        onclick={resetView}
      >
        <RotateCcw class="size-4" strokeWidth={1.8} />
        <span class="hidden lg:inline">{$i18n.t("editor.resetPreview")}</span>
      </button>
    </div>
  </div>
  <div
    bind:this={viewport}
    role="region"
    aria-label={$i18n.t("editor.diagramPreview")}
    class="min-h-0 flex-1 overflow-auto p-6 select-none"
    class:cursor-grab={!panning}
    class:cursor-grabbing={Boolean(panning)}
    onwheel={zoomAtPointer}
    onpointerdown={startPan}
    onpointermove={pan}
    onpointerup={stopPan}
    onpointercancel={stopPan}
  >
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
