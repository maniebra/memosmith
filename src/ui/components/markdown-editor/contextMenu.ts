import {
  ClipboardCopy,
  ClipboardPaste,
  FileUp,
  Scissors,
  Sparkles,
  Trash2,
} from "@lucide/svelte";
import type { ContextMenuItem } from "../ContextMenu.svelte";
import { databaseAnchorFor, databaseMenuItems } from "./databaseMenu";
import { EMBED_SELECTOR } from "./embedLayout";
import { formatMenuItems } from "./formatMenu";
import type { ContextMenuApi, Editor } from "./types";

/** What a right click landed on, and what it left selected. */
export type ContextMenuState = {
  x: number;
  y: number;
  hasSelection: boolean;
  textSelection?: { start: number; end: number } | null;
  embedPreview?: HTMLElement | null;
  /** The card in the note behind a right-clicked database view. */
  databaseCard?: HTMLElement | null;
};

export function createContextMenu(e: Editor): ContextMenuApi {
  const service = new EditorContextMenu(e);

  return {
    closeContextMenu: service.closeContextMenu.bind(service),
    contextItems: service.contextItems.bind(service),
    copySelection: service.copySelection.bind(service),
    cutSelection: service.cutSelection.bind(service),
    openContextMenu: service.openContextMenu.bind(service),
    pasteClipboard: service.pasteClipboard.bind(service),
    selectAll: service.selectAll.bind(service),
  };
}

/** Puts a collapsed caret under the pointer, unless a real selection exists. */
export function placeCaretAtPoint(e: Editor, event: MouseEvent) {
  const selection = e.selectionOffsets();

  if (selection && selection.start !== selection.end) {
    return;
  }

  const caretDocument = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };
  const { clientX, clientY } = event;
  let range = caretDocument.caretRangeFromPoint?.(clientX, clientY) ?? null;

  if (!range) {
    const position = caretDocument.caretPositionFromPoint?.(clientX, clientY);

    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
    }
  }

  if (!range || !e.element?.contains(range.startContainer)) {
    return;
  }

  range.collapse(true);
  const nextSelection = getSelection();
  nextSelection?.removeAllRanges();
  nextSelection?.addRange(range);
  e.markActiveBlock();
}

/** The right-click menu, and the clipboard commands it offers. */
class EditorContextMenu {
  constructor(private e: Editor) {}

  closeContextMenu() {
    this.e.ui.contextMenu = null;
  }

  async copySelection() {
    const table = this.e.tableSelection();

    if (table) {
      const text = table.text || table.cell.innerText;

      if (text) {
        await navigator.clipboard.writeText(text);
      }

      return;
    }

    const selection = this.e.selectionOffsets();

    if (!selection || selection.start === selection.end) {
      return;
    }

    await navigator.clipboard.writeText(
      this.e.value.slice(selection.start, selection.end),
    );
  }

  async cutSelection() {
    const table = this.e.tableSelection();

    if (table) {
      const text = table.text || table.cell.innerText;

      if (!text) {
        return;
      }

      await navigator.clipboard.writeText(text);

      if (this.e.props.editable) {
        this.e.replaceTableCellSelection(table.cell, "");
      }

      return;
    }

    const selection = this.e.selectionOffsets();

    if (!selection || selection.start === selection.end) {
      return;
    }

    await navigator.clipboard.writeText(
      this.e.value.slice(selection.start, selection.end),
    );
    this.e.replace(selection.start, selection.end, "");
  }

  async pasteClipboard() {
    const text = await navigator.clipboard.readText();
    const table = this.e.tableSelection();

    if (table && this.e.props.editable) {
      this.e.replaceTableCellSelection(table.cell, text);
      return;
    }

    if (text) {
      this.e.replaceSelection(text);
    }
  }

  selectAll() {
    const table = this.e.tableSelection();

    if (table) {
      this.e.selectTableCellContents(table.cell);
      return;
    }

    if (!this.e.element || !this.e.value) {
      return;
    }

    this.e.selectRange(0, this.e.value.length);
    this.e.markActiveBlock();
  }

  private selectMenuTableCell(target: HTMLElement) {
    const tableCell = this.e.tableCellForNode(target);
    const preview = target.closest(".md-table-preview") as HTMLElement | null;
    const fallback = preview ? this.e.selectedCellIn(preview) : null;
    const cell = tableCell ?? fallback;
    const selection = getSelection();
    const selectionCell =
      this.e.tableCellForNode(selection?.anchorNode ?? null) ??
      this.e.tableCellForNode(selection?.focusNode ?? null);

    if (cell) {
      this.e.selectTableCell(cell);
    }

    return Boolean(
      cell && selectionCell === cell && selection && !selection.isCollapsed,
    );
  }

