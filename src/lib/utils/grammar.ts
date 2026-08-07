export type GrammarIssue = {
  kind: "mistake" | "suggestion";
  excerpt: string;
  replacement: string;
  message: string;
};

export type GrammarReport = {
  score: number;
  summary: string;
  issues: GrammarIssue[];
};

export const GRAMMAR_SYSTEM_PROMPT = `You are Grammar Police, a proofreader for markdown notes.
Reply with JSON only, no prose and no code fence, shaped like:
{"score": 0-100, "summary": "one short sentence", "issues": [{"kind": "mistake" | "suggestion", "excerpt": "text exactly as it appears in the note", "replacement": "the corrected text", "message": "why"}]}
"mistake" is grammar, spelling, or punctuation that is wrong; "suggestion" is clarity, tone, or wording that could be better.
"excerpt" must be copied character for character from the note and be short enough to be unique.
Score 100 means flawless writing. Leave "issues" empty when the note is already clean.
Never rewrite markdown syntax, links, code blocks, or math.`;

export const EXPLAIN_SYSTEM_PROMPT = `You are Grammar Police explaining one of your own notes to a writer.
Answer in at most three short sentences: name the rule or writing principle, say why the original text breaks it, and why the replacement is better.
Plain prose, no lists, no JSON, no markdown headings.`;

export function explainPrompt(issue: GrammarIssue) {
  return [
    `Kind: ${issue.kind}`,
    `Original: ${issue.excerpt}`,
    `Suggested: ${issue.replacement || "(no replacement)"}`,
    `Short note: ${issue.message || "(none)"}`,
  ].join("\n");
}

/** Models like wrapping JSON in a fence despite being asked not to. */
function jsonPayload(raw: string) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  const text = (fenced?.[1] ?? raw).trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  return start === -1 || end === -1 ? text : text.slice(start, end + 1);
}

function toIssue(value: unknown): GrammarIssue | null {
  const issue = (value ?? {}) as Partial<GrammarIssue>;

  if (typeof issue.excerpt !== "string" || !issue.excerpt) {
    return null;
  }

  return {
    kind: issue.kind === "mistake" ? "mistake" : "suggestion",
    excerpt: issue.excerpt,
    replacement: typeof issue.replacement === "string" ? issue.replacement : "",
    message: typeof issue.message === "string" ? issue.message : "",
  };
}

export function parseReport(raw: string): GrammarReport {
  let parsed: { score?: unknown; summary?: unknown; issues?: unknown };

  try {
    parsed = JSON.parse(jsonPayload(raw));
  } catch {
    throw new Error("Grammar Police got an unreadable reply from the model");
  }

  const score = Number(parsed.score);
  const issues = (Array.isArray(parsed.issues) ? parsed.issues : [])
    .map(toIssue)
    .filter((issue): issue is GrammarIssue => issue !== null);

  return {
    score: Number.isFinite(score) ? Math.min(100, Math.max(0, Math.round(score))) : 0,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
    issues,
  };
}

/** Excerpts are matched literally, so an edited note simply stops matching. */
export function applyIssue(text: string, issue: GrammarIssue) {
  const at = text.indexOf(issue.excerpt);

  return at === -1 ? null : text.slice(0, at) + issue.replacement + text.slice(at + issue.excerpt.length);
}

export function issueRange(text: string, issue: GrammarIssue) {
  const at = text.indexOf(issue.excerpt);

  return at === -1 ? null : { start: at, end: at + issue.excerpt.length };
}

export function scoreLabel(score: number) {
  return score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 50 ? "Needs work" : "Rough";
}
