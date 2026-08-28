import type { I18nKey } from "../../../lib/i18n";
import type { DatabaseSummary } from "../../../lib/tauri/databases";
import type {
  CalloutDefinition,
  LspSettings,
  MermaidSettings,
  PaletteColor,
  PlantumlSettings,
  RunnerSettings,
} from "../../../lib/storage/settings";
import type { Completion } from "../../../lib/utils/lsp";
import type { HistoryApi } from "./history";
import type {
  editMarkdownTable,
  WikilinkEmbed,
  WikilinkResolver,
  withMediaOptions,
} from "../../../lib/utils/markdown";
import type { ContextMenuItem } from "../ContextMenu.svelte";
import type { ContextMenuState } from "./contextMenu";
import type { FindApi, FindState } from "./find";
import type { EditSurface } from "./surface";

export type Decoration = {
  start: number;
  end: number;
  tone: "mistake" | "suggestion";
};

export type DecorationBox = {
  left: number;
  top: number;
  width: number;
  height: number;
  tone: string;
};

export type SlashCommand = {
  label: string;
  hint: string;
  prefix: string;
  /** Children open a submenu, not an insert. */ children?: SlashCommand[];
  /** Callout entries carry their own icon and colour into the menu row. */
  icon?: string;
  color?: string;
};

export type BlockUnit = {
  key: string;
  blocks: HTMLElement[];
  start: number;
  end: number;
};

export type BlockTransform = {
  labelKey: I18nKey;
  prefix: string;
  icon: any;
};

export type UnitContext = {
  units: BlockUnit[];
  unit: BlockUnit;
  index: number;
};

export type UnitRect =
  { top: number; bottom: number; height: number } | DOMRect | null;

export type ScrollSnapshot = {
  node: HTMLElement;
  top: number;
  left: number;
}[];

export type EditorProps = {
  placeholder: string;
  textSize: number;
  spellcheck: boolean;
  slashCommands: boolean;
  fancyTableEditor: boolean;
  callouts: boolean;
  calloutDefinitions: CalloutDefinition[];
  highlightColors: PaletteColor[];
  drawings: boolean;
  diagrams: boolean;
  quizzes: boolean;
  codeExecution: boolean;
  plantuml: boolean;
  plantumlSettings: PlantumlSettings;
  mermaid: boolean;
  mermaidSettings: MermaidSettings;
  runSession: string;
  runner: RunnerSettings;
  lsp: boolean;
  lspSettings: LspSettings;
  editable: boolean;
  onInput: () => void;
  onAssets: (source: { files?: File[]; paths?: string[] }) => Promise<string>;
  onPickAssets: (() => Promise<string>) | null;
  onGenerate: ((prompt: string) => Promise<string>) | null;
  onWikilink: ((target: string) => void | Promise<void>) | null;
  resolveWikilink: WikilinkResolver | undefined;
  renderWikilinkEmbed:
    ((target: string, depth: number) => WikilinkEmbed | null) | undefined;
  wikilinkKey: string;
  databaseRoot: string;
  databaseOptions: DatabaseSummary[];
  onOpenDatabase: ((databaseId: string) => void) | null;
  onStatus: (message: string) => void;
  decorations: Decoration[];
  resolveAsset: ((source: string) => string) | null;
};

/** Everything the markup renders from; every write notifies the component. */
export type EditorUi = {
  find: FindState | null;
  composing: boolean;
  editingDrawing: { preview: HTMLElement; scene: string } | null;
  editingDiagram: { preview: HTMLElement; diagram: string } | null;
  decorationBoxes: DecorationBox[];
  slashStart: number | null;
  slashQuery: string;
  slashIndex: number;
  /** Submenus drilled into; query length when the last opened. */
  slashPath: string[];
  slashPathQuery: number;
  menuPosition: { top: number; left: number };
  completions: Completion[];
  completionIndex: number;
  completionStart: number | null;
  completionPosition: { top: number; left: number };
  contextMenu: ContextMenuState | null;
  generating: boolean;
  selectedTableCell: { group: string; row: number; column: number } | null;
  blockToolbar: { top: number; visible: boolean };
  tailAddTop: number;
  blockMenu: { x: number; y: number } | null;
  draggingUnit: {
    key: string;
    startY: number;
    moved: boolean;
    targetIndex: number;
  } | null;
  dragIndicatorTop: number | null;
  hoveredBlock: HTMLElement | undefined;
  activeBlock: HTMLElement | undefined;
};

/** The component side: live props, the bound elements and the note's text. */
export type EditorHost = {
  value: string;
  readonly element: HTMLElement | undefined;
  readonly shell: HTMLElement | undefined;
  readonly databaseLayer: HTMLElement | undefined;
  readonly props: EditorProps;
  t: (key: I18nKey, values?: Record<string, string | number>) => string;
};

