<script lang="ts">
  import {
    BookOpenText,
    ChevronLeft,
    ChevronRight,
    Contrast,
    Highlighter,
    List,
    RotateCw,
    Search,
    Zap,
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
  const INVERT_KEY = "memosmith:readableInvert";
  const GPU_KEY = "memosmith:readableGpu";
  const button =
    "rounded-md p-1.5 text-stone-500 hover:bg-stone-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-400";
  /** A pressed tool reads as a held-down key, not as coloured text. */
  const active = `${button} bg-emerald-600/10 text-emerald-600 dark:text-emerald-400`;
  const divider = "mx-1 h-4 w-px shrink-0 bg-stone-200 dark:bg-stone-800";
  const field =
    "h-5 w-9 rounded border border-transparent bg-stone-500/10 text-center tabular-nums focus:border-emerald-600/40 focus:outline-none";

  let reader: any;
  let zoom = Number(localStorage.getItem(ZOOM_KEY)) || 1;
  let rotation = 0;
  let invert = localStorage.getItem(INVERT_KEY) === "1";
  /** Off by default: the cheap path caps the canvas and skips HiDPI redraws. */
  let gpu = localStorage.getItem(GPU_KEY) === "1";
  let loading = true;
  let error = "";
  let outline: OutlineItem[] = [];
  let hits: SearchHit[] = [];
  let query = "";
  let searching = false;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let sidebar: "toc" | "search" | "annotations" | null = null;
  let pageLabel = "";
  let annotations: Annotation[] = loadAnnotations(path);
  let frame: HTMLElement | undefined;
  /** Ctrl+= and friends act on the reader the pointer is over. */
  let hot = false;

  $: percent = `${Math.round(zoom * 100)}%`;
  $: [pageNow = "", pageTotal = ""] = pageLabel.split("/").map((part) =>
    part.trim(),
  );

  /** Typing a page number and pressing Enter is how every viewer does it. */
  function goToPage(value: string) {
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      reader?.goTo(String(Math.floor(number)));
    }
  }

  function setZoom(next: number) {
    zoom = Math.min(4, Math.max(0.4, Number(next.toFixed(2))));
    localStorage.setItem(ZOOM_KEY, String(zoom));
  }

  function toggleInvert() {
    invert = !invert;
    localStorage.setItem(INVERT_KEY, invert ? "1" : "0");
  }

  function toggleGpu() {
    gpu = !gpu;
    localStorage.setItem(GPU_KEY, gpu ? "1" : "0");
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
    class="@container flex h-9 shrink-0 items-center gap-0.5 border-b border-stone-200/70 px-1.5 text-xs text-stone-500 dark:border-stone-800 dark:text-stone-400"
  >
    <span
      class="hidden min-w-0 flex-1 truncate px-1 @[30rem]:block"
      title={path}>{name || path}</span
    >
    <!-- Narrow panes drop the name, but the controls stay where they were. -->
    <span class="flex-1 @[30rem]:hidden"></span>

    {#if kind === "pdf"}
      <input
        class={field}
        value={pageNow}
        inputmode="numeric"
        aria-label={$i18n.t("readables.page")}
        title={$i18n.t("readables.page")}
        onkeydown={(event) => {
          if (event.key === "Enter") {
            goToPage(event.currentTarget.value);
          }
        }}
        onblur={(event) => (event.currentTarget.value = pageNow)}
      />
      <span class="tabular-nums text-stone-400 dark:text-stone-500">
        / {pageTotal}
      </span>
    {:else}
      <button
        type="button"
        class={button}
        aria-label={$i18n.t("readables.previous")}
        title={$i18n.t("readables.previous")}
        onclick={() => reader?.previous()}
      >
        <ChevronLeft class="size-4" />
      </button>
      <span class="tabular-nums">{pageLabel}</span>
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

    <span class={divider}></span>

    <button
      type="button"
      class={button}
      aria-label={$i18n.t("readables.zoomOut")}
      title={$i18n.t("readables.zoomOut")}
      onclick={() => setZoom(zoom - 0.2)}
    >
      <ZoomOut class="size-4" />
    </button>
    <!-- Familiar from every viewer: the percentage is the way back to 100%. -->
    <button
      type="button"
      class="hidden rounded-md px-1 tabular-nums hover:bg-stone-500/10 @[22rem]:block"
      aria-label={$i18n.t("readables.resetZoom")}
      title={$i18n.t("readables.resetZoom")}
      onclick={() => setZoom(1)}
    >
      {percent}
    </button>
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
      <!-- Page dressing: the first thing a cramped pane can do without. -->
      <span class="hidden @[26rem]:contents">
        <span class={divider}></span>
        <button
          type="button"
          class={button}
          aria-label={$i18n.t("readables.rotate")}
          title={$i18n.t("readables.rotate")}
          onclick={() => (rotation = (rotation + 90) % 360)}
        >
          <RotateCw class="size-4" />
        </button>
        <button
          type="button"
          class={invert ? active : button}
          aria-label={$i18n.t("readables.invert")}
          title={$i18n.t("readables.invert")}
          aria-pressed={invert}
          onclick={toggleInvert}
        >
          <Contrast class="size-4" />
        </button>
        <button
          type="button"
          class={gpu ? active : button}
          aria-label={$i18n.t("readables.gpu")}
          title={$i18n.t("readables.gpu")}
          aria-pressed={gpu}
          onclick={toggleGpu}
        >
          <Zap class="size-4" />
        </button>
      </span>
    {/if}

    <span class={divider}></span>

    <button
      type="button"
      class={sidebar === "toc" ? active : button}
      aria-label={$i18n.t("readables.contents")}
      title={$i18n.t("readables.contents")}
      aria-pressed={sidebar === "toc"}
      onclick={() => toggle("toc")}
    >
      <List class="size-4" />
    </button>
    <button
      type="button"
      class={sidebar === "search" ? active : button}
      aria-label={$i18n.t("readables.search")}
      title={$i18n.t("readables.search")}
      aria-pressed={sidebar === "search"}
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
      class={sidebar === "annotations" ? active : button}
      aria-label={$i18n.t("readables.highlights")}
      title={$i18n.t("readables.highlights")}
      aria-pressed={sidebar === "annotations"}
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
          {invert}
          mode={gpu ? "gpu" : "cpu"}
          {annotations}
          onOutline={(items) => (outline = items)}
          onReady={() => (loading = false)}
          onError={(message) => ((error = message), (loading = false))}
          onZoom={setZoom}
          onPage={(label) => (pageLabel = label)}
        />
      {:else}
        <ReadableEpub
          bind:this={reader}
          {path}
          {zoom}
          {annotations}
          onOutline={(items) => (outline = items)}
          onPage={(label) => (pageLabel = label)}
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
