import { convertFileSrc, invoke } from "@tauri-apps/api/core";

/**
 * The reader libraries get bytes rather than a URL, because pdf.js only
 * fetches http(s) and epub.js sniffs the format from the file name. The asset
 * protocol streams them; the command is the fallback, and moves every byte
 * through the IPC bridge, so it is slow for a large book.
 */
export async function readFileBytes(path: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(convertFileSrc(path));

    if (response.ok) {
      return await response.arrayBuffer();
    }
  } catch {
    // Falls through to the command below.
  }

  return new Uint8Array(await invoke<number[]>("read_binary", { path })).buffer;
}
