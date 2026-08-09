import type { ContextMenuItem } from "../ContextMenu.svelte";
import type { Editor, TableMenuApi } from "./types";

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

  private focusTableCell(
    preview: HTMLElement,
    from: HTMLElement,
    direction: 1 | -1,
  ) {
    const cells = Array.from(
      preview.querySelectorAll("[data-table-cell]"),
    ) as HTMLElement[];
    const target = cells[cells.indexOf(from) + direction];

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

  private handleTableShortcut(event: KeyboardEvent, cell: HTMLElement) {
    const key = event.key.toLowerCase();

    if (key === "a") {
      event.preventDefault();
      this.e.selectTableCellContents(cell);
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

  handleTableKeydown(event: KeyboardEvent, cell: HTMLElement) {
    if (
      (event.ctrlKey || event.metaKey) &&
      this.handleTableShortcut(event, cell)
    ) {
      return true;
    }

    if (event.key !== "Tab") {
      return false;
    }

    const preview = cell.closest(".md-table-preview") as HTMLElement | null;

    if (!preview) {
      return false;
    }

    event.preventDefault();
    this.e.handleTableCellInput(cell);
    this.focusTableCell(preview, cell, event.shiftKey ? -1 : 1);

    return true;
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
