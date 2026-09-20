import type { OutlineItem, SearchHit } from "./reader";

export type PdfDocument = any;

export type PdfPage = {
  /** 1-based page number. */
  number: number;
  wrapper: HTMLElement;
  textLayer: HTMLElement;
};

export async function loadPdf(url: string): Promise<PdfDocument> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");

  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  return pdfjs.getDocument({ url }).promise;
}

/** The scale that fits a page to `width`, before the reader's own zoom. */
export async function fitScale(document_: PdfDocument, width: number) {
  const page = await document_.getPage(1);

  return Math.max(0.2, (width - 32) / page.getViewport({ scale: 1 }).width);
}

/**
 * Draws one page: a canvas with a selectable text layer on top, so copying,
 * searching and highlighting all work against real text.
 */
async function renderPage(
  document_: PdfDocument,
  number: number,
  options: { scale: number; rotation: number },
): Promise<PdfPage> {
  const { TextLayer } = await import("pdfjs-dist");
  const page = await document_.getPage(number);
  const viewport = page.getViewport(options);
  const wrapper = document.createElement("div");
  const canvas = document.createElement("canvas");
  const textLayer = document.createElement("div");

  wrapper.className = "ms-readable-page";
  wrapper.dataset.page = String(number);
  wrapper.style.width = `${Math.floor(viewport.width)}px`;
  wrapper.style.height = `${Math.floor(viewport.height)}px`;
  textLayer.className = "textLayer";
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  wrapper.append(canvas, textLayer);

  const context = canvas.getContext("2d");

  if (context) {
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    await new TextLayer({
      textContentSource: page.streamTextContent(),
      container: textLayer,
      viewport,
    }).render();
  }

  return { number, wrapper, textLayer };
}

/** Renders every page into `host`; big documents pay for it up front. */
export async function renderPdf(
  document_: PdfDocument,
  host: HTMLElement,
  options: { scale: number; rotation: number },
): Promise<PdfPage[]> {
  host.replaceChildren();
  const pages: PdfPage[] = [];

  // ponytail: eager full render; page virtualisation if large PDFs drag.
  for (let number = 1; number <= document_.numPages; number++) {
    const page = await renderPage(document_, number, options);

    host.append(page.wrapper);
    pages.push(page);
  }

  return pages;
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
