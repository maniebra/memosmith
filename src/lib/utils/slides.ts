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
