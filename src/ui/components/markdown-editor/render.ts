import { gitlabResolver } from "../../../lib/utils/gitlab";
import {
  renderDocument,
  type QuizScore,
} from "../../../lib/utils/markdown";
import { paintBlocks } from "./blockDiff";
import { paintPlayers } from "./players";
import type { Editor, RenderApi } from "./types";

export function createRender(e: Editor): RenderApi {
  const service = new EditorRender(e);

  return {
    insertAssets: service.insertAssets.bind(service),
    render: service.render.bind(service),
    renderPreservingScroll: service.renderPreservingScroll.bind(service),
    replace: service.replace.bind(service),
    replaceSelection: service.replaceSelection.bind(service),
    restoreScrollSnapshot: service.restoreScrollSnapshot.bind(service),
    scrollSnapshot: service.scrollSnapshot.bind(service),
    syncDiagramSettings: service.syncDiagramSettings.bind(service),
    syncFeatures: service.syncFeatures.bind(service),
    syncValue: service.syncValue.bind(service),
  };
}

type ScrollSnapshot = { node: HTMLElement; top: number; left: number }[];

/** Rendering the note, moving the caret with it, and keeping the view still. */
class EditorRender {
  private renderedBlocks: string[] = [];
  private renderedCalloutDefinitions = "";
  private renderedHighlightColors = "";
  private renderedWikilinkKey = "";
  /** Filled on the first sync: props are not assigned yet at build time. */
  private rendered: Record<string, boolean> | null = null;

  constructor(private e: Editor) {}

  private featureFlags() {
    const props = this.e.props;

    return {
      fancyTableEditor: props.fancyTableEditor,
      callouts: props.callouts,
      drawings: props.drawings,
      diagrams: props.diagrams,
      quizzes: props.quizzes,
      codeExecution: props.codeExecution,
      plantuml: props.plantuml,
      mermaid: props.mermaid,
      youtube: props.youtube,
      spotify: props.spotify,
      online: props.online,
    };
  }

  private documentOptions() {
    const props = this.e.props;

    return {
      fancyTableEditor: props.fancyTableEditor,
      callouts: props.callouts,
      calloutDefinitions: props.calloutDefinitions,
      highlightColors: props.highlightColors,
      drawings: props.drawings,
      diagrams: props.diagrams,
      quizzes: props.quizzes,
      quizLabels: {
        check: this.e.t("editor.quizCheck"),
        reveal: this.e.t("editor.quizReveal"),
        write: this.e.t("editor.quizWrite"),
        retry: this.e.t("editor.quizRetry"),
        clear: this.e.t("editor.quizClear"),
        score: ({ hits, correct, misses }: QuizScore) =>
          this.e.t(misses ? "editor.quizScoreWrong" : "editor.quizScore", {
            hits,
            total: correct,
            misses,
          }),
      },
      codeExecution: props.codeExecution,
      resolveWikilink: props.resolveWikilink,
      renderWikilinkEmbed: props.renderWikilinkEmbed,
      databaseEmbeds: Boolean(props.databaseRoot),
      resolveGitlab: gitlabResolver(props.gitlabCards),
      youtubeOnline: props.youtube ? props.online : undefined,
      spotifyOnline: props.spotify ? props.online : undefined,
      plantuml: props.plantuml,
      mermaid: props.mermaid,
    };
  }

  private paintFeatures() {
    const e = this.e;

    e.bindTableToolbars();
    e.paintDatabaseEmbeds();
    paintPlayers(e);
    e.paintDrawingPreviews();
    e.paintDiagramPreviews();
    e.trackInlineEditor();
    e.paintRunPreviews();
    e.paintDiagramLivePreviews();

    if (e.props.editable || !e.element) {
      return;
    }

    for (const node of Array.from(
      e.element.querySelectorAll("[data-table-cell], [data-subblock-body]"),
    )) {
      (node as HTMLElement).contentEditable = "false";
    }
  }

  render(offset: number | null) {
    const e = this.e;

    if (!e.element) {
      return false;
    }

    const painted = paintBlocks(
      this.renderedBlocks,
      renderDocument(
        e.value,
        e.props.resolveAsset ?? undefined,
        this.documentOptions(),
      ),
      e.element,
    );

    this.renderedBlocks = painted.blocks;

    // Nothing in the DOM moved, so there is no caret to put back and no paint
    // pass with anything to paint: touching either only makes the view jump.
    if (!painted.changed) {
      return false;
    }

    this.paintFeatures();

    if (offset !== null) {
      const block = e.blockAtOffset(offset);

      // A caret that came from a table cell (undo, an external write) maps back
      // onto the hidden source lines: put it in the card, not in the markdown.
      if (block?.classList.contains("md-table-line")) {
        e.focusTableSource(block);
      } else {
        e.setActiveBlock(block);
        e.setCaret(offset);
      }
    }

    e.markActiveBlock();
    e.markSelectedTableCell();
    e.syncTailAdd();

    return true;
  }

