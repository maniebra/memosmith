import type { ContextMenuItem } from "../ContextMenu.svelte";
import { withoutEmptyCaret } from "./dom";
import type { Editor, TableMenuApi } from "./types";

const ARROW_STEPS: Record<string, { row: number; column: number }> = {
  ArrowUp: { row: -1, column: 0 },
  ArrowDown: { row: 1, column: 0 },
  ArrowLeft: { row: 0, column: -1 },
  ArrowRight: { row: 0, column: 1 },
};

const CELL_COLORS = [
  { labelKey: "editor.colorRed", color: "#fee2e2" },
  { labelKey: "editor.colorYellow", color: "#fef3c7" },
  { labelKey: "editor.colorGreen", color: "#dcfce7" },
  { labelKey: "editor.colorBlue", color: "#dbeafe" },
] as const;

export function createTableMenu(e: Editor): TableMenuApi {
  const service = new EditorTableMenu(e);

  return {
    handleTableKeydown: service.handleTableKeydown.bind(service),
    handleTablePointerDown: service.handleTablePointerDown.bind(service),
    tableAction: service.tableAction.bind(service),
    tableItems: service.tableItems.bind(service),
  };
}

/** Table commands: the toolbar buttons, the keyboard, and the context menu. */
class EditorTableMenu {
  constructor(private e: Editor) {}

  tableAction(
    preview: HTMLElement,
    selected: HTMLElement,
    actionName: string | undefined,
    color?: string,
  ) {
    const row = Number(selected.dataset.row);
    const column = Number(selected.dataset.column);
    const update = this.e.updateTable;

    if (actionName === "insert-row") {
      update(preview, { type: "insert-row", row });
    } else if (actionName === "insert-column") {
      update(preview, { type: "insert-column", column });
    } else if (actionName === "delete-row") {
      update(preview, { type: "delete-row", row });
    } else if (actionName === "delete-column") {
      update(preview, { type: "delete-column", column });
    } else if (actionName === "merge-right") {
      update(preview, { type: "merge-right", row, column });
    } else if (actionName === "merge-down") {
      update(preview, { type: "merge-down", row, column });
    } else if (actionName === "split-cell") {
      update(preview, { type: "split-cell", row, column });
    } else if (actionName === "set-color") {
      update(preview, {
        type: "set-cell-background",
        row,
        column,
        background: color,
      });
    } else if (actionName === "clear-color") {
      update(preview, { type: "set-cell-background", row, column });
    }
  }

  private previewCells(preview: HTMLElement) {
    return Array.from(
      preview.querySelectorAll("[data-table-cell]"),
    ) as HTMLElement[];
  }

  private focusTableCell(
    preview: HTMLElement,
    from: HTMLElement,
    direction: 1 | -1,
  ) {
    const cells = this.previewCells(preview);

    this.focusCell(cells[cells.indexOf(from) + direction]);
  }

  /** The cell one step away in the grid, skipping the gaps merges leave. */
  private cellInDirection(
    preview: HTMLElement,
    from: HTMLElement,
    rowStep: number,
    columnStep: number,
  ) {
    const cells = this.previewCells(preview);
    const lastRow = Math.max(...cells.map((cell) => Number(cell.dataset.row)));
    const lastColumn = Math.max(
      ...cells.map((cell) => Number(cell.dataset.column)),
    );
    let row = Number(from.dataset.row) + rowStep;
    let column = Number(from.dataset.column) + columnStep;

    while (row >= 0 && column >= 0 && row <= lastRow && column <= lastColumn) {
      const target = cells.find(
        (cell) =>
          Number(cell.dataset.row) === row &&
          Number(cell.dataset.column) === column,
      );

      if (target) {
        return target;
      }

      row += rowStep;
      column += columnStep;
    }

    return null;
  }

