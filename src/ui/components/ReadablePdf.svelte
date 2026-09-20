<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import "pdfjs-dist/web/pdf_viewer.css";
  import {
    loadPositions,
    savePosition,
    type Annotation,
  } from "../../lib/storage/readables";
  import { paintRanges, quoteRanges } from "../../lib/utils/reader";
  import type { OutlineItem, SearchHit } from "../../lib/utils/reader";
  import {
    fitScale,
    loadPdf,
    renderPdf,
    pdfOutline,
    searchPdf,
    type PdfDocument,
    type PdfPage,
  } from "../../lib/utils/readerPdf";

  export let path: string;
  export let url: string;
  export let zoom = 1;
  export let rotation = 0;
  export let annotations: Annotation[] = [];
  export let onOutline: (items: OutlineItem[]) => void = () => {};
  export let onReady: () => void = () => {};
  export let onError: (message: string) => void = () => {};

  let host: HTMLDivElement | undefined;
  let document_: PdfDocument | null = null;
  let pages: PdfPage[] = [];
  let base = 1;
  let rendering = false;
  let redraw = false;
  let lastQuery = "";

  onMount(() => void start());
  onDestroy(() => {
    paintRanges("ms-readable-marks", []);
    paintRanges("ms-readable-search", []);
    void document_?.cleanup();
  });

  // Re-render whenever the view settings change; the first render is `start`.
  $: if (document_ && host && (zoom || rotation !== undefined)) {
    void draw();
  }
  $: if (pages.length) {
    paintAnnotations(annotations);
  }

  async function start() {
    try {
      document_ = await loadPdf(url);
      base = await fitScale(document_, host?.clientWidth ?? 800);
      await draw();
      restorePosition();
      onOutline(await pdfOutline(document_));
      onReady();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function draw() {
    if (!document_ || !host) {
      return;
    }

    // A zoom or rotation during a render queues one more pass after it.
    if (rendering) {
      redraw = true;
      return;
    }

    rendering = true;
    try {
      pages = await renderPdf(document_, host, {
        scale: base * zoom,
        rotation,
      });
      paintAnnotations(annotations);
      markSearch(lastQuery);
    } finally {
      rendering = false;
    }

    if (redraw) {
      redraw = false;
      await draw();
    }
  }

  function restorePosition() {
    const saved = Number(loadPositions()[path]);

    if (Number.isFinite(saved) && saved > 1) {
      goTo(String(saved));
    }
  }

  function pageOf(location: string) {
    const number = Number(location);

    return pages[Math.min(Math.max(1, number), pages.length) - 1];
  }

  export function goTo(location: string) {
    pageOf(location)?.wrapper.scrollIntoView();
  }

  export function search(query: string): Promise<SearchHit[]> {
    return document_ ? searchPdf(document_, query) : Promise.resolve([]);
  }

  /** Tints every occurrence of the query across the rendered pages. */
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
        const page = pageOf(entry.location);

        return page ? quoteRanges(page.textLayer, entry.text) : [];
      }),
    );
  }

  /** The page in view is the last one whose top has scrolled past the pane. */
  function rememberPage() {
    if (!host) {
      return;
    }

    let current = 1;

    for (const page of pages) {
      if (page.wrapper.offsetTop - host.offsetTop <= host.scrollTop + 8) {
        current = page.number;
      }
    }

    savePosition(path, String(current));
  }

  let scrollTimer: ReturnType<typeof setTimeout> | undefined;

  function onScroll() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(rememberPage, 400);
  }

  onDestroy(() => clearTimeout(scrollTimer));
</script>

<div
  bind:this={host}
  onscroll={onScroll}
  class="min-h-0 min-w-0 flex-1 overflow-auto bg-stone-100 p-2 dark:bg-stone-900"
></div>

<style>
  :global(.ms-readable-page) {
    position: relative;
    margin: 0 auto 0.75rem;
    box-shadow: 0 1px 6px rgb(0 0 0 / 0.18);
  }

  :global(::highlight(ms-readable-marks)) {
    background-color: rgb(250 204 21 / 0.45);
  }

  :global(::highlight(ms-readable-search)) {
    background-color: rgb(16 185 129 / 0.45);
  }
</style>
