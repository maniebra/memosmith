import {
  editMarkdownTable,
  parseMarkdownTable,
} from "../../../lib/utils/markdown";
import type { Editor, TableApi } from "./types";

export function createTables(e: Editor): TableApi {
  const service = new EditorTables(e);

  return {
    bindTableToolbars: service.bindTableToolbars.bind(service),
    copyTable: service.copyTable.bind(service),
    handleTableCellInput: service.handleTableCellInput.bind(service),
    markSelectedTableCell: service.markSelectedTableCell.bind(service),
    replaceTableCellSelection:
      service.replaceTableCellSelection.bind(service),
    pasteTable: service.pasteTable.bind(service),
    focusTableSource: service.focusTableSource.bind(service),
    selectTableCell: service.selectTableCell.bind(service),
    selectTableCellContents: service.selectTableCellContents.bind(service),
    selectedCellIn: service.selectedCellIn.bind(service),
    selectedTableCellElement: service.selectedTableCellElement.bind(service),
    tableSelection: service.tableSelection.bind(service),
    updateTable: service.updateTable.bind(service),
  };
}

/** The fancy table editor: cell selection and edits written back to the source. */
class EditorTables {
  constructor(private e: Editor) {}

  private tableSourceBlocks(preview: Element) {
    const group = (preview as HTMLElement).dataset.table;
    const children = Array.from(this.e.element?.children ?? []);

    return (children as HTMLElement[]).filter(
      (block) =>
        block.dataset.table === group &&
        !block.classList.contains("md-preview"),
    );
  }

  private tableRangeFor(preview: Element) {
    const e = this.e;
    const sourceBlocks = this.tableSourceBlocks(preview);
    const first = sourceBlocks[0];
    const last = sourceBlocks[sourceBlocks.length - 1];
    const start = first ? e.offsetForPosition(first, 0) : null;
    const end = last ? e.offsetForPosition(last, e.sourceLength(last)) : null;

    return start === null || end === null ? null : { start, end };
  }

  private tableSourceText(preview: Element) {
    return this.tableSourceBlocks(preview)
      .map((block) => this.e.sourceText(block))
      .join("\n");
  }

  async copyTable(preview: HTMLElement) {
    await navigator.clipboard.writeText(this.tableSourceText(preview));
  }

  async pasteTable(preview: HTMLElement) {
    const text = (await navigator.clipboard.readText())
      .replace(/\r\n?/g, "\n")
      .trim();

    if (!text || !parseMarkdownTable(text.split("\n"))) {
      this.e.props.onStatus(this.e.t("editor.pasteTableInvalid"));
      return;
    }

    this.replaceTable(preview, text, true);
  }

  private syncTableSourceBlocks(preview: Element, text: string) {
    const sourceBlocks = this.tableSourceBlocks(preview);
    const lines = text.split("\n");

    if (sourceBlocks.length !== lines.length) {
      return false;
    }

    for (const [index, block] of sourceBlocks.entries()) {
      block.textContent = lines[index];
    }

    return true;
  }

  private syncTableToolbarScroll(shell: HTMLElement) {
    const tools = shell.querySelector(".md-table-tools") as HTMLElement | null;

    if (!tools) {
      return;
    }

    const overflow = tools.scrollWidth > tools.clientWidth + 1;
    const right = tools.scrollLeft + tools.clientWidth < tools.scrollWidth - 1;

    shell.toggleAttribute("data-scroll-left", overflow && tools.scrollLeft > 1);
    shell.toggleAttribute("data-scroll-right", overflow && right);
  }

  private syncTableToolbars() {
    requestAnimationFrame(() => {
      const shells = this.e.element?.querySelectorAll(".md-table-tools-shell");

      for (const shell of Array.from(shells ?? [])) {
        this.syncTableToolbarScroll(shell as HTMLElement);
      }
    });
  }

  bindTableToolbars() {
    const tools = this.e.element?.querySelectorAll(".md-table-tools") ?? [];

    for (const bar of Array.from(tools)) {
      const shell = bar.closest(".md-table-tools-shell") as HTMLElement | null;

      if (!shell) {
        continue;
      }

      bar.addEventListener(
        "scroll",
        () => this.syncTableToolbarScroll(shell),
        { passive: true },
      );
    }

    this.syncTableToolbars();
  }

  private markSelectedPreviews() {
    const selected = this.e.ui.selectedTableCell;
    const previews = this.e.element?.querySelectorAll(".md-table-preview");

    for (const preview of Array.from(previews ?? [])) {
      const htmlPreview = preview as HTMLElement;

      htmlPreview.toggleAttribute(
        "data-active",
        Boolean(selected && htmlPreview.dataset.table === selected.group),
      );
    }
  }

  markSelectedTableCell() {
    const selected = this.e.ui.selectedTableCell;
    const cells = this.e.element?.querySelectorAll("[data-table-cell]");

    this.markSelectedPreviews();

    for (const cell of Array.from(cells ?? [])) {
      const htmlCell = cell as HTMLElement;
      const preview = htmlCell.closest(".md-table-preview") as HTMLElement | null;

      htmlCell.classList.toggle(
        "is-selected",
        Boolean(
          selected &&
            preview?.dataset.table === selected.group &&
            Number(htmlCell.dataset.row) === selected.row &&
            Number(htmlCell.dataset.column) === selected.column,
        ),
      );
    }

    this.syncTableToolbars();
  }

