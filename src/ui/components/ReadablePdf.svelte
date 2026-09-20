<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import "pdfjs-dist/web/pdf_viewer.css";
  import {
    loadPositions,
    savePosition,
    type Annotation,
  } from "../../lib/storage/readables";
  import { readFileBytes } from "../../lib/tauri/readables";
  import { paintRanges, quoteRanges } from "../../lib/utils/reader";
  import type { OutlineItem, SearchHit } from "../../lib/utils/reader";
  import {
    buildPages,
    fitScale,
    loadPdf,
    measurePages,
    pageIndexAt,
    pdfOutline,
    renderVisible,
    resetPages,
    searchPdf,
    type PdfDocument,
    type PdfPage,
  } from "../../lib/utils/readerPdf";

  export let path: string;
  export let zoom = 1;
  export let rotation = 0;
  /** Dark-mode reading: the drawn page is inverted, the highlights are not. */
  export let invert = false;
  export let annotations: Annotation[] = [];
  export let onOutline: (items: OutlineItem[]) => void = () => {};
  export let onReady: () => void = () => {};
  export let onError: (message: string) => void = () => {};
  export let onZoom: (zoom: number) => void = () => {};
  export let onPage: (label: string) => void = () => {};

  let host: HTMLDivElement | undefined;
  let document_: PdfDocument | null = null;
  let pages: PdfPage[] = [];
  let base = 1;
  let busy = false;
  let lastQuery = "";
  /** Page tops, remeasured after a layout change instead of on every scroll. */
  let offsets: number[] = [];
  let applied = "";

  $: options = { scale: base * zoom, rotation };
  // Re-lay-out only when the settings really changed, not on every render.
  $: if (document_ && `${zoom}/${rotation}` !== applied) {
    applied = `${zoom}/${rotation}`;
    void rescale();
  }
  $: if (pages.length) {
    paintAnnotations(annotations);
  }

  onMount(() => void start());
  onDestroy(() => {
    clearTimeout(scrollTimer);
    // The debounce may still be pending when the tab closes.
    if (pages.length) {
      savePosition(path, position());
    }
    paintRanges("ms-readable-marks", []);
    paintRanges("ms-readable-search", []);
    void document_?.cleanup();
  });

  async function start() {
    try {
      document_ = await loadPdf(await readFileBytes(path));
      base = await fitScale(document_, host?.clientWidth || 800);
      applied = `${zoom}/${rotation}`;
      pages = await buildPages(document_, host as HTMLElement, options);
      offsets = measurePages(host as HTMLElement, pages);
      goTo(loadPositions()[path] ?? "1");
      await fill();
      onReady();
      onOutline(await pdfOutline(document_));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  /** Draws whatever is on screen now, then paints marks over it. */
  async function fill() {
    if (!document_ || !host || busy) {
      return;
    }

    busy = true;
    try {
      if (await renderVisible(document_, host, pages, offsets, options)) {
        offsets = measurePages(host, pages);
        paintAnnotations(annotations);
        markSearch(lastQuery);
      }
    } finally {
      busy = false;
    }
  }

  /** A zoom or a turn keeps the page you were on, at the new size. */
  async function rescale() {
    if (!document_ || !host) {
      return;
    }

    const spot = position();

    await resetPages(document_, pages, options);
    offsets = measurePages(host, pages);
    goTo(spot);
    await fill();
  }

  /** Height of the page at `index`, falling back to the pane's own height. */
  function heightOf(index: number) {
    return pages[index]?.wrapper.offsetHeight || host?.clientHeight || 1;
  }

  function pageIndex(location: string) {
    const number = Number(location.split(":")[0]);
    const clamped = Number.isFinite(number) ? number : 1;

    return Math.min(Math.max(1, clamped), Math.max(1, pages.length)) - 1;
  }

  /**
   * Where the reader is, as `page:fraction` — the fraction is how far into
   * that page the pane has scrolled, so reopening lands on the same line
   * rather than the top of the page. A bare page number still reads fine.
   */
  export function position() {
    if (!host || !offsets.length) {
      return "1";
    }

    const index = pageIndexAt(offsets, host.scrollTop + 8);
    const into = (host.scrollTop - offsets[index]) / heightOf(index);

    return `${index + 1}:${Math.min(1, Math.max(0, into)).toFixed(3)}`;
  }

  export function goTo(location: string) {
    const index = pageIndex(location);
    const into = Number(location.split(":")[1]);

    if (host) {
      host.scrollTop =
        offsets[index] + (Number.isFinite(into) ? into * heightOf(index) : 0);
    }

    report();
    void fill();
  }

  function report() {
    onPage(`${pageIndex(position()) + 1} / ${pages.length}`);
  }

  export function search(query: string): Promise<SearchHit[]> {
    return document_ ? searchPdf(document_, query) : Promise.resolve([]);
  }

  /** Tints every occurrence of the query across the pages drawn so far. */
  export function markSearch(query: string) {
    lastQuery = query;
    paintRanges(
      "ms-readable-search",
      query ? pages.flatMap((page) => quoteRanges(page.textLayer, query)) : [],
    );
  }

  /** The current selection, as the page it sits on and the text it covers. */
  export function selection() {
    const selected = window.getSelection();
    const text = selected?.toString().trim() ?? "";
    const wrapper = (
      selected?.anchorNode instanceof Element
        ? selected.anchorNode
        : selected?.anchorNode?.parentElement
    )?.closest<HTMLElement>("[data-page]");

    return text && wrapper?.dataset.page
      ? { location: wrapper.dataset.page, text }
      : null;
  }

  function paintAnnotations(entries: Annotation[]) {
    paintRanges(
      "ms-readable-marks",
      entries.flatMap((entry) => {
        const page = pages[pageIndex(entry.location)];

        return page ? quoteRanges(page.textLayer, entry.text) : [];
      }),
    );
  }

  let scrollTimer: ReturnType<typeof setTimeout> | undefined;

  function onScroll() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      savePosition(path, position());
      report();
      void fill();
    }, 150);
  }

  /** Ctrl and the wheel is what everyone reaches for to zoom a document. */
  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    onZoom(zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1));
  }

  let panning: { x: number; y: number; left: number; top: number } | null =
    null;

  /** Middle-button drag pans; the left button stays free for selecting text. */
  function onPointerDown(event: PointerEvent) {
    if (event.button !== 1 || !host) {
      return;
    }

    event.preventDefault();
    panning = {
      x: event.clientX,
      y: event.clientY,
      left: host.scrollLeft,
      top: host.scrollTop,
    };
    host.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    if (!panning || !host) {
      return;
    }

    host.scrollLeft = panning.left - (event.clientX - panning.x);
    host.scrollTop = panning.top - (event.clientY - panning.y);
  }

  function onPointerUp(event: PointerEvent) {
    if (panning && host) {
      host.releasePointerCapture(event.pointerId);
      panning = null;
    }
  }
</script>

<div
  bind:this={host}
  onscroll={onScroll}
  onwheel={onWheel}
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
  role="document"
  class="min-h-0 min-w-0 flex-1 overflow-auto bg-stone-100 p-2 dark:bg-stone-900"
  class:cursor-grabbing={panning}
  class:ms-readable-invert={invert}
></div>

<style>
  :global(.ms-readable-page) {
    position: relative;
    margin: 0 auto 0.75rem;
    background: white;
    box-shadow: 0 1px 6px rgb(0 0 0 / 0.18);
  }

  /* Only the canvas turns: inverting the page would turn the marks too. */
  :global(.ms-readable-invert canvas) {
    filter: invert(1) hue-rotate(180deg);
  }

  :global(.ms-readable-invert .ms-readable-page) {
    background: #111;
  }

  :global(::highlight(ms-readable-marks)) {
    background-color: rgb(250 204 21 / 0.45);
  }

  :global(::highlight(ms-readable-search)) {
    background-color: rgb(16 185 129 / 0.45);
  }
</style>
