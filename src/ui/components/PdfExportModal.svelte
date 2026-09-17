<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import { FileDown, Printer, TriangleAlert, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import Button from "./Button.svelte";
  import PdfLayoutPanel from "./PdfLayoutPanel.svelte";
  import {
    exportPdf,
    loadLayout,
    pageGeometry,
    papers,
    saveLayout,
  } from "../../lib/tauri/pdf";

  /** The live editor frame; it is cloned so the PDF shows exactly what is on screen. */
  export let source: HTMLElement | undefined;
  export let title = "";
  export let onClose: () => void;
  export let onStatus: (message: string) => void = () => {};

  const pxPerMm = 96 / 25.4;
  const previousTitle = document.title;

  let sheet: HTMLElement | undefined;
  let pane: HTMLElement | undefined;
  let paneWidth = 0;
  /** The width the note was laid out at; database embeds only line up there. */
  let sourceWidth = 0;
  let cloning = true;
  let saving = false;
  let error = "";
  let layout = loadLayout();

  $: saveLayout(layout);
  $: page = pageGeometry(layout);
  $: contentWidth = (page.width - page.side * 2) * pxPerMm;
  // The printer shrinks a wider note to fit the page but never enlarges a narrower one.
  $: sheetZoom = sourceWidth ? Math.min(1, contentWidth / sourceWidth) : 1;
  // The whole page is scaled to fit the pane, like a print preview.
  $: paperZoom = paneWidth
    ? Math.min(1, (paneWidth - 64) / (page.width * pxPerMm))
    : 1;
  // The page rule lives only while the modal does, so a later print is unaffected.
  const pageRule = document.head.appendChild(document.createElement("style"));
  $: pageRule.textContent = [
    "@page {",
    `size: ${papers[layout.paper].css}`,
    `${layout.landscape ? "landscape" : "portrait"};`,
    `margin: ${page.top}mm ${page.side}mm ${page.bottom}mm;`,
    "}",
  ].join(" ");

  function handleKey(event: KeyboardEvent) {
    if (event.key === "Escape" && !saving) {
      onClose();
    }
  }

  /**
   * A code fence renders as one `.md-block` per line, so telling the printer to keep each block
   * whole still lets it slice the slab in half. Wrapping each run of them — plus the run bar or
   * preview that trails it — in one element gives the printer something to keep together.
   */
  function groupCodeBlocks(copy: HTMLElement) {
    // Database cards are excluded: they are meant to break between rows, not stay whole.
    const parts =
      ":is(.md-codeblock, .md-fence, .md-run-preview, .md-preview):not(.md-database-anchor)";

    for (const start of Array.from(
      copy.querySelectorAll(".md-fence-open, .md-codeblock"),
    )) {
      if (start.closest(".ms-print-group")) {
        continue;
      }

      const group = document.createElement("div");
      group.className = "ms-print-group";
      start.before(group);

      let next: Element | null = group.nextElementSibling;

      while (next?.matches(parts)) {
        const current = next;
        next = current.nextElementSibling;
        group.append(current);
      }
    }
  }

  /**
   * Database views live in an absolutely positioned layer over the note, which the printer
   * cannot paginate: the card lands on top of the text and gets torn across pages. Dropping
   * each view back into its anchor puts it in the normal flow, where it breaks like anything
   * else.
   */
  function inlineDatabaseEmbeds(copy: HTMLElement) {
    const portals = Array.from(
      copy.querySelectorAll(".md-database-portal"),
    ) as HTMLElement[];
    const anchors = Array.from(
      copy.querySelectorAll(".md-database-preview:not(.md-database-portal)"),
    ) as HTMLElement[];
    const taken = new Set<HTMLElement>();

    portals.forEach((portal, index) => {
      // `data-code` pairs the two; position is the fallback, since a re-render can renumber it.
      const anchor =
        anchors.find(
          (candidate) =>
            candidate.dataset.code === portal.dataset.code &&
            !taken.has(candidate),
        ) ?? (taken.has(anchors[index]) ? undefined : anchors[index]);

      // No anchor to drop into: leave the floating card where it is rather than lose the table.
      if (!anchor) {
        return;
      }

      taken.add(anchor);

      // Tabs, "Add board view", "Filter", "New row": controls that do nothing on paper.
      for (const control of Array.from(portal.querySelectorAll("button"))) {
        control.remove();
      }

      portal.removeAttribute("style");
      portal.classList.remove("md-database-portal");
      // The anchor is only a hidden spacer sized to the floating card, so the card takes its
      // place outright rather than moving inside it.
      anchor.replaceWith(portal);
    });
  }

  /**
   * Excalidraw bakes dark mode into a thumbnail as an invert filter. The sheet is paper, so
   * the filter comes off and the drawing prints in its own colours.
   */
  function undoDarkDrawings(copy: HTMLElement) {
    for (const element of Array.from(
      copy.querySelectorAll('.md-drawing-thumbnail [style*="invert"]'),
    ) as HTMLElement[]) {
      element.style.filter = "";
    }
  }

  function clone() {
    if (!sheet || !source) {
      cloning = false;
      return;
    }

    const copy = source.cloneNode(true) as HTMLElement;

    // Editing affordances are part of the live DOM, never part of the document.
    for (const chrome of Array.from(
      copy.querySelectorAll(
        ".md-block-toolbar, .md-block-drop-indicator, .md-tail-add",
      ),
    )) {
      chrome.remove();
    }

    for (const editable of Array.from(
      copy.querySelectorAll("[contenteditable]"),
    )) {
      (editable as HTMLElement).contentEditable = "false";
    }

    // A failed touch-up is still worth printing: show the note rather than an empty sheet.
    try {
      inlineDatabaseEmbeds(copy);
      groupCodeBlocks(copy);
      undoDarkDrawings(copy);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
      console.error("PDF preview layout failed", failure);
    }

    sourceWidth = source.getBoundingClientRect().width;
    sheet.replaceChildren(copy);
    cloning = false;
  }

  async function save() {
    saving = true;
    error = "";

    try {
      const path = await exportPdf(title, layout);

      if (path) {
        onStatus($i18n.t("pdf.saved", { path }));
        onClose();
      }
    } catch (failure) {
      // The status bar sits behind this modal, so the failure has to be readable here.
      error = failure instanceof Error ? failure.message : String(failure);
      console.error("PDF export failed", failure);
      onStatus(error);
    } finally {
      saving = false;
    }
  }

  onMount(() => {
    // The paper is always light, so nothing has to re-render first; one tick lets the
    // skeleton paint before the (possibly large) clone blocks the thread.
    void tick().then(() => requestAnimationFrame(clone));

    const observer = new ResizeObserver(([entry]) => {
      paneWidth = entry.contentRect.width;
    });

    if (pane) {
      observer.observe(pane);
    }

    return () => observer.disconnect();
  });

  // The print dialog and the save dialog both name the file after the document title.
  $: document.title = title || previousTitle;

  onDestroy(() => {
    document.title = previousTitle;
    pageRule.remove();
  });
</script>

<svelte:window on:keydown={handleKey} />

<div
  class="ms-print-overlay fixed inset-0 z-50 flex flex-col bg-stone-100 md:flex-row dark:bg-stone-950"
  role="dialog"
  aria-modal="true"
  aria-label={$i18n.t("pdf.preview")}
>
  <div
    bind:this={pane}
    class="ms-print-scroll relative min-h-0 flex-1 overflow-auto px-8 py-10"
  >
    {#if cloning}
      <!-- Page-shaped placeholder while the note is copied, so the sheet does not pop in. -->
      <div
        class="mx-auto flex flex-col gap-3 rounded-sm bg-white p-12 shadow-lg shadow-stone-950/10 motion-safe:animate-pulse"
        style={`width: ${page.width * pxPerMm * paperZoom}px; aspect-ratio: ${page.width} / ${page.height};`}
        aria-hidden="true"
      >
        <div class="h-7 w-2/5 rounded bg-stone-200"></div>
        <div class="mt-4 h-3 w-full rounded bg-stone-100"></div>
        <div class="h-3 w-11/12 rounded bg-stone-100"></div>
        <div class="h-3 w-4/5 rounded bg-stone-100"></div>
        <div class="mt-4 h-32 w-full rounded bg-stone-100"></div>
      </div>
    {/if}
    <div
      class="ms-print-paper ms-light relative mx-auto flex flex-col bg-white text-stone-900 shadow-lg shadow-stone-950/10 transition-[padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] dark:shadow-black/40"
      class:hidden={cloning}
      style={`--ms-paper-zoom: ${paperZoom}; width: ${page.width * pxPerMm}px; min-height: ${page.height * pxPerMm}px; padding: ${page.top * pxPerMm}px ${page.side * pxPerMm}px ${page.bottom * pxPerMm}px;`}
    >
      {#if layout.header && title}
        <div
          class="absolute inset-x-0 top-0 flex items-center justify-center truncate px-8 text-xs text-stone-500"
          style={`height: ${page.top * pxPerMm}px;`}
          aria-hidden="true"
        >
          {title}
        </div>
      {/if}
      <div
        bind:this={sheet}
        class="ms-print-sheet"
        style={`--ms-sheet-zoom: ${sheetZoom}; width: ${sourceWidth}px;`}
        aria-label={$i18n.t("pdf.renderedNote")}
        aria-busy={cloning}
      ></div>
      {#if layout.pageNumbers}
        <div
          class="absolute inset-x-0 bottom-0 flex items-center justify-center text-xs text-stone-500 tabular-nums"
          style={`height: ${page.bottom * pxPerMm}px;`}
          aria-hidden="true"
        >
          1 / 1
        </div>
      {/if}
    </div>
  </div>

  <aside
    class="ms-print-chrome flex max-h-[45dvh] w-full shrink-0 flex-col border-t border-stone-200 bg-surface md:max-h-none md:w-80 md:border-s md:border-t-0 dark:border-stone-800 dark:bg-stone-900"
  >
    <header class="flex h-14 shrink-0 items-center gap-2 px-5">
      <div class="flex min-w-0 flex-col leading-tight">
        <span class="text-sm font-medium text-stone-900 dark:text-stone-100">
          {$i18n.t("pdf.preview")}
        </span>
        {#if title}
          <span class="truncate text-xs text-stone-500 dark:text-stone-400"
            >{title}</span
          >
        {/if}
      </div>
      <Button
        label={$i18n.t("common.close")}
        icon={X}
        onClick={onClose}
        variant="ghost"
        size="sm"
        disabled={saving}
        className="ms-auto shrink-0"
      />
    </header>

    <div
      class="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto px-5 pb-6"
    >
      <PdfLayoutPanel bind:layout />
    </div>

    {#if error}
      <!-- The full message: the status bar is hidden behind this modal. -->
      <div
        class="mx-5 mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[0.8125rem] text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
        role="alert"
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0" />
        <span class="min-w-0 break-words">{error}</span>
      </div>
    {/if}

    <footer
      class="grid shrink-0 gap-2 border-t border-stone-200 px-5 py-4 dark:border-stone-800"
    >
      <Button
        label={saving ? $i18n.t("app.saving") : $i18n.t("pdf.saveAsPdf")}
        icon={FileDown}
        showLabel
        variant="primary"
        onClick={save}
        disabled={saving || cloning}
        className="w-full active:scale-[0.98]"
      />
      {#if error}
        <Button
          label={$i18n.t("pdf.printDialog")}
          icon={Printer}
          showLabel
          onClick={() => window.print()}
          className="w-full"
        />
      {/if}
    </footer>
  </aside>
</div>
