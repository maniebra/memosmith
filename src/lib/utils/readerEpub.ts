import type { OutlineItem, SearchHit } from "./reader";

export type EpubBook = any;

export async function loadEpub(data: ArrayBuffer): Promise<EpubBook> {
  const { default: ePub } = await import("epubjs");

  return ePub(data);
}

function tocItems(entries: any[], depth: number): OutlineItem[] {
  return entries.flatMap((entry) => [
    { label: entry.label?.trim() || "—", location: entry.href, depth },
    ...tocItems(entry.subitems ?? [], depth + 1),
  ]);
}

export async function epubOutline(book: EpubBook): Promise<OutlineItem[]> {
  await book.loaded.navigation;

  return tocItems(book.navigation.toc ?? [], 0);
}

/** Loads each spine item in turn and asks epub.js to find the query in it. */
export async function searchEpub(
  book: EpubBook,
  query: string,
  limit = 200,
): Promise<SearchHit[]> {
  const needle = query.trim();
  const hits: SearchHit[] = [];

  if (!needle) {
    return hits;
  }

  await book.ready;

  for (const item of book.spine.spineItems) {
    await item.load(book.load.bind(book));
    for (const found of item.find(needle) ?? []) {
      hits.push({
        label: item.idref ?? "",
        location: found.cfi,
        excerpt: (found.excerpt ?? "").trim(),
      });
    }
    item.unload();

    if (hits.length >= limit) {
      break;
    }
  }

  return hits.slice(0, limit);
}
