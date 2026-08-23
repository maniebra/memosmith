import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";

/**
 * Prints the live webview straight to a PDF file — no print dialog, no second renderer,
 * so the file matches the preview exactly. Returns the path, or null if the user cancelled.
 */
export async function exportPdf(suggestedName: string): Promise<string | null> {
  const path = await save({
    defaultPath: `${suggestedName || "note"}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!path) {
    return null;
  }

  // The webview prints itself, so a focused editor would bake its caret and focus ring
  // into the file.
  (document.activeElement as HTMLElement | null)?.blur();
  window.getSelection()?.removeAllRanges();

  await invoke<string>("export_pdf", {
    path: path.toLowerCase().endsWith(".pdf") ? path : `${path}.pdf`,
  });

  return path;
}
