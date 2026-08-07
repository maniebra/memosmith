export type GrammarIssue = {
  kind: "mistake" | "suggestion";
  excerpt: string;
  replacement: string;
  message: string;
};

export type GrammarReport = {
  score: number;
  rating: string;
  summary: string;
  issues: GrammarIssue[];
};

export type GrammarMode = "normal" | "ielts" | "toefl" | "beginner";

export const GRAMMAR_MODES: { id: GrammarMode; label: string; brief: string }[] = [
  {
    id: "normal",
    label: "Normal",
    brief: `Proofread as a careful editor. Leave "rating" empty.`,
  },
  {
    id: "ielts",
    label: "IELTS Coach",
    brief: `Mark the note as an IELTS Writing examiner: task response, coherence and cohesion, lexical resource, grammatical range and accuracy.
Set "rating" to the estimated band, like "Band 6.5", and name the weakest criterion in the summary.
Phrase suggestions as the band-raising move they are, and prefer academic register.`,
  },
  {
    id: "toefl",
    label: "TOEFL Coach",
    brief: `Mark the note as a TOEFL iBT Writing rater: development, organization, and language use.
Set "rating" to the estimated score out of 30, like "24/30", and say in the summary what caps it there.
Point out repetition, weak topic sentences, and missing transitions as suggestions.`,
  },
  {
    id: "beginner",
    label: "Beginner Coach",
    brief: `Coach a beginner learner. Use simple words in every message and explain the rule in one short sentence a learner can remember.
Set "rating" to a rough CEFR level, like "A2". Be encouraging, report the clearest mistakes first, and never flag stylistic nitpicks.`,
  },
];

export function systemPromptFor(mode: GrammarMode) {
  const brief = (GRAMMAR_MODES.find((entry) => entry.id === mode) ?? GRAMMAR_MODES[0]).brief;

  return `You are Grammar Police, a proofreader for markdown notes.
Reply with JSON only, no prose and no code fence, shaped like:
{"score": 0-100, "rating": "short label or empty", "summary": "one short sentence", "issues": [{"kind": "mistake" | "suggestion", "excerpt": "text exactly as it appears in the note", "replacement": "the corrected text", "message": "why"}]}
"mistake" is grammar, spelling, or punctuation that is wrong; "suggestion" is clarity, tone, or wording that could be better.
"excerpt" must be copied character for character from the note and be short enough to be unique.
"score" is always 0-100 where 100 means flawless writing, whatever "rating" says. Leave "issues" empty when the note is already clean.
Never rewrite markdown syntax, links, code blocks, or math.

${brief}`;
}

export function wordCount(text: string) {
  const trimmed = text.trim();

  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Band scoring depends on the question the note answers and on how long it is,
 * so both are stated up front rather than left for the model to guess.
 */
export function checkPrompt(text: string, task = "", wordTarget = "") {
  const target = Number(wordTarget.trim());
  const words = wordCount(text);
  const header: string[] = [];

  if (task.trim()) {
    header.push(`Task the note answers:\n${task.trim()}`);
  }

  header.push(
    Number.isFinite(target) && target > 0
      ? `Length: ${words} words against a target of ${target}. Judge the note against that target and say so if it misses.`
      : `Length: ${words} words.`,
  );

  return `${header.join("\n\n")}\n\nNote:\n${text}`;
}

export function isGrammarMode(value: unknown): value is GrammarMode {
  return GRAMMAR_MODES.some((entry) => entry.id === value);
}

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
  let parsed: { score?: unknown; rating?: unknown; summary?: unknown; issues?: unknown };

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
    rating: typeof parsed.rating === "string" ? parsed.rating.trim() : "",
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
