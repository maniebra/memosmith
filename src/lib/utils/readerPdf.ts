import type { Raster } from "./readerPdfRaster";
export { startRaster, type Raster } from "./readerPdfRaster";
export { pdfOutline, searchPdf } from "./readerPdfText";

export type PdfDocument = any;

export type PdfPage = {
  /** 1-based page number. */
  number: number;
  wrapper: HTMLElement;
  textLayer: HTMLElement;
  /** False while the page is still an empty placeholder. */
  rendered: boolean;
  /** The in-flight pdf.js render, kept so a zoom can cancel it. */
  task?: { cancel: () => void } | null;
  /**
   * Fraction of the full pixel ratio this page is drawn at: a scroll or a zoom
   * lands a cheap draft first, and the sharp pass follows once things settle.
   */
  quality: number;
};

export type PdfOptions = { scale: number; rotation: number };

/**
 * `gpu` hands the canvas to the compositor unsynchronised and draws at the
 * screen's full pixel ratio; the default keeps both down, which is most of
 * the cost of a page.
 */
export type RenderMode = "cpu" | "gpu";

/** Pixels per canvas, past which a page costs more than it looks better. */
const BUDGET: Record<RenderMode, number> = { cpu: 4e6, gpu: 12e6 };

/** Pages kept drawn on either side of the screen; the rest are thrown away. */
const KEEP = 4;

/** Ratio multiplier for the draft pass; the sharp pass is 1. */
export const DRAFT = 0.5;

/**
 * Device pixels per CSS pixel for this page: the screen's ratio, pulled down
 * until the canvas fits the budget. A zoomed-in A4 page at ratio 2 is 30M
 * pixels, which is seconds of CPU and 120MB of canvas for no visible gain.
 */
export function pixelRatio(
  viewport: { width: number; height: number },
  mode: RenderMode,
) {
  const ratio = mode === "gpu" ? globalThis.devicePixelRatio || 1 : 1;
  const area = Math.max(1, viewport.width * viewport.height);

  // Floor: a page drawn under half-resolution is unreadable, so past this the
  // budget gives way rather than the text.
  return Math.max(0.5, Math.min(ratio, Math.sqrt(BUDGET[mode] / area)));
}

export async function loadPdf(data: ArrayBuffer): Promise<PdfDocument> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");

  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  // Copied into `public/pdfjs` by the `pdfjs` script: without these, pages
  // with JPEG 2000 images or CJK text fail to decode.
  return pdfjs.getDocument({
    data,
    wasmUrl: "/pdfjs/wasm/",
    iccUrl: "/pdfjs/iccs/",
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  }).promise;
}

/** The scale that fits a page to `width`, before the reader's own zoom. */
export async function fitScale(document_: PdfDocument, width: number) {
  const page = await document_.getPage(1);

  return Math.max(0.2, (width - 32) / page.getViewport({ scale: 1 }).width);
}

function sizeOf(
  wrapper: HTMLElement,
  size: { width: number; height: number; scale: number },
) {
  wrapper.style.width = `${Math.floor(size.width)}px`;
  wrapper.style.height = `${Math.floor(size.height)}px`;
  // The pdf.js text layer positions its spans against this.
  wrapper.style.setProperty("--total-scale-factor", String(size.scale));
}

/**
 * Lays out one empty, correctly sized placeholder per page. Pages are drawn
 * only once they scroll near the viewport, so a thousand-page book opens as
 * fast as a one-page one.
 */
export async function buildPages(
  document_: PdfDocument,
  host: HTMLElement,
  options: PdfOptions,
): Promise<PdfPage[]> {
  const estimate = (await document_.getPage(1)).getViewport(options);
  const pages: PdfPage[] = [];

  host.replaceChildren();

  for (let number = 1; number <= document_.numPages; number++) {
    const wrapper = document.createElement("div");
    const textLayer = document.createElement("div");

    wrapper.className = "ms-readable-page";
    wrapper.dataset.page = String(number);
    textLayer.className = "textLayer";
    sizeOf(wrapper, estimate);
    wrapper.append(textLayer);
    host.append(wrapper);
    pages.push({
      number,
      wrapper,
      textLayer,
      rendered: false,
      task: null,
      quality: 0,
    });
  }

  return pages;
}

/**
 * Draws one page: a canvas with a selectable text layer on top, so copying,
 * searching and highlighting all work against real text.
 */
