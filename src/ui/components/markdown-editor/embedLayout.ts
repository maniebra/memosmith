import { AlignCenter, AlignLeft, AlignRight, Trash2 } from "@lucide/svelte";
import {
  isMediaLine,
  liveDiagramFenceLine,
  mediaOptions,
  withMediaOptions,
} from "../../../lib/utils/markdown";
import type { ContextMenuItem } from "../ContextMenu.svelte";
import type { EmbedLayoutApi, Editor } from "./types";

/** Drag target for manual sizing, appended inside every embed card. */
export const RESIZE_HANDLE =
  '<span class="md-resize" aria-hidden="true"></span>';

export const EMBED_SELECTOR =
  ".md-drawing-preview, .md-diagram-preview, .md-livediagram-preview";

export function createEmbedLayout(e: Editor): EmbedLayoutApi {
  const service = new EditorEmbedLayout(e);

  return {
    alignItems: service.alignItems.bind(service),
    applyEmbedLayout: service.applyEmbedLayout.bind(service),
    codeSourceBlocks: service.codeSourceBlocks.bind(service),
    deleteEmbed: service.deleteEmbed.bind(service),
    embedAlignItems: service.embedAlignItems.bind(service),
    replaceFencedSource: service.replaceFencedSource.bind(service),
    sceneOf: service.sceneOf.bind(service),
    setEmbedOption: service.setEmbedOption.bind(service),
    setMediaOption: service.setMediaOption.bind(service),
    startEmbedResize: service.startEmbedResize.bind(service),
    startMediaResize: service.startMediaResize.bind(service),
    withEmbedLayout: service.withEmbedLayout.bind(service),
  };
}

/** Where an embedded card sits, how wide it is, and the source behind it. */
class EditorEmbedLayout {
  constructor(private e: Editor) {}

