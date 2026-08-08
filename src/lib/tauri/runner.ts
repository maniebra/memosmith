import { invoke } from "@tauri-apps/api/core";
import type { RunnerSettings } from "../storage/settings";
import { kernelFor } from "../utils/runner";

export type RunOutput = {
  output: string;
  status: number;
  timedOut: boolean;
};

export function runCode(
  session: string,
  language: string,
  code: string,
  runner: RunnerSettings,
) {
  const kernel = kernelFor(language);

  return invoke<RunOutput>("run_code", {
    session,
    language,
    code,
    command: kernel ? runner.commands[kernel] : "",
    timeoutMs: Number(runner.timeoutMs) || null,
  });
}

export function resetSession(session: string, language: string) {
  return invoke("reset_session", { session, language });
}

/** Resolved command per kernel, empty when the runtime is missing. */
export function detectRuntimes(runner: RunnerSettings) {
  return invoke<Record<string, string>>("detect_runtimes", { commands: runner.commands });
}
