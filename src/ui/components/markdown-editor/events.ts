import {
  continueList,
  continueQuote,
  insideFence,
  mathUnclosed,
} from "../../../lib/utils/markdown";
import { EMBED_SELECTOR } from "./embedLayout";
import type { Editor, EventApi } from "./types";

export function createEvents(e: Editor): EventApi {
  const service = new EditorEvents(e);

  return {
    handleInput: service.handleInput.bind(service),
    handleCompositionEnd: service.handleCompositionEnd.bind(service),
    handleCompositionStart: service.handleCompositionStart.bind(service),
    handleKeydown: service.handleKeydown.bind(service),
    handlePaste: service.handlePaste.bind(service),
    handlePointerDown: service.handlePointerDown.bind(service),
    insideDatabaseEmbed: service.insideDatabaseEmbed.bind(service),
  };
}

/** Typing, pointer and clipboard events, sent to whichever island owns them. */
class EditorEvents {
  constructor(private e: Editor) {}

  /**
   * Events from the live database card belong to it, not to the note's source.
   * IME events name the editor as their target, so focus decides as well.
   */
  insideDatabaseEmbed(event?: Event) {
    return Boolean(this.e.databaseCardFor(event));
  }

  handleCompositionStart(event: Event) {
    if (!this.insideDatabaseEmbed(event)) {
      this.e.ui.composing = true;
    }
  }

  handleCompositionEnd(event: Event) {
    if (this.insideDatabaseEmbed(event)) {
      return;
    }

    this.e.ui.composing = false;
    this.handleInput();
  }

  handleInput(event?: Event) {
    const e = this.e;

    if (e.ui.composing || this.insideDatabaseEmbed(event)) {
      return;
    }

    const tableCell = e.tableCellForNode(event?.target as Node | null);

    if (tableCell) {
      e.handleTableCellInput(tableCell);
      return;
    }

    e.value = e.getText();
    const offset = e.caretOffset();
    e.renderPreservingScroll(offset);

    if (offset !== null) {
      e.syncMenu(offset);
      e.syncCompletions(offset);
    }

    e.props.onInput();
  }

  private handleCompletionKeydown(event: KeyboardEvent) {
    const e = this.e;
    const completions = e.ui.completions;

    if (!completions.length) {
      return false;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const step = event.key === "ArrowDown" ? 1 : completions.length - 1;

      event.preventDefault();
      e.ui.completionIndex =
        (e.ui.completionIndex + step) % completions.length;
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      e.applyCompletion(completions[e.ui.completionIndex]);
      return true;
    }

    if (event.key === "Escape") {
      e.closeCompletions();
      return true;
    }

    return false;
  }

  private handleSlashKeydown(event: KeyboardEvent) {
    const e = this.e;
    const matches = e.slashMatches();

    if (!e.props.slashCommands || e.ui.slashStart === null || !matches.length) {
      return false;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const step = event.key === "ArrowDown" ? 1 : matches.length - 1;

      event.preventDefault();
      e.ui.slashIndex = (e.ui.slashIndex + step) % matches.length;
      return true;
    }

    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      e.runCommand(matches[e.ui.slashIndex].prefix);
      return true;
    }

    if (event.key === "Escape") {
      e.closeMenu();
      return true;
    }

