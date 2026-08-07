const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
import {
  applyIssue,
  checkPrompt,
  wordCount,
  GRAMMAR_MODES,
  isGrammarMode,
  issueRange,
  parseReport,
  scoreLabel,
  systemPromptFor,
} from "./grammar";

const raw = `\`\`\`json
{"score": 82, "summary": "Mostly clean.", "issues": [
  {"kind": "mistake", "excerpt": "teh cat", "replacement": "the cat", "message": "Typo"},
  {"kind": "bogus", "excerpt": "very big", "replacement": "huge", "message": "Tighter"},
  {"kind": "mistake", "replacement": "x", "message": "no excerpt"}
]}
\`\`\``;

const report = parseReport(raw);

assert(report.score === 82, "score survives the fence");
assert(report.summary === "Mostly clean.", "summary is kept");
assert(report.issues.length === 2, "issues without an excerpt are dropped");
assert(report.issues[1].kind === "suggestion", "unknown kinds fall back to suggestion");

assert(parseReport('{"score": 150, "issues": []}').score === 100, "score is clamped");
assert(parseReport('Sure! {"score": 5, "issues": []} hope that helps').score === 5, "surrounding prose is ignored");
assert(parseReport('{"score": "nope"}').score === 0, "a missing score reads as 0");

let threw = false;
try {
  parseReport("not json at all");
} catch {
  threw = true;
}
assert(threw, "an unreadable reply throws");

const text = "I saw teh cat and teh dog.";

assert(applyIssue(text, report.issues[0]) === "I saw the cat and teh dog.", "only the first match is replaced");
assert(applyIssue(text, { ...report.issues[0], excerpt: "missing" }) === null, "a stale excerpt applies nothing");
assert(issueRange(text, report.issues[0])?.start === 6, "range points at the excerpt");
assert(issueRange(text, { ...report.issues[0], excerpt: "missing" }) === null, "a stale excerpt has no range");

assert(scoreLabel(95) === "Excellent" && scoreLabel(10) === "Rough", "score labels bucket by band");

assert(parseReport('{"score": 70, "rating": " Band 6.5 ", "issues": []}').rating === "Band 6.5", "rating is trimmed");
assert(parseReport('{"score": 70, "issues": []}').rating === "", "a missing rating is empty");

assert(GRAMMAR_MODES.map((entry) => entry.id).join() === "normal,ielts,toefl,beginner", "every coach is listed");
assert(isGrammarMode("ielts") && !isGrammarMode("pirate"), "only known modes validate");

for (const entry of GRAMMAR_MODES) {
  const prompt = systemPromptFor(entry.id);

  assert(prompt.includes(entry.brief), `${entry.id} prompt carries its brief`);
  assert(prompt.includes('"score": 0-100'), `${entry.id} prompt keeps the JSON contract`);
}

assert(systemPromptFor("bogus" as never) === systemPromptFor("normal"), "an unknown mode falls back to normal");

assert(wordCount("  one  two\nthree ") === 3, "words split on any whitespace");
assert(wordCount("   ") === 0, "blank text has no words");

const asked = checkPrompt("Some essay text here.", "Do you agree?", "250");

assert(asked.includes("Task the note answers:\nDo you agree?"), "the task is stated first");
assert(asked.includes("4 words against a target of 250"), "actual and target length are both given");
assert(asked.endsWith("Note:\nSome essay text here."), "the note comes last, unmodified");

const bare = checkPrompt("Two words");

assert(!bare.includes("Task the note answers"), "no task means no task section");
assert(bare.includes("Length: 2 words."), "length is always reported");
assert(!checkPrompt("hi", "", "0").includes("target"), "a zero target is ignored");
assert(!checkPrompt("hi", "", "soon").includes("target"), "a junk target is ignored");

console.log("grammar ok");
