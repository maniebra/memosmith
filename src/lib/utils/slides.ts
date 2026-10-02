/**
 * Cuts a flat run of blocks into slides, a new one at every block `isStart` picks. Anything
 * before the first start keeps its own slide, unless it is blank.
 */
export function splitSlides<T>(
  blocks: T[],
  isStart: (block: T) => boolean,
  isBlank: (block: T) => boolean,
): T[][] {
  const slides: T[][] = [];

  for (const block of blocks) {
    if (isStart(block) || !slides.length) {
      slides.push([]);
    }
    slides[slides.length - 1].push(block);
  }

  return slides.filter((slide) => !slide.every(isBlank));
}

/** A slide's own blocks and the speaker notes that trail them. */
export type Slide<T> = { content: T[]; notes: T[] };

/** Everything from the first `isNote` block on is speaker notes, kept off the slide. */
export function splitNotes<T>(
  blocks: T[],
  isNote: (block: T) => boolean,
): Slide<T> {
  const start = blocks.findIndex(isNote);
  return start < 0
    ? { content: blocks, notes: [] }
    : { content: blocks.slice(0, start), notes: blocks.slice(start) };
}

/** `Note:` or `Notes:` opening a line marks speaker notes, as in reveal.js. */
export const NOTE_MARKER = /^\s*notes?:/i;