async function renderPage(
  document_: PdfDocument,
  entry: PdfPage,
  options: PdfOptions,
  mode: RenderMode,
  quality: number,
  raster: Raster | null,
) {
  const { TextLayer } = await import("pdfjs-dist");
  const page = await document_.getPage(entry.number);
  const viewport = page.getViewport(options);
  // Draw at device resolution, lay out at CSS resolution: on a HiDPI screen
  // a 1:1 canvas looks blurry. The draft pass goes below that on purpose.
  const ratio = pixelRatio(viewport, mode) * quality;
  const canvas = document.createElement("canvas");

  sizeOf(entry.wrapper, viewport);
  canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
  canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const drawn = raster
    ? await rasterise(raster, entry, canvas, { ...options, ratio })
    : await paint(page, entry, canvas, viewport, ratio, mode);

  if (!drawn) {
    entry.quality = 0;
    entry.rendered = false;

    return;
  }

  // Swap the old canvas out only now: a draft stays on screen until its sharp
  // replacement is finished, so a zoom never flashes white.
  entry.wrapper.querySelector("canvas")?.remove();
  entry.wrapper.prepend(canvas);
  entry.quality = quality;

  // The text layer follows the viewport, not the pixel ratio, so the sharp
  // pass reuses what the draft already laid out.
  if (!entry.textLayer.childElementCount) {
    await new TextLayer({
      textContentSource: page.streamTextContent(),
      container: entry.textLayer,
      viewport,
    }).render();
  }
}

/** Off-thread draw: the worker returns a bitmap, this only blits it. */
async function rasterise(
  raster: Raster,
  entry: PdfPage,
  canvas: HTMLCanvasElement,
  request: { scale: number; rotation: number; ratio: number },
) {
  entry.task = { cancel: () => raster.cancel() };
  try {
    const bitmap = await raster.draw({ number: entry.number, ...request });

    canvas.getContext("bitmaprenderer")?.transferFromImageBitmap(bitmap);

    return true;
  } catch {
    // A cancelled or failed worker draw simply leaves the page for the next
    // pass; the caller falls back to the main thread if the worker is gone.
    return false;
  } finally {
    entry.task = null;
  }
}

/** The main-thread draw, used where the worker is unavailable. */
async function paint(
  page: any,
  entry: PdfPage,
  canvas: HTMLCanvasElement,
  viewport: any,
  ratio: number,
  mode: RenderMode,
) {
  // No alpha: the page is opaque, and a transparent canvas costs a blend on
  // every composite. `desynchronized` skips the compositor's frame lock.
  const context = canvas.getContext("2d", {
    alpha: false,
    desynchronized: mode === "gpu",
  });

  if (!context) {
    return false;
  }

  const task = page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
  });

  entry.task = task;
  try {
    await task.promise;

    return true;
  } catch (cause: any) {
    // A cancelled render is the normal outcome of zooming mid-draw.
    if (cause?.name !== "RenderingCancelledException") {
      throw cause;
    }

    return false;
  } finally {
    entry.task = null;
  }
}

/**
 * Page tops, measured once per layout: asking the DOM for 800 offsets on every
 * scroll is what makes a big book feel heavy.
 */
export function measurePages(host: HTMLElement, pages: PdfPage[]) {
  return pages.map((entry) => entry.wrapper.offsetTop - host.offsetTop);
}

/** Index of the last page whose top is at or above `y`. */
export function pageIndexAt(offsets: number[], y: number) {
  let low = 0;
  let high = offsets.length - 1;

  while (low < high) {
    const middle = Math.ceil((low + high) / 2);

    if (offsets[middle] <= y) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }

  return low;
}

/** Throws away the canvases far from the screen; they redraw on the way back. */
function prune(pages: PdfPage[], first: number, last: number) {
  for (const [index, entry] of pages.entries()) {
    if (entry.rendered && (index < first - KEEP || index > last + KEEP)) {
      entry.task?.cancel();
      entry.task = null;
      entry.rendered = false;
      entry.quality = 0;
      entry.wrapper.querySelector("canvas")?.remove();
      entry.textLayer.replaceChildren();
    }
  }
}

/**
 * Renders the pages within one screen of the viewport, and no others, at
 * `quality` — anything already drawn that sharp is left alone.
 */
export async function renderVisible(
  document_: PdfDocument,
  host: HTMLElement,
  pages: PdfPage[],
  offsets: number[],
  options: PdfOptions,
  mode: RenderMode = "cpu",
  quality = 1,
  raster: Raster | null = null,
) {
  const first = pageIndexAt(offsets, host.scrollTop - host.clientHeight);
  const last = pageIndexAt(offsets, host.scrollTop + host.clientHeight * 2);
  let drew = false;

  prune(pages, first, last);

  for (const entry of pages.slice(first, last + 1)) {
    if (entry.quality < quality) {
      entry.rendered = true;
      await renderPage(document_, entry, options, mode, quality, raster);
      drew = true;
    }
  }

  return drew;
}

/** Resizes every placeholder and drops what was drawn, after a zoom or turn. */
export async function resetPages(
  document_: PdfDocument,
  pages: PdfPage[],
  options: PdfOptions,
) {
  const estimate = (await document_.getPage(1)).getViewport(options);

  for (const entry of pages) {
    entry.task?.cancel();
    entry.task = null;
    entry.rendered = false;
    entry.quality = 0;
    entry.wrapper.querySelector("canvas")?.remove();
    entry.textLayer.replaceChildren();
    sizeOf(entry.wrapper, estimate);
  }
}
