import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

export type PaperName = "a4" | "letter" | "legal" | "a5" | "a3";
export type MarginName = "none" | "narrow" | "normal" | "wide";

export type PdfLayout = {
  paper: PaperName;
  landscape: boolean;
  margin: MarginName;
  header: boolean;
  pageNumbers: boolean;
};

/** Portrait width and height in millimetres, the GTK paper name, and the CSS `size` keyword. */
export const papers: Record<
  PaperName,
  { width: number; height: number; gtk: string; css: string }
> = {
  a4: { width: 210, height: 297, gtk: "iso_a4", css: "A4" },
  letter: { width: 215.9, height: 279.4, gtk: "na_letter", css: "letter" },
  legal: { width: 215.9, height: 355.6, gtk: "na_legal", css: "legal" },
  a5: { width: 148, height: 210, gtk: "iso_a5", css: "A5" },
  a3: { width: 297, height: 420, gtk: "iso_a3", css: "A3" },
};

export const margins: Record<MarginName, number> = {
  none: 0,
  narrow: 6,
  normal: 12,
  wide: 20,
};

/** Header and footer text sits in the margin, so it needs at least this much. */
export const bandMm = 12;

/** Headless export is Linux-only (see pdf.rs); elsewhere the system print dialog saves the PDF. */
export const headlessPdf = navigator.userAgent.includes("Linux");

const layoutKey = "memosmith.pdfLayout";

export const defaultLayout: PdfLayout = {
  paper: "a4",
  landscape: false,
  margin: "normal",
  header: false,
  pageNumbers: true,
};

export function loadLayout(): PdfLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(layoutKey) ?? "{}");
    const layout = { ...defaultLayout, ...saved };

    return layout.paper in papers && layout.margin in margins
      ? layout
      : defaultLayout;
  } catch {
    return defaultLayout;
  }
}

export function saveLayout(layout: PdfLayout) {
  try {
    localStorage.setItem(layoutKey, JSON.stringify(layout));
  } catch {
    // A remembered layout is a convenience; the export works without it.
  }
}

/** Page geometry in millimetres, with the margins the header and footer force. */
export function pageGeometry(layout: PdfLayout) {
  const paper = papers[layout.paper];
  const margin = margins[layout.margin];

  return {
    width: layout.landscape ? paper.height : paper.width,
    height: layout.landscape ? paper.width : paper.height,
    top: layout.header ? Math.max(margin, bandMm) : margin,
    bottom: layout.pageNumbers ? Math.max(margin, bandMm) : margin,
    side: margin,
  };
}

/**
 * The title as an alpha mask. PDF base fonts only cover Latin, so the webview draws the text
 * with the app font and the backend stamps the pixels.
 */
function textMask(text: string) {
  const scale = 4;
  const fontSize = 9 * scale;
  const height = fontSize * 1.5;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const family =
    getComputedStyle(document.documentElement)
      .getPropertyValue("--ms-ui-font")
      .trim() || "sans-serif";
  const font = `${fontSize}px ${family}`;

  context.font = font;
  canvas.width = Math.max(1, Math.ceil(context.measureText(text).width));
  canvas.height = height;
  // Resizing the canvas resets its state.
  context.font = font;
  context.textBaseline = "middle";
  context.direction = document.dir === "rtl" ? "rtl" : "ltr";
  context.textAlign = "center";
  context.fillText(text, canvas.width / 2, height / 2);

  const pixels = context.getImageData(0, 0, canvas.width, height).data;
  const alpha = new Array<number>(canvas.width * height);

  for (let index = 0; index < alpha.length; index++) {
    alpha[index] = pixels[index * 4 + 3];
  }

  // 9pt text in a 1.5x line box, in millimetres.
  return {
    width: canvas.width,
    height,
    alpha,
    size: ((9 * 1.5) / 72) * 25.4,
  };
}

/**
 * Prints the live webview straight to a PDF file — no print dialog, no second renderer,
 * so the file matches the preview exactly. Returns the path, or null if the user cancelled
 * or the print dialog handled it.
 */
export async function exportPdf(
  suggestedName: string,
  layout: PdfLayout,
): Promise<string | null> {
  if (!headlessPdf) {
    window.print();
    return null;
  }

  const path = await save({
    defaultPath: `${suggestedName || "note"}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!path) {
    return null;
  }

  // The webview prints itself, so a focused editor would bake its caret and focus ring
  // into the file.
  (document.activeElement as HTMLElement | null)?.blur();
  window.getSelection()?.removeAllRanges();

  return invoke<string>("export_pdf", {
    path: path.toLowerCase().endsWith(".pdf") ? path : `${path}.pdf`,
    options: {
      paper: papers[layout.paper].gtk,
      landscape: layout.landscape,
      margin: margins[layout.margin],
      header: layout.header && suggestedName ? textMask(suggestedName) : null,
      pageNumbers: layout.pageNumbers,
    },
  });
}
