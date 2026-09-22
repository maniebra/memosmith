import type { OutlineItem, SearchHit } from "./reader";
import type { PdfDocument } from "./readerPdf";

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

    // The scan touches every page; without this each one keeps its parsed
    // fonts and operator list alive for the rest of the session.
    page.cleanup();

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