  /** Source lines of a fenced block, preview cards excluded. */
  codeSourceBlocks(preview: Element) {
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

  sceneOf(preview: Element) {
    return this.codeSourceBlocks(preview)
      .map((block) => this.e.sourceText(block))
      .slice(1, -1)
      .join("\n");
  }

  private isLiveDiagramPreview(preview: Element) {
    return preview.classList.contains("md-livediagram-preview");
  }

  private embedLanguage(preview: Element) {
    return preview.classList.contains("md-diagram-preview")
      ? "drawio"
      : "excalidraw";
  }

  private embedSource(preview: Element): Record<string, any> {
    // PlantUML holds diagram text, not JSON, so its layout rides on the fence.
    if (this.isLiveDiagramPreview(preview)) {
      const dataset = (preview as HTMLElement).dataset;
      const width = Number(dataset.livediagramWidth);

      return {
        ...(dataset.livediagramAlign && { align: dataset.livediagramAlign }),
        ...(Number.isFinite(width) && width > 0 && { width }),
      };
    }

    try {
      const parsed = JSON.parse(this.sceneOf(preview) || "{}");

      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  /** Rewrites just the opening fence, so the source itself is never touched. */
  private setLiveDiagramOption(
    preview: HTMLElement,
    options: { width?: number | null; align?: string | null },
  ) {
    const e = this.e;
    const current = this.embedSource(preview);
    const open = this.codeSourceBlocks(preview)[0];
    const start = open ? e.offsetForPosition(open, 0) : null;

    if (!open || start === null) {
      return;
    }

    const align =
      options.align === undefined
        ? current.align
        : (options.align ?? undefined);
    const width =
      options.width === undefined
        ? current.width
        : (options.width ?? undefined);
    const language = /```(\w*)/.exec(open.textContent ?? "")?.[1] || "plantuml";

    e.value =
      e.value.slice(0, start) +
      liveDiagramFenceLine(language, align, width) +
      e.value.slice(start + e.sourceLength(open));
    e.render(null);
    e.props.onInput();
  }

  /** Width in pixels and alignment ride along in the block's own JSON. */
  applyEmbedLayout(preview: HTMLElement, button: HTMLElement) {
    const { width, align } = this.embedSource(preview);
    const svg = button.querySelector("svg, img") as HTMLElement | null;

    preview.style.justifyContent =
      align === "center"
        ? "center"
        : align === "right"
          ? "flex-end"
          : "flex-start";
    button.style.width = typeof width === "number" ? `${width}px` : "";
    // A sized card scales its thumbnail; an unsized one keeps its own size.
    svg?.style.setProperty("width", typeof width === "number" ? "100%" : "");
  }

  setEmbedOption(
    preview: HTMLElement,
    options: { width?: number | null; align?: string | null },
  ) {
    if (this.isLiveDiagramPreview(preview)) {
      this.setLiveDiagramOption(preview, options);

      return;
    }

    const source = this.embedSource(preview);

    for (const [key, option] of Object.entries(options)) {
      if (option === null) {
        delete source[key];
      } else if (option !== undefined) {
        source[key] = option;
      }
    }

    this.replaceFencedSource(
      preview,
      this.embedLanguage(preview),
      JSON.stringify(source),
    );
  }

  /** The modals only know their own content, so layout is carried over here. */
  withEmbedLayout(preview: HTMLElement, source: string) {
    const { width, align } = this.embedSource(preview);

    if (width === undefined && align === undefined) {
      return source;
    }

    try {
      return JSON.stringify({
        ...JSON.parse(source),
        ...(width !== undefined && { width }),
        ...(align !== undefined && { align }),
      });
    } catch {
      return source;
    }
  }

  private trackResize(
    node: HTMLElement,
    event: PointerEvent,
    factor: number,
    onDone: (width: number) => void,
  ) {
    const startX = event.clientX;
    const startWidth = node.getBoundingClientRect().width;

    const onMove = (moveEvent: PointerEvent) => {
      const width = startWidth + (moveEvent.clientX - startX) * factor;

      node.style.width = `${Math.max(64, Math.round(width))}px`;
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      onDone(Math.round(node.getBoundingClientRect().width));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  private resizeFactor(align: unknown) {
    // A centered card grows from both edges, a right-aligned one leftwards.
    return align === "center" ? 2 : align === "right" ? -1 : 1;
  }

  startEmbedResize(event: PointerEvent, handle: HTMLElement) {
    const preview = handle.closest(EMBED_SELECTOR) as HTMLElement | null;
    const button = handle.parentElement;

    if (!preview || !button) {
      return;
    }

    event.preventDefault();
    this.trackResize(
      button,
      event,
      this.resizeFactor(this.embedSource(preview).align),
      (width) => this.setEmbedOption(preview, { width }),
    );
  }

  /** Offsets of the whole fenced block behind a preview card. */
  private fenceRange(preview: HTMLElement) {
    const e = this.e;
    const blocks = this.codeSourceBlocks(preview);
    const last = blocks[blocks.length - 1];
    const start = blocks[0] ? e.offsetForPosition(blocks[0], 0) : null;
    const end = last ? e.offsetForPosition(last, e.sourceLength(last)) : null;
    return start === null || end === null ? null : { start, end };
  }

  /** Drops the fence with the newline that follows it, so no blank line is left. */
  deleteEmbed(preview: HTMLElement) {
    const e = this.e;
    const range = this.fenceRange(preview);

    if (!range) {
      return;
    }
    const end = e.value[range.end] === "\n" ? range.end + 1 : range.end;
    e.value = e.value.slice(0, range.start) + e.value.slice(end);
    e.render(null);
    e.props.onInput();
  }

  replaceFencedSource(
    preview: HTMLElement,
    language: string,
    source: string,
    rerender = true,
  ) {
    const e = this.e;
    const { start, end } = this.fenceRange(preview) ?? {};

    if (start === undefined || end === undefined) {
      return;
    }

    e.value =
      e.value.slice(0, start) +
      `\`\`\`${language}\n${source}\n\`\`\`` +
      e.value.slice(end);

    if (rerender) {
      e.render(null);
    }

    e.props.onInput();
  }

  setMediaOption(
    range: { start: number; end: number },
    options: Parameters<typeof withMediaOptions>[1],
  ) {
    const e = this.e;
    const line = withMediaOptions(
      e.value.slice(range.start, range.end),
      options,
    );

    // Re-render without a caret: it would expand the source under the pointer.
    e.value = e.value.slice(0, range.start) + line + e.value.slice(range.end);
    e.render(null);
    e.props.onInput();
  }

  startMediaResize(event: PointerEvent, handle: HTMLElement) {
    const e = this.e;

    if (!e.props.editable || !handle.classList?.contains("md-resize")) {
      return;
    }

    const parent = handle.parentElement;
    const media = parent?.querySelector(".md-media") as HTMLElement | null;
    const preview = handle.closest(".md-preview");
    const range = preview ? e.lineRangeFor(preview) : null;

    if (!media || !range) {
      return;
    }

    event.preventDefault();
    const align = mediaOptions(e.value.slice(range.start, range.end)).align;

    this.trackResize(media, event, this.resizeFactor(align), (width) =>
      this.setMediaOption(range, { width }),
    );
  }

  embedAlignItems(): ContextMenuItem[] {
    const preview = this.e.ui.contextMenu?.embedPreview;

    if (!this.e.props.editable || !preview) {
      return [];
    }

    return [
      ...this.alignEntries((align) => this.setEmbedOption(preview, { align })),
      {
        label: this.e.t("editor.resetSize"),
        onSelect: () => this.setEmbedOption(preview, { width: null }),
      },
      {
        label: this.e.t("common.delete"),
        icon: Trash2,
        onSelect: () => this.deleteEmbed(preview),
      },
      { separator: true },
    ];
  }

  private alignEntries(
    apply: (align: "left" | "center" | "right" | null) => void,
    leftValue: "left" | null = null,
  ): ContextMenuItem[] {
    return [
      {
        label: this.e.t("editor.alignLeft"),
        icon: AlignLeft,
        onSelect: () => apply(leftValue),
      },
      {
        label: this.e.t("editor.alignCenter"),
        icon: AlignCenter,
        onSelect: () => apply("center"),
      },
      {
        label: this.e.t("editor.alignRight"),
        icon: AlignRight,
        onSelect: () => apply("right"),
      },
    ];
  }

  alignItems(): ContextMenuItem[] {
    const e = this.e;
    const range = e.caretLineRange();

    if (
      !e.props.editable ||
      !range ||
      !isMediaLine(e.value.slice(range.start, range.end))
    ) {
      return [];
    }

    return [
      ...this.alignEntries(
        (align) => this.setMediaOption(range, { align: align ?? undefined }),
        "left",
      ),
      { separator: true },
    ];
  }
}
