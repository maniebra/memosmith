import { gitlabResolver } from "../../../lib/utils/gitlab";
import {
  renderDocument,
  serializeColumnSubblocks,
  verticalSubblockLine,
  type RenderDocumentOptions,
  type TextEdit,
} from "../../../lib/utils/markdown";
import type { EditSurface } from "./surface";
import { SubblockText } from "./subblockText";
import type { Editor, SubblockApi } from "./types";

export function createSubblocks(e: Editor): SubblockApi {
  const service = new EditorSubblocks(e);

  return {
    handleSubblockInput: service.handleSubblockInput.bind(service),
    handleSubblockKeydown: service.handleSubblockKeydown.bind(service),
    handleSubblockPointerDown:
      service.handleSubblockPointerDown.bind(service),
    subblockSurface: service.subblockSurface.bind(service),
    replaceSubblockSelection: service.replaceSubblockSelection.bind(service),
  };
}

/** Visual column blocks backed by hidden markdown source. */
class EditorSubblocks {
  private text: SubblockText;

  constructor(private e: Editor) {
    this.text = new SubblockText(e);
  }

  private sourceBlocks(preview: HTMLElement) {
    const group = preview.dataset.subblocks;
    const children = Array.from(preview.parentElement?.children ?? []);

    return (children as HTMLElement[]).filter(
      (block) =>
        block.dataset.subblocks === group &&
        !block.classList.contains("md-preview"),
    );
  }

  private bodies(preview: Element | null) {
    return Array.from(preview?.children ?? [])
      .map((child) => child.firstElementChild)
      .filter((child) => child?.matches("[data-subblock-body]")) as
      HTMLElement[];
  }

  private rangeFor(preview: HTMLElement) {
    const blocks = this.sourceBlocks(preview);
    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    const start = first ? this.e.offsetForPosition(first, 0) : null;
    const end = last
      ? this.e.offsetForPosition(last, this.e.sourceLength(last))
      : null;

    return start === null || end === null ? null : { start, end };
  }

  private textFor(preview: HTMLElement) {
    return serializeColumnSubblocks(
      this.bodies(preview).map((entry) => this.text.text(entry)),
    );
  }

  private documentOptions(): RenderDocumentOptions {
    const props = this.e.props;

    return {
      calloutDefinitions: props.calloutDefinitions,
      callouts: props.callouts,
      codeExecution: props.codeExecution,
      databaseEmbeds: Boolean(props.databaseRoot),
      resolveGitlab: gitlabResolver(props.gitlabCards),
      diagrams: props.diagrams,
      drawings: props.drawings,
      fancyTableEditor: props.fancyTableEditor,
      mermaid: props.mermaid,
      plantuml: props.plantuml,
      renderWikilinkEmbed: props.renderWikilinkEmbed,
      resolveWikilink: props.resolveWikilink,
    };
  }

  private commitPreview(preview: HTMLElement): boolean {
    const range = this.rangeFor(preview);
    const text = this.textFor(preview);

    this.writeSourceBlocks(preview, text);

    if (!range) {
      const parent = preview.parentElement?.closest("[data-subblock-body]");

      return parent instanceof HTMLElement ? this.commitBody(parent) : false;
    }

    this.e.value =
      this.e.value.slice(0, range.start) + text + this.e.value.slice(range.end);

    return true;
  }

  private commitBody(body: HTMLElement): boolean {
    const preview = body.closest(".md-subblocks-preview") as HTMLElement | null;

    return preview ? this.commitPreview(preview) : false;
  }

  /**
   * The hidden source lines are patched in place. A full document render would
   * replace the body the caret lives in, which costs the focus on every key.
   */
  private writeSourceBlocks(preview: HTMLElement, text: string) {
    const blocks = this.sourceBlocks(preview);
    const lines = text.split("\n");

    if (blocks.length === lines.length) {
      for (const [index, block] of blocks.entries()) {
        block.textContent = lines[index];
      }

      return;
    }

    this.rebuildSourceBlocks(preview, blocks, lines);
  }

  private rebuildSourceBlocks(
    preview: HTMLElement,
    blocks: HTMLElement[],
    lines: string[],
  ) {
    const first = blocks[0];

    if (!first) {
      return;
    }

    const group = Number(preview.dataset.subblocks ?? 0);
    const holder = document.createElement("div");

    holder.innerHTML = lines
      .map((line, index) =>
        verticalSubblockLine(line, group, index, lines.length, true, {}),
      )
      .join("");
    first.before(...Array.from(holder.children));
    for (const block of blocks) {
      block.remove();
    }
  }

  /** Every column edit goes through here, so source and preview stay in step. */
  private applyEdit(
    body: HTMLElement,
    edit: TextEdit,
    source = this.text.text(body),
  ) {
    const next =
      source.slice(0, edit.start) + edit.text + source.slice(edit.end);

    this.commitAndRender(body, next, edit.caret);
  }

