import type { RasterReply } from "./readerPdfRaster.worker";

type Waiter = {
  resolve: (bitmap: ImageBitmap) => void;
  reject: (cause: Error) => void;
};

/** Hands one worker reply to whoever is waiting on it. */
function settle(
  message: RasterReply,
  pending: Map<number, Waiter>,
  hooks: {
    opened: (() => void) | null;
    broke: ((cause: Error) => void) | null;
    onFatal: () => void;
  },
) {
  if (message.type === "opened") {
    hooks.opened?.();

    return;
  }

  if (message.type === "drawn") {
    pending.get(message.id)?.resolve(message.bitmap);
  } else {
    const failure = new Error(message.message);

    // A cancelled draw is routine; anything else means no worker at all.
    if (!message.cancelled) {
      hooks.broke?.(failure);
      hooks.onFatal();
    }

    pending.get(message.id)?.reject(failure);
  }

  pending.delete(message.id);
}

export type Raster = {
  ready: Promise<void>;
  draw(request: {
    number: number;
    scale: number;
    rotation: number;
    ratio: number;
  }): Promise<ImageBitmap>;
  cancel(): void;
  close(): void;
};

/**
 * Starts the raster worker over a copy of the file.
 *
 * ponytail: the worker parses the document a second time, which costs the
 * file's bytes twice over — the main-thread document is still what the text
 * layer, the outline and the search read. Proxying those through the worker
 * too would drop back to one parse, at the price of a message for every
 * text-content call.
 */
export function startRaster(
  data: ArrayBuffer,
  onFatal: () => void = () => {},
): Raster | null {
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return null;
  }

  const worker = new Worker(
    new URL("./readerPdfRaster.worker.ts", import.meta.url),
    { type: "module" },
  );
  const pending = new Map<number, Waiter>();
  let next = 1;
  let opened: (() => void) | null = null;
  let broke: ((cause: Error) => void) | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    opened = resolve;
    broke = reject;
  });

  worker.onmessage = (event: MessageEvent<RasterReply>) =>
    settle(event.data, pending, { opened, broke, onFatal });
  worker.onerror = () => {
    broke?.(new Error("the raster worker died"));
    onFatal();
  };
  // A copy, transferred: the main-thread document keeps the original buffer.
  const copy = data.slice(0);

  worker.postMessage({ type: "open", data: copy }, [copy]);

  return {
    ready,
    draw(request) {
      const id = next++;

      return new Promise<ImageBitmap>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: "render", id, ...request });
      });
    },
    cancel() {
      for (const id of pending.keys()) {
        worker.postMessage({ type: "cancel", id });
      }
    },
    close() {
      worker.postMessage({ type: "close" });
      worker.terminate();
    },
  };
}
