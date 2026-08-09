<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { Printer, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import Button from "./Button.svelte";
  import { exportPdf } from "../../lib/tauri/pdf";

  /** The live editor frame; it is cloned so the PDF shows exactly what is on screen. */
  export let source: HTMLElement | undefined;
  export let title = "";
  export let onClose: () => void;
  export let onStatus: (message: string) => void = () => {};

  let sheet: HTMLElement | undefined;
  let cloning = true;
  let saving = false;
  let error = "";

  const previousTitle = document.title;

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

    for (const start of Array.from(copy.querySelectorAll(".md-fence-open, .md-codeblock"))) {
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
    const portals = Array.from(copy.querySelectorAll(".md-database-portal")) as HTMLElement[];
    const anchors = Array.from(
      copy.querySelectorAll(".md-database-preview:not(.md-database-portal)"),
    ) as HTMLElement[];
    const taken = new Set<HTMLElement>();

    portals.forEach((portal, index) => {
      // `data-code` pairs the two; position is the fallback, since a re-render can renumber it.
      const anchor =
        anchors.find(
          (candidate) => candidate.dataset.code === portal.dataset.code && !taken.has(candidate),
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

  function clone() {
    if (!sheet || !source) {
      cloning = false;
      return;
    }

    const copy = source.cloneNode(true) as HTMLElement;

    // Editing affordances are part of the live DOM, never part of the document.
    for (const chrome of Array.from(
      copy.querySelectorAll(".md-block-toolbar, .md-block-drop-indicator, .md-tail-add"),
    )) {
      chrome.remove();
    }

    for (const editable of Array.from(copy.querySelectorAll("[contenteditable]"))) {
      (editable as HTMLElement).contentEditable = "false";
    }

    // A failed touch-up is still worth printing: show the note rather than an empty sheet.
    try {
      inlineDatabaseEmbeds(copy);
      groupCodeBlocks(copy);
    } catch (failure) {
      error = failure instanceof Error ? failure.message : String(failure);
      console.error("PDF preview layout failed", failure);
    }

    // Database embeds are absolutely positioned against the frame, so the clone only
    // lines up at the width it was laid out at.
    sheet.style.width = `${source.getBoundingClientRect().width}px`;
    sheet.replaceChildren(copy);
    cloning = false;
  }

  async function save() {
    saving = true;
    error = "";

    try {
      const path = await exportPdf(title);
      onStatus(path ? $i18n.t("pdf.saved", { path }) : $i18n.t("pdf.cancelled"));

      if (path) {
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
    // The page pins itself to the light theme while this modal is open, and diagrams re-render
    // for it asynchronously.
    // ponytail: fixed wait for that repaint; add a re-clone button if a slow PlantUML server
    // ever lands after it.
    const timer = setTimeout(clone, 500);

    return () => clearTimeout(timer);
  });

  // The print dialog and the save dialog both name the file after the document title.
  $: document.title = title || previousTitle;

  onDestroy(() => {
    document.title = previousTitle;
  });
</script>

<svelte:window on:keydown={handleKey} />

<div class="ms-print-overlay fixed inset-0 z-50 flex flex-col bg-stone-900/60">
  <header
    class="ms-print-chrome flex h-12 shrink-0 items-center gap-2 border-b border-stone-200/70 bg-stone-50/95 px-3"
  >
    <span class="text-sm font-medium text-stone-700">PDF preview</span>
    <span class="min-w-0 truncate text-sm text-stone-400">{title}</span>
    {#if error}
      <span class="min-w-0 truncate text-sm text-rose-600" role="alert">{error}</span>
    {/if}
    <div class="ml-auto flex items-center gap-1">
      <Button
        label={saving ? $i18n.t("app.saving") : $i18n.t("pdf.saveAsPdf")}
        icon={Printer}
        onClick={save}
        disabled={saving || cloning}
        size="sm"
      />
      {#if error}
        <Button
          label="Print dialog"
          onClick={() => window.print()}
          variant="secondary"
          size="sm"
        />
      {/if}
      <Button label={$i18n.t("common.close")} icon={X} onClick={onClose} variant="ghost" size="sm" />
    </div>
  </header>

  <div class="ms-print-scroll min-h-0 flex-1 overflow-auto p-8">
    <div
      bind:this={sheet}
      class="ms-print-sheet mx-auto bg-white text-stone-900 shadow-xl"
      aria-label={$i18n.t("pdf.renderedNote")}
      aria-busy={cloning}
    ></div>
  </div>
</div>