  openContextMenu(event: MouseEvent) {
    const e = this.e;

    event.preventDefault();
    e.closeMenu();

    const target = event.target as HTMLElement;

    // Same as a left click: the database card owns no caret position. Its own
    // menu still opens, or the webview's would take over the card.
    const databaseCard = databaseAnchorFor(target, e.element);

    if (databaseCard) {
      e.ui.contextMenu = {
        databaseCard,
        x: event.clientX,
        y: event.clientY,
        hasSelection: false,
        textSelection: null,
      };

      return;
    }

    const embedPreview = target.closest(EMBED_SELECTOR) as HTMLElement | null;

    // An embed card holds no caret position, so focusing and placing one there
    // would drop the caret at the top of the note and scroll the editor.
    if (embedPreview) {
      e.ui.contextMenu = {
        embedPreview,
        x: event.clientX,
        y: event.clientY,
        hasSelection: false,
        textSelection: null,
      };

      return;
    }

    e.element?.focus();

    if (!this.selectMenuTableCell(target)) {
      placeCaretAtPoint(this.e, event);
    }

    const textSelection = e.selectionOffsets();
    const table = e.tableSelection();

    e.ui.contextMenu = {
      embedPreview,
      x: event.clientX,
      y: event.clientY,
      hasSelection: Boolean(
        table
          ? table.text || table.cell.innerText
          : textSelection && textSelection.start !== textSelection.end,
      ),
      textSelection,
    };
  }

  /** The selection is the prompt; generated markdown lands right after it. */
  private async generateFromSelection() {
    const e = this.e;
    const range = e.ui.contextMenu?.textSelection;
    const prompt = range ? e.value.slice(range.start, range.end).trim() : "";
    const onGenerate = e.props.onGenerate;

    if (!onGenerate || !prompt || e.ui.generating) {
      return;
    }

    e.ui.generating = true;

    try {
      const generated = await onGenerate(prompt);

      e.replace(range!.end, range!.end, `\n\n${generated}\n`);
    } finally {
      e.ui.generating = false;
    }
  }

  private clipboardItems(hasSelection: boolean): ContextMenuItem[] {
    const e = this.e;

    return [
      {
        label: e.t("common.cut"),
        shortcut: "Ctrl X",
        icon: Scissors,
        disabled: !e.props.editable || !hasSelection,
        onSelect: () => this.cutSelection(),
      },
      {
        label: e.t("common.copy"),
        shortcut: "Ctrl C",
        icon: ClipboardCopy,
        disabled: !hasSelection,
        onSelect: () => this.copySelection(),
      },
      {
        label: e.t("common.paste"),
        shortcut: "Ctrl V",
        icon: ClipboardPaste,
        disabled: !e.props.editable,
        onSelect: () => this.pasteClipboard(),
      },
    ];
  }

  contextItems(): ContextMenuItem[] {
    const e = this.e;
    const props = e.props;
    const databaseCard = e.ui.contextMenu?.databaseCard;

    // The card is one block the note owns: it is deleted, not edited in place.
    if (databaseCard) {
      return databaseMenuItems(databaseCard, {
        editable: props.editable,
        label: (key) => e.t(key as Parameters<Editor["t"]>[0]),
        icon: Trash2,
        onDelete: (anchor) => e.deleteEmbed(anchor),
      });
    }

    const hasSelection = Boolean(e.ui.contextMenu?.hasSelection);
    const generating = e.ui.generating;

    return [
      ...e.embedAlignItems(),
      ...e.alignItems(),
      ...e.tableItems(),
      ...this.clipboardItems(hasSelection),
      { separator: true },
      ...formatMenuItems(e, hasSelection),
      { separator: true },
      {
        label: generating ? e.t("editor.generating") : e.t("editor.generateAi"),
        icon: Sparkles,
        disabled:
          !props.editable || !props.onGenerate || !hasSelection || generating,
        onSelect: () => this.generateFromSelection(),
      },
      {
        label: e.t("editor.insertFile"),
        icon: FileUp,
        disabled: !props.editable || !props.onPickAssets,
        onSelect: async () => e.insertAssets(await props.onPickAssets!()),
      },
      { separator: true },
      {
        label: e.t("editor.selectAll"),
        shortcut: "Ctrl A",
        disabled: !e.value,
        onSelect: () => this.selectAll(),
      },
    ];
  }
}
