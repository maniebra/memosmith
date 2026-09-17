import { RESIZE_HANDLE } from "./embedLayout";
import type { DrawingApi, Editor } from "./types";

export function createDrawings(e: Editor): DrawingApi {
  const service = new EditorDrawings(e);

  return {
    closeDiagramModal: service.closeDiagramModal.bind(service),
    closeDrawingModal: service.closeDrawingModal.bind(service),
    handleDiagramPointer: service.handleDiagramPointer.bind(service),
    invalidateThumbnails: service.invalidateThumbnails.bind(service),
    openDiagram: service.openDiagram.bind(service),
    openDrawing: service.openDrawing.bind(service),
    paintDiagramPreviews: service.paintDiagramPreviews.bind(service),
    paintDrawingPreviews: service.paintDrawingPreviews.bind(service),
    saveDiagram: service.saveDiagram.bind(service),
    saveDrawing: service.saveDrawing.bind(service),
    trackInlineEditor: service.trackInlineEditor.bind(service),
  };
}

/** Excalidraw drawings and draw.io diagrams: their thumbnails and modals. */
class EditorDrawings {
  /** Exported thumbnails keyed by their scene JSON, so a re-render is free. */
  private thumbnails = new Map<string, string>();
  private darkMode = document.documentElement.classList.contains("dark");

  constructor(private e: Editor) {}

  // Thumbnails are baked for one theme, so a theme switch invalidates them.
  invalidateThumbnails() {
    const dark = document.documentElement.classList.contains("dark");

    if (dark !== this.darkMode) {
      this.darkMode = dark;
      this.thumbnails.clear();
      this.paintDrawingPreviews();
      this.paintDiagramPreviews();
    }
  }

  private async exportSvg(scene: string) {
    const parsed = JSON.parse(scene || "{}");
    const elements = Array.isArray(parsed.elements) ? parsed.elements : [];

    if (!elements.length) {
      return "";
    }

    const { exportToSvg } = await import("@excalidraw/excalidraw");
    const node = await exportToSvg({
      elements,
      files: parsed.files ?? null,
      appState: {
        ...(parsed.appState ?? {}),
        exportBackground: false,
        exportWithDarkMode: this.darkMode,
      },
      exportPadding: 8,
    });

    return node.outerHTML;
  }

  private async exportThumbnail(scene: string) {
    const cached = this.thumbnails.get(scene);

    if (cached !== undefined) {
      return cached;
    }

    let svg = "";

    try {
      svg = await this.exportSvg(scene);
    } catch {
      svg = "";
    }

    this.thumbnails.set(scene, svg);

    return svg;
  }

  paintDrawingPreviews() {
    const previews = this.e.element?.querySelectorAll(".md-drawing-preview");

    for (const preview of Array.from(previews ?? [])) {
      const open = preview.querySelector(".md-drawing-open");
      const button = open as HTMLElement | null;

      if (!button) {
        continue;
      }

      const scene = this.e.sceneOf(preview);

      void this.exportThumbnail(scene).then((svg) => {
        // The document may have been re-rendered while exporting.
        if (!button.isConnected || this.e.sceneOf(preview) !== scene) {
          return;
        }

        button.classList.toggle("md-drawing-thumbnail", Boolean(svg));
        button.innerHTML = (svg || "Edit drawing") + RESIZE_HANDLE;
        this.e.applyEmbedLayout(preview as HTMLElement, button);
      });
    }
  }

  paintDiagramPreviews() {
    const previews = this.e.element?.querySelectorAll(
      ".md-diagram-preview:not(.md-diagram-static-preview)",
    );

    for (const preview of Array.from(previews ?? [])) {
      const open = preview.querySelector(".md-diagram-open");
      const button = open as HTMLElement | null;

      if (!button) {
        continue;
      }

      let svg = "";

      try {
        const scene = this.e.sceneOf(preview) || "{}";

        svg = (JSON.parse(scene) as { svg?: string }).svg ?? "";
      } catch {
        svg = "";
      }

      button.classList.toggle("md-diagram-thumbnail", Boolean(svg));
      button.innerHTML = (svg || "Edit diagram") + RESIZE_HANDLE;
      this.e.applyEmbedLayout(preview as HTMLElement, button);
    }
  }

