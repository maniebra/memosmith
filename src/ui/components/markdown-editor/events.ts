import { spotifyMarkdown } from "../../../lib/utils/spotify";
import { youtubeMarkdown } from "../../../lib/utils/youtube";
import {
  enterEdit,
  insideFence,
  lineStartAt,
  mathUnclosed,
  tabEdit,
} from "../../../lib/utils/markdown";
import { handleCompletionKeydown, handleSlashKeydown } from "./menuKeys";
import { editSurface, type EditSurface } from "./surface";
import { EMBED_SELECTOR } from "./embedLayout";
import { handleCalloutPointer } from "./calloutPointer";
import { handleVimKeydown } from "./vim";
import { handleEditorShortcut } from "./shortcuts";
import {
  handleQuizChange,
  handleQuizFieldKeydown,
  handleQuizPointer,
  quizFieldOf,
} from "./quiz";
import { toggleTaskAt, toggleTaskKey } from "./taskToggle";
import { journal } from "../../../lib/utils/journal";
import { handleDragOver, handleDrop } from "./drop";
import type { Editor, EventApi } from "./types";

export function createEvents(e: Editor): EventApi {
  const service = new EditorEvents(e);

  return {
    handleInput: service.handleInput.bind(service),
    handleCompositionEnd: service.handleCompositionEnd.bind(service),
    handleCompositionStart: service.handleCompositionStart.bind(service),
    handleKeydown: service.handleKeydown.bind(service),
    handlePaste: service.handlePaste.bind(service),
    handleDragOver: (event) => handleDragOver(e, event),
    handleDrop: (event) =>
      handleDrop(e, event, service.insideDatabaseEmbed(event)),
    handlePointerDown: service.handlePointerDown.bind(service),
    handleChange: service.handleChange.bind(service),
    insideDatabaseEmbed: service.insideDatabaseEmbed.bind(service),
  };
}

class EditorEvents {
  constructor(private e: Editor) {}

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

  /** A quiz field is its own little editor: its typing never becomes note text. */
  handleChange(event: Event) {
    handleQuizChange(this.e, event);
  }

