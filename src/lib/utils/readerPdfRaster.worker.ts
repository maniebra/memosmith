/**
 * Draws PDF pages off the main thread.
 *
 * pdf.js parses in its own worker but rasterises wherever its document lives,
 * so a heavy page freezes the UI. This worker keeps a second document of its
 * own and hands back finished `ImageBitmap`s; the main thread only blits them.
 * Fonts are drawn as glyph paths (`disableFontFace`) because the FontFace API
 * needs a document, which a worker has not got.
 */
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

export type RasterRequest =
  | { type: "open"; data: ArrayBuffer }
  | {
      type: "render";
      id: number;
      number: number;
      scale: number;
      rotation: number;
      ratio: number;
    }
  | { type: "cancel"; id: number }
  | { type: "close" };

export type RasterReply =
  | { type: "opened" }
  | { type: "drawn"; id: number; bitmap: ImageBitmap }
  | { type: "failed"; id: number; message: string; cancelled: boolean };

const tasks = new Map<number, { cancel: () => void }>();
let document_: any = null;
/** Renders can arrive before the file is open; they wait on this. */
let opening: Promise<void> | null = null;

function reply(message: RasterReply, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(message, transfer);
}

async function open(data: ArrayBuffer) {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loading = pdfjs.getDocument({
    data,
    disableFontFace: true,
    wasmUrl: "/pdfjs/wasm/",
    iccUrl: "/pdfjs/iccs/",
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
  }).promise;

  opening = loading.then((opened: any) => {
    document_ = opened;
  });
  await opening;
  reply({ type: "opened" });
}

async function draw(request: Extract<RasterRequest, { type: "render" }>) {
  await opening;

  if (!document_) {
    throw new Error("render before open");
  }

  const page = await document_.getPage(request.number);
  const viewport = page.getViewport({
    scale: request.scale,
    rotation: request.rotation,
  });
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.floor(viewport.width * request.ratio)),
    Math.max(1, Math.floor(viewport.height * request.ratio)),
  );
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("no 2d context in the raster worker");
  }

  const task = page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform:
      request.ratio === 1
        ? undefined
        : [request.ratio, 0, 0, request.ratio, 0, 0],
  });

  tasks.set(request.id, task);
  try {
    await task.promise;
  } finally {
    tasks.delete(request.id);
  }

  const bitmap = canvas.transferToImageBitmap();

  reply({ type: "drawn", id: request.id, bitmap }, [bitmap]);
}

self.onmessage = async (event: MessageEvent<RasterRequest>) => {
  const request = event.data;

  try {
    if (request.type === "open") {
      await open(request.data);
    } else if (request.type === "render") {
      await draw(request);
    } else if (request.type === "cancel") {
      tasks.get(request.id)?.cancel();
    } else {
      await document_?.destroy();
      self.close();
    }
  } catch (cause: any) {
    reply({
      type: "failed",
      id: request.type === "render" ? request.id : 0,
      message: String(cause?.message ?? cause),
      // Cancelling a draw is routine; anything else means the worker cannot
      // draw at all and the reader falls back to the main thread.
      cancelled: cause?.name === "RenderingCancelledException",
    });
  }
};
