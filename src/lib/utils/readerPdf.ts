import type { OutlineItem, SearchHit } from "./reader";

export type PdfDocument = any;

export type PdfPage = {
  /** 1-based page number. */
  number: number;
  wrapper: HTMLElement;
  textLayer: HTMLElement;
  /** False while the page is still an empty placeholder. */
  rendered: boolean;
};

export type PdfOptions = { scale: number; rotation: number };

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
    pages.push({ number, wrapper, textLayer, rendered: false });
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
) {
  const { TextLayer } = await import("pdfjs-dist");
  const page = await document_.getPage(entry.number);
  const viewport = page.getViewport(options);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  // Draw at device resolution, lay out at CSS resolution: on a HiDPI screen
  // a 1:1 canvas looks blurry.
  const ratio = window.devicePixelRatio || 1;

  sizeOf(entry.wrapper, viewport);
  canvas.width = Math.floor(viewport.width * ratio);
  canvas.height = Math.floor(viewport.height * ratio);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  entry.wrapper.prepend(canvas);
  entry.textLayer.replaceChildren();

  if (!context) {
    return;
  }

  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
  }).promise;
  await new TextLayer({
    textContentSource: page.streamTextContent(),
    container: entry.textLayer,
    viewport,
  }).render();
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

/** Renders the pages within one screen of the viewport, and no others. */
export async function renderVisible(
  document_: PdfDocument,
  host: HTMLElement,
  pages: PdfPage[],
  offsets: number[],
  options: PdfOptions,
) {
  const first = pageIndexAt(offsets, host.scrollTop - host.clientHeight);
  const last = pageIndexAt(offsets, host.scrollTop + host.clientHeight * 2);
  let drew = false;

  for (const entry of pages.slice(first, last + 1)) {
    if (!entry.rendered) {
      entry.rendered = true;
      await renderPage(document_, entry, options);
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
    entry.rendered = false;
    entry.wrapper.querySelector("canvas")?.remove();
    entry.textLayer.replaceChildren();
    sizeOf(entry.wrapper, estimate);
  }
}

async function outlineItems(
  document_: PdfDocument,
  entries: any[],
  depth: number,
): Promise<OutlineItem[]> {
  const items: OutlineItem[] = [];

  for (const entry of entries) {
    const destination =
      typeof entry.dest === "string"
        ? await document_.getDestination(entry.dest)
        : entry.dest;
    const index = destination
      ? await document_.getPageIndex(destination[0]).catch(() => null)
      : null;

    items.push({
      label: entry.title || "—",
      location: String((index ?? 0) + 1),
      depth,
    });
    items.push(
      ...(await outlineItems(document_, entry.items ?? [], depth + 1)),
    );
  }

  return items;
}

export async function pdfOutline(document_: PdfDocument) {
  const outline = await document_.getOutline().catch(() => null);

  return outline ? outlineItems(document_, outline, 0) : [];
}

const SNIPPET = 40;

/** Page-by-page text scan; each hit carries its page and a bit of context. */
export async function searchPdf(
  document_: PdfDocument,
  query: string,
  limit = 200,
): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase();
  const hits: SearchHit[] = [];

  if (!needle) {
    return hits;
  }

  for (let number = 1; number <= document_.numPages; number++) {
    const page = await document_.getPage(number);
    const content = await page.getTextContent();
    const text = content.items.map((item: any) => item.str ?? "").join(" ");
    const haystack = text.toLowerCase();

    for (
      let at = haystack.indexOf(needle);
      at !== -1 && hits.length < limit;
      at = haystack.indexOf(needle, at + needle.length)
    ) {
      hits.push({
        label: `${number}`,
        location: String(number),
        excerpt: text
          .slice(Math.max(0, at - SNIPPET), at + needle.length + SNIPPET)
          .trim(),
      });
    }

    if (hits.length >= limit) {
      break;
    }
  }

  return hits;
}