  /** An inline editor sits over its embed; stretching the embed pushes the text below out of the way. */
  private reserveSpace(preview: HTMLElement | undefined, reserve: boolean) {
    if (preview) {
      preview.style.minHeight = reserve && this.e.props.inlineEmbeds ? "32rem" : "";
    }
  }

  /**
   * Keeps an in-place editor on its embed. A re-render swaps the embed for a
   * new element, so it is found again by its source, which cannot change
   * while the editor holds it. Gone from the note: nothing left to save into.
   */
  trackInlineEditor() {
    const ui = this.e.ui;
    const drawing = ui.editingDrawing;
    const diagram = ui.editingDiagram;
    const editing = drawing ?? diagram;
    const shell = this.e.shell;

    if (!editing || !shell || !this.e.props.inlineEmbeds) {
      return;
    }

    const scene = drawing ? drawing.scene : diagram!.diagram;
    let preview: HTMLElement | undefined = editing.preview;

    if (!preview.isConnected) {
      const selector = drawing ? ".md-drawing-preview" : ".md-diagram-preview";
      const candidates =
        this.e.element?.querySelectorAll<HTMLElement>(selector) ?? [];

      preview = Array.from(candidates).find(
        (candidate) => this.e.sceneOf(candidate) === scene,
      );
    }

    if (!preview) {
      ui.editingDrawing = null;
      ui.editingDiagram = null;
      return;
    }

    this.reserveSpace(preview, true);

    const top =
      preview.getBoundingClientRect().top - shell.getBoundingClientRect().top;

    if (preview === editing.preview && top === editing.top) {
      return;
    }

    if (drawing) {
      ui.editingDrawing = { ...drawing, preview, top };
    } else {
      ui.editingDiagram = { ...diagram!, preview, top };
    }
  }

  closeDiagramModal() {
    this.reserveSpace(this.e.ui.editingDiagram?.preview, false);
    this.e.ui.editingDiagram = null;
  }

  closeDrawingModal() {
    this.reserveSpace(this.e.ui.editingDrawing?.preview, false);
    this.e.ui.editingDrawing = null;
  }

  openDiagram(preview: HTMLElement) {
    this.reserveSpace(preview, true);
    this.e.ui.editingDiagram = { preview, diagram: this.e.sceneOf(preview) };
    this.trackInlineEditor();
  }

  saveDiagram(diagram: string) {
    const preview = this.e.ui.editingDiagram?.preview;
    this.closeDiagramModal();

    if (preview) {
      this.e.replaceFencedSource(
        preview,
        "drawio",
        this.e.withEmbedLayout(preview, diagram),
      );
    }
  }

  openDrawing(preview: HTMLElement) {
    const lines = this.e
      .codeSourceBlocks(preview)
      .map((block) => this.e.sourceText(block));

    this.reserveSpace(preview, true);
    this.e.ui.editingDrawing = { preview, scene: lines.slice(1, -1).join("\n") };
    this.trackInlineEditor();
  }

  saveDrawing(scene: string) {
    const preview = this.e.ui.editingDrawing?.preview;
    this.closeDrawingModal();

    if (preview) {
      this.e.replaceFencedSource(
        preview,
        "excalidraw",
        this.e.withEmbedLayout(preview, scene),
      );
    }
  }

  handleDiagramPointer(event: PointerEvent, handle: HTMLElement) {
    const editable = this.e.props.editable;

    if (handle.closest?.(".md-diagram-open")) {
      const preview = handle.closest(".md-diagram-preview") as HTMLElement | null;
      const isStatic = preview?.classList.contains("md-diagram-static-preview");

      if (editable && preview && !isStatic) {
        event.preventDefault();
        this.openDiagram(preview);
      }

      return true;
    }

    if (handle.closest?.(".md-drawing-open")) {
      const preview = handle.closest(".md-drawing-preview") as HTMLElement | null;

      if (editable && preview) {
        event.preventDefault();
        this.openDrawing(preview);
      }

      return true;
    }

    return false;
  }
}
