const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
import { applyIssue, issueRange, parseReport, scoreLabel } from "./grammar";

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

console.log("grammar ok");
