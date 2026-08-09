import type { LlmSettings } from "../storage/settings";

const NUMBER_FIELDS = [
  ["temperature", "temperature"],
  ["topP", "top_p"],
  ["maxTokens", "max_tokens"],
  ["presencePenalty", "presence_penalty"],
  ["frequencyPenalty", "frequency_penalty"],
  ["seed", "seed"],
] as const;

export const REASONING_LEVELS = [
  "",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
] as const;

/**
 * Empty fields are left out entirely: endpoints differ on which knobs they accept,
 * and sending an unsupported one is an error rather than a no-op.
 */
export function requestOptions(llm: LlmSettings) {
  const options: Record<string, unknown> = {};

  for (const [field, param] of NUMBER_FIELDS) {
    const raw = llm[field].trim();
    const parsed = Number(raw);

    if (raw && Number.isFinite(parsed)) {
      options[param] = parsed;
    }
  }

  if (llm.reasoningEffort.trim()) {
    options.reasoning_effort = llm.reasoningEffort.trim();
  }

  const stop = llm.stop
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (stop.length) {
    options.stop = stop;
  }

  return { ...options, ...extraBody(llm.extraBody) };
}

/** The escape hatch for provider-specific knobs (top_k, min_p, repetition_penalty, ...). */
function extraBody(raw: string) {
  if (!raw.trim()) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Extra body is not valid JSON");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Extra body must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}
