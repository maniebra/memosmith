<script lang="ts">
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ClipboardCopy,
    ClipboardPaste,
    FileUp,
    Scissors,
    Sparkles,
  } from "@lucide/svelte";
  import { onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import { cn } from "../../lib/utils/cn";
  import ContextMenu, { type ContextMenuItem } from "./ContextMenu.svelte";
  import {
    applyPrefix,
    continueList,
    DEFAULT_TABLE_MARKDOWN,
    editMarkdownTable,
    insideFence,
    isMediaLine,
    mathUnclosed,
    mediaOptions,
    renderDocument,
    SLASH_COMMANDS,
    withMediaOptions,
  } from "../../lib/utils/markdown";

  export let value: string;
  export let element: HTMLElement | undefined = undefined;
  export let placeholder = "";
  export let textSize = 17;
  export let spellcheck = true;
  export let slashCommands = true;
  export let editable = true;
  export let className = "";
  export let onInput: () => void = () => {};
  /** Stores dropped/pasted/picked files next to the note and returns the markdown to insert. */
  export let onAssets: (source: {
    files?: File[];
    paths?: string[];
  }) => Promise<string> = async () => "";
  export let onPickAssets: (() => Promise<string>) | null = null;
  /** Takes the selected text as a prompt and returns generated markdown. */
  export let onGenerate: ((prompt: string) => Promise<string>) | null = null;
  /** Source ranges to underline, drawn in an overlay so the editable DOM stays untouched. */
  export let decorations: Decoration[] = [];
  export let resolveAsset: ((source: string) => string) | null = null;

  type Decoration = { start: number; end: number; tone: "mistake" | "suggestion" };

  let composing = false;
  let decorationBoxes: { left: number; top: number; width: number; height: number; tone: string }[] = [];
  const EMPTY_CARET = String.fromCharCode(8203);

  function withoutEmptyCaret(text: string) {
    return text.split(EMPTY_CARET).join("");
  }

  /** Without an initial render the editor has no blocks, so typed text has nowhere to land. */
  onMount(() => {
    render(null);

    // Tauri swallows HTML5 file drops, so dropped paths arrive on this webview event instead.
    const dragDrop = getCurrentWebview().onDragDropEvent(async (event) => {
      if (event.payload.type !== "drop" || !editable) {
        return;
      }

      const rect = element?.getBoundingClientRect();
      const { x, y } = event.payload.position.toLogical(
        window.devicePixelRatio,
      );

      if (
        !rect ||
        x < rect.left ||
        x > rect.right ||
        y < rect.top ||
        y > rect.bottom
      ) {
        return;
      }

      insertAssets(await onAssets({ paths: event.payload.paths }));
    });

    return () => void dragDrop.then((unlisten) => unlisten());
  });

  let slashStart: number | null = null;
  let slashQuery = "";
  let slashIndex = 0;
  let menuPosition = { top: 0, left: 0 };
  let contextMenu: {
    x: number;
    y: number;
    hasSelection: boolean;
    textSelection?: { start: number; end: number } | null;
  } | null = null;
  let generating = false;
  let selectedTableCell: {
    group: string;
    row: number;
    column: number;
  } | null = null;

  $: matches = SLASH_COMMANDS.filter((command) =>
    command.label.toLowerCase().includes(slashQuery.toLowerCase()),
  );
  $: if (!slashCommands && slashStart !== null) {
    closeMenu();
  }
  $: if (element && !composing && getText() !== value) {
    render(caretOffset());
  }

  /** Previews are rendered output, not source: they must not shift caret offsets or line counts. */
  function blocks() {
    return (Array.from(element?.children ?? []) as HTMLElement[]).filter(
      (block) => !block.classList.contains("md-preview"),
    );
  }

  function isRenderedMath(node: Node) {
    return (
      node instanceof HTMLElement && node.classList.contains("md-math-rendered")
    );
  }

  function sourceText(node: Node): string {
    if (isRenderedMath(node)) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return withoutEmptyCaret(node.textContent ?? "");
    }

    return Array.from(node.childNodes).map(sourceText).join("");
  }

  function sourceLength(node: Node) {
    return sourceText(node).length;
  }

  function sourceLengthBefore(node: Node, offset: number) {
    if (node.nodeType === Node.TEXT_NODE) {
      return withoutEmptyCaret((node.textContent ?? "").slice(0, offset))
        .length;
    }

    return Array.from(node.childNodes)
      .slice(0, offset)
      .reduce((length, child) => length + sourceLength(child), 0);
  }

  function sourceOffsetWithin(root: Node, target: Node, targetOffset: number) {
    let offset = 0;
    let found = false;

    function visit(node: Node) {
      if (isRenderedMath(node)) {
        return;
      }

      if (node === target) {
        offset += sourceLengthBefore(node, targetOffset);
        found = true;
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        offset += node.textContent?.length ?? 0;
        return;
      }

      for (const child of Array.from(node.childNodes)) {
        if (found) {
          return;
        }

        visit(child);
      }
    }

    visit(root);

    return found ? offset : null;
  }

  function caretPositionIn(
    node: Node,
    offset: number,
  ): { node: Node; offset: number } | null {
    if (isRenderedMath(node)) {
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return {
        node,
        offset: Math.min(offset, node.textContent?.length ?? 0),
      };
    }

    let remaining = offset;

    for (const [index, child] of Array.from(node.childNodes).entries()) {
      const length = sourceLength(child);

      if (remaining > length) {
        remaining -= length;
        continue;
      }

      if (length === 0) {
        if (
          child.nodeType === Node.TEXT_NODE &&
          child.textContent?.includes(EMPTY_CARET)
        ) {
          return { node: child, offset: 0 };
        }

        return { node, offset: index };
      }

      return caretPositionIn(child, remaining);
    }

    return { node, offset: node.childNodes.length };
  }

  let activeBlock: HTMLElement | undefined;

  function setActiveBlock(active: HTMLElement | undefined) {
    // selectionchange fires far more often than the active block actually moves.
    if (active === activeBlock) {
      return;
    }

    activeBlock = active;
    const group =
      active?.dataset.code ?? active?.dataset.math ?? active?.dataset.table;
    const groupName =
      active?.dataset.code !== undefined
        ? "code"
        : active?.dataset.math !== undefined
          ? "math"
          : active?.dataset.table !== undefined
            ? "table"
            : null;

    for (const block of Array.from(element?.children ?? []) as HTMLElement[]) {
      block.toggleAttribute(
        "data-active",
        block === active ||
          (groupName !== null && block.dataset[groupName] === group),
      );
    }

    if (groupName !== "table") {
      selectedTableCell = null;
      markSelectedTableCell();
    }
  }

  function blockAtOffset(offset: number) {
    let remaining = offset;

    for (const block of blocks()) {
      const length = sourceLength(block);

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      return block;
    }

    const currentBlocks = blocks();

    return currentBlocks[currentBlocks.length - 1];
  }

  function getText() {
    return blocks().map(sourceText).join("\n");
  }

  function caretOffset() {
    const selection = getSelection();

    return selection?.focusNode
      ? offsetForPosition(selection.focusNode, selection.focusOffset)
      : null;
  }

  function previewForNode(node: Node | null) {
    return (
      node instanceof HTMLElement ? node : node?.parentElement
    )?.closest(".md-preview");
  }

  function tableCellForNode(node: Node | null) {
    return (
      node instanceof HTMLElement ? node : node?.parentElement
    )?.closest("[data-table-cell]") as HTMLElement | null;
  }

  function offsetForPosition(node: Node, nodeOffset: number): number | null {
    if (!element || !element.contains(node)) {
      return null;
    }

    // A caret parked in a preview belongs to the source line above it, not to nowhere.
    const preview = previewForNode(node);

    if (preview) {
      const source = preview.previousElementSibling;

      return source
        ? offsetForPosition(source, source.childNodes.length)
        : null;
    }

    let offset = 0;

    for (const block of blocks()) {
      if (block.contains(node) || block === node) {
        const lineOffset = sourceOffsetWithin(block, node, nodeOffset);

        return lineOffset === null ? null : offset + lineOffset;
      }

      offset += sourceLength(block) + 1;
    }

    return null;
  }

  function selectionOffsets() {
    const selection = getSelection();

    if (!selection?.anchorNode || !selection.focusNode) {
      return null;
    }

    const anchor = offsetForPosition(
      selection.anchorNode,
      selection.anchorOffset,
    );
    const focus = offsetForPosition(selection.focusNode, selection.focusOffset);

    if (anchor === null || focus === null) {
      return null;
    }

    return {
      start: Math.min(anchor, focus),
      end: Math.max(anchor, focus),
    };
  }

  function setCaret(offset: number) {
    let remaining = offset;

    for (const block of blocks()) {
      const length = sourceLength(block);

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      const position = caretPositionIn(block, remaining);

      const selection = getSelection();
      const range = document.createRange();

      range.setStart(position?.node ?? block, position?.offset ?? 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
  }

  /** A source offset resolves to a DOM position the same way the caret does. */
  function positionAtOffset(offset: number) {
    let remaining = offset;

    for (const block of blocks()) {
      const length = sourceLength(block);

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      return caretPositionIn(block, remaining) ?? { node: block, offset: 0 };
    }

    return null;
  }

  /**
   * Underlines are drawn as boxes over the editor rather than as markup, so the
   * contenteditable DOM (and every caret offset derived from it) stays untouched.
   */
  function measureDecorations() {
    if (!element || !decorations.length) {
      decorationBoxes = [];
      return;
    }

    const origin = element.getBoundingClientRect();
    const boxes: typeof decorationBoxes = [];

    for (const decoration of decorations) {
      const from = positionAtOffset(decoration.start);
      const to = positionAtOffset(decoration.end);

      if (!from || !to) {
        continue;
      }

      const range = document.createRange();

      try {
        range.setStart(from.node, from.offset);
        range.setEnd(to.node, to.offset);
      } catch {
        continue;
      }

      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width < 1) {
          continue;
        }

        boxes.push({
          left: rect.left - origin.left,
          top: rect.top - origin.top,
          width: rect.width,
          height: rect.height,
          tone: decoration.tone,
        });
      }
    }

    decorationBoxes = boxes;
  }

  function scheduleMeasure() {
    requestAnimationFrame(measureDecorations);
  }

  $: decorations, element, value, textSize, scheduleMeasure();

  onMount(() => {
    const observer = new ResizeObserver(scheduleMeasure);

    if (element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  });

  let previewNavigation:
    | { direction: "up" | "down"; column: number }
    | null = null;
  let normalizingSelection = false;

  function adjacentSourceBlock(
    node: Element,
    direction: "previous" | "next",
  ) {
    let sibling =
      direction === "previous"
        ? node.previousElementSibling
        : node.nextElementSibling;

    while (sibling?.classList.contains("md-preview")) {
      sibling =
        direction === "previous"
          ? sibling.previousElementSibling
          : sibling.nextElementSibling;
    }

    return sibling instanceof HTMLElement ? sibling : null;
  }

  function offsetInBlock(block: HTMLElement, column: number) {
    const start = offsetForPosition(block, 0);

    return start === null
      ? null
      : start + Math.min(column, sourceLength(block));
  }

  function normalizePreviewSelection() {
    if (normalizingSelection) {
      return false;
    }

    const selection = getSelection();

    if (tableCellForNode(selection?.focusNode ?? null)) {
      return false;
    }

    const preview = previewForNode(selection?.focusNode ?? null);

    if (!preview) {
      return false;
    }

    const source = preview.previousElementSibling;
    const column =
      previewNavigation?.column ??
      (source instanceof HTMLElement ? sourceLength(source) : 0);
    const target =
      previewNavigation?.direction === "down"
        ? adjacentSourceBlock(preview, "next") ?? source
        : source ?? adjacentSourceBlock(preview, "previous");
    const offset =
      target instanceof HTMLElement ? offsetInBlock(target, column) : null;

    if (offset === null) {
      return false;
    }

    normalizingSelection = true;
    setCaret(offset);
    normalizingSelection = false;
    previewNavigation = null;
    markActiveBlock();

    return true;
  }

  function repairPreviewNavigation(direction: "up" | "down", offset: number) {
    previewNavigation = {
      direction,
      column: offset - lineStartAt(offset),
    };

    requestAnimationFrame(() => {
      if (!normalizePreviewSelection()) {
        previewNavigation = null;
      }
    });
  }

  /** Markdown markers stay hidden except on the block holding the caret; a code block counts as one. */
  function markActiveBlock() {
    if (normalizePreviewSelection()) {
      return;
    }

    const selection = getSelection();
    const tableCell = tableCellForNode(selection?.focusNode ?? null);

    if (tableCell) {
      setActiveBlock(undefined);
      selectTableCell(tableCell);
      return;
    }

    const containing = blocks().find((block) =>
      Boolean(selection?.focusNode && block.contains(selection.focusNode)),
    );
    const offset = containing ? null : caretOffset();

    setActiveBlock(
      containing ?? (offset === null ? undefined : blockAtOffset(offset)),
    );
  }

  function render(offset: number | null) {
    if (!element) {
      return;
    }

    element.innerHTML = renderDocument(value, resolveAsset ?? undefined);
    bindTableToolbars();

    if (!editable) {
      for (const cell of Array.from(element.querySelectorAll("[data-table-cell]"))) {
        (cell as HTMLElement).contentEditable = "false";
      }
    }

    if (offset !== null) {
      setActiveBlock(blockAtOffset(offset));
      setCaret(offset);
    }

    markActiveBlock();
    markSelectedTableCell();
  }

  function replace(
    start: number,
    end: number,
    text: string,
    caret = start + text.length,
  ) {
    value = value.slice(0, start) + text + value.slice(end);
    render(caret);
    onInput();
  }

  function replaceSelection(text: string) {
    const selection = selectionOffsets();
    const start = selection?.start ?? caretOffset();

    if (start === null) {
      return;
    }

    replace(start, selection?.end ?? start, text);
  }

  /** Media wants its own line, so it lands after the current one rather than inside it. */
  function insertAssets(markdown: string) {
    if (!markdown) {
      return;
    }

    const offset = caretOffset() ?? value.length;
    const lineEnd =
      value.indexOf("\n", offset) === -1
        ? value.length
        : value.indexOf("\n", offset);
    const lead = value.slice(lineStartAt(lineEnd), lineEnd) ? "\n" : "";

    replace(lineEnd, lineEnd, `${lead}${markdown}\n`);
  }

  function lineRangeFor(preview: Element) {
    const source = preview.previousElementSibling;
    const start = source ? offsetForPosition(source, 0) : null;

    return start === null || !source
      ? null
      : { start, end: start + sourceLength(source) };
  }

  function tableSourceBlocks(preview: Element) {
    const group = (preview as HTMLElement).dataset.table;

    return (Array.from(element?.children ?? []) as HTMLElement[]).filter(
      (block) => block.dataset.table === group && !block.classList.contains("md-preview"),
    );
  }

  function tableRangeFor(preview: Element) {
    const sourceBlocks = tableSourceBlocks(preview);
    const first = sourceBlocks[0];
    const last = sourceBlocks[sourceBlocks.length - 1];
    const start = first ? offsetForPosition(first, 0) : null;
    const end = last ? offsetForPosition(last, sourceLength(last)) : null;

    return start === null || end === null ? null : { start, end };
  }

  function tableSourceText(preview: Element) {
    return tableSourceBlocks(preview).map(sourceText).join("\n");
  }

  function syncTableSourceBlocks(preview: Element, text: string) {
    const sourceBlocks = tableSourceBlocks(preview);
    const lines = text.split("\n");

    if (sourceBlocks.length !== lines.length) {
      return false;
    }

    for (const [index, block] of sourceBlocks.entries()) {
      block.textContent = lines[index];
    }

    return true;
  }

  function syncTableToolbarScroll(shell: HTMLElement) {
    const tools = shell.querySelector(".md-table-tools") as HTMLElement | null;

    if (!tools) {
      return;
    }

    const hasOverflow = tools.scrollWidth > tools.clientWidth + 1;

    shell.toggleAttribute("data-scroll-left", hasOverflow && tools.scrollLeft > 1);
    shell.toggleAttribute(
      "data-scroll-right",
      hasOverflow && tools.scrollLeft + tools.clientWidth < tools.scrollWidth - 1,
    );
  }

  function syncTableToolbars() {
    requestAnimationFrame(() => {
      for (const shell of Array.from(element?.querySelectorAll(".md-table-tools-shell") ?? [])) {
        syncTableToolbarScroll(shell as HTMLElement);
      }
    });
  }

  function bindTableToolbars() {
    for (const tools of Array.from(element?.querySelectorAll(".md-table-tools") ?? [])) {
      const shell = tools.closest(".md-table-tools-shell") as HTMLElement | null;

      if (!shell) {
        continue;
      }

      tools.addEventListener("scroll", () => syncTableToolbarScroll(shell), { passive: true });
    }

    syncTableToolbars();
  }

  function markSelectedTableCell() {
    for (const preview of Array.from(element?.querySelectorAll(".md-table-preview") ?? [])) {
      const htmlPreview = preview as HTMLElement;

      htmlPreview.toggleAttribute(
        "data-active",
        Boolean(selectedTableCell && htmlPreview.dataset.table === selectedTableCell.group),
      );
    }

    for (const cell of Array.from(element?.querySelectorAll("[data-table-cell]") ?? [])) {
      const htmlCell = cell as HTMLElement;
      const preview = htmlCell.closest(".md-table-preview") as HTMLElement | null;
      const group = preview?.dataset.table;
      const row = Number(htmlCell.dataset.row);
      const column = Number(htmlCell.dataset.column);

      htmlCell.classList.toggle(
        "is-selected",
        Boolean(
          selectedTableCell &&
            group === selectedTableCell.group &&
            row === selectedTableCell.row &&
            column === selectedTableCell.column,
        ),
      );
    }

    syncTableToolbars();
  }

  function selectTableCell(cell: HTMLElement) {
    const preview = cell.closest(".md-table-preview") as HTMLElement | null;

    if (!preview?.dataset.table) {
      return;
    }

    setActiveBlock(undefined);

    selectedTableCell = {
      group: preview.dataset.table,
      row: Number(cell.dataset.row),
      column: Number(cell.dataset.column),
    };
    markSelectedTableCell();
  }

  function selectedCellIn(preview: HTMLElement) {
    const selected = selectedTableCell;

    if (selected && selected.group === preview.dataset.table) {
      const cell = preview.querySelector(
        `[data-table-cell][data-row="${selected.row}"][data-column="${selected.column}"]`,
      );

      if (cell instanceof HTMLElement) {
        return cell;
      }
    }

    return preview.querySelector("[data-table-cell]") as HTMLElement | null;
  }

  function selectedTableCellElement() {
    if (!element || !selectedTableCell) {
      return null;
    }

    for (const preview of Array.from(element.querySelectorAll(".md-table-preview")) as HTMLElement[]) {
      if (preview.dataset.table !== selectedTableCell.group) {
        continue;
      }

      const cell = preview.querySelector(
        `[data-table-cell][data-row="${selectedTableCell.row}"][data-column="${selectedTableCell.column}"]`,
      );

      return cell instanceof HTMLElement ? cell : null;
    }

    return null;
  }

  function tableSelection() {
    const selection = getSelection();
    const anchorCell = tableCellForNode(selection?.anchorNode ?? null);
    const focusCell = tableCellForNode(selection?.focusNode ?? null);

    if (selection && anchorCell && anchorCell === focusCell) {
      return {
        cell: anchorCell,
        text: selection.toString(),
        hasSelection: !selection.isCollapsed,
      };
    }

    const selected = selectedTableCellElement();

    return selected
      ? {
          cell: selected,
          text: selected.innerText,
          hasSelection: false,
        }
      : null;
  }

  function selectTableCellContents(cell: HTMLElement) {
    cell.focus();
    selectTableCell(cell);

    const range = document.createRange();
    range.selectNodeContents(cell);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    markSelectedTableCell();
  }

  function replaceTableCellSelection(cell: HTMLElement, text: string) {
    const selection = getSelection();
    const anchorCell = tableCellForNode(selection?.anchorNode ?? null);
    const focusCell = tableCellForNode(selection?.focusNode ?? null);

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
      selectTableCellContents(cell);
    }

    handleTableCellInput(cell);
  }

  function replaceTable(preview: HTMLElement, text: string, renderPreview: boolean) {
    const range = tableRangeFor(preview);

    if (!range) {
      return;
    }

    value = value.slice(0, range.start) + text + value.slice(range.end);

    if (renderPreview || !syncTableSourceBlocks(preview, text)) {
      render(null);
    }

    onInput();
  }

  function updateTable(preview: HTMLElement, edit: Parameters<typeof editMarkdownTable>[1], renderPreview = true) {
    const source = tableSourceText(preview);
    const next = editMarkdownTable(source, edit);

    if (next !== source) {
      replaceTable(preview, next, renderPreview);
    }
  }

  function handleTableCellInput(cell: HTMLElement) {
    const preview = cell.closest(".md-table-preview") as HTMLElement | null;

    if (!preview) {
      return;
    }

    selectTableCell(cell);
    updateTable(
      preview,
      {
        type: "set-cell-text",
        row: Number(cell.dataset.row),
        column: Number(cell.dataset.column),
        text: cell.innerText.replace(/\s*\n\s*/g, " ").trim(),
      },
      false,
    );
  }

  function tableAction(
    preview: HTMLElement,
    selected: HTMLElement,
    actionName: string | undefined,
    color?: string,
  ) {
    const row = Number(selected.dataset.row);
    const column = Number(selected.dataset.column);

    if (actionName === "insert-row") {
      updateTable(preview, { type: "insert-row", row });
    } else if (actionName === "insert-column") {
      updateTable(preview, { type: "insert-column", column });
    } else if (actionName === "merge-right") {
      updateTable(preview, { type: "merge-right", row, column });
    } else if (actionName === "merge-down") {
      updateTable(preview, { type: "merge-down", row, column });
    } else if (actionName === "split-cell") {
      updateTable(preview, { type: "split-cell", row, column });
    } else if (actionName === "set-color") {
      updateTable(preview, {
        type: "set-cell-background",
        row,
        column,
        background: color,
      });
    } else if (actionName === "clear-color") {
      updateTable(preview, { type: "set-cell-background", row, column });
    }
  }

  function focusTableCell(preview: HTMLElement, from: HTMLElement, direction: 1 | -1) {
    const cells = Array.from(preview.querySelectorAll("[data-table-cell]")) as HTMLElement[];
    const index = cells.indexOf(from);
    const target = cells[index + direction];

    if (!target) {
      return;
    }

    target.focus();
    selectTableCell(target);

    const selection = getSelection();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function handleTableKeydown(event: KeyboardEvent, cell: HTMLElement) {
    const isPrimaryShortcut = event.ctrlKey || event.metaKey;

    if (isPrimaryShortcut) {
      const key = event.key.toLowerCase();

      if (key === "a") {
        event.preventDefault();
        selectTableCellContents(cell);
        return true;
      }

      if (key === "c") {
        event.preventDefault();
        void copySelection();
        return true;
      }

      if (key === "x") {
        event.preventDefault();
        void cutSelection();
        return true;
      }

      if (key === "v") {
        event.preventDefault();
        void pasteClipboard();
        return true;
      }
    }

    if (event.key !== "Tab") {
      return false;
    }

    const preview = cell.closest(".md-table-preview") as HTMLElement | null;

    if (!preview) {
      return false;
    }

    event.preventDefault();
    handleTableCellInput(cell);
    focusTableCell(preview, cell, event.shiftKey ? -1 : 1);

    return true;
  }

  function handleTablePointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement;
    const action = target.closest("[data-table-action]") as HTMLElement | null;
    const cell = tableCellForNode(target);

    if (cell) {
      selectTableCell(cell);
      closeMenu();
    }

    if (!editable || !action) {
      return false;
    }

    const preview = action.closest(".md-table-preview") as HTMLElement | null;
    const selected = preview ? selectedCellIn(preview) : null;

    if (!preview || !selected) {
      return false;
    }

    event.preventDefault();
    selectTableCell(selected);

    tableAction(preview, selected, action.dataset.tableAction, action.dataset.color);

    return true;
  }

  function caretLineRange() {
    const offset = caretOffset();

    if (offset === null) {
      return null;
    }

    const end = value.indexOf("\n", offset);

    return { start: lineStartAt(offset), end: end === -1 ? value.length : end };
  }

  function setMediaOption(
    range: { start: number; end: number },
    options: Parameters<typeof withMediaOptions>[1],
  ) {
    const line = withMediaOptions(value.slice(range.start, range.end), options);

    // Re-render without a caret: parking it on the media line would expand the source under the pointer.
    value = value.slice(0, range.start) + line + value.slice(range.end);
    render(null);
    onInput();
  }

  function handlePointerDown(event: PointerEvent) {
    const handle = event.target as HTMLElement;

    if (!editable || !handle.classList?.contains("md-resize")) {
      return;
    }

    const media = handle.parentElement?.querySelector(
      ".md-media",
    ) as HTMLElement | null;
    const preview = handle.closest(".md-preview");
    const range = preview ? lineRangeFor(preview) : null;

    if (!media || !range) {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startWidth = media.getBoundingClientRect().width;
    // A centered image grows from both edges, a right-aligned one grows leftwards.
    const align = mediaOptions(value.slice(range.start, range.end)).align;
    const factor = align === "center" ? 2 : align === "right" ? -1 : 1;

    const onMove = (moveEvent: PointerEvent) => {
      media.style.width = `${Math.max(64, Math.round(startWidth + (moveEvent.clientX - startX) * factor))}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setMediaOption(range, {
        width: Math.round(media.getBoundingClientRect().width),
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function placeCaretAtPoint(event: MouseEvent) {
    const selection = selectionOffsets();

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
    let range =
      caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY) ?? null;

    if (!range) {
      const position = caretDocument.caretPositionFromPoint?.(
        event.clientX,
        event.clientY,
      );

      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
      }
    }

    if (!range || !element?.contains(range.startContainer)) {
      return;
    }

    range.collapse(true);
    const nextSelection = getSelection();
    nextSelection?.removeAllRanges();
    nextSelection?.addRange(range);
    markActiveBlock();
  }

  async function copySelection() {
    const table = tableSelection();

    if (table) {
      const text = table.text || table.cell.innerText;

      if (text) {
        await navigator.clipboard.writeText(text);
      }

      return;
    }

    const selection = selectionOffsets();

    if (!selection || selection.start === selection.end) {
      return;
    }

    await navigator.clipboard.writeText(
      value.slice(selection.start, selection.end),
    );
  }

  async function cutSelection() {
    const table = tableSelection();

    if (table) {
      const text = table.text || table.cell.innerText;

      if (!text) {
        return;
      }

      await navigator.clipboard.writeText(text);

      if (editable) {
        replaceTableCellSelection(table.cell, table.hasSelection ? "" : "");
      }

      return;
    }

    const selection = selectionOffsets();

    if (!selection || selection.start === selection.end) {
      return;
    }

    await navigator.clipboard.writeText(
      value.slice(selection.start, selection.end),
    );
    replace(selection.start, selection.end, "");
  }

  async function pasteClipboard() {
    const text = await navigator.clipboard.readText();

    const table = tableSelection();

    if (table && editable) {
      replaceTableCellSelection(table.cell, text);
      return;
    }

    if (text) {
      replaceSelection(text);
    }
  }

  function selectAll() {
    const table = tableSelection();

    if (table) {
      selectTableCellContents(table.cell);
      return;
    }

    if (!element) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    markActiveBlock();
  }

  function openContextMenu(event: MouseEvent) {
    event.preventDefault();
    element?.focus();
    closeMenu();

    const target = event.target as HTMLElement;
    const tableCell = tableCellForNode(target);
    const preview = target.closest(".md-table-preview") as HTMLElement | null;
    const fallbackTableCell = preview ? selectedCellIn(preview) : null;
    const cell = tableCell ?? fallbackTableCell;
    const selection = getSelection();
    const selectionCell =
      tableCellForNode(selection?.anchorNode ?? null) ??
      tableCellForNode(selection?.focusNode ?? null);
    const keepTableSelection =
      cell && selectionCell === cell && selection && !selection.isCollapsed;

    if (cell) {
      selectTableCell(cell);
    }

    if (!keepTableSelection) {
      placeCaretAtPoint(event);
    }

    const textSelection = selectionOffsets();
    const table = tableSelection();

    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      hasSelection: Boolean(
        table ? table.text || table.cell.innerText : textSelection && textSelection.start !== textSelection.end,
      ),
      textSelection,
    };
  }

  function alignItems(): ContextMenuItem[] {
    const range = caretLineRange();

    if (
      !editable ||
      !range ||
      !isMediaLine(value.slice(range.start, range.end))
    ) {
      return [];
    }

    return [
      {
        label: "Align left",
        icon: AlignLeft,
        onSelect: () => setMediaOption(range, { align: "left" }),
      },
      {
        label: "Align center",
        icon: AlignCenter,
        onSelect: () => setMediaOption(range, { align: "center" }),
      },
      {
        label: "Align right",
        icon: AlignRight,
        onSelect: () => setMediaOption(range, { align: "right" }),
      },
      { separator: true },
    ];
  }

  function tableItems(): ContextMenuItem[] {
    const cell = selectedTableCellElement();
    const preview = cell?.closest(".md-table-preview") as HTMLElement | null;

    if (!editable || !cell || !preview) {
      return [];
    }

    return [
      {
        label: "Add row below",
        onSelect: () => tableAction(preview, cell, "insert-row"),
      },
      {
        label: "Add column right",
        onSelect: () => tableAction(preview, cell, "insert-column"),
      },
      {
        label: "Merge right",
        onSelect: () => tableAction(preview, cell, "merge-right"),
      },
      {
        label: "Merge down",
        onSelect: () => tableAction(preview, cell, "merge-down"),
      },
      {
        label: "Split cell",
        onSelect: () => tableAction(preview, cell, "split-cell"),
      },
      {
        label: "Color red",
        onSelect: () => tableAction(preview, cell, "set-color", "#fee2e2"),
      },
      {
        label: "Color yellow",
        onSelect: () => tableAction(preview, cell, "set-color", "#fef3c7"),
      },
      {
        label: "Color green",
        onSelect: () => tableAction(preview, cell, "set-color", "#dcfce7"),
      },
      {
        label: "Color blue",
        onSelect: () => tableAction(preview, cell, "set-color", "#dbeafe"),
      },
      {
        label: "Clear cell color",
        onSelect: () => tableAction(preview, cell, "clear-color"),
      },
      { separator: true },
    ];
  }

  /** The selection is the prompt; generated markdown lands right after it. */
  async function generateFromSelection() {
    const range = contextMenu?.textSelection;
    const prompt = range ? value.slice(range.start, range.end).trim() : "";

    if (!onGenerate || !prompt || generating) {
      return;
    }

    generating = true;

    try {
      const generated = await onGenerate(prompt);

      replace(range!.end, range!.end, `\n\n${generated}\n`);
    } finally {
      generating = false;
    }
  }

  function contextItems(): ContextMenuItem[] {
    return [
      ...alignItems(),
      ...tableItems(),
      {
        label: "Cut",
        shortcut: "Ctrl X",
        icon: Scissors,
        disabled: !editable || !contextMenu?.hasSelection,
        onSelect: cutSelection,
      },
      {
        label: "Copy",
        shortcut: "Ctrl C",
        icon: ClipboardCopy,
        disabled: !contextMenu?.hasSelection,
        onSelect: copySelection,
      },
      {
        label: "Paste",
        shortcut: "Ctrl V",
        icon: ClipboardPaste,
        disabled: !editable,
        onSelect: pasteClipboard,
      },
      {
        label: generating ? "Generating..." : "Generate with AI",
        icon: Sparkles,
        disabled: !editable || !onGenerate || !contextMenu?.hasSelection || generating,
        onSelect: generateFromSelection,
      },
      {
        label: "Insert file",
        icon: FileUp,
        disabled: !editable || !onPickAssets,
        onSelect: async () => insertAssets(await onPickAssets!()),
      },
      { separator: true },
      {
        label: "Select all",
        shortcut: "Ctrl A",
        disabled: !value,
        onSelect: selectAll,
      },
    ];
  }

  function lineStartAt(offset: number) {
    return value.lastIndexOf("\n", offset - 1) + 1;
  }

  function closeMenu() {
    slashStart = null;
    slashQuery = "";
    slashIndex = 0;
  }

  function syncMenu(offset: number) {
    if (!slashCommands) {
      closeMenu();
      return;
    }

    const typed = /(?:^|\s)\/([\w ]*)$/.exec(
      value.slice(lineStartAt(offset), offset),
    );

    if (!typed) {
      closeMenu();
      return;
    }

    slashStart = offset - typed[1].length - 1;
    slashQuery = typed[1];
    slashIndex = 0;

    const rect = getSelection()?.getRangeAt(0).getBoundingClientRect();

    if (rect) {
      menuPosition = { top: rect.bottom + 4, left: rect.left };
    }
  }

  function runCommand(prefix: string) {
    const offset = caretOffset();

    if (offset === null || slashStart === null) {
      return;
    }

    const start = lineStartAt(offset);
    const lineEnd =
      value.indexOf("\n", offset) === -1
        ? value.length
        : value.indexOf("\n", offset);
    const tail = value.slice(offset, lineEnd);
    const nextLine = applyPrefix(value.slice(start, slashStart) + tail, prefix);

    closeMenu();

    if (prefix === DEFAULT_TABLE_MARKDOWN) {
      replace(start, lineEnd, prefix, start + prefix.length);
      return;
    }

    // A code block needs its closing fence, with the caret waiting on the line between.
    if (prefix.startsWith("```")) {
      const opening = applyPrefix(value.slice(start, slashStart), prefix);

      replace(
        start,
        lineEnd,
        `${opening}\n${tail}\n\`\`\``,
        start + opening.length + 1,
      );
      return;
    }

    replace(start, lineEnd, nextLine, start + nextLine.length - tail.length);
  }

  function handleInput(event?: Event) {
    if (composing) {
      return;
    }

    const tableCell = tableCellForNode(event?.target as Node | null);

    if (tableCell) {
      handleTableCellInput(tableCell);
      return;
    }

    value = getText();
    const offset = caretOffset();
    render(offset);

    if (offset !== null) {
      syncMenu(offset);
    }

    onInput();
  }

  function handleKeydown(event: KeyboardEvent) {
    const tableCell = tableCellForNode(event.target as Node | null);

    if (tableCell && handleTableKeydown(event, tableCell)) {
      return;
    }

    if (slashCommands && slashStart !== null && matches.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        slashIndex =
          (slashIndex + (event.key === "ArrowDown" ? 1 : matches.length - 1)) %
          matches.length;
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        runCommand(matches[slashIndex].prefix);
        return;
      }

      if (event.key === "Escape") {
        closeMenu();
        return;
      }
    }

    const offset = caretOffset();

    if (offset === null || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const start = lineStartAt(offset);

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      repairPreviewNavigation(event.key === "ArrowDown" ? "down" : "up", offset);
      return;
    }

    // Third backtick opens a fenced block and closes it, caret on the line between.
    if (
      event.key === "`" &&
      /^[ \t]*``$/.test(value.slice(start, offset)) &&
      !insideFence(value.slice(0, start))
    ) {
      event.preventDefault();
      closeMenu();
      replace(offset, offset, "`\n\n```", offset + 2);
      return;
    }

    // Only close a `$$` that has no partner; inside an existing block Enter is just a new line.
    if (
      event.key === "Enter" &&
      /^[ \t]*\$\$$/.test(value.slice(start, offset)) &&
      mathUnclosed(value)
    ) {
      event.preventDefault();
      closeMenu();
      replace(offset, offset, "\n\n$$", offset + 1);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      closeMenu();

      const line = value.slice(start, offset);
      const prefix = continueList(line);

      if (!prefix && /^\s*([-*+]|\d+\.)( \[[ x]\])? $/.test(line)) {
        replace(start, offset, "");
        return;
      }

      replace(offset, offset, `\n${prefix}`);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();

      if (event.shiftKey) {
        replace(
          start,
          offset,
          value.slice(start, offset).replace(/^ {1,2}/, ""),
        );
      } else {
        replace(offset, offset, "  ");
      }
    }
  }

  function handlePaste(event: ClipboardEvent) {
    const files = Array.from(event.clipboardData?.files ?? []);

    if (files.length) {
      event.preventDefault();
      void onAssets({ files }).then(insertAssets);
      return;
    }

    const offset = caretOffset();
    const text = event.clipboardData?.getData("text/plain");
    const table = tableSelection();

    if (table && text !== undefined) {
      event.preventDefault();
      replaceTableCellSelection(table.cell, text);
      return;
    }

    if (offset === null || !text) {
      return;
    }

    event.preventDefault();
    replace(offset, offset, text);
  }