export type DomApi = {
  sourceText: (node: Node) => string;
  sourceLength: (node: Node) => number;
  caretPositionIn: (
    node: Node,
    offset: number,
  ) => { node: Node; offset: number } | null;
  blocks: () => HTMLElement[];
  blockFromTarget: (target: EventTarget | null) => HTMLElement | undefined;
  blockAtOffset: (offset: number) => HTMLElement | undefined;
  getText: () => string;
  caretOffset: () => number | null;
  previewForNode: (node: Node | null) => Element | null | undefined;
  subblockBodyForNode: (node: Node | null) => HTMLElement | null;
  tableCellForNode: (node: Node | null) => HTMLElement | null;
  offsetForPosition: (node: Node, nodeOffset: number) => number | null;
  selectionOffsets: () => { start: number; end: number } | null;
  selectRange: (start: number, end: number) => void;
  setCaret: (offset: number) => void;
  positionAtOffset: (offset: number) => { node: Node; offset: number } | null;
  lineStartAt: (offset: number) => number;
  caretLineRange: () => { start: number; end: number } | null;
  lineRangeFor: (preview: Element) => { start: number; end: number } | null;
};

export type RenderApi = {
  render: (offset: number | null) => void;
  renderPreservingScroll: (
    offset: number | null,
    revealOffset?: number | null,
  ) => void;
  replace: (
    start: number,
    end: number,
    text: string,
    caret?: number | null,
  ) => void;
  replaceSelection: (text: string) => void;
  scrollSnapshot: () => ScrollSnapshot;
  restoreScrollSnapshot: (snapshot: ScrollSnapshot) => void;
  insertAssets: (markdown: string) => void;
  syncValue: () => void;
  syncFeatures: () => void;
  syncDiagramSettings: () => void;
};
export type SelectionApi = {
  setActiveBlock: (active: HTMLElement | undefined) => void;
  markActiveBlock: () => void;
  markActiveSubblock: (body: HTMLElement, node: Node | null) => void;
  repairPreviewNavigation: (direction: "up" | "down", offset: number) => void;
  measureDecorations: () => void;
  scheduleMeasure: () => void;
};
export type BlockApi = {
  closeBlockMenu: () => void;
  sourceUnits: () => BlockUnit[];
  currentBlock: () => HTMLElement | undefined;
  unitContext: () => UnitContext | null;
  unitChunks: (units: BlockUnit[]) => string[];
  commitChunks: (
    chunks: string[],
    caretIndex: number,
    caretColumn?: number,
  ) => void;
  unitVisualRect: (unit: BlockUnit) => UnitRect;
  syncBlockToolbar: () => void;
  syncTailAdd: () => void;
  trackHoveredBlock: (event: PointerEvent) => void;
  clearBlockToolbarHide: () => void;
  scheduleBlockToolbarHide: () => void;
  openBlockMenu: (event: MouseEvent) => void;
  startBlockDrag: (event: PointerEvent) => void;
  handleBlockDragMove: (event: PointerEvent) => void;
  handleBlockDragEnd: () => void;
};

export type BlockEditApi = {
  addBlockAfter: () => void;
  openTailBlock: () => void;
  handleTailPointerDown: (event: PointerEvent) => boolean;
  blockContextItems: () => ContextMenuItem[];
};

export type TableApi = {
  bindTableToolbars: () => void;
  focusTableSource: (block: HTMLElement) => void;
  markSelectedTableCell: () => void;
  selectTableCell: (cell: HTMLElement) => void;
  selectedCellIn: (preview: HTMLElement) => HTMLElement | null;
  selectedTableCellElement: () => HTMLElement | null;
  tableSelection: () => {
    cell: HTMLElement;
    text: string;
    hasSelection: boolean;
  } | null;
  selectTableCellContents: (cell: HTMLElement) => void;
  replaceTableCellSelection: (cell: HTMLElement, text: string) => void;
  updateTable: (
    preview: HTMLElement,
    edit: Parameters<typeof editMarkdownTable>[1],
    renderPreview?: boolean,
  ) => void;
  handleTableCellInput: (cell: HTMLElement) => void;
};

export type SubblockApi = {
  handleSubblockInput: (body: HTMLElement) => void;
  handleSubblockKeydown: (event: KeyboardEvent, body: HTMLElement) => boolean;
  handleSubblockPointerDown: (
    event: PointerEvent,
    body: HTMLElement,
  ) => boolean;
  replaceSubblockSelection: (body: HTMLElement, text: string) => void;
  subblockSurface: (body: HTMLElement) => EditSurface;
};