  private commitAndRender(body: HTMLElement, source: string, offset: number) {
    if (!this.commitBody(body)) {
      return false;
    }

    this.renderBody(body, source, offset);
    this.e.props.onInput();
    return true;
  }

  private renderBody(body: HTMLElement, source: string, offset: number) {
    body.innerHTML = renderDocument(
      source,
      this.e.props.resolveAsset ?? undefined,
      this.documentOptions(),
    );
    this.e.paintRunPreviews();
    // A fence or math line hides until active, so unfold before the caret lands.
    const landing = this.text.position(body, offset)?.node ?? null;

    this.e.markActiveSubblock(body, landing);
    this.text.restoreCaret(body, offset);
    this.e.markActiveBlock();
  }

  private focusBody(body: HTMLElement, direction: 1 | -1) {
    const preview = body.closest(".md-subblocks-preview");
    const bodies = this.bodies(preview);
    const target = bodies[bodies.indexOf(body) + direction];

    target?.focus();
  }

  /** Like the document: a caret aimed at a preview belongs to its source line. */
  private focusPreviewSource(body: HTMLElement, preview: HTMLElement) {
    const target = preview.previousElementSibling;

    if (!(target instanceof HTMLElement)) {
      return false;
    }

    // preventDefault kept the click from focusing the body, so do it here.
    body.focus({ preventScroll: true });

    const position = this.e.caretPositionIn(
      target,
      this.e.sourceLength(target),
    );
    const range = document.createRange();

    range.setStart(position?.node ?? target, position?.offset ?? 0);
    range.collapse(true);
    getSelection()?.removeAllRanges();
    getSelection()?.addRange(range);
    this.e.markActiveBlock();

    return true;
  }

  handleSubblockPointerDown(event: PointerEvent, body: HTMLElement) {
    const target = event.target as HTMLElement | null;
    const source = target?.closest(".md-math-source");

    if (source && body.contains(source)) {
      return false;
    }

    const preview = target?.closest(".md-preview") as HTMLElement | null;

    // A preview with its own controls keeps the click.
    if (
      !preview ||
      !body.contains(preview) ||
      target?.closest("button, input, textarea, a, [contenteditable='true']")
    ) {
      return false;
    }

    event.preventDefault();
    return this.focusPreviewSource(body, preview);
  }

  /** Same rule as the document: Enter stays plain on a code line. */
  private inCodeBlock(body: HTMLElement) {
    const focus = getSelection()?.focusNode ?? null;
    const node = focus instanceof HTMLElement ? focus : focus?.parentElement;
    const block = node?.closest(".md-block");

    return Boolean(
      block && body.contains(block) && block.classList.contains("md-codeblock"),
    );
  }

  /** The column body as an edit surface, so it runs the document's own logic. */
  subblockSurface(body: HTMLElement): EditSurface {
    return {
      text: this.text.text(body),
      caret: this.text.caretOffset(body),
      selection: this.text.selection(body),
      inCodeBlock: this.inCodeBlock(body),
      direction: getComputedStyle(body).direction,
      subblock: true,
      apply: (edit) => this.applyEdit(body, edit),
      setCaret: (offset) => {
        this.text.restoreCaret(body, offset);
        this.e.markActiveBlock();
      },
      select: (start, end) => {
        this.text.selectRange(body, start, end);
        this.e.markActiveBlock();
      },
    };
  }

  /** Leaving the columns needs a keyboard route out of the preview. */
  private exitBody(body: HTMLElement) {
    const preview = body.closest(".md-subblocks-preview") as HTMLElement | null;
    const range = preview ? this.rangeFor(preview) : null;

    if (range === null) {
      return;
    }

    this.e.setCaret(range.end);
    this.e.markActiveBlock();
  }

  private handleColumnNavigation(event: KeyboardEvent, body: HTMLElement) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return false;
    }

    event.preventDefault();
    this.focusBody(body, event.key === "ArrowRight" ? 1 : -1);
    return true;
  }

  /**
   * Only what is specific to columns: moving between them and stepping out.
   * Everything else runs the document's handlers through the edit surface.
   */
  handleSubblockKeydown(event: KeyboardEvent, body: HTMLElement) {
    if (event.altKey && this.handleColumnNavigation(event, body)) {
      return true;
    }

    // An open menu owns Escape; only a bare Escape leaves the columns.
    const menuOpen =
      this.e.ui.slashStart !== null || this.e.ui.completions.length > 0;

    if (event.key === "Escape" && !menuOpen) {
      event.preventDefault();
      this.exitBody(body);
      return true;
    }

    return false;
  }

  handleSubblockInput(body: HTMLElement) {
    return this.commitAndRender(
      body,
      this.text.text(body),
      this.text.caretOffset(body),
    );
  }

  /** Pasted newlines have to become source lines, not browser line breaks. */
  replaceSubblockSelection(body: HTMLElement, text: string) {
    const selection = this.text.selection(body);

    this.applyEdit(body, {
      start: selection.start,
      end: selection.end,
      text,
      caret: selection.start + text.length,
    });
  }
}
