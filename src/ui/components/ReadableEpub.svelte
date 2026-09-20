<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import {
    loadPositions,
    savePosition,
    type Annotation,
  } from "../../lib/storage/readables";
  import { readFileBytes } from "../../lib/tauri/readables";
  import type { OutlineItem, SearchHit } from "../../lib/utils/reader";
  import {
    epubOutline,
    loadEpub,
    searchEpub,
    type EpubBook,
  } from "../../lib/utils/readerEpub";

  export let path: string;
  export let zoom = 1;
  export let annotations: Annotation[] = [];
  export let onOutline: (items: OutlineItem[]) => void = () => {};
  export let onReady: () => void = () => {};
  export let onError: (message: string) => void = () => {};
  export let onPage: (label: string) => void = () => {};

  let host: HTMLDivElement | undefined;
  let book: EpubBook | null = null;
  let rendition: any = null;
  let selected: { location: string; text: string } | null = null;
  let painted: string[] = [];

  onMount(() => void start());
  onDestroy(() => {
    observer?.disconnect();
    book?.destroy();
  });

  let observer: ResizeObserver | undefined;

  $: if (rendition) {
    rendition.themes.fontSize(`${Math.round(zoom * 100)}%`);
  }
  $: if (rendition) {
    paintAnnotations(annotations);
  }

  async function start() {
    try {
      book = await loadEpub(await readFileBytes(path));
      if (!host) {
        return;
      }

      rendition = book.renderTo(host, {
        width: "100%",
        height: "100%",
        flow: "scrolled-doc",
        spread: "none",
      });
      rendition.on("relocated", relocated);
      rendition.on("selected", (cfiRange: string, contents: any) => {
        selected = {
          location: cfiRange,
          text: contents.window.getSelection()?.toString().trim() ?? "",
        };
      });
      await rendition.display(loadPositions()[path] || undefined);
      watchSize(host);
      onOutline(await epubOutline(book));
      onReady();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  function relocated(location: any) {
    const displayed = location?.start?.displayed;

    onPage(displayed ? `${displayed.page} / ${displayed.total}` : "");
    if (location?.start?.cfi) {
      savePosition(path, location.start.cfi);
    }
  }

  function watchSize(element: HTMLElement) {
    observer = new ResizeObserver(() =>
      rendition?.resize(element.clientWidth, element.clientHeight),
    );
    observer.observe(element);
  }

  /** epub.js draws highlights itself, so only the new ones need adding. */
  function paintAnnotations(entries: Annotation[]) {
    const wanted = entries.map((entry) => entry.location);

    for (const location of painted.filter((cfi) => !wanted.includes(cfi))) {
      rendition.annotations.remove(location, "highlight");
    }
    for (const location of wanted.filter((cfi) => !painted.includes(cfi))) {
      rendition.annotations.highlight(location, {}, undefined, "ms-epub-mark", {
        fill: "#facc15",
        "fill-opacity": "0.45",
      });
    }
    painted = wanted;
  }

  export function goTo(location: string) {
    void rendition?.display(location);
  }

  export function search(query: string): Promise<SearchHit[]> {
    return book ? searchEpub(book, query) : Promise.resolve([]);
  }

  /** EPUB pages live in an iframe, so search tinting is left to the reader. */
  export function markSearch(_query: string) {}

  export function selection() {
    return selected?.text ? selected : null;
  }

  export function next() {
    void rendition?.next();
  }

  export function previous() {
    void rendition?.prev();
  }
</script>

<div
  bind:this={host}
  class="min-h-0 min-w-0 flex-1 overflow-hidden bg-surface"
></div>