export type TableMenuApi = {
  tableAction: (
    preview: HTMLElement,
    selected: HTMLElement,
    actionName: string | undefined,
    color?: string,
  ) => void;
  handleTableKeydown: (event: KeyboardEvent, cell: HTMLElement) => boolean;
  handleTablePointerDown: (event: PointerEvent) => boolean;
  tableItems: () => ContextMenuItem[];
};

export type EmbedLayoutApi = {
  codeSourceBlocks: (preview: Element) => HTMLElement[];
  sceneOf: (preview: Element) => string;
  applyEmbedLayout: (preview: HTMLElement, button: HTMLElement) => void;
  setEmbedOption: (
    preview: HTMLElement,
    options: { width?: number | null; align?: string | null },
  ) => void;
  withEmbedLayout: (preview: HTMLElement, source: string) => string;
  startEmbedResize: (event: PointerEvent, handle: HTMLElement) => void;
  replaceFencedSource: (
    preview: HTMLElement,
    language: string,
    source: string,
    rerender?: boolean,
  ) => void;
  setMediaOption: (
    range: { start: number; end: number },
    options: Parameters<typeof withMediaOptions>[1],
  ) => void;
  startMediaResize: (event: PointerEvent, handle: HTMLElement) => void;
  embedAlignItems: () => ContextMenuItem[];
  deleteEmbed: (preview: HTMLElement) => void;
  alignItems: () => ContextMenuItem[];
};

export type DrawingApi = {
  closeDiagramModal: () => void;
  closeDrawingModal: () => void;
  paintDrawingPreviews: () => void;
  paintDiagramPreviews: () => void;
  invalidateThumbnails: () => void;
  openDiagram: (preview: HTMLElement) => void;
  saveDiagram: (diagram: string) => void;
  openDrawing: (preview: HTMLElement) => void;
  saveDrawing: (scene: string) => void;
  handleDiagramPointer: (event: PointerEvent, handle: HTMLElement) => boolean;
};

export type LiveDiagramApi = {
  paintDiagramLivePreviews: () => void;
  stopDiagramTimer: () => void;
};

export type RunCellApi = {
  cellKey: (preview: HTMLElement) => string;
  paintRunPreviews: () => void;
  runCell: (preview: HTMLElement) => Promise<void>;
  restartCell: (preview: HTMLElement) => Promise<void>;
  handleRunPointer: (event: PointerEvent, handle: HTMLElement) => boolean;
};

export type DatabaseApi = {
  paintDatabaseEmbeds: () => void;
  scheduleDatabaseLayout: () => void;
  databaseCardFor: (event?: Event) => HTMLElement | null;
  enterDatabaseIsland: (event?: Event) => boolean;
  handleDatabaseBlur: (event: FocusEvent) => void;
  disposeDatabaseViews: () => void;
};

export type SlashApi = {
  highlightSlash: (index: number) => void;
  slashMatches: () => SlashCommand[];
  closeMenu: () => void;
  syncMenu: (surface: EditSurface) => void;
  trackMenu: () => void;
  runCommand: (prefix: string) => void;
  pickCommand: (command: SlashCommand) => void;
};

export type CompletionApi = {
  highlightCompletion: (index: number) => void;
  closeCompletions: () => void;
  syncCompletions: (surface: EditSurface) => void;
  applyCompletion: (item: Completion) => void;
};

export type ContextMenuApi = {
  closeContextMenu: () => void;
  openContextMenu: (event: MouseEvent) => void;
  contextItems: () => ContextMenuItem[];
  copySelection: () => Promise<void>;
  cutSelection: () => Promise<void>;
  pasteClipboard: () => Promise<void>;
  selectAll: () => void;
};

export type EventApi = {
  handleCompositionStart: (event: Event) => void;
  handleCompositionEnd: (event: Event) => void;
  insideDatabaseEmbed: (event?: Event) => boolean;
  handleInput: (event?: Event) => void;
  handleKeydown: (event: KeyboardEvent) => void;
  handlePaste: (event: ClipboardEvent) => void;
  handlePointerDown: (event: PointerEvent) => void;
  handleChange: (event: Event) => void;
};

export type Editor = EditorHost &
  DomApi &
  RenderApi &
  HistoryApi &
  SelectionApi &
  BlockApi &
  BlockEditApi &
  TableApi &
  SubblockApi &
  TableMenuApi &
  EmbedLayoutApi &
  DrawingApi &
  LiveDiagramApi &
  RunCellApi &
  DatabaseApi &
  SlashApi &
  CompletionApi &
  ContextMenuApi &
  EventApi &
  FindApi & { ui: EditorUi };
