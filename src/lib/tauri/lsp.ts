import { invoke } from "@tauri-apps/api/core";
import type { LspSettings } from "../storage/settings";
import type { Completion } from "../utils/lsp";
import { kernelFor } from "../utils/runner";

export function completeCode(
  session: string,
  language: string,
  code: string,
  line: number,
  character: number,
  lsp: LspSettings,
) {
  const kernel = kernelFor(language);

  return invoke<Completion[]>("lsp_complete", {
    session,
    language,
    code,
    line,
    character,
    command: kernel ? lsp.commands[kernel] : "",
  });
}

export function resetLanguageServers() {
  return invoke("reset_language_servers");
}

/** Resolved server command per language, empty when the server is missing. */
export function detectLanguageServers(lsp: LspSettings) {
  return invoke<Record<string, string>>("detect_language_servers", { commands: lsp.commands });
}
