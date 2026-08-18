const HISTORY_KEY = "memosmith:commandHistory";
const HISTORY_LIMIT = 50;

export function loadCommandHistory(): string[] {
  const raw = localStorage.getItem(HISTORY_KEY);

  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

/** Most recent first, deduplicated, capped so the list cannot grow forever. */
export function recordCommandUse(id: string, history = loadCommandHistory()) {
  const next = [id, ...history.filter((entry) => entry !== id)].slice(
    0,
    HISTORY_LIMIT,
  );

  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}
