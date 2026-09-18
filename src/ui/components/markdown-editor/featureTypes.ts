import type {
  editMarkdownTable,
  withMediaOptions,
} from "../../../lib/utils/markdown";
import type { ContextMenuItem } from "../ContextMenu.svelte";
import type { EditSurface } from "./surface";

export type TableApi = {
  bindTableToolbars: () => void;
  copyTable: (preview: HTMLElement) => Promise<void>;
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
  pasteTable: (preview: HTMLElement) => Promise<void>;
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
  trackInlineEditor: () => void;
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