  replace(
    start: number,
    end: number,
    text: string,
    caret: number | null = start + text.length,
  ) {
    const e = this.e;

    e.value = e.value.slice(0, start) + text + e.value.slice(end);
    this.render(caret);
    e.props.onInput();
  }

  replaceSelection(text: string) {
    const selection = this.e.selectionOffsets();
    const start = selection?.start ?? this.e.caretOffset();

    if (start === null) {
      return;
    }

    this.replace(start, selection?.end ?? start, text);
  }

  scrollSnapshot() {
    const containers: ScrollSnapshot = [];
    let node = this.e.element?.parentElement;

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

  restoreScrollSnapshot(snapshot: ScrollSnapshot) {
    for (const entry of snapshot) {
      entry.node.scrollTop = entry.top;
      entry.node.scrollLeft = entry.left;
    }
  }

  private caretRectForOffset(offset: number) {
    const position = this.e.positionAtOffset(offset);

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

    return this.e.blockAtOffset(offset)?.getBoundingClientRect() ?? null;
  }

  private revealCaretIfNeeded(offset: number) {
    const caret = this.caretRectForOffset(offset);

    if (!caret) {
      return;
    }

    for (const { node } of this.scrollSnapshot()) {
      const viewport = node.getBoundingClientRect();
      const padding = 12;

      if (caret.top < viewport.top + padding) {
        node.scrollTop -= viewport.top + padding - caret.top;
      } else if (caret.bottom > viewport.bottom - padding) {
        node.scrollTop += caret.bottom - (viewport.bottom - padding);
      }
    }
  }

  renderPreservingScroll(
    offset: number | null,
    revealOffset: number | null = offset,
  ) {
    const snapshot = this.scrollSnapshot();

    if (!this.render(offset)) {
      return;
    }

    this.restoreScrollSnapshot(snapshot);

    if (revealOffset !== null) {
      this.revealCaretIfNeeded(revealOffset);
    }

    requestAnimationFrame(() => {
      this.restoreScrollSnapshot(snapshot);

      if (revealOffset !== null) {
        this.revealCaretIfNeeded(revealOffset);
      }
    });
  }

  /** Media wants its own line, so it lands after the current one. */
  insertAssets(markdown: string) {
    const e = this.e;

    if (!markdown) {
      return;
    }

    const offset = e.caretOffset() ?? e.value.length;
    const newline = e.value.indexOf("\n", offset);
    const lineEnd = newline === -1 ? e.value.length : newline;
    const lead = e.value.slice(e.lineStartAt(lineEnd), lineEnd) ? "\n" : "";

    this.replace(lineEnd, lineEnd, `${lead}${markdown}\n`);
  }

  /** The note's text changed underneath the editor, so the DOM catches up. */
  syncValue() {
    const e = this.e;

    if (!e.element || e.ui.composing || e.getText() === e.value) {
      return;
    }

    // The write came from outside the editor (another note, an external edit),
    // so the entries collected for the old text no longer apply.
    e.resetHistory();
    this.render(e.caretOffset());
  }

  /** A toggled feature has to enter or leave the rendered document. */
  syncFeatures() {
    const e = this.e;

    if (!e.element) {
      return;
    }

    const flags = this.featureFlags();
    const calloutDefinitions = JSON.stringify(e.props.calloutDefinitions);
    const highlightColors = JSON.stringify(e.props.highlightColors);
    const wikilinkKey =
      e.props.resolveWikilink && e.props.wikilinkKey ? e.props.wikilinkKey : "";
    const rendered = this.rendered;
    const changed =
      (rendered !== null &&
        Object.entries(flags).some(([key, on]) => rendered[key] !== on)) ||
      this.renderedCalloutDefinitions !== calloutDefinitions ||
      this.renderedHighlightColors !== highlightColors ||
      (Boolean(wikilinkKey) && this.renderedWikilinkKey !== wikilinkKey);

    this.rendered = flags;
    this.renderedCalloutDefinitions = calloutDefinitions;
    this.renderedHighlightColors = highlightColors;
    this.renderedWikilinkKey = wikilinkKey;

    if (changed) {
      this.render(e.caretOffset());
    }
  }

  /** Switching binary, server, or output format invalidates every diagram. */
  syncDiagramSettings() {
    if (this.e.element && (this.e.props.plantuml || this.e.props.mermaid)) {
      this.e.paintDiagramLivePreviews();
    }
  }
}
