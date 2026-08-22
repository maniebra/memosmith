import { invoke } from "@tauri-apps/api/core";
import { appLogDir } from "@tauri-apps/api/path";

/** Debug journal: timestamped lines appended to a rotating file. */
const LOG_FILE = "memosmith.log";
const MAX_BYTES = 1_000_000;
/** Long values are cut so one call cannot fill the file. */
const MAX_VALUE = 200;

let directory: Promise<string> = appLogDir().catch(() => "/tmp");

/** Empty falls back to the app log folder. */
export function setJournalDir(dir: string) {
  directory = dir ? Promise.resolve(dir) : appLogDir().catch(() => "/tmp");
}

function describe(value: unknown): string {
  if (value instanceof Error) {
    return `${value.message}\n${value.stack ?? ""}`;
  }
  if (typeof value === "function") {
    return "[function]";
  }
  if (value instanceof Element) {
    return `<${value.tagName.toLowerCase()}>`;
  }
  let text: string;
  try {
    text = JSON.stringify(value) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE)}…` : text;
}

export function journal(event: string, data: Record<string, unknown> = {}) {
  const stamp = new Date().toISOString().slice(11, 23);
  const detail = Object.entries(data)
    .map(([key, value]) => `${key}=${describe(value)}`)
    .join(" ");
  const line = `${stamp} ${event}${detail ? ` ${detail}` : ""}`;

  void directory
    .then((dir) =>
      invoke("append_log", {
        path: `${dir}/${LOG_FILE}`,
        line,
        maxBytes: MAX_BYTES,
      }),
    )
    .catch(() => {});
}

/**
 * Wraps every function on an actions object so each call, and anything it
 * throws, lands in the journal without a log line per call site.
 */
export function traced<T extends Record<string, unknown>>(
  namespace: string,
  actions: T,
): T {
  const wrapped = Object.entries(actions).map(([name, value]) => {
    if (typeof value !== "function") {
      return [name, value] as const;
    }
    const call = value as (...args: unknown[]) => unknown;
    return [
      name,
      (...args: unknown[]) => {
        journal(`${namespace}.${name}`, { args });
        try {
          const result = call(...args);
          if (result instanceof Promise) {
            return result.catch((error: unknown) => {
              journal(`${namespace}.${name}:threw`, { error });
              throw error;
            });
          }
          return result;
        } catch (error) {
          journal(`${namespace}.${name}:threw`, { error });
          throw error;
        }
      },
    ] as const;
  });

  return Object.fromEntries(wrapped) as T;
}

window.addEventListener("error", (event) =>
  journal("window:error", { message: event.message, error: event.error }),
);
window.addEventListener("unhandledrejection", (event) =>
  journal("window:rejection", { reason: event.reason }),
);
