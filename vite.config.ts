import { cpSync, createReadStream, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

const host = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env?.TAURI_DEV_HOST;

const PDFJS_ROOT = "node_modules/pdfjs-dist";
/** Decoder wasm, its JS fallback, CMaps, ICC profiles and the base fonts. */
const PDFJS_DIRS = ["wasm", "cmaps", "standard_fonts", "iccs"];
const MIME: Record<string, string> = {
  ".wasm": "application/wasm",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".icc": "application/octet-stream",
  ".bcmap": "application/octet-stream",
};

/**
 * Serves pdf.js runtime data at `/pdfjs/`. It cannot live in `public/`: pdf.js
 * imports the decoder fallback as a module, which the dev server refuses for
 * public files.
 */
function pdfjsAssets() {
  return {
    name: "pdfjs-assets",
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          handler: (
            request: IncomingMessage,
            response: ServerResponse,
            next: () => void,
          ) => void,
        ) => void;
      };
    }) {
      server.middlewares.use("/pdfjs", (request, response, next) => {
        const path = normalize(join(PDFJS_ROOT, request.url ?? ""));
        const file = path.startsWith(normalize(PDFJS_ROOT))
          ? statSync(path, { throwIfNoEntry: false })
          : null;

        if (!file?.isFile()) {
          next();
          return;
        }

        response.setHeader(
          "Content-Type",
          MIME[extname(path)] ?? "application/octet-stream",
        );
        createReadStream(path).pipe(response);
      });
    },
    writeBundle() {
      for (const dir of PDFJS_DIRS) {
        cpSync(join(PDFJS_ROOT, dir), join("dist/pdfjs", dir), {
          recursive: true,
        });
      }
    },
  };
}

export default defineConfig(async () => ({
  plugins: [tailwindcss(), svelte(), pdfjsAssets()],
  clearScreen: false,
  build: { chunkSizeWarningLimit: 2000 },
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
