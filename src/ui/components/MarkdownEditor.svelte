<script lang="ts">
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ArrowDown,
    ArrowUp,
    CheckSquare,
    ClipboardCopy,
    ClipboardPaste,
    Code2,
    Copy,
    FileUp,
    GripVertical,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Plus,
    Quote,
    Scissors,
    Sparkles,
    Trash2,
    Type,
  } from "@lucide/svelte";
  import { onDestroy, onMount } from "svelte";
  import { cubicOut } from "svelte/easing";
  import { scale } from "svelte/transition";
  import {
    defaultLspSettings,
    defaultMermaidSettings,
    defaultPlantumlSettings,
    defaultRunnerSettings,
    type CalloutDefinition,
    type LspSettings,
    type MermaidSettings,
    type PlantumlSettings,
    type RunnerSettings,
  } from "../../lib/storage/settings";
  import { cn } from "../../lib/utils/cn";
  import ContextMenu, { type ContextMenuItem } from "./ContextMenu.svelte";
  import {
    applyPrefix,
    continueList,
    continueQuote,
    DEFAULT_TABLE_MARKDOWN,
    editMarkdownTable,
    insideFence,
    isMediaLine,
    mathUnclosed,
    mediaOptions,
    renderDocument,
    type WikilinkEmbed,
    type WikilinkResolver,
    SLASH_COMMANDS,
    withMediaOptions,
    EMPTY_DRAWING,
    EMPTY_DIAGRAM,
    EMPTY_PLANTUML,
    EMPTY_MERMAID,
    liveDiagramFenceLine,
    type LiveDiagramEngine,
    emptyDatabaseEmbed,
    DATABASE_LANGUAGE,
  } from "../../lib/utils/markdown";
  import { runCode, resetSession } from "../../lib/tauri/runner";
  import { renderDiagram, type DiagramOutput } from "../../lib/render/diagram";
  import { outputKey } from "../../lib/utils/runner";
  import { completeCode } from "../../lib/tauri/lsp";
  import {
    fenceContext,
    hasLanguageServer,
    rankCompletions,
    shouldComplete,
    wordPrefix,
    type Completion,
  } from "../../lib/utils/lsp";
  import { mount, unmount } from "svelte";
  import DatabaseView from "../sections/DatabaseView.svelte";
  import type { Database } from "../../lib/utils/database";
  import DrawingModal from "./DrawingModal.svelte";
  import DiagramModal from "./DiagramModal.svelte";

  export let value: string;
  export let element: HTMLElement | undefined = undefined;
  let databaseLayer: HTMLElement | undefined;
  export let placeholder = "";
  export let textSize = 17;
  export let spellcheck = true;
  export let slashCommands = true;
  export let fancyTableEditor = true;
  export let callouts = true;
  export let calloutDefinitions: CalloutDefinition[] = [];
  export let drawings = false;
  export let diagrams = false;
  export let codeExecution = false;
  export let plantuml = false;
  export let plantumlSettings: PlantumlSettings = defaultPlantumlSettings;
  export let mermaid = false;
  export let mermaidSettings: MermaidSettings = defaultMermaidSettings;
  /** Identifies the kernels a note owns, so its variables survive between cells. */
  export let runSession = "";
  export let runner: RunnerSettings = defaultRunnerSettings;
  export let lsp = false;
  export let lspSettings: LspSettings = defaultLspSettings;
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
  export let onWikilink: ((target: string) => void | Promise<void>) | null = null;
  export let resolveWikilink: WikilinkResolver | undefined = undefined;
  export let renderWikilinkEmbed:
    | ((target: string, depth: number) => WikilinkEmbed | null)
    | undefined = undefined;
  export let wikilinkKey = "";
  /** Space folder the embedded databases live in; empty disables database embeds. */
  export let databaseRoot = "";
  /** Databases offered by the slash menu and by relation columns. */
  export let databaseOptions: { id: string; name: string }[] = [];
  export let onOpenDatabase: ((databaseId: string) => void) | null = null;
  export let onStatus: (message: string) => void = () => {};
  /** Source ranges to underline, drawn in an overlay so the editable DOM stays untouched. */
  export let decorations: Decoration[] = [];
  export let resolveAsset: ((source: string) => string) | null = null;

  type Decoration = { start: number; end: number; tone: "mistake" | "suggestion" };

  let composing = false;
  let renderedFancyTableEditor = fancyTableEditor;
  let renderedCallouts = callouts;
  let renderedCalloutDefinitions = "";
  let renderedDrawings = drawings;
  let renderedDiagrams = diagrams;
  let renderedCodeExecution = codeExecution;
  let renderedPlantuml = plantuml;
  let renderedMermaid = mermaid;
  type CellRun = {
    state: "running" | "ok" | "error" | "timeout";
    text: string;
    seconds?: number;
    /** Set once the result has been shown, so re-renders do not replay the reveal. */
    shown?: boolean;
  };
  /** Keyed by cell content, so results follow their block instead of its position. */
  const cellRuns = new Map<string, CellRun>();
  /** The drawing block being edited in the modal, plus the scene JSON it opened with. */
  let editingDrawing: { preview: HTMLElement; scene: string } | null = null;
  /** The diagram block being edited in the modal, plus the JSON it opened with. */
  let editingDiagram: { preview: HTMLElement; diagram: string } | null = null;
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
  let completions: Completion[] = [];
  let completionIndex = 0;
  let completionStart: number | null = null;
  let completionPosition = { top: 0, left: 0 };
  let completionTimer: ReturnType<typeof setTimeout> | undefined;
  /** Only the newest request may paint; a slower earlier one is stale by the time it lands. */
  let completionRequest = 0;
  /** A server answers one request at a time, so asking twice at once only builds a queue. */
  let completionBusy = false;
  /** Long enough that a burst of typing costs one request rather than one per character. */
  const COMPLETION_DELAY = 300;
  let contextMenu: {
    x: number;
    y: number;
    hasSelection: boolean;
    textSelection?: { start: number; end: number } | null;
    embedPreview?: HTMLElement | null;
  } | null = null;
  let generating = false;
  let selectedTableCell: {
    group: string;
    row: number;
    column: number;
  } | null = null;
  let shell: HTMLElement | undefined;
  let hoveredBlock: HTMLElement | undefined;
  let blockToolbar = { top: 0, visible: false };
  let tailAddTop = 0;
  let blockMenu: { x: number; y: number } | null = null;
  let draggingUnit:
    | {
        key: string;
        startY: number;
        moved: boolean;
        targetIndex: number;
      }
    | null = null;
  let dragIndicatorTop: number | null = null;
  let suppressBlockMenuClick = false;
  let blockToolbarHideTimer: ReturnType<typeof setTimeout> | undefined;

  type BlockUnit = {
    key: string;
    blocks: HTMLElement[];
    start: number;
    end: number;
  };

  type BlockTransform = {
    label: string;
    prefix: string;
    icon: any;
  };

  const BLOCK_TRANSFORMS: BlockTransform[] = [
    { label: "Text", prefix: "", icon: Type },
    { label: "Heading 1", prefix: "# ", icon: Heading1 },
    { label: "Heading 2", prefix: "## ", icon: Heading2 },
    { label: "Heading 3", prefix: "### ", icon: Heading3 },
    { label: "Bulleted list", prefix: "- ", icon: List },
    { label: "Numbered list", prefix: "1. ", icon: ListOrdered },
    { label: "To-do", prefix: "- [ ] ", icon: CheckSquare },
    { label: "Quote", prefix: "> ", icon: Quote },
    { label: "Code", prefix: "```", icon: Code2 },
  ];

  $: calloutDefinitionsKey = JSON.stringify(calloutDefinitions);
  $: primaryCalloutId = calloutDefinitions.find((callout) => callout.id)?.id ?? "note";
  $: commands = [
    ...SLASH_COMMANDS,
    ...(callouts
      ? [{ label: "Callout", hint: primaryCalloutId, prefix: `> [!${primaryCalloutId}] ` }]
      : []),
    ...(drawings ? [{ label: "Drawing", hint: "excalidraw", prefix: EMPTY_DRAWING }] : []),
    ...(diagrams ? [{ label: "Diagram", hint: "draw.io", prefix: EMPTY_DIAGRAM }] : []),
    ...(plantuml ? [{ label: "PlantUML", hint: "diagram", prefix: EMPTY_PLANTUML }] : []),
    ...(mermaid ? [{ label: "Mermaid", hint: "diagram", prefix: EMPTY_MERMAID }] : []),
    ...(databaseRoot
      ? databaseOptions.map((option) => ({
          label: `Database: ${option.name}`,
          hint: "embed",
          prefix: emptyDatabaseEmbed(option.id),
        }))
      : []),
  ];
  $: matches = commands.filter((command) =>
    command.label.toLowerCase().includes(slashQuery.toLowerCase()),
  );
  $: if (!slashCommands && slashStart !== null) {
    closeMenu();
  }
  $: if (!lsp && completions.length) {
    closeCompletions();
  }
  $: if (element && !composing && getText() !== value) {
    render(caretOffset());
  }
  $: if (element && renderedFancyTableEditor !== fancyTableEditor) {
    renderedFancyTableEditor = fancyTableEditor;
    render(caretOffset());
  }
  $: if (
    element &&
    (renderedCallouts !== callouts || renderedCalloutDefinitions !== calloutDefinitionsKey)
  ) {
    renderedCallouts = callouts;
    renderedCalloutDefinitions = calloutDefinitionsKey;
    render(caretOffset());
  }
  $: if (element && renderedDrawings !== drawings) {
    renderedDrawings = drawings;
    render(caretOffset());
  }
  $: if (element && renderedCodeExecution !== codeExecution) {
    renderedCodeExecution = codeExecution;
    render(caretOffset());
  }

  $: if (element && renderedPlantuml !== plantuml) {
    renderedPlantuml = plantuml;
    render(caretOffset());
  }

  $: if (element && renderedMermaid !== mermaid) {
    renderedMermaid = mermaid;
    render(caretOffset());
  }

  /** Switching binary, server, or output format invalidates every painted diagram. */
  $: diagramKeyPrefix = `${plantumlSettings.format}|${plantumlSettings.theme}|${plantumlSettings.server}|${plantumlSettings.command}|${mermaidSettings.theme}`;
  $: if (element && (plantuml || mermaid) && diagramKeyPrefix) {
    paintDiagramLivePreviews();
  }

  $: if (element && renderedDiagrams !== diagrams) {
    renderedDiagrams = diagrams;
    render(caretOffset());
  }
  $: if (element && resolveWikilink && wikilinkKey) {
    render(caretOffset());
  }

  /** Previews are rendered output, not source: they must not shift caret offsets or line counts. */
  function blocks() {
    return (Array.from(element?.children ?? []) as HTMLElement[]).filter(
      (block) => !block.classList.contains("md-preview"),
    );
  }

  function blockUnitKey(block: HTMLElement, fallback: number) {
    if (block.dataset.code !== undefined) {
      return `code:${block.dataset.code}`;
    }

    if (block.dataset.math !== undefined) {
      return `math:${block.dataset.math}`;
    }

    if (block.dataset.table !== undefined) {
      return `table:${block.dataset.table}`;
    }

    if (block.dataset.callout !== undefined) {
      return `callout:${block.dataset.callout}`;
    }

    return `block:${fallback}`;
  }

  function sourceUnits(): BlockUnit[] {
    const units: BlockUnit[] = [];

    for (const [index, block] of blocks().entries()) {
      const key = blockUnitKey(block, index);
      const previous = units[units.length - 1];

      if (previous?.key === key) {
        previous.blocks.push(block);
        continue;
      }

      const start = offsetForPosition(block, 0);

      if (start === null) {
        continue;
      }

      units.push({
        key,
        blocks: [block],
        start,
        end: start + sourceLength(block),
      });
    }

    for (const unit of units) {
      const last = unit.blocks[unit.blocks.length - 1];
      const end = last ? offsetForPosition(last, sourceLength(last)) : null;

      if (end !== null) {
        unit.end = end;
      }
    }

    return units;
  }

  function blockFromTarget(target: EventTarget | null) {
    const node = target instanceof HTMLElement ? target : null;
    const source =
      node?.closest(".md-block") ??
      node?.closest(".md-preview")?.previousElementSibling;

    return source instanceof HTMLElement ? source : undefined;
  }

  function currentBlock() {
    return hoveredBlock ?? activeBlock;
  }

  function currentUnit() {
    const block = currentBlock();

    return block ? sourceUnits().find((unit) => unit.blocks.includes(block)) : undefined;
  }

  function unitText(unit: BlockUnit) {
    return value.slice(unit.start, unit.end);
  }

  function unitVisualElements(unit: BlockUnit) {
    const [kind, group] = unit.key.split(":");

    if (
      element &&
      group !== undefined &&
      (kind === "code" || kind === "math" || kind === "table" || kind === "callout")
    ) {
      return Array.from(
        element.querySelectorAll(`[data-${kind}="${CSS.escape(group)}"]`),
      ) as HTMLElement[];
    }

    return unit.blocks;
  }

  function unitVisualRect(unit: BlockUnit) {
    const rects = unitVisualElements(unit)
      .map((node) => node.getBoundingClientRect())
      .filter((rect) => rect.height > 0);
    const fallback = unit.blocks[0]?.getBoundingClientRect();

    if (!rects.length) {
      return fallback ?? null;
    }

    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));

    return { top, bottom, height: bottom - top };
  }

  function lastVisualBlockRect() {
    const children = Array.from(element?.children ?? []) as HTMLElement[];

    for (let index = children.length - 1; index >= 0; index--) {
      const rect = children[index].getBoundingClientRect();

      if (rect.height > 0) {
        return rect;
      }
    }

    return null;
  }

  function syncBlockToolbar() {
    requestAnimationFrame(() => {
      const unit = currentUnit();
      const rect = unit ? unitVisualRect(unit) : null;

      if (!shell || !element || !unit || !rect || !editable) {
        blockToolbar = { ...blockToolbar, visible: false };
        return;
      }

      const shellRect = shell.getBoundingClientRect();

      blockToolbar = {
        top: rect.top - shellRect.top + Math.max(0, (rect.height - 28) / 2),
        visible: true,
      };
    });
  }

  function syncTailAdd() {
    requestAnimationFrame(() => {
      if (!shell || !element || !editable) {
        tailAddTop = 0;
        return;
      }

      const lastRect = lastVisualBlockRect();
      const shellRect = shell.getBoundingClientRect();
      const fallback = element.getBoundingClientRect();

      tailAddTop = Math.max(0, (lastRect?.bottom ?? fallback.top) - shellRect.top + 2);
    });
  }

  function trackHoveredBlock(event: PointerEvent) {
    if (draggingUnit) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (target?.closest(".md-block-toolbar")) {
      clearBlockToolbarHide();
      return;
    }

    const block = blockFromTarget(event.target);

    if (block !== hoveredBlock) {
      clearBlockToolbarHide();
      hoveredBlock = block;
      syncBlockToolbar();
    }
  }

  function clearBlockToolbarHide() {
    if (blockToolbarHideTimer) {
      clearTimeout(blockToolbarHideTimer);
      blockToolbarHideTimer = undefined;
    }
  }

  function scheduleBlockToolbarHide() {
    clearBlockToolbarHide();

    blockToolbarHideTimer = setTimeout(() => {
      if (!blockMenu && !draggingUnit) {
        hoveredBlock = undefined;
        syncBlockToolbar();
      }

      blockToolbarHideTimer = undefined;
    }, 220);
  }

  function openBlockMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (suppressBlockMenuClick) {
      suppressBlockMenuClick = false;
      return;
    }

    element?.focus();
    blockMenu = { x: event.clientX, y: event.clientY };
  }

  function startBlockDrag(event: PointerEvent) {
    const context = unitContext();

    if (!context) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    element?.focus();
    closeMenu();
    blockMenu = null;
    draggingUnit = {
      key: context.unit.key,
      startY: event.clientY,
      moved: false,
      targetIndex: context.index,
    };
  }

  function updateDragIndicator(units: BlockUnit[], targetIndex: number) {
    if (!shell || !units.length) {
      dragIndicatorTop = null;
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    const target = units[targetIndex] ? unitVisualRect(units[targetIndex]) : null;

    if (target) {
      dragIndicatorTop = target.top - shellRect.top;
      return;
    }

    const last = unitVisualRect(units[units.length - 1]);

    dragIndicatorTop = last ? last.bottom - shellRect.top : null;
  }

  function dragTargetIndex(event: PointerEvent, units: BlockUnit[]) {
    for (const [index, unit] of units.entries()) {
      const rect = unitVisualRect(unit);

      if (!rect) {
        continue;
      }

      if (event.clientY < rect.top + rect.height / 2) {
        return index;
      }
    }

    return units.length;
  }

  function handleBlockDragMove(event: PointerEvent) {
    if (!draggingUnit) {
      return;
    }

    const units = sourceUnits();
    const targetIndex = dragTargetIndex(event, units);

    draggingUnit = {
      ...draggingUnit,
      moved: draggingUnit.moved || Math.abs(event.clientY - draggingUnit.startY) > 4,
      targetIndex,
    };
    updateDragIndicator(units, targetIndex);
  }

  function handleBlockDragEnd() {
    if (!draggingUnit) {
      return;
    }

    const units = sourceUnits();
    const currentIndex = units.findIndex((unit) => unit.key === draggingUnit?.key);
    const chunks = unitChunks(units);
    const [chunk] = currentIndex === -1 ? [] : chunks.splice(currentIndex, 1);
    let targetIndex = draggingUnit.targetIndex;

    if (currentIndex !== -1 && chunk !== undefined) {
      if (targetIndex > currentIndex) {
        targetIndex--;
      }

      if (targetIndex !== currentIndex && draggingUnit.moved) {
        chunks.splice(Math.max(0, Math.min(targetIndex, chunks.length)), 0, chunk);
        commitChunks(chunks, Math.max(0, Math.min(targetIndex, chunks.length - 1)));
      }
    }

    suppressBlockMenuClick = draggingUnit.moved;

    if (suppressBlockMenuClick) {
      window.setTimeout(() => {
        suppressBlockMenuClick = false;
      }, 250);
    }

    draggingUnit = null;
    dragIndicatorTop = null;
    syncBlockToolbar();
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
      active?.dataset.code ?? active?.dataset.math ?? active?.dataset.table ?? active?.dataset.callout;
    const groupName =
      active?.dataset.code !== undefined
        ? "code"
        : active?.dataset.math !== undefined
          ? "math"
          : active?.dataset.table !== undefined
            ? "table"
            : active?.dataset.callout !== undefined
              ? "callout"
              : null;

    for (const block of Array.from(element?.children ?? []) as HTMLElement[]) {
      // A database card is live UI, never source to unfold: its fence stays collapsed.
      block.toggleAttribute(
        "data-active",
        !block.classList.contains("md-database-line") &&
          (block === active || (groupName !== null && block.dataset[groupName] === group)),
      );
    }

    if (groupName !== "table") {
      selectedTableCell = null;
      markSelectedTableCell();
    }

    syncBlockToolbar();
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
  $: element, editable, value, textSize, syncBlockToolbar();

  onMount(() => {
    const observer = new ResizeObserver(() => {
      scheduleMeasure();
      syncTailAdd();
      scheduleDatabaseLayout();
    });
    const repositionDatabaseLayer = () => scheduleDatabaseLayout();

    if (element) {
      observer.observe(element);
    }

    window.addEventListener("resize", repositionDatabaseLayer);
    window.addEventListener("scroll", repositionDatabaseLayer, true);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", repositionDatabaseLayer);
      window.removeEventListener("scroll", repositionDatabaseLayer, true);
    };
  });

  onDestroy(() => {
    window.clearTimeout(diagramTimer);
    clearBlockToolbarHide();

    for (const entry of databaseViews.values()) {
      disposeDatabaseEntry(entry);
    }
    databaseViews.clear();
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

    element.innerHTML = renderDocument(value, resolveAsset ?? undefined, {
      fancyTableEditor,
      callouts,
      calloutDefinitions,
      drawings,
      diagrams,
      codeExecution,
      resolveWikilink,
      renderWikilinkEmbed,
      databaseEmbeds: Boolean(databaseRoot),
      plantuml,
      mermaid,
    });
    bindTableToolbars();
    paintDatabaseEmbeds();
    paintDrawingPreviews();
    paintDiagramPreviews();
    paintRunPreviews();
    paintDiagramLivePreviews();

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
    syncTailAdd();
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

  function scrollSnapshot() {
    const containers: { node: HTMLElement; top: number; left: number }[] = [];
    let node = element?.parentElement;

    while (node) {
      const style = getComputedStyle(node);

      if (
        /(auto|scroll|overlay)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight
      ) {
        containers.push({
          node,
          top: node.scrollTop,
          left: node.scrollLeft,
        });
      }

      node = node.parentElement;
    }

    return containers;
  }

  function restoreScrollSnapshot(snapshot: ReturnType<typeof scrollSnapshot>) {
    for (const entry of snapshot) {
      entry.node.scrollTop = entry.top;
      entry.node.scrollLeft = entry.left;
    }
  }

  function caretRectForOffset(offset: number) {
    const position = positionAtOffset(offset);

    if (!position) {
      return null;
    }

    const range = document.createRange();

    try {
      range.setStart(position.node, position.offset);
      range.collapse(true);
    } catch {
      return null;
    }

    const rect = range.getBoundingClientRect();

    if (rect.height > 0) {
      return rect;
    }

    return blockAtOffset(offset)?.getBoundingClientRect() ?? null;
  }

  function revealCaretIfNeeded(offset: number) {
    const caret = caretRectForOffset(offset);

    if (!caret) {
      return;
    }

    for (const { node } of scrollSnapshot()) {
      const viewport = node.getBoundingClientRect();
      const padding = 12;

      if (caret.top < viewport.top + padding) {
        node.scrollTop -= viewport.top + padding - caret.top;
      } else if (caret.bottom > viewport.bottom - padding) {
        node.scrollTop += caret.bottom - (viewport.bottom - padding);
      }
    }
  }

  function renderPreservingScroll(offset: number | null, revealOffset = offset) {
    const snapshot = scrollSnapshot();

    render(offset);
    restoreScrollSnapshot(snapshot);

    if (revealOffset !== null) {
      revealCaretIfNeeded(revealOffset);
    }

    requestAnimationFrame(() => {
      restoreScrollSnapshot(snapshot);

      if (revealOffset !== null) {
        revealCaretIfNeeded(revealOffset);
      }
    });
  }

  function unitContext() {
    const block = currentBlock();
    const units = sourceUnits();
    const index = block ? units.findIndex((unit) => unit.blocks.includes(block)) : -1;

    return index === -1 ? null : { units, unit: units[index], index };
  }

  function unitChunks(units: BlockUnit[]) {
    return units.map(unitText);
  }

  function offsetForChunk(chunks: string[], index: number) {
    return chunks
      .slice(0, index)
      .reduce((offset, chunk) => offset + chunk.length + 1, 0);
  }

  function commitChunks(chunks: string[], caretIndex: number, caretColumn = 0) {
    const nextChunks = chunks.length ? chunks : [""];

    value = nextChunks.join("\n");
    render(Math.min(value.length, offsetForChunk(nextChunks, caretIndex) + caretColumn));
    blockMenu = null;
    onInput();
  }

  function addBlockAfter() {
    const context = unitContext();

    if (!context) {
      replace(value.length, value.length, value ? "\n" : "", value.length + (value ? 1 : 0));
      return;
    }

    const chunks = unitChunks(context.units);
    const insertionIndex = context.index + 1;

    chunks.splice(insertionIndex, 0, "");
    commitChunks(chunks, insertionIndex);
  }

  function openTailBlock() {
    const snapshot = scrollSnapshot();

    closeMenu();
    closeCompletions();

    if (!value || value.endsWith("\n")) {
      render(value.length);
    } else {
      replace(value.length, value.length, "\n");
    }

    element?.focus({ preventScroll: true });
    restoreScrollSnapshot(snapshot);
    requestAnimationFrame(() => restoreScrollSnapshot(snapshot));
  }

  function handleTailPointerDown(event: PointerEvent) {
    if (!editable || !element || event.target !== element) {
      return false;
    }

    const units = sourceUnits();
    const lastUnit = units[units.length - 1];
    const lastRect = lastUnit ? unitVisualRect(lastUnit) : null;

    if (lastRect && event.clientY < lastRect.bottom) {
      return false;
    }

    event.preventDefault();
    openTailBlock();
    return true;
  }

  function duplicateBlock() {
    const context = unitContext();

    if (!context) {
      return;
    }

    const chunks = unitChunks(context.units);
    const text = chunks[context.index];

    chunks.splice(context.index + 1, 0, text);
    commitChunks(chunks, context.index + 1, text.length);
  }

  function deleteBlock() {
    const context = unitContext();

    if (!context) {
      return;
    }

    const chunks = unitChunks(context.units);

    chunks.splice(context.index, 1);
    commitChunks(chunks, Math.min(context.index, Math.max(0, chunks.length - 1)));
  }

  function moveBlock(direction: -1 | 1) {
    const context = unitContext();
    const targetIndex = context ? context.index + direction : -1;

    if (!context || targetIndex < 0 || targetIndex >= context.units.length) {
      return;
    }

    const chunks = unitChunks(context.units);
    const [chunk] = chunks.splice(context.index, 1);

    chunks.splice(targetIndex, 0, chunk);
    commitChunks(chunks, targetIndex);
  }

  function transformBlock(transform: BlockTransform) {
    const context = unitContext();

    if (!context) {
      return;
    }

    const chunks = unitChunks(context.units);
    const text = chunks[context.index];
    const lines = text.split("\n");

    if (transform.prefix === "```") {
      const fenced =
        lines[0]?.trim().startsWith("```") &&
        lines[lines.length - 1]?.trim().startsWith("```");

      chunks[context.index] = fenced
        ? lines.slice(1, -1).join("\n")
        : `\`\`\`\n${text}\n\`\`\``;
      commitChunks(chunks, context.index, fenced ? 0 : 4);
      return;
    }

    chunks[context.index] = [
      applyPrefix(lines[0] ?? "", transform.prefix),
      ...lines.slice(1),
    ].join("\n");
    commitChunks(chunks, context.index, transform.prefix.length);
  }

  function blockContextItems(): ContextMenuItem[] {
    const context = unitContext();
    const canTransform = Boolean(
      context &&
        (context.unit.blocks.length === 1 || context.unit.key.startsWith("code:")),
    );

    return [
      ...BLOCK_TRANSFORMS.map((transform) => ({
        label: transform.label,
        icon: transform.icon,
        disabled: !canTransform,
        onSelect: () => transformBlock(transform),
      })),
      { separator: true },
      {
        label: "Add block below",
        icon: Plus,
        disabled: !editable,
        onSelect: addBlockAfter,
      },
      {
        label: "Duplicate",
        icon: Copy,
        disabled: !context,
        onSelect: duplicateBlock,
      },
      {
        label: "Move up",
        icon: ArrowUp,
        disabled: !context || context.index === 0,
        onSelect: () => moveBlock(-1),
      },
      {
        label: "Move down",
        icon: ArrowDown,
        disabled: !context || context.index === context.units.length - 1,
        onSelect: () => moveBlock(1),
      },
      { separator: true },
      {
        label: "Delete",
        icon: Trash2,
        danger: true,
        disabled: !context,
        onSelect: deleteBlock,
      },
    ];
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

  /** Source lines of a fenced block, preview cards excluded. */
  function codeSourceBlocks(preview: Element) {
    const group = (preview as HTMLElement).dataset.code;
    const blocks: HTMLElement[] = [];
    let sibling = preview.previousElementSibling;

    while (sibling) {
      if (
        sibling instanceof HTMLElement &&
        sibling.dataset.code === group &&
        !sibling.classList.contains("md-preview")
      ) {
        blocks.unshift(sibling);
        sibling = sibling.previousElementSibling;
        continue;
      }

      if (blocks.length) {
        break;
      }

      sibling = sibling.previousElementSibling;
    }

    return blocks;
  }

  /** Drag target for manual sizing, appended inside every embed card. */
  const RESIZE_HANDLE = '<span class="md-resize" aria-hidden="true"></span>';

  /** Exported thumbnails keyed by their scene JSON, so a re-render repaints without re-exporting. */
  const drawingThumbnails = new Map<string, string>();
  let darkMode = document.documentElement.classList.contains("dark");

  // Thumbnails are baked for one theme, so a theme switch invalidates every one of them.
  onMount(() => {
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains("dark");

      if (dark !== darkMode) {
        darkMode = dark;
        drawingThumbnails.clear();
        paintDrawingPreviews();
    paintDiagramPreviews();
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => observer.disconnect();
  });

  function sceneOf(preview: Element) {
    return codeSourceBlocks(preview).map(sourceText).slice(1, -1).join("\n");
  }

  async function exportThumbnail(scene: string) {
    const cached = drawingThumbnails.get(scene);

    if (cached !== undefined) {
      return cached;
    }

    let svg = "";

    try {
      const parsed = JSON.parse(scene || "{}");
      const elements = Array.isArray(parsed.elements) ? parsed.elements : [];

      if (elements.length) {
        const { exportToSvg } = await import("@excalidraw/excalidraw");
        const node = await exportToSvg({
          elements,
          files: parsed.files ?? null,
          appState: {
            ...(parsed.appState ?? {}),
            exportBackground: false,
            exportWithDarkMode: darkMode,
          },
          exportPadding: 8,
        });

        svg = node.outerHTML;
      }
    } catch {
      svg = "";
    }

    drawingThumbnails.set(scene, svg);

    return svg;
  }

  function paintDrawingPreviews() {
    for (const preview of Array.from(element?.querySelectorAll(".md-drawing-preview") ?? [])) {
      const button = preview.querySelector(".md-drawing-open") as HTMLElement | null;

      if (!button) {
        continue;
      }

      const scene = sceneOf(preview);

      void exportThumbnail(scene).then((svg) => {
        // The document may have been re-rendered while the export was running.
        if (!button.isConnected || sceneOf(preview) !== scene) {
          return;
        }

        button.classList.toggle("md-drawing-thumbnail", Boolean(svg));
        button.innerHTML = (svg || "Edit drawing") + RESIZE_HANDLE;
        applyEmbedLayout(preview as HTMLElement, button);
      });
    }
  }

  function cellKey(preview: HTMLElement) {
    return outputKey(preview.dataset.runLanguage ?? "", sceneOf(preview));
  }

  type DiagramRender = { state: "rendering" | "ok" | "error"; output?: DiagramOutput; message?: string };
  /** Keyed by source plus the settings that shaped it, so a re-render repaints without re-asking. */
  const diagramRenders = new Map<string, DiagramRender>();
  /** Diagrams edited away are dead weight; the oldest entries go once the map gets big. */
  const DIAGRAM_CACHE_LIMIT = 60;

  function diagramKey(engine: LiveDiagramEngine, source: string) {
    const settings =
      engine === "mermaid"
        ? mermaidSettings.theme
        : `${plantumlSettings.format}|${plantumlSettings.theme}|${plantumlSettings.server.trim() || plantumlSettings.command}`;

    return `${engine}\u0000${settings}\u0000${source}`;
  }

  function diagramEngineOf(preview: HTMLElement) {
    return (preview.dataset.livediagramEngine === "mermaid" ? "mermaid" : "plantuml") as LiveDiagramEngine;
  }

  function cacheDiagram(key: string, render: DiagramRender) {
    diagramRenders.delete(key);
    diagramRenders.set(key, render);

    const excess = Math.max(0, diagramRenders.size - DIAGRAM_CACHE_LIMIT);

    for (const stale of Array.from(diagramRenders.keys()).slice(0, excess)) {
      diagramRenders.delete(stale);
    }
  }

  /** Typing rewrites the fence on every keystroke; diagrams only chase the source once it settles. */
  const DIAGRAM_IDLE_MS = 800;
  let diagramTimer: number | undefined;
  /** Last good render per block, so an edit keeps showing the old diagram instead of blanking. */
  const diagramLast = new Map<string, DiagramOutput>();

  /** Rendering happens off the render pass: a slow or missing PlantUML never blocks the editor. */
  function paintDiagramLivePreviews() {
    let pending = false;

    for (const preview of Array.from(element?.querySelectorAll(".md-livediagram-preview") ?? [])) {
      pending = paintDiagramLivePreview(preview as HTMLElement) || pending;
    }

    window.clearTimeout(diagramTimer);

    if (pending) {
      diagramTimer = window.setTimeout(renderPendingDiagrams, DIAGRAM_IDLE_MS);
    }
  }

  /** Fires only after the caret has been still, so one diagram is rendered per pause, not per key. */
  function renderPendingDiagrams() {
    for (const preview of Array.from(element?.querySelectorAll(".md-livediagram-preview") ?? [])) {
      const source = (preview as HTMLElement).dataset.livediagram ?? "";
      const engine = diagramEngineOf(preview as HTMLElement);

      if (source.trim() && !diagramRenders.has(diagramKey(engine, source))) {
        void renderDiagramSource(engine, source);
      }
    }
  }

  /** Rendered nodes are kept per block and moved back in, so a keystroke never reparses the SVG. */
  const diagramNodes = new Map<string, { content: string; node: HTMLElement }>();

  function buildDiagramNode(output: DiagramOutput, engine: LiveDiagramEngine) {
    const figure = document.createElement("div");

    figure.className =
      engine === "plantuml" ? "md-livediagram-figure md-livediagram-paper" : "md-livediagram-figure";

    if (output.format === "svg") {
      figure.innerHTML = output.content;

      // PlantUML ships `preserveAspectRatio="none"`, which stretches the art once it is resized.
      const svg = figure.querySelector("svg");

      svg?.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg?.removeAttribute("height");
      // Both engines pin sizes inline, which beats any class the card sets.
      svg?.style.setProperty("height", "auto");
      svg?.style.setProperty("max-width", "100%");
    } else if (output.format === "png") {
      const image = document.createElement("img");

      image.src = output.content;
      image.alt = "PlantUML diagram";
      figure.append(image);
    } else {
      const ascii = document.createElement("pre");

      ascii.className = "md-livediagram-ascii";
      ascii.textContent = output.content;
      figure.append(ascii);
    }

    figure.insertAdjacentHTML("beforeend", RESIZE_HANDLE);

    return figure;
  }

  function showDiagramOutput(preview: HTMLElement, output: DiagramOutput, group: string) {
    const cached = diagramNodes.get(group);
    const node =
      cached?.content === output.content
        ? cached.node
        : buildDiagramNode(output, diagramEngineOf(preview));

    if (node !== cached?.node) {
      diagramNodes.set(group, { content: output.content, node });
    }

    if (preview.firstChild !== node || preview.childNodes.length !== 1) {
      preview.replaceChildren(node);
    }

    applyEmbedLayout(preview, node);
  }

  /** Returns true when this block still needs a render scheduled. */
  function paintDiagramLivePreview(preview: HTMLElement) {
    const source = preview.dataset.livediagram ?? "";
    const group = preview.dataset.code ?? "";
    const cached = diagramRenders.get(diagramKey(diagramEngineOf(preview), source));
    const previous = diagramLast.get(group);

    if (cached?.state === "ok" && cached.output) {
      diagramLast.set(group, cached.output);
      preview.classList.remove("md-livediagram-busy", "md-livediagram-error");
      showDiagramOutput(preview, cached.output, group);

      return false;
    }

    if (cached?.state === "error") {
      preview.classList.remove("md-livediagram-busy");
      preview.classList.add("md-livediagram-error");
      preview.textContent = cached.message ?? "";

      return false;
    }

    // Still rendering, or not asked for yet: keep the last diagram on screen rather than blanking.
    preview.classList.toggle("md-livediagram-busy", Boolean(source.trim()) && !previous);
    preview.classList.remove("md-livediagram-error");

    if (previous) {
      showDiagramOutput(preview, previous, group);
    } else {
      preview.textContent = source.trim() ? "Rendering diagram…" : "";
    }

    return Boolean(source.trim()) && !cached;
  }

  async function renderDiagramSource(engine: LiveDiagramEngine, source: string) {
    const key = diagramKey(engine, source);

    cacheDiagram(key, { state: "rendering" });

    try {
      cacheDiagram(key, {
        state: "ok",
        output: await renderDiagram(engine, source, {
          plantuml: plantumlSettings,
          mermaid: mermaidSettings,
        }),
      });
    } catch (error) {
      cacheDiagram(key, {
        state: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    paintDiagramLivePreviews();
  }

  /** Results live in a map, so every re-render repaints them onto the fresh run bars. */
  function paintRunPreviews() {
    for (const preview of Array.from(element?.querySelectorAll(".md-run-preview") ?? [])) {
      paintRunPreview(preview as HTMLElement);
    }

    syncTailAdd();
  }

  function paintRunPreview(preview: HTMLElement) {
    const run = cellRuns.get(cellKey(preview));
    const bar = preview.querySelector(".md-run-bar");
    const status = preview.querySelector(".md-run-status");
    let output = preview.querySelector(".md-run-output") as HTMLElement | null;

    preview.classList.toggle("md-run-busy", run?.state === "running");
    bar?.classList.toggle("md-run-bar-busy", run?.state === "running");

    if (status) {
      status.textContent =
        run?.state === "running"
          ? "running"
          : run?.seconds !== undefined
            ? `${run.seconds.toFixed(run.seconds < 10 ? 2 : 1)}s`
            : "";
    }

    if (!run?.text) {
      output?.remove();

      return;
    }

    if (!output) {
      output = document.createElement("div");
      output.className = "md-run-output";
      preview.append(output);
    }

    output.classList.remove("md-run-ok", "md-run-error", "md-run-timeout");
    output.classList.add(`md-run-${run.state === "running" ? "ok" : run.state}`);
    output.classList.toggle("md-run-quiet", Boolean(run.shown));
    output.textContent = run.text;
    run.shown = true;
  }

  async function runCell(preview: HTMLElement) {
    const language = preview.dataset.runLanguage ?? "";
    const code = sceneOf(preview);
    const key = outputKey(language, code);

    if (cellRuns.get(key)?.state === "running") {
      return;
    }

    cellRuns.set(key, { state: "running", text: "" });
    paintRunPreviews();

    const started = performance.now();

    try {
      const result = await runCode(runSession || "scratch", language, code, runner);

      cellRuns.set(key, {
        state: result.timedOut ? "timeout" : result.status === 0 ? "ok" : "error",
        text: result.timedOut
          ? `${result.output}\nCell timed out and the kernel was restarted.`
          : result.output || (result.status === 0 ? "" : "Cell failed with no output."),
        seconds: (performance.now() - started) / 1000,
      });
    } catch (error) {
      cellRuns.set(key, {
        state: "error",
        text: error instanceof Error ? error.message : String(error),
        seconds: (performance.now() - started) / 1000,
      });
    }

    paintRunPreviews();
  }

  async function restartCell(preview: HTMLElement) {
    const language = preview.dataset.runLanguage ?? "";

    await resetSession(runSession || "scratch", language).catch(() => {});

    for (const other of Array.from(element?.querySelectorAll(".md-run-preview") ?? [])) {
      if ((other as HTMLElement).dataset.runLanguage === language) {
        cellRuns.delete(cellKey(other as HTMLElement));
      }
    }

    preview.classList.add("md-run-restarted");
    window.setTimeout(() => preview.classList.remove("md-run-restarted"), 600);
    paintRunPreviews();
  }

  const EMBED_SELECTOR = ".md-drawing-preview, .md-diagram-preview, .md-livediagram-preview";

  function isLiveDiagramPreview(preview: Element) {
    return preview.classList.contains("md-livediagram-preview");
  }

  function embedLanguage(preview: Element) {
    return preview.classList.contains("md-diagram-preview") ? "drawio" : "excalidraw";
  }

  function embedSource(preview: Element): Record<string, any> {
    // PlantUML holds diagram text, not JSON, so its layout rides on the opening fence instead.
    if (isLiveDiagramPreview(preview)) {
      const { livediagramAlign, livediagramWidth } = (preview as HTMLElement).dataset;
      const width = Number(livediagramWidth);

      return {
        ...(livediagramAlign && { align: livediagramAlign }),
        ...(Number.isFinite(width) && width > 0 && { width }),
      };
    }

    try {
      const parsed = JSON.parse(sceneOf(preview) || "{}");

      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  /** Rewrites just the opening fence, so the diagram source itself is never touched. */
  function setLiveDiagramOption(
    preview: HTMLElement,
    options: { width?: number | null; align?: string | null },
  ) {
    const current = embedSource(preview);
    const open = codeSourceBlocks(preview)[0];
    const start = open ? offsetForPosition(open, 0) : null;

    if (!open || start === null) {
      return;
    }

    const align = options.align === undefined ? current.align : (options.align ?? undefined);
    const width = options.width === undefined ? current.width : (options.width ?? undefined);
    const language = /```(\w*)/.exec(open.textContent ?? "")?.[1] || "plantuml";

    value =
      value.slice(0, start) +
      liveDiagramFenceLine(language, align, width) +
      value.slice(start + sourceLength(open));
    render(null);
    onInput();
  }

  /** Width in pixels and alignment ride along in the block's own JSON. */
  function applyEmbedLayout(preview: HTMLElement, button: HTMLElement) {
    const { width, align } = embedSource(preview);

    const svg = button.querySelector("svg, img") as HTMLElement | null;

    preview.style.justifyContent =
      align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
    button.style.width = typeof width === "number" ? `${width}px` : "";
    // A sized card scales its thumbnail; an unsized one keeps the export's natural size.
    svg?.style.setProperty("width", typeof width === "number" ? "100%" : "");
  }

  function setEmbedOption(preview: HTMLElement, options: { width?: number | null; align?: string | null }) {
    if (isLiveDiagramPreview(preview)) {
      setLiveDiagramOption(preview, options);

      return;
    }

    const source = embedSource(preview);

    for (const [key, option] of Object.entries(options)) {
      if (option === null) {
        delete source[key];
      } else if (option !== undefined) {
        source[key] = option;
      }
    }

    replaceFencedSource(preview, embedLanguage(preview), JSON.stringify(source));
  }

  /** The modals only know about their own content, so width and align are carried over here. */
  function withEmbedLayout(preview: HTMLElement, source: string) {
    const { width, align } = embedSource(preview);

    if (width === undefined && align === undefined) {
      return source;
    }

    try {
      return JSON.stringify({ ...JSON.parse(source), ...(width !== undefined && { width }), ...(align !== undefined && { align }) });
    } catch {
      return source;
    }
  }

  function startEmbedResize(event: PointerEvent, handle: HTMLElement) {
    const preview = handle.closest(EMBED_SELECTOR) as HTMLElement | null;
    const button = handle.parentElement;

    if (!preview || !button) {
      return;
    }

    event.preventDefault();

    const startX = event.clientX;
    const startWidth = button.getBoundingClientRect().width;
    // A centered card grows from both edges, a right-aligned one grows leftwards.
    const align = embedSource(preview).align;
    const factor = align === "center" ? 2 : align === "right" ? -1 : 1;

    const onMove = (moveEvent: PointerEvent) => {
      button.style.width = `${Math.max(64, Math.round(startWidth + (moveEvent.clientX - startX) * factor))}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setEmbedOption(preview, { width: Math.round(button.getBoundingClientRect().width) });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function paintDiagramPreviews() {
    for (const preview of Array.from(element?.querySelectorAll(".md-diagram-preview:not(.md-diagram-static-preview)") ?? [])) {
      const button = preview.querySelector(".md-diagram-open") as HTMLElement | null;

      if (!button) {
        continue;
      }

      let svg = "";

      try {
        svg = (JSON.parse(sceneOf(preview) || "{}") as { svg?: string }).svg ?? "";
      } catch {
        svg = "";
      }

      button.classList.toggle("md-diagram-thumbnail", Boolean(svg));
      button.innerHTML = (svg || "Edit diagram") + RESIZE_HANDLE;
      applyEmbedLayout(preview as HTMLElement, button);
    }
  }

  function openDiagram(preview: HTMLElement) {
    editingDiagram = { preview, diagram: sceneOf(preview) };
  }

  function saveDiagram(diagram: string) {
    const preview = editingDiagram?.preview;
    editingDiagram = null;

    if (preview) {
      replaceFencedSource(preview, "drawio", withEmbedLayout(preview, diagram));
    }
  }

  type DatabaseEmbed = { database?: string; table?: string; view?: string };

  function databaseEmbedSource(preview: HTMLElement) {
    try {
      return JSON.parse(preview.dataset.embed || "{}") as DatabaseEmbed;
    } catch {
      return null;
    }
  }

  type DatabasePortal = {
    view: ReturnType<typeof mount>;
    card: HTMLElement;
    host: HTMLElement;
    resizeObserver: ResizeObserver;
  };

  /** Live database views, keyed by their fenced source. The host lives outside contenteditable. */
  const databaseViews = new Map<string, DatabasePortal>();
  /** Loaded databases, so a re-render repaints the card without another round trip. */
  const databaseCache = new Map<string, Database>();
  let databaseLayoutFrame: number | undefined;

  /**
   * A re-render rebuilds the note's DOM, which takes the mounted card with it. Remember
   * which cell was being typed in so the caret can be put back where the user left it.
   */
  function databaseFocus() {
    const active = document.activeElement as HTMLInputElement | null;
    const cell = active?.closest?.("[data-row][data-column]") as HTMLElement | null;
    const card = cell?.closest(".md-database-preview") as HTMLElement | null;

    if (!cell || !card || !("selectionStart" in (active ?? {}))) {
      return null;
    }

    return {
      code: card.dataset.code,
      row: cell.dataset.row,
      column: cell.dataset.column,
      start: active?.selectionStart ?? null,
      end: active?.selectionEnd ?? null,
    };
  }

  function databaseCardFor(event?: Event) {
    return ((event?.target as HTMLElement | null)?.closest?.(".md-database-preview") ??
      (document.activeElement as HTMLElement | null)?.closest?.(".md-database-preview")) as HTMLElement | null;
  }

  function enterDatabaseIsland(event?: Event) {
    if (!databaseCardFor(event)) {
      return false;
    }

    closeMenu();
    closeCompletions();
    selectedTableCell = null;
    markSelectedTableCell();

    return true;
  }

  function restoreDatabaseFocus(focus: ReturnType<typeof databaseFocus>) {
    if (!focus) {
      return;
    }

    const input = databaseLayer
      ?.querySelector(`.md-database-portal[data-code="${focus.code}"]`)
      ?.querySelector(
        `[data-row="${focus.row}"][data-column="${focus.column}"] input, [data-row="${focus.row}"][data-column="${focus.column}"] textarea`,
      ) as HTMLInputElement | null;

    // Focus survived the re-render: leave the caret exactly where the user has it.
    if (!input || document.activeElement === input) {
      return;
    }

    input.focus();

    if (focus.start !== null) {
      const start = Math.min(focus.start, input.value.length);

      input.setSelectionRange(start, Math.min(focus.end ?? start, input.value.length));
    }
  }

  /**
   * Cells swallow re-renders while they are being typed in. Once focus leaves the card the
   * note catches up in one go.
   */
  function handleDatabaseBlur(event: FocusEvent) {
    const card = (event.target as HTMLElement | null)?.closest?.(".md-database-preview");

    if (!card) {
      return;
    }

    // A focus that bounces back inside the card is the browser shuffling, not the user
    // leaving: settle first, then decide.
    setTimeout(() => {
      if (!card.contains(document.activeElement)) {
        render(caretOffset());
      }
    }, 0);
  }

  function embedKey(preview: HTMLElement) {
    return `${preview.dataset.code}:${preview.dataset.embed}`;
  }

  function positionDatabaseEntry(entry: DatabasePortal) {
    if (!databaseLayer || !entry.card.isConnected) {
      return;
    }

    const card = entry.card.getBoundingClientRect();
    const layer = databaseLayer.getBoundingClientRect();

    entry.host.style.left = `${card.left - layer.left}px`;
    entry.host.style.top = `${card.top - layer.top}px`;
    entry.host.style.width = `${card.width}px`;

    const height = entry.host.getBoundingClientRect().height;

    if (height > 0) {
      entry.card.style.height = `${height}px`;
    }
  }

  function positionDatabaseEntries() {
    databaseLayoutFrame = undefined;

    for (const entry of databaseViews.values()) {
      positionDatabaseEntry(entry);
    }
  }

  function scheduleDatabaseLayout() {
    if (databaseLayoutFrame !== undefined) {
      return;
    }

    databaseLayoutFrame = requestAnimationFrame(positionDatabaseEntries);
  }

  function disposeDatabaseEntry(entry: DatabasePortal) {
    entry.resizeObserver.disconnect();
    void unmount(entry.view);
    entry.host.remove();
  }

  function databaseEntryForHost(host: HTMLElement) {
    for (const entry of databaseViews.values()) {
      if (entry.host === host) {
        return entry;
      }
    }

    return null;
  }

  function createDatabaseHost(preview: HTMLElement) {
    const host = document.createElement("div");

    host.className = "md-database-preview md-database-portal";
    host.dataset.code = preview.dataset.code ?? "";
    host.dataset.embed = preview.dataset.embed ?? "";
    host.contentEditable = "false";
    host.style.position = "absolute";

    databaseLayer?.append(host);

    return host;
  }

  function paintDatabaseEmbeds() {
    const focus = databaseFocus();
    const live = new Set<string>();

    for (const preview of Array.from(element?.querySelectorAll(".md-database-preview") ?? [])) {
      const anchor = preview as HTMLElement;
      const embed = databaseRoot ? databaseEmbedSource(anchor) : null;
      const key = embedKey(anchor);

      live.add(key);

      const existing = databaseViews.get(key);

      if (existing) {
        existing.card = anchor;
        existing.host.dataset.code = anchor.dataset.code ?? "";
        existing.host.dataset.embed = anchor.dataset.embed ?? "";
        scheduleDatabaseLayout();
        continue;
      }

      if (!embed?.database) {
        anchor.classList.remove("md-database-anchor");
        anchor.innerHTML = `<p class="md-database-empty">Database unavailable</p>`;
        continue;
      }

      const databaseId = embed.database;
      const host = createDatabaseHost(anchor);
      const resizeObserver = new ResizeObserver(() => scheduleDatabaseLayout());

      resizeObserver.observe(host);

      const entry: DatabasePortal = {
        card: anchor,
        view: mount(DatabaseView, {
          target: host,
          props: {
            root: databaseRoot,
            databaseId,
            compact: true,
            preloaded: databaseCache.get(databaseId) ?? null,
            tableId: embed.table ?? null,
            viewId: embed.view ?? null,
            databaseOptions,
            onStatus,
            onRenamed: () => {},
            onOpen: onOpenDatabase ? () => onOpenDatabase?.(databaseId) : null,
            onChange: (database: Database) => databaseCache.set(database.id, database),
            onNavigate: (tableId: string, viewId: string) => {
              const current = databaseEntryForHost(host)?.card ?? anchor;

              writeDatabaseEmbed(current, { database: databaseId, table: tableId, view: viewId });
            },
          },
        }),
        host,
        resizeObserver,
      };

      databaseViews.set(key, entry);
      scheduleDatabaseLayout();
    }

    for (const [key, entry] of databaseViews) {
      if (!live.has(key)) {
        disposeDatabaseEntry(entry);
        databaseViews.delete(key);
      }
    }

    restoreDatabaseFocus(focus);
  }

  /** Keeps the fence JSON in step with the tab the card is showing. */
  function writeDatabaseEmbed(preview: HTMLElement, embed: DatabaseEmbed) {
    const source = JSON.stringify(embed);

    if (source === preview.dataset.embed || !editable) {
      return;
    }

    const previous = embedKey(preview);

    preview.dataset.embed = source;

    const entry = databaseViews.get(previous);

    if (entry) {
      databaseViews.delete(previous);
      databaseViews.set(embedKey(preview), entry);
    }

    replaceFencedSource(preview, DATABASE_LANGUAGE, source, false);
  }

  function openDrawing(preview: HTMLElement) {
    const lines = codeSourceBlocks(preview).map(sourceText);

    editingDrawing = { preview, scene: lines.slice(1, -1).join("\n") };
  }

  function saveDrawing(scene: string) {
    const preview = editingDrawing?.preview;
    editingDrawing = null;

    if (preview) {
      replaceFencedSource(preview, "excalidraw", withEmbedLayout(preview, scene));
    }
  }

  /** Rewrites the whole fenced block a preview card stands for. */
  function replaceFencedSource(
    preview: HTMLElement,
    language: string,
    source: string,
    rerender = true,
  ) {
    const sourceBlocks = codeSourceBlocks(preview);
    const first = sourceBlocks[0];
    const last = sourceBlocks[sourceBlocks.length - 1];
    const start = first ? offsetForPosition(first, 0) : null;
    const end = last ? offsetForPosition(last, sourceLength(last)) : null;

    if (start === null || end === null) {
      return;
    }

    value = value.slice(0, start) + `\`\`\`${language}\n${source}\n\`\`\`` + value.slice(end);

    if (rerender) {
      render(null);
    }

    onInput();
  }

  function handlePointerDown(event: PointerEvent) {
    const handle = event.target as HTMLElement;

    // pointerdown fires for the right button too, and a right click belongs to the context menu.
    if (event.button !== 0) {
      return;
    }

    const wikilink = handle.closest?.(".md-wikilink") as HTMLElement | null;
    const wikilinkEmbedOpen = handle.closest?.(".md-wikilink-embed-open") as HTMLElement | null;

    if (wikilinkEmbedOpen?.dataset.wikilinkTarget && onWikilink) {
      event.preventDefault();
      void onWikilink(wikilinkEmbedOpen.dataset.wikilinkTarget);
      return;
    }

    if (
      wikilink?.dataset.wikilinkTarget &&
      onWikilink &&
      (!editable || event.ctrlKey || event.metaKey || Boolean(wikilink.closest(".md-wikilink-embed-preview")))
    ) {
      event.preventDefault();
      void onWikilink(wikilink.dataset.wikilinkTarget);
      return;
    }

    if (editable && handle.classList?.contains("md-resize") && handle.closest(EMBED_SELECTOR)) {
      startEmbedResize(event, handle);
      return;
    }

    const runControl = handle.closest?.(".md-run-button, .md-run-restart") as HTMLElement | null;

    if (runControl) {
      const preview = runControl.closest(".md-run-preview") as HTMLElement | null;

      if (preview) {
        event.preventDefault();

        if (runControl.classList.contains("md-run-restart")) {
          void restartCell(preview);
        } else {
          void runCell(preview);
        }
      }

      return;
    }

    if (handle.closest?.(".md-diagram-open")) {
      const preview = handle.closest(".md-diagram-preview") as HTMLElement | null;

      if (editable && preview && !preview.classList.contains("md-diagram-static-preview")) {
        event.preventDefault();
        openDiagram(preview);
      }

      return;
    }

    if (handle.closest?.(".md-drawing-open")) {
      const preview = handle.closest(".md-drawing-preview") as HTMLElement | null;

      if (editable && preview) {
        event.preventDefault();
        openDrawing(preview);
      }

      return;
    }

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
    closeMenu();

    const target = event.target as HTMLElement;

    // Same as a left click: the database card owns no caret position.
    if (target.closest(".md-database-preview")) {
      return;
    }

    const embedPreview = target.closest(EMBED_SELECTOR) as HTMLElement | null;

    // An embed card holds no caret position, so focusing and placing one there would
    // drop the caret at the top of the note and scroll the whole editor with it.
    if (embedPreview) {
      contextMenu = {
        embedPreview,
        x: event.clientX,
        y: event.clientY,
        hasSelection: false,
        textSelection: null,
      };

      return;
    }

    element?.focus();
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
      embedPreview: target.closest(EMBED_SELECTOR) as HTMLElement | null,
      x: event.clientX,
      y: event.clientY,
      hasSelection: Boolean(
        table ? table.text || table.cell.innerText : textSelection && textSelection.start !== textSelection.end,
      ),
      textSelection,
    };
  }

  function embedAlignItems(): ContextMenuItem[] {
    const preview = contextMenu?.embedPreview;

    if (!editable || !preview) {
      return [];
    }

    return [
      {
        label: "Align left",
        icon: AlignLeft,
        onSelect: () => setEmbedOption(preview, { align: null }),
      },
      {
        label: "Align center",
        icon: AlignCenter,
        onSelect: () => setEmbedOption(preview, { align: "center" }),
      },
      {
        label: "Align right",
        icon: AlignRight,
        onSelect: () => setEmbedOption(preview, { align: "right" }),
      },
      {
        label: "Reset size",
        onSelect: () => setEmbedOption(preview, { width: null }),
      },
      { separator: true },
    ];
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
      ...embedAlignItems(),
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


  function closeCompletions() {
    clearTimeout(completionTimer);
    completionRequest += 1;
    completions = [];
    completionIndex = 0;
    completionStart = null;
  }

  /** Completions come from a language server, so they are asked for after the typing pauses. */
  function syncCompletions(offset: number) {
    clearTimeout(completionTimer);

    if (!lsp || slashStart !== null) {
      closeCompletions();
      return;
    }

    const context = fenceContext(value, offset);

    if (!context || !hasLanguageServer(context.language)) {
      closeCompletions();
      return;
    }

    const line = context.code.split("\n")[context.line] ?? "";

    if (!shouldComplete(line, context.character)) {
      closeCompletions();
      return;
    }

    const prefix = wordPrefix(line, context.character);
    const request = ++completionRequest;

    completionTimer = setTimeout(async () => {
      if (completionBusy) {
        const current = caretOffset();

        if (current !== null) {
          syncCompletions(current);
        }

        return;
      }

      let items: Completion[] = [];

      completionBusy = true;

      try {
        items = await completeCode(
          runSession || "scratch",
          context.language,
          context.code,
          context.line,
          context.character,
          lspSettings,
        );
      } catch (error) {
        console.warn("completions failed", error);
        items = [];
      } finally {
        completionBusy = false;
      }

      if (request !== completionRequest || caretOffset() !== offset) {
        return;
      }

      completions = rankCompletions(items, prefix);
      completionIndex = 0;
      completionStart = completions.length ? offset - prefix.length : null;

      const rect = getSelection()?.getRangeAt(0).getBoundingClientRect();

      if (rect) {
        completionPosition = { top: rect.bottom + 4, left: rect.left };
      }
    }, COMPLETION_DELAY);
  }

  function applyCompletion(item: Completion) {
    const offset = caretOffset();
    const start = completionStart;

    closeCompletions();

    if (offset === null || start === null) {
      return;
    }

    replace(start, offset, item.insert);
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

    // Embeds carry their own source, so the caret waits on a fresh line under the card.
    if (prefix.startsWith("```") && prefix.includes("\n")) {
      const opening = applyPrefix(value.slice(start, slashStart), prefix);

      replace(start, lineEnd, `${opening}\n\n${tail}`, start + opening.length + 2);
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

  /**
   * Events from the live database card belong to it, not to the note's source. IME and
   * composition events name the editor as their target, so the focused element decides too.
   */
  function insideDatabaseEmbed(event?: Event) {
    return Boolean(databaseCardFor(event));
  }

  function handleInput(event?: Event) {
    if (composing || insideDatabaseEmbed(event)) {
      return;
    }

    const tableCell = tableCellForNode(event?.target as Node | null);

    if (tableCell) {
      handleTableCellInput(tableCell);
      return;
    }

    value = getText();
    const offset = caretOffset();
    renderPreservingScroll(offset);

    if (offset !== null) {
      syncMenu(offset);
      syncCompletions(offset);
    }

    onInput();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (insideDatabaseEmbed(event)) {
      return;
    }

    const tableCell = tableCellForNode(event.target as Node | null);

    if (tableCell && handleTableKeydown(event, tableCell)) {
      return;
    }

    if (completions.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        completionIndex =
          (completionIndex + (event.key === "ArrowDown" ? 1 : completions.length - 1)) %
          completions.length;
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        applyCompletion(completions[completionIndex]);
        return;
      }

      if (event.key === "Escape") {
        closeCompletions();
        return;
      }
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

    // Jupyter muscle memory: Ctrl/Cmd+Enter runs the cell holding the caret.
    if (codeExecution && event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      const group = currentBlock()?.dataset.code;
      const preview = group
        ? (element?.querySelector(`.md-run-preview[data-code="${group}"]`) as HTMLElement | null)
        : null;

      if (preview) {
        event.preventDefault();
        void runCell(preview);
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

      if (blockAtOffset(offset)?.classList.contains("md-codeblock") && insideFence(value.slice(0, start))) {
        replace(offset, offset, "\n");
        return;
      }

      const line = value.slice(start, offset);
      const quotePrefix = continueQuote(line);
      const prefix = quotePrefix || continueList(line);

      if (!quotePrefix && /^\s*>\s?$/.test(line)) {
        replace(start, offset, "");
        return;
      }

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
    if (insideDatabaseEmbed(event)) {
      return;
    }

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
<svelte:window
  onpointermove={handleBlockDragMove}
  onpointerup={handleBlockDragEnd}
/>

<div
  bind:this={shell}
  class="md-editor-shell relative"
  role="presentation"
  onpointermove={trackHoveredBlock}
  onmouseleave={scheduleBlockToolbarHide}
>
{#if editable && blockToolbar.visible}
  <div
    class="md-block-toolbar"
    style={`top: ${blockToolbar.top}px;`}
    contenteditable="false"
    role="toolbar"
    tabindex="-1"
    aria-label="Block controls"
    onpointerenter={clearBlockToolbarHide}
    onpointermove={(event) => {
      event.stopPropagation();
      clearBlockToolbarHide();
    }}
  >
    <button
      type="button"
      class="md-block-button"
      title="Add block below"
      aria-label="Add block below"
      onmousedown={(event) => event.preventDefault()}
      onclick={(event) => {
        event.stopPropagation();
        addBlockAfter();
      }}
    >
      <Plus class="size-4" strokeWidth={1.8} aria-hidden="true" />
    </button>
    <button
      type="button"
      class="md-block-button md-block-grip"
      title="Block menu. Drag to move."
      aria-label="Block menu. Drag to move."
      onmousedown={(event) => event.preventDefault()}
      onclick={openBlockMenu}
      onpointerdown={startBlockDrag}
    >
      <GripVertical class="size-4" strokeWidth={1.8} aria-hidden="true" />
    </button>
  </div>
{/if}

{#if dragIndicatorTop !== null}
  <div
    class="md-block-drop-indicator"
    style={`top: ${dragIndicatorTop}px;`}
    aria-hidden="true"
  ></div>
{/if}

<div
  bind:this={element}
  contenteditable={editable}
  {spellcheck}
  role="textbox"
  tabindex="0"
  aria-multiline="true"
  aria-label="Markdown editor"
  style="--md-placeholder: '{placeholder}'; font-size: {textSize}px; font-family: var(--ms-editor-font); line-height: var(--ms-editor-line-height);"
  class={cn(
    "min-h-[60vh] w-full leading-[1.75] whitespace-pre-wrap caret-emerald-700",
    "md-editor-surface",
    "focus-visible:outline-none",
    editable
      ? "text-stone-900 dark:text-stone-100"
      : "cursor-default text-stone-400 dark:text-stone-500",
    "dark:caret-emerald-400",
    className,
  )}
  oninput={handleInput}
  onfocusout={handleDatabaseBlur}
  onkeydown={handleKeydown}
  oncontextmenu={openContextMenu}
  onfocusin={(event) => {
    enterDatabaseIsland(event);
  }}
  onpointerdown={(event) => {
    if (enterDatabaseIsland(event)) {
      return;
    }

    if (!handleTailPointerDown(event) && !handleTablePointerDown(event)) {
      handlePointerDown(event);
    }
  }}
  onpaste={handlePaste}
  onblur={() => {
    closeMenu();
    closeCompletions();
  }}
  oncompositionstart={(event) => {
    if (!insideDatabaseEmbed(event)) {
      composing = true;
    }
  }}
  oncompositionend={(event) => {
    if (insideDatabaseEmbed(event)) {
      return;
    }

    composing = false;
    handleInput();
  }}
></div>

<div
  bind:this={databaseLayer}
  class="pointer-events-none absolute inset-0 z-10"
  role="presentation"
  onfocusout={handleDatabaseBlur}
></div>

{#if editable}
  <div
    class="absolute right-0 left-0 z-20 flex h-7 items-start"
    style={`top: ${tailAddTop}px;`}
    role="presentation"
    onpointerdown={(event) => {
      if (event.target === event.currentTarget) {
        event.preventDefault();
        openTailBlock();
      }
    }}
  >
    <button
      type="button"
      class="flex h-7 w-full items-center justify-center rounded-md border border-dashed border-stone-300 bg-[#fffdfa]/90 text-stone-400 opacity-0 shadow-sm backdrop-blur transition-[border-color,background-color,color,opacity] hover:border-emerald-600/40 hover:bg-emerald-50/80 hover:text-emerald-700 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:border-stone-700 dark:bg-[#1a1917]/90 dark:text-stone-500 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300"
      title="Add block"
      aria-label="Add block"
      onmousedown={(event) => event.preventDefault()}
      onclick={(event) => {
        event.stopPropagation();
        openTailBlock();
      }}
    >
      <Plus class="size-4" strokeWidth={1.8} aria-hidden="true" />
    </button>
  </div>
{/if}

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

{#if editingDrawing}
  <DrawingModal
    scene={editingDrawing.scene}
    onSave={saveDrawing}
    onClose={() => (editingDrawing = null)}
  />
{/if}

{#if editingDiagram}
  <DiagramModal
    diagram={editingDiagram.diagram}
    onSave={saveDiagram}
    onClose={() => (editingDiagram = null)}
  />
{/if}

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextItems()}
    onClose={() => (contextMenu = null)}
  />
{/if}

{#if blockMenu}
  <ContextMenu
    x={blockMenu.x}
    y={blockMenu.y}
    items={blockContextItems()}
    onClose={() => (blockMenu = null)}
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

{#if completions.length}
  <ul
    class="fixed z-50 max-h-72 w-72 overflow-y-auto rounded-xl border border-stone-200 bg-white/95 p-1 shadow-xl shadow-stone-900/10 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 dark:shadow-black/40"
    style="top: {completionPosition.top}px; left: {completionPosition.left}px; transform-origin: top left;"
    in:scale={{ start: 0.96, duration: 110, easing: cubicOut }}
    role="listbox"
    aria-label="Code completions"
  >
    {#each completions as item, index}
      <li>
        <button
          type="button"
          role="option"
          aria-selected={index === completionIndex}
          class={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
            index === completionIndex
              ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
              : "text-stone-700 dark:text-stone-200",
          )}
          onmousedown={(event) => {
            event.preventDefault();
            applyCompletion(item);
          }}
          onmouseenter={() => (completionIndex = index)}
        >
          <span class="truncate font-mono text-[0.8rem]">{item.label}</span>
          <span class="truncate text-[0.7rem] text-stone-400 dark:text-stone-500">{item.detail}</span>
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  /* Fence lines are scaffolding until the caret enters that code block. */
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
