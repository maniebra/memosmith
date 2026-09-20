<script lang="ts">
  import {
    BookOpenText,
    ChevronLeft,
    ChevronRight,
    Highlighter,
    List,
    RotateCw,
    Search,
    ZoomIn,
    ZoomOut,
  } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import {
    loadAnnotations,
    newAnnotation,
    saveAnnotations,
    type Annotation,
    type ReadableKind,
  } from "../../lib/storage/readables";
  import type { OutlineItem, SearchHit } from "../../lib/utils/reader";
  import ReadableEpub from "./ReadableEpub.svelte";
  import ReadablePdf from "./ReadablePdf.svelte";
  import ReadableSidebar from "./ReadableSidebar.svelte";

  export let path: string;
  export let kind: ReadableKind;
  export let name = "";

  const ZOOM_KEY = "memosmith:readableZoom";
  const button =
    "rounded p-1 text-stone-500 hover:bg-stone-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-400";

  let reader: any;
  let zoom = Number(localStorage.getItem(ZOOM_KEY)) || 1;
  let rotation = 0;
  let loading = true;
  let error = "";
  let outline: OutlineItem[] = [];
  let hits: SearchHit[] = [];
  let query = "";
  let searching = false;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let sidebar: "toc" | "search" | "annotations" | null = null;
  let epubPage = "";
  let annotations: Annotation[] = loadAnnotations(path);
  let frame: HTMLElement | undefined;
  /** Ctrl+= and friends act on the reader the pointer is over. */
  let hot = false;

  $: percent = `${Math.round(zoom * 100)}%`;

  function setZoom(next: number) {
    zoom = Math.min(4, Math.max(0.4, Number(next.toFixed(2))));
    localStorage.setItem(ZOOM_KEY, String(zoom));
  }

  function onKeydown(event: KeyboardEvent) {
    if (!event.ctrlKey || !(hot || frame?.contains(document.activeElement))) {
      return;
    }

    if (event.key === "+" || event.key === "=") {
      setZoom(zoom + 0.2);
    } else if (event.key === "-") {
      setZoom(zoom - 0.2);
    } else if (event.key === "0") {
      setZoom(1);
    } else {
      return;
    }

    event.preventDefault();
  }

  function toggle(panel: "toc" | "search" | "annotations") {
    sidebar = sidebar === panel ? null : panel;
  }

  function runSearch(value: string) {
    query = value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      searching = Boolean(value.trim());
      hits = value.trim() ? await reader.search(value) : [];
      searching = false;
      reader.markSearch(value.trim());
    }, 300);
  }

  function addHighlight() {
    const picked = reader?.selection?.();

    if (!picked) {
      return;
    }

    annotations = [...annotations, newAnnotation(picked.location, picked.text)];
    saveAnnotations(path, annotations);
    sidebar = "annotations";
  }

  function removeHighlight(id: string) {
    annotations = annotations.filter((entry) => entry.id !== id);
    saveAnnotations(path, annotations);
  }

  function noteHighlight(id: string, note: string) {
    annotations = annotations.map((entry) =>
      entry.id === id ? { ...entry, note } : entry,
    );
    saveAnnotations(path, annotations);
  }
</script>

<svelte:window onkeydown={onKeydown} />
<div
  bind:this={frame}
  onpointerenter={() => (hot = true)}
  onpointerleave={() => (hot = false)}
  role="presentation"
  class="flex min-h-0 min-w-0 flex-1 flex-col"
>
  <div
    class="flex h-9 shrink-0 items-center gap-1 border-b border-stone-200/70 px-2 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400"
  >
    <span class="min-w-0 flex-1 truncate" title={path}>{name || path}</span>
    {#if kind === "epub"}
      <button
        type="button"
        class={button}
        aria-label={$i18n.t("readables.previous")}
        title={$i18n.t("readables.previous")}
        onclick={() => reader?.previous()}
      >
        <ChevronLeft class="size-4" />
      </button>
      <span class="tabular-nums">{epubPage}</span>
      <button
        type="button"
        class={button}
        aria-label={$i18n.t("readables.next")}
        title={$i18n.t("readables.next")}
        onclick={() => reader?.next()}
      >
        <ChevronRight class="size-4" />
      </button>
    {/if}
    <button
      type="button"
      class={button}
      aria-label={$i18n.t("readables.zoomOut")}
      title={$i18n.t("readables.zoomOut")}
      onclick={() => setZoom(zoom - 0.2)}
    >
      <ZoomOut class="size-4" />
    </button>
    <span class="tabular-nums">{percent}</span>
    <button
      type="button"
      class={button}
      aria-label={$i18n.t("readables.zoomIn")}
      title={$i18n.t("readables.zoomIn")}
      onclick={() => setZoom(zoom + 0.2)}
    >
      <ZoomIn class="size-4" />
    </button>
    {#if kind === "pdf"}
      <button
        type="button"
        class={button}
        aria-label={$i18n.t("readables.rotate")}
        title={$i18n.t("readables.rotate")}
        onclick={() => (rotation = (rotation + 90) % 360)}
      >
        <RotateCw class="size-4" />
      </button>
    {/if}
    <button
      type="button"
      class={button}
      class:text-emerald-600={sidebar === "toc"}
      aria-label={$i18n.t("readables.contents")}
      title={$i18n.t("readables.contents")}
      onclick={() => toggle("toc")}
    >
      <List class="size-4" />
    </button>
    <button
      type="button"
      class={button}
      class:text-emerald-600={sidebar === "search"}
      aria-label={$i18n.t("readables.search")}
      title={$i18n.t("readables.search")}
      onclick={() => toggle("search")}
    >
      <Search class="size-4" />
    </button>
    <button
      type="button"
      class={button}
      aria-label={$i18n.t("readables.highlight")}
      title={$i18n.t("readables.highlight")}
      onclick={addHighlight}
    >
      <Highlighter class="size-4" />
    </button>
    <button
      type="button"
      class={button}
      class:text-emerald-600={sidebar === "annotations"}
      aria-label={$i18n.t("readables.highlights")}
      title={$i18n.t("readables.highlights")}
      onclick={() => toggle("annotations")}
    >
      <BookOpenText class="size-4" />
    </button>
  </div>
  {#if loading}
    <p class="px-4 py-6 text-center text-xs text-stone-400">
      {$i18n.t("readables.loading")}
    </p>
  {:else if error}
    <p class="px-4 py-6 text-center text-xs text-rose-500">{error}</p>
  {/if}
  <div class="flex min-h-0 min-w-0 flex-1">
    {#key path}
      {#if kind === "pdf"}
        <ReadablePdf
          bind:this={reader}
          {path}
          {zoom}
          {rotation}
          {annotations}
          onOutline={(items) => (outline = items)}
          onReady={() => (loading = false)}
          onError={(message) => ((error = message), (loading = false))}
          onZoom={setZoom}
        />
      {:else}
        <ReadableEpub
          bind:this={reader}
          {path}
          {zoom}
          {annotations}
          onOutline={(items) => (outline = items)}
          onPage={(label) => (epubPage = label)}
          onReady={() => (loading = false)}
          onError={(message) => ((error = message), (loading = false))}
        />
      {/if}
    {/key}
    {#if sidebar}
      <ReadableSidebar
        mode={sidebar}
        {outline}
        {hits}
        {annotations}
        {query}
        {searching}
        onQuery={runSearch}
        onGo={(location) => reader?.goTo(location)}
        onRemove={removeHighlight}
        onNote={noteHighlight}
      />
    {/if}
  </div>
</div>