    return false;
  }

  private handleRunShortcut(event: KeyboardEvent) {
    const e = this.e;
    const shortcut = event.ctrlKey || event.metaKey;

    if (!e.props.codeExecution || event.key !== "Enter" || !shortcut) {
      return false;
    }

    const group = e.currentBlock()?.dataset.code;
    const preview = group
      ? (e.element?.querySelector(
          `.md-run-preview[data-code="${group}"]`,
        ) as HTMLElement | null)
      : null;

    if (!preview) {
      return false;
    }

    event.preventDefault();
    void e.runCell(preview);
    return true;
  }

  private handleAutoClose(event: KeyboardEvent, offset: number, start: number) {
    const e = this.e;
    const typed = e.value.slice(start, offset);

    if (
      event.key === "`" &&
      /^[ \t]*``$/.test(typed) &&
      !insideFence(e.value.slice(0, start))
    ) {
      event.preventDefault();
      e.closeMenu();
      e.replace(offset, offset, "`\n\n```", offset + 2);
      return true;
    }

    if (
      event.key === "Enter" &&
      /^[ \t]*\$\$$/.test(typed) &&
      mathUnclosed(e.value)
    ) {
      event.preventDefault();
      e.closeMenu();
      e.replace(offset, offset, "\n\n$$", offset + 1);
      return true;
    }

    return false;
  }

  private handleEnter(event: KeyboardEvent, offset: number, start: number) {
    const e = this.e;

    if (event.key !== "Enter") {
      return false;
    }

    event.preventDefault();
    e.closeMenu();

    const inCodeBlock = e
      .blockAtOffset(offset)
      ?.classList.contains("md-codeblock");

    if (inCodeBlock && insideFence(e.value.slice(0, start))) {
      e.replace(offset, offset, "\n");
      return true;
    }

    const line = e.value.slice(start, offset);
    const quotePrefix = continueQuote(line);
    const prefix = quotePrefix || continueList(line);

    if (!quotePrefix && /^\s*>\s?$/.test(line)) {
      e.replace(start, offset, "");
      return true;
    }

    if (!prefix && /^\s*([-*+]|\d+\.)( \[[ x]\])? $/.test(line)) {
      e.replace(start, offset, "");
      return true;
    }

    e.replace(offset, offset, `\n${prefix}`);
    return true;
  }

  private handleTab(event: KeyboardEvent, offset: number, start: number) {
    const e = this.e;

    if (event.key !== "Tab") {
      return false;
    }

    event.preventDefault();

    if (event.shiftKey) {
      const line = e.value.slice(start, offset);

      e.replace(start, offset, line.replace(/^ {1,2}/, ""));
    } else {
      e.replace(offset, offset, "  ");
    }

    return true;
  }

  private handleMarkdownKeydown(event: KeyboardEvent) {
    const e = this.e;
    const offset = e.caretOffset();

    if (offset === null || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const start = e.lineStartAt(offset);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      const direction = event.key === "ArrowDown" ? "down" : "up";

      e.repairPreviewNavigation(direction, offset);
      return;
    }

    if (
      this.handleAutoClose(event, offset, start) ||
      this.handleEnter(event, offset, start)
    ) {
      return;
    }

    this.handleTab(event, offset, start);
  }

  handleKeydown(event: KeyboardEvent) {
    const e = this.e;

    if (this.insideDatabaseEmbed(event)) {
      return;
    }

    const tableCell = e.tableCellForNode(event.target as Node | null);

    if (tableCell && e.handleTableKeydown(event, tableCell)) {
      return;
    }

    if (
      this.handleCompletionKeydown(event) ||
      this.handleSlashKeydown(event) ||
      this.handleRunShortcut(event)
    ) {
      return;
    }

    this.handleMarkdownKeydown(event);
  }

  handlePaste(event: ClipboardEvent) {
    const e = this.e;

    if (this.insideDatabaseEmbed(event)) {
      return;
    }

    const files = Array.from(event.clipboardData?.files ?? []);

    if (files.length) {
      event.preventDefault();
      void e.props.onAssets({ files }).then(e.insertAssets);
      return;
    }

    const offset = e.caretOffset();
    const text = event.clipboardData?.getData("text/plain");
    const table = e.tableSelection();

    if (table && text !== undefined) {
      event.preventDefault();
      e.replaceTableCellSelection(table.cell, text);
      return;
    }

    if (offset === null || !text) {
      return;
    }

    event.preventDefault();
    e.replace(offset, offset, text);
  }

  private handleWikilinkPointer(event: PointerEvent, handle: HTMLElement) {
    const { onWikilink, editable } = this.e.props;
    const wikilink = handle.closest?.(".md-wikilink") as HTMLElement | null;
    const embedOpen = handle.closest?.(
      ".md-wikilink-embed-open",
    ) as HTMLElement | null;

    if (embedOpen?.dataset.wikilinkTarget && onWikilink) {
      event.preventDefault();
      void onWikilink(embedOpen.dataset.wikilinkTarget);
      return true;
    }

    const inEmbed = Boolean(wikilink?.closest(".md-wikilink-embed-preview"));
    const follows = !editable || event.ctrlKey || event.metaKey || inEmbed;

    if (wikilink?.dataset.wikilinkTarget && onWikilink && follows) {
      event.preventDefault();
      void onWikilink(wikilink.dataset.wikilinkTarget);
      return true;
    }

    return false;
  }

  handlePointerDown(event: PointerEvent) {
    const e = this.e;
    const handle = event.target as HTMLElement;

    // pointerdown fires for the right button too, which the menu owns.
    if (event.button !== 0 || this.handleWikilinkPointer(event, handle)) {
      return;
    }

    const onEmbed =
      handle.classList?.contains("md-resize") &&
      handle.closest(EMBED_SELECTOR);

    if (e.props.editable && onEmbed) {
      e.startEmbedResize(event, handle);
      return;
    }

    if (
      e.handleRunPointer(event, handle) ||
      e.handleDiagramPointer(event, handle)
    ) {
      return;
    }

    e.startMediaResize(event, handle);
  }
}
