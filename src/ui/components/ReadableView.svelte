<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import {
    loadPositions,
    savePosition,
    type ReadableKind,
  } from "../../lib/storage/readables";

  export let path: string;
  export let kind: ReadableKind;
  export let name = "";

  let container: HTMLDivElement | undefined;
  let error = "";
  let loading = true;
  /** Set by whichever reader is live, so the switch below can tear it down. */
  let teardown: () => void = () => {};
  let epubPage = { label: "", prev: () => {}, next: () => {} };

  onMount(() => {
    void open();
    return () => teardown();
  });

  onDestroy(() => teardown());

  async function open() {
    try {
      loading = true;
      error = "";
      if (kind === "pdf") {
        await openPdf();
      } else {
        await openEpub();
      }
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      loading = false;
    }
  }

  /** Draws every page into its own canvas, sized to the pane width. */
  async function renderPdfPages(host: HTMLElement, document_: any) {
    host.replaceChildren();
    const canvases: HTMLCanvasElement[] = [];

    for (let number = 1; number <= document_.numPages; number++) {
      const page = await document_.getPage(number);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      canvas.className = "mx-auto my-3 max-w-full shadow-sm";
      host.append(canvas);
      canvases.push(canvas);

      if (!context) {
        continue;
      }

      const unscaled = page.getViewport({ scale: 1 });
      const scale = Math.max(0.2, (host.clientWidth - 32) / unscaled.width);
      const viewport = page.getViewport({ scale });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
    }

    return canvases;
  }

  /** The page in view is the last one whose top has scrolled past the pane. */
  function trackPdfPage(host: HTMLElement, canvases: HTMLCanvasElement[]) {
    const remember = () => {
      let page = 1;

      for (const [index, canvas] of canvases.entries()) {
        if (canvas.offsetTop - host.offsetTop <= host.scrollTop + 8) {
          page = index + 1;
        }
      }

      savePosition(path, String(page));
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(remember, 400);
    };

    host.addEventListener("scroll", onScroll);

    return () => {
      clearTimeout(timer);
      host.removeEventListener("scroll", onScroll);
    };
  }

  async function openPdf() {
    const pdfjs = await import("pdfjs-dist");

    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

    const document_ = await pdfjs.getDocument({
      url: convertFileSrc(path),
    }).promise;
    const host = container;

    if (!host) {
      return;
    }

    const canvases = await renderPdfPages(host, document_);
    const saved = Number(loadPositions()[path]);

    if (Number.isFinite(saved) && saved > 1) {
      canvases[Math.min(saved, canvases.length) - 1]?.scrollIntoView();
    }

    const stopTracking = trackPdfPage(host, canvases);

    teardown = () => {
      stopTracking();
      void document_.cleanup();
    };
  }

  /** epub.js needs the bytes: the asset URL carries no `.epub` for it to sniff. */
  async function openEpub() {
    const { default: ePub } = await import("epubjs");
    const response = await fetch(convertFileSrc(path));
    const book = ePub(await response.arrayBuffer());
    const host = container;

    if (!host) {
      return;
    }

    host.replaceChildren();
    const rendition = book.renderTo(host, {
      width: "100%",
      height: "100%",
      flow: "scrolled-doc",
      spread: "none",
    });

    await rendition.display(loadPositions()[path] || undefined);

    rendition.on("relocated", (location: any) => {
      epubPage = {
        label: location?.start?.displayed
          ? `${location.start.displayed.page} / ${location.start.displayed.total}`
          : "",
        prev: () => void rendition.prev(),
        next: () => void rendition.next(),
      };
      if (location?.start?.cfi) {
        savePosition(path, location.start.cfi);
      }
    });

    const observer = new ResizeObserver(() =>
      rendition.resize(host.clientWidth, host.clientHeight),
    );

    observer.observe(host);
    teardown = () => {
      observer.disconnect();
      book.destroy();
    };
  }
</script>

<div class="flex min-h-0 min-w-0 flex-1 flex-col">
  <div
    class="flex h-9 shrink-0 items-center gap-2 border-b border-stone-200/70 px-3 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400"
  >
    <span class="min-w-0 flex-1 truncate" title={path}>{name || path}</span>
    {#if kind === "epub"}
      <button
        type="button"
        class="rounded p-1 hover:bg-stone-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25"
        aria-label={$i18n.t("readables.previous")}
        title={$i18n.t("readables.previous")}
        onclick={() => epubPage.prev()}
      >
        <ChevronLeft class="size-4" />
      </button>
      <span class="tabular-nums">{epubPage.label}</span>
      <button
        type="button"
        class="rounded p-1 hover:bg-stone-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25"
        aria-label={$i18n.t("readables.next")}
        title={$i18n.t("readables.next")}
        onclick={() => epubPage.next()}
      >
        <ChevronRight class="size-4" />
      </button>
    {/if}
  </div>
  {#if loading}
    <p class="px-4 py-6 text-center text-xs text-stone-400">
      {$i18n.t("readables.loading")}
    </p>
  {:else if error}
    <p class="px-4 py-6 text-center text-xs text-rose-500">{error}</p>
  {/if}
  <div
    bind:this={container}
    class="min-h-0 min-w-0 flex-1 overflow-auto bg-stone-100 dark:bg-stone-900"
  ></div>
</div>