</script>

<svelte:document onselectionchange={markActiveBlock} />

<div class="relative">
<div
  bind:this={element}
  contenteditable={editable}
  {spellcheck}
  role="textbox"
  tabindex="0"
  aria-multiline="true"
  aria-label="Markdown editor"
  style="--md-placeholder: '{placeholder}'; font-size: {textSize}px;"
  class={cn(
    "min-h-[60vh] w-full leading-[1.75] whitespace-pre-wrap caret-emerald-700",
    "focus-visible:outline-none",
    editable
      ? "text-stone-900 dark:text-stone-100"
      : "cursor-default text-stone-400 dark:text-stone-500",
    "dark:caret-emerald-400",
    className,
  )}
  oninput={handleInput}
  onkeydown={handleKeydown}
  oncontextmenu={openContextMenu}
  onpointerdown={(event) => {
    if (!handleTablePointerDown(event)) {
      handlePointerDown(event);
    }
  }}
  onpaste={handlePaste}
  onblur={closeMenu}
  oncompositionstart={() => (composing = true)}
  oncompositionend={() => {
    composing = false;
    handleInput();
  }}
></div>

{#if decorationBoxes.length}
  <div class="pointer-events-none absolute inset-0" aria-hidden="true">
    {#each decorationBoxes as box}
      <span
        class={cn(
          "absolute border-b-2",
          box.tone === "mistake"
            ? "border-rose-500/80 bg-rose-500/5"
            : "border-amber-500/80 bg-amber-500/5",
        )}
        style={`left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px;`}
      ></span>
    {/each}
  </div>
{/if}
</div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextItems()}
    onClose={() => (contextMenu = null)}
  />
{/if}

{#if slashStart !== null && matches.length}
  <ul
    class="fixed z-50 max-h-72 w-64 overflow-y-auto rounded-xl border border-stone-200 bg-white/95 p-1 shadow-xl shadow-stone-900/10 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 dark:shadow-black/40"
    style="top: {menuPosition.top}px; left: {menuPosition.left}px; transform-origin: top left;"
    in:scale={{ start: 0.96, duration: 110, easing: cubicOut }}
    role="listbox"
    aria-label="Block commands"
  >
    {#each matches as command, index}
      <li>
        <button
          type="button"
          role="option"
          aria-selected={index === slashIndex}
          class={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
            index === slashIndex
              ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
              : "text-stone-700 dark:text-stone-200",
          )}
          onmousedown={(event) => {
            event.preventDefault();
            runCommand(command.prefix);
          }}
          onmouseenter={() => (slashIndex = index)}
        >
          <span>{command.label}</span>
          <span
            class="rounded border border-stone-200 px-1.5 py-px font-mono text-[0.7rem] text-stone-400 dark:border-stone-700 dark:text-stone-500"
            >{command.hint}</span
          >
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  /* The fence lines are scaffolding: only show them while the caret is in that code block. */
  [contenteditable] :global(.md-fence:not([data-active])) {
    display: none;
  }

  /* Hint on the caret's empty line, and on an empty document. */
  [contenteditable]
    :global(
      .md-block:not(.md-codeblock, .md-fence):has(> br:only-child):is(
          [data-active],
          :only-child
        )
    )::before {
    content: var(--md-placeholder);
    position: absolute;
    inset-inline-start: 0;
    color: rgb(168 162 158 / 0.7);
    pointer-events: none;
  }
</style>