  private focusCell(target: HTMLElement | null | undefined) {
    if (!target) {
      return;
    }

    target.focus();
    this.e.selectTableCell(target);

    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  /** Ctrl+Enter: a row under the caret's one, with the caret in it. */
  private insertRowBelow(cell: HTMLElement) {
    const preview = cell.closest(".md-table-preview") as HTMLElement | null;
    const group = preview?.dataset.table;

    if (!preview || group === undefined) {
      return;
    }

    const row = Math.max(1, Number(cell.dataset.row) + 1);

    this.e.handleTableCellInput(cell);
    this.tableAction(preview, cell, "insert-row");

    // The insert re-rendered the document, so the old card is gone.
    const target = this.e.element?.querySelector(
      `.md-table-preview[data-table="${group}"] ` +
        `[data-table-cell][data-row="${row}"][data-column="0"]`,
    );

    this.focusCell(target instanceof HTMLElement ? target : null);
  }

  private handleTableShortcut(event: KeyboardEvent, cell: HTMLElement) {
    const key = event.key.toLowerCase();

    if (key === "a") {
      event.preventDefault();
      this.e.selectTableCellContents(cell);
      return true;
    }

    if (key === "b") {
      this.toggleTableInlineMark(event, cell, "**");
      return true;
    }

    if (key === "i") {
      this.toggleTableInlineMark(event, cell, "*");
      return true;
    }

    if (key === "enter") {
      event.preventDefault();
      this.insertRowBelow(cell);
      return true;
    }

    if (key === "c") {
      event.preventDefault();
      void this.e.copySelection();
      return true;
    }

    if (key === "x") {
      event.preventDefault();
      void this.e.cutSelection();
      return true;
    }

    if (key === "v") {
      event.preventDefault();
      void this.e.pasteClipboard();
      return true;
    }

    return false;
  }

  private toggleTableInlineMark(
    event: KeyboardEvent,
    cell: HTMLElement,
    marker: "*" | "**",
  ) {
    event.preventDefault();
    event.stopPropagation();

    const selection = this.e.tableSelection();

    if (!selection || selection.cell !== cell || !selection.hasSelection) {
      return;
    }

    const selected = selection.text;
    const marked =
      selected.startsWith(marker) && selected.endsWith(marker)
        ? selected.slice(marker.length, selected.length - marker.length)
        : `${marker}${selected}${marker}`;

    this.e.replaceTableCellSelection(cell, marked);
  }

  handleTableKeydown(event: KeyboardEvent, cell: HTMLElement) {
    if (
      (event.ctrlKey || event.metaKey) &&
      this.handleTableShortcut(event, cell)
    ) {
      return true;
    }

    const arrow = ARROW_STEPS[event.key];

    if (event.key !== "Tab" && !arrow) {
      return false;
    }

    const preview = cell.closest(".md-table-preview") as HTMLElement | null;

    if (!preview) {
      return false;
    }

    if (arrow) {
      // Left and right walk the text first and only leave the cell at its edge;
      // up and down always change row, the way a grid is expected to behave.
      const rtl = getComputedStyle(cell).direction === "rtl";
      const columnStep = rtl ? -arrow.column : arrow.column;

      if (columnStep && !this.atCellEdge(cell, columnStep)) {
        return false;
      }

      const target = this.cellInDirection(preview, cell, arrow.row, columnStep);

      if (!target) {
        return false;
      }

      event.preventDefault();
      this.e.handleTableCellInput(cell);
      this.focusCell(target);
      return true;
    }

    event.preventDefault();
    this.e.handleTableCellInput(cell);
    this.focusTableCell(preview, cell, event.shiftKey ? -1 : 1);

    return true;
  }

  /** True when nothing but the empty-cell anchor sits on that side of the caret. */
  private atCellEdge(cell: HTMLElement, side: number) {
    const selection = getSelection();

    if (!selection?.rangeCount || !selection.isCollapsed) {
      return false;
    }

    const focus = selection.focusNode;

    if (!focus || !cell.contains(focus)) {
      return false;
    }

    const range = document.createRange();
    range.selectNodeContents(cell);

    if (side < 0) {
      range.setEnd(focus, selection.focusOffset);
    } else {
      range.setStart(focus, selection.focusOffset);
    }

    return withoutEmptyCaret(range.toString()).length === 0;
  }

  handleTablePointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement;
    const action = target.closest("[data-table-action]") as HTMLElement | null;
    const cell = this.e.tableCellForNode(target);

    if (cell) {
      this.e.selectTableCell(cell);
      this.e.closeMenu();
    }

    if (!this.e.props.editable || !action) {
      return false;
    }

    const preview = action.closest(".md-table-preview") as HTMLElement | null;
    const selected = preview ? this.e.selectedCellIn(preview) : null;

    if (!preview || !selected) {
      return false;
    }

    event.preventDefault();
    this.e.selectTableCell(selected);
    this.tableAction(
      preview,
      selected,
      action.dataset.tableAction,
      action.dataset.color,
    );

    return true;
  }

  private item(
    preview: HTMLElement,
    cell: HTMLElement,
    labelKey: Parameters<Editor["t"]>[0],
    action: string,
    color?: string,
  ): ContextMenuItem {
    return {
      label: this.e.t(labelKey),
      onSelect: () => this.tableAction(preview, cell, action, color),
    };
  }

  tableItems(): ContextMenuItem[] {
    const cell = this.e.selectedTableCellElement();
    const preview = cell?.closest(".md-table-preview") as HTMLElement | null;

    if (!this.e.props.editable || !cell || !preview) {
      return [];
    }

    return [
      this.item(preview, cell, "editor.addRowBelow", "insert-row"),
      this.item(preview, cell, "editor.addColumnRight", "insert-column"),
      this.item(preview, cell, "editor.deleteRow", "delete-row"),
      this.item(preview, cell, "editor.deleteColumn", "delete-column"),
      this.item(preview, cell, "editor.mergeRight", "merge-right"),
      this.item(preview, cell, "editor.mergeDown", "merge-down"),
      this.item(preview, cell, "editor.splitCell", "split-cell"),
      ...CELL_COLORS.map(({ labelKey, color }) =>
        this.item(preview, cell, labelKey, "set-color", color),
      ),
      this.item(preview, cell, "editor.clearCellColor", "clear-color"),
      { separator: true },
    ];
  }
}