  selectTableCell(cell: HTMLElement) {
    const preview = cell.closest(".md-table-preview") as HTMLElement | null;

    if (!preview?.dataset.table) {
      return;
    }

    this.e.setActiveBlock(undefined);

    this.e.ui.selectedTableCell = {
      group: preview.dataset.table,
      row: Number(cell.dataset.row),
      column: Number(cell.dataset.column),
    };
    this.markSelectedTableCell();
  }

  /** Moves the caret from a table's hidden source line into its card. */
  focusTableSource(block: HTMLElement) {
    const preview = this.e.element?.querySelector(
      `.md-table-preview[data-table="${block.dataset.table}"]`,
    ) as HTMLElement | null;
    const cell = preview ? this.selectedCellIn(preview) : null;

    if (!cell) {
      this.e.setActiveBlock(undefined);
      return;
    }

    cell.focus();
    this.selectTableCell(cell);

    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(false);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  private cellAt(preview: HTMLElement, row: number, column: number) {
    const cell = preview.querySelector(
      `[data-table-cell][data-row="${row}"][data-column="${column}"]`,
    );

    return cell instanceof HTMLElement ? cell : null;
  }

  selectedCellIn(preview: HTMLElement) {
    const selected = this.e.ui.selectedTableCell;

    if (selected && selected.group === preview.dataset.table) {
      const cell = this.cellAt(preview, selected.row, selected.column);

      if (cell) {
        return cell;
      }
    }

    return preview.querySelector("[data-table-cell]") as HTMLElement | null;
  }

  selectedTableCellElement() {
    const selected = this.e.ui.selectedTableCell;

    if (!this.e.element || !selected) {
      return null;
    }

    const previews = this.e.element.querySelectorAll(".md-table-preview");

    for (const preview of Array.from(previews) as HTMLElement[]) {
      if (preview.dataset.table !== selected.group) {
        continue;
      }

      return this.cellAt(preview, selected.row, selected.column);
    }

    return null;
  }

  tableSelection() {
    const selection = getSelection();
    const anchorCell = this.e.tableCellForNode(selection?.anchorNode ?? null);
    const focusCell = this.e.tableCellForNode(selection?.focusNode ?? null);

    if (selection && anchorCell && anchorCell === focusCell) {
      return {
        cell: anchorCell,
        text: selection.toString(),
        hasSelection: !selection.isCollapsed,
      };
    }

    const selected = this.selectedTableCellElement();

    return selected
      ? { cell: selected, text: selected.innerText, hasSelection: false }
      : null;
  }

  selectTableCellContents(cell: HTMLElement) {
    cell.focus();
    this.selectTableCell(cell);

    const range = document.createRange();
    range.selectNodeContents(cell);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    this.markSelectedTableCell();
  }

  replaceTableCellSelection(cell: HTMLElement, text: string) {
    const selection = getSelection();
    const anchorCell = this.e.tableCellForNode(selection?.anchorNode ?? null);
    const focusCell = this.e.tableCellForNode(selection?.focusNode ?? null);

    if (selection?.rangeCount && anchorCell === cell && focusCell === cell) {
      const range = selection.getRangeAt(0);
      const node = document.createTextNode(text);

      range.deleteContents();
      range.insertNode(node);
      range.setStartAfter(node);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      cell.textContent = text;
      this.selectTableCellContents(cell);
    }

    this.handleTableCellInput(cell);
  }

  private replaceTable(
    preview: HTMLElement,
    text: string,
    renderPreview: boolean,
  ) {
    const e = this.e;
    const range = this.tableRangeFor(preview);

    if (!range) {
      return;
    }

    e.value = e.value.slice(0, range.start) + text + e.value.slice(range.end);

    if (renderPreview || !this.syncTableSourceBlocks(preview, text)) {
      e.render(null);
    }

    e.props.onInput();
  }

  updateTable(
    preview: HTMLElement,
    edit: Parameters<typeof editMarkdownTable>[1],
    renderPreview = true,
  ) {
    const source = this.tableSourceText(preview);
    const next = editMarkdownTable(source, edit);

    if (next !== source) {
      this.replaceTable(preview, next, renderPreview);
    }
  }

  handleTableCellInput(cell: HTMLElement) {
    const preview = cell.closest(".md-table-preview") as HTMLElement | null;

    if (!preview) {
      return;
    }

    this.selectTableCell(cell);
    this.updateTable(
      preview,
      {
        type: "set-cell-text",
        row: Number(cell.dataset.row),
        column: Number(cell.dataset.column),
        // `sourceText` drops the zero-width anchor an empty cell renders with:
        // left in, it lands in the markdown and the re-render throws the caret
        // into the source lines.
        text: this.e.sourceText(cell).replace(/\s*\n\s*/g, " ").trim(),
      },
      false,
    );
  }
}
