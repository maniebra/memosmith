import { invoke } from "@tauri-apps/api/core";

/** Temporary debug journal: timestamped lines appended to a rotating file. */
const JOURNAL_PATH = "/tmp/memosmith-journal.log";
const MAX_BYTES = 1_000_000;

export function journal(event: string, data: Record<string, unknown> = {}) {
  const stamp = new Date().toISOString().slice(11, 23);
  const detail = Object.entries(data)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
  const line = `${stamp} ${event}${detail ? ` ${detail}` : ""}`;

  void invoke("append_log", {
    path: JOURNAL_PATH,
    line,
    maxBytes: MAX_BYTES,
  }).catch(() => {});
}
