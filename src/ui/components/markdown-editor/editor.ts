import { getCurrentWebview } from "@tauri-apps/api/webview";
import { createBlockEdit } from "./blockEdit";
import { createBlocks } from "./blocks";
import { createCompletions } from "./completions";
import { createContextMenu } from "./contextMenu";
import { createDatabase } from "./database";
import { createDom } from "./dom";
import { createDrawings } from "./drawings";
import { createEmbedLayout } from "./embedLayout";
import { createEvents } from "./events";
import { createFind } from "./find";
import { createLiveDiagrams } from "./liveDiagrams";
import { createRender } from "./render";
import { createRunCells } from "./runCells";
import { createSelection } from "./selection";
import { createSlash } from "./slash";
import { createSubblocks } from "./subblocks";
import { createTableMenu } from "./tableMenu";
import { createTables } from "./tables";
import type { Editor, EditorHost, EditorUi } from "./types";

function emptyUi(): EditorUi {
  return {
    activeBlock: undefined,
    blockMenu: null,
    blockToolbar: { top: 0, visible: false },
    completionIndex: 0,
    completionPosition: { top: 0, left: 0 },
    completionStart: null,
    completions: [],
    composing: false,
    contextMenu: null,
    decorationBoxes: [],
    dragIndicatorTop: null,
    draggingUnit: null,
    editingDiagram: null,
    editingDrawing: null,
    find: null,
    generating: false,
    hoveredBlock: undefined,
    menuPosition: { top: 0, left: 0 },
    selectedTableCell: null,
    slashIndex: 0,
    slashQuery: "",
    slashStart: null,
    tailAddTop: 0,
  };
}

/** Every write to the UI state is one the component has to re-render from. */
function createUi(notify: () => void): EditorUi {
  return new Proxy(emptyUi(), {
    set(target, key, value) {
      Reflect.set(target, key, value);
      notify();

      return true;
    },
  });
}

/**
 * The editor's behaviour, split by concern and stitched back together here.
 * Every part reaches the others (and the component's props, elements and text)
 * through this one object.
 */
export function createEditor(host: EditorHost, notify: () => void) {
  const editor = { ui: createUi(notify) } as Editor;

  // The text and the bound elements stay live: they are read off the component.
  Object.defineProperties(editor, {
    value: {
      get: () => host.value,
      set: (next: string) => {
        host.value = next;
      },
    },
    element: { get: () => host.element },
    shell: { get: () => host.shell },
    databaseLayer: { get: () => host.databaseLayer },
    props: { get: () => host.props },
    t: { value: host.t },
  });

  Object.assign(
    editor,
    createDom(editor),
    createRender(editor),
    createSelection(editor),
    createBlocks(editor),
    createBlockEdit(editor),
    createTables(editor),
    createTableMenu(editor),
    createEmbedLayout(editor),
    createDrawings(editor),
    createLiveDiagrams(editor),
    createRunCells(editor),
    createDatabase(editor),
    createSubblocks(editor),
    createSlash(editor),
    createCompletions(editor),
    createContextMenu(editor),
    createEvents(editor),
    createFind(editor),
  );

  return editor;
}

/** Tauri swallows HTML5 file drops, so paths arrive on a webview event. */
function listenForDroppedFiles(e: Editor) {
  return getCurrentWebview().onDragDropEvent(async (event) => {
    if (event.payload.type !== "drop" || !e.props.editable) {
      return;
    }

    const rect = e.element?.getBoundingClientRect();
    const { x, y } = event.payload.position.toLogical(window.devicePixelRatio);

    if (
      !rect ||
      x < rect.left ||
      x > rect.right ||
      y < rect.top ||
      y > rect.bottom
    ) {
      return;
    }

    e.insertAssets(await e.props.onAssets({ paths: event.payload.paths }));
  });
}

/** Listeners the editor keeps for as long as the component is on screen. */
export function mountEditor(e: Editor) {
  // Without a first render the editor has no blocks, so typing has nowhere to go.
  e.render(null);

  const dragDrop = listenForDroppedFiles(e);
  const observer = new ResizeObserver(() => {
    e.scheduleMeasure();
    e.syncTailAdd();
    e.scheduleDatabaseLayout();
  });
  const reposition = () => e.scheduleDatabaseLayout();
  const themeObserver = new MutationObserver(() => e.invalidateThumbnails());

  if (e.element) {
    observer.observe(e.element);
  }

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  window.addEventListener("resize", reposition);
  window.addEventListener("scroll", reposition, true);

  return () => {
    void dragDrop.then((unlisten) => unlisten());
    observer.disconnect();
    themeObserver.disconnect();
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
  };
}

export function destroyEditor(e: Editor) {
  e.stopDiagramTimer();
  e.clearBlockToolbarHide();
  e.disposeDatabaseViews();
}
