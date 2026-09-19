import { ClipboardCopy, ExternalLink } from "@lucide/svelte";
import type { DiagramPreview } from "../../../lib/utils/diagramPreview";
import type { ContextMenuItem } from "../ContextMenu.svelte";
import type { Editor } from "./types";

type DiagramArtwork =
  | { kind: "svg"; content: string }
  | { kind: "image"; source: string }
  | { kind: "text"; content: string; style: CSSStyleDeclaration };

function artworkIn(preview: HTMLElement): DiagramArtwork | null {
  const svg = preview.querySelector("svg");

  if (svg instanceof SVGSVGElement) {
    return {
      kind: "svg",
      content: new XMLSerializer().serializeToString(svg),
    };
  }

  const image = preview.querySelector("img");

  if (image instanceof HTMLImageElement && image.currentSrc) {
    return { kind: "image", source: image.currentSrc };
  }

  const text = preview.querySelector(".md-livediagram-ascii");

  if (text instanceof HTMLElement && text.textContent?.trim()) {
    return {
      kind: "text",
      content: text.textContent,
      style: getComputedStyle(text),
    };
  }

  return null;
}

function svgUrl(content: string) {
  return URL.createObjectURL(new Blob([content], { type: "image/svg+xml" }));
}

function imageFor(
  artwork: Extract<DiagramArtwork, { kind: "svg" | "image" }>,
) {
  return artwork.kind === "svg" ? svgUrl(artwork.content) : artwork.source;
}

function imageSize(image: HTMLImageElement) {
  const width = image.naturalWidth || 1;
  const height = image.naturalHeight || 1;
  const scale = Math.min(1, 8192 / Math.max(width, height));

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The diagram image could not be loaded"));
    image.src = source;
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("The diagram image could not be created"));
      }
    }, "image/png");
  });
}

async function rasterizedArtwork(artwork: DiagramArtwork) {
  if (artwork.kind === "text") {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is unavailable");
    }

    const size = Number.parseFloat(artwork.style.fontSize) || 13;
    const lineHeight =
      Number.parseFloat(artwork.style.lineHeight) || size * 1.25;
    const padding = 12;
    const lines = artwork.content.split("\n");

    context.font = `${artwork.style.fontWeight} ${size}px ${artwork.style.fontFamily}`;
    canvas.width = Math.ceil(
      Math.max(...lines.map((line) => context.measureText(line).width), 1) +
        padding * 2,
    );
    canvas.height = Math.ceil(lines.length * lineHeight + padding * 2);
    context.font = `${artwork.style.fontWeight} ${size}px ${artwork.style.fontFamily}`;
    context.fillStyle = artwork.style.color || "#1c1917";

    for (const [index, line] of lines.entries()) {
      context.fillText(line, padding, padding + size + index * lineHeight);
    }

    return canvasBlob(canvas);
  }

  const source = imageFor(artwork);

  try {
    const image = await loadImage(source);
    const { width, height } = imageSize(image);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas is unavailable");
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    return canvasBlob(canvas);
  } finally {
    if (artwork.kind === "svg") {
      URL.revokeObjectURL(source);
    }
  }
}

function previewArtwork(artwork: DiagramArtwork): DiagramPreview {
  return artwork.kind === "image"
    ? { kind: artwork.kind, content: artwork.source }
    : { kind: artwork.kind, content: artwork.content };
}

export function diagramMenuItems(
  e: Editor,
  preview: HTMLElement,
): ContextMenuItem[] {
  const artwork = artworkIn(preview);
  const items: ContextMenuItem[] = [
    {
      label: e.t("editor.previewInNewTab"),
      icon: ExternalLink,
      disabled: !artwork,
      onSelect: async () => {
        if (!artwork) {
          return;
        }

        try {
          await e.props.onPreviewDiagram(previewArtwork(artwork));
        } catch {
          e.props.onStatus(e.t("editor.previewUnavailable"));
        }
      },
    },
    {
      label: e.t("editor.copyAsImage"),
      icon: ClipboardCopy,
      disabled: !artwork,
      onSelect: async () => {
        if (!artwork || !navigator.clipboard?.write || !window.ClipboardItem) {
          e.props.onStatus(e.t("editor.copyImageFailed"));
          return;
        }

        try {
          const png = await rasterizedArtwork(artwork);

          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": png }),
          ]);
        } catch {
          e.props.onStatus(e.t("editor.copyImageFailed"));
        }
      },
    },
  ];

  const editItems = e.embedAlignItems();

  return editItems.length
    ? [...items, { separator: true }, ...editItems]
    : items;
}