  handleInput(event?: Event) {
    const e = this.e;

    if (
      e.ui.composing ||
      this.insideDatabaseEmbed(event) ||
      quizFieldOf(event?.target as Node | null)
    ) {
      return;
    }

    const subblockBody = e.subblockBodyForNode(event?.target as Node | null);
    if (subblockBody) {
      e.handleSubblockInput(subblockBody);

      // The body may have been re-rendered, so the menu reads the live caret.
      const surface = editSurface(e, null);

      if (surface) {
        e.syncMenu(surface);
        e.syncCompletions(surface);
      }

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

    const surface = offset === null ? null : editSurface(e, null);

    if (surface) {
      e.syncMenu(surface);
      e.syncCompletions(surface);
    }

    e.props.onInput();
  }

  private handleRunShortcut(event: KeyboardEvent) {
    const e = this.e;
    const shortcut = event.ctrlKey || event.metaKey;

    if (!e.props.codeExecution || event.key !== "Enter" || !shortcut) {
      return false;
    }

    // Keyboard shortcut, so the caret picks the cell — `currentBlock()` would
    // let a block merely sitting under the mouse pointer run instead.
    const caret = e.caretOffset();
    const block =
      (caret === null ? null : e.blockAtOffset(caret)) ?? e.ui.activeBlock;
    const group = block?.dataset.code;
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

  private handleAutoClose(event: KeyboardEvent, surface: EditSurface) {
    const e = this.e;
    const { text, caret } = surface;
    const start = lineStartAt(text, caret);
    const typed = text.slice(start, caret);

    if (
      event.key === "`" &&
      /^[ \t]*``$/.test(typed) &&
      !insideFence(text.slice(0, start))
    ) {
      event.preventDefault();
      e.closeMenu();
      surface.apply({
        start: caret,
        end: caret,
        text: "`\n\n```",
        caret: caret + 1,
      });
      return true;
    }

    if (
      event.key === "Enter" &&
      /^[ \t]*\$\$$/.test(typed) &&
      mathUnclosed(text)
    ) {
      event.preventDefault();
      e.closeMenu();
      surface.apply({
        start: caret,
        end: caret,
        text: "\n\n$$",
        caret: caret + 1,
      });
      return true;
    }

    return false;
  }

  private handleEnter(event: KeyboardEvent, surface: EditSurface) {
    if (event.key !== "Enter") {
      return false;
    }

    event.preventDefault();
    this.e.closeMenu();
    surface.apply(
      enterEdit(surface.text, surface.caret, surface.inCodeBlock),
    );
    return true;
  }

  private handleTab(event: KeyboardEvent, surface: EditSurface) {
    if (event.key !== "Tab") {
      return false;
    }

    event.preventDefault();
    surface.apply(tabEdit(surface.text, surface.caret, event.shiftKey));
    return true;
  }

  private handleMarkdownKeydown(event: KeyboardEvent, surface: EditSurface) {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // Inside a column the browser already walks the body's own lines.
      if (!surface.subblock) {
        this.e.repairPreviewNavigation(
          event.key === "ArrowDown" ? "down" : "up",
          surface.caret,
        );
      }

      return;
    }

    if (
      this.handleAutoClose(event, surface) ||
      this.handleEnter(event, surface)
    ) {
      return;
    }

    this.handleTab(event, surface);
  }

  handleKeydown(event: KeyboardEvent) {
    const e = this.e;

    if (this.insideDatabaseEmbed(event)) {
      return;
    }

    if (toggleTaskKey(e, event)) {
      return;
    }

    if (handleQuizFieldKeydown(event)) {
      return;
    }

    const tableCell = e.tableCellForNode(event.target as Node | null);

    if (tableCell && e.handleTableKeydown(event, tableCell)) {
      return;
    }

    const subblockBody = e.subblockBodyForNode(event.target as Node | null);
    if (subblockBody && e.handleSubblockKeydown(event, subblockBody)) {
      return;
    }

    const surface = editSurface(e, event.target as Node | null);

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      journal("events.selectAllKey", {
        surface: Boolean(surface),
        target: event.target as Node | null,
        caret: e.caretOffset(),
      });
    }

    if (!surface) {
      return;
    }

    if (
      handleVimKeydown(event, e, surface) ||
      handleEditorShortcut(event, e, surface) ||
      handleCompletionKeydown(this.e, event)
    ) {
      return;
    }

    if (handleSlashKeydown(this.e, event) || this.handleRunShortcut(event)) {
      return;
    }

    this.handleMarkdownKeydown(event, surface);
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

    const text = event.clipboardData?.getData("text/plain");
    const subblockBody = e.subblockBodyForNode(event.target as Node | null);
    if (subblockBody && text !== undefined) {
      event.preventDefault();
      e.replaceSubblockSelection(subblockBody, text);
      return;
    }

    const offset = e.caretOffset();
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
    const video =
      (e.props.youtube ? youtubeMarkdown(text) : null) ??
      (e.props.spotify ? spotifyMarkdown(text) : null);

    if (video) {
      // The player needs a line of its own.
      const before = e.value.slice(0, offset);
      const lead = before === "" || before.endsWith("\n") ? "" : "\n";
      e.replace(offset, offset, `${lead}${video}\n`);
      return;
    }

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
    if (
      event.button !== 0 ||
      this.handleWikilinkPointer(event, handle) ||
      handleCalloutPointer(e, event, handle) ||
      handleQuizPointer(e, event, handle) ||
      toggleTaskAt(this.e, event, handle)
    ) {
      return;
    }
    // A column body only claims the click when it moves its own caret.
    const subblockBody = e.subblockBodyForNode(handle);
    if (subblockBody && e.handleSubblockPointerDown(event, subblockBody)) {
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
