const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  EMPTY_QUIZ,
  EMPTY_QUIZ_ANSWER,
  EMPTY_QUIZ_BLANK,
  isMultiQuiz,
  parseQuiz,
  parseQuizState,
  quizFenceLine,
  quizExpectedFor,
  quizScore,
  quizVerdict,
  renderDocument,
  withQuizResponse,
} from "../../../src/lib/utils/markdown";

const quizOptions = { quizzes: true };

const quiz = parseQuiz(
  "What is **2 + 2**?\n- [x] 4\n- [ ] 5\n> Two plus two is four.\n> Really.",
);

assert(quiz.kind === "choice", "options make it a multiple choice quiz");
assert(quiz.question === "What is **2 + 2**?", "question is the text before the options");
assert(quiz.options.length === 2, "both options are parsed");
assert(quiz.options[0].correct && !quiz.options[1].correct, "only the [x] option is correct");
assert(
  quiz.explanation === "Two plus two is four.\nReally.",
  "quote lines become the explanation",
);
assert(!isMultiQuiz(quiz), "one correct option is a single-answer quiz");

const stray = parseQuiz("Q?\n- [ ] a\nloose note");
assert(stray.explanation === "loose note", "text after the options is kept as explanation");

const state = parseQuizState("|picked=2,0|checked");
assert(state.picked.join(",") === "2,0" && state.checked, "fence info carries the answer");
assert(
  quizFenceLine(state) === "```quiz|picked=0,2|checked",
  "the fence line round-trips the answer",
);
assert(
  quizFenceLine({ picked: [], checked: false }) === "```quiz",
  "an unanswered quiz keeps a bare fence",
);
assert(
  parseQuizState("").picked.length === 0 && !parseQuizState("").checked,
  "a bare fence is unanswered",
);

const html = renderDocument(EMPTY_QUIZ, undefined, quizOptions);
assert(html.includes("md-quiz-preview"), "a quiz fence gets a card");
assert((html.match(/md-quiz-line/g) ?? []).length === 6, "quiz source lines are collapsed");
assert(html.includes("data-quiz-correct"), "the correct option is marked in the card");
assert(!html.includes("data-quiz-answered"), "an unanswered quiz shows no verdict");
assert(!html.includes("md-quiz-reset"), "retry only appears once answered");
assert(!html.includes("md-quiz-check"), "a single-answer choice needs no check button");

const answered = renderDocument(
  EMPTY_QUIZ.replace("```quiz", "```quiz|picked=1|checked"),
  undefined,
  quizOptions,
);
assert(
  answered.includes('data-quiz-answered="wrong"'),
  "picking the wrong option marks the card wrong",
);
assert(answered.includes("data-quiz-picked"), "the picked option is marked");
assert(answered.includes("md-quiz-reset"), "an answered quiz offers a retry");

const multiSource = "Pick the even numbers\n- [x] 2\n- [ ] 3\n- [x] 4";
const multi = parseQuiz(multiSource);
assert(isMultiQuiz(multi), "two correct options make it multi-select");
assert(
  quizScore(multi, [0, 1]).hits === 1 && quizScore(multi, [0, 1]).misses === 1,
  "score counts hits and wrong picks",
);
assert(quizScore(multi, [0, 2]).perfect, "every correct option and nothing else is perfect");
assert(!quizScore(multi, [0]).perfect, "a missing correct option is not perfect");

const multiHtml = renderDocument(
  "```quiz|picked=0,2|checked\n" + multiSource + "\n```",
  undefined,
  quizOptions,
);
assert(multiHtml.includes("md-quiz-multi"), "multi-select cards are marked");
assert(multiHtml.includes("2 / 2 correct"), "the score is shown once checked");
assert(
  renderDocument("```quiz\n" + multiSource + "\n```", undefined, quizOptions).includes(
    "md-quiz-check",
  ),
  "an unchecked multi-select quiz offers a check button",
);

const blank = parseQuiz("Water freezes at [____] °C.\n= 0\n< 0\n> At sea level.");
assert(blank.kind === "blank", "a [____] question is a fill-in-the-blank");
assert(blank.expected.join() === "0", "= lines are the accepted answers");
assert(blank.response === "0", "< lines are what the reader wrote");
assert(
  quizVerdict(blank, { picked: [], checked: true }) === "correct",
  "a matching written answer is correct",
);
assert(
  quizVerdict(parseQuiz("At [____]?\n= 0\n< 1"), { picked: [], checked: true }) === "wrong",
  "a different written answer is wrong",
);
assert(
  quizVerdict(blank, { picked: [], checked: false }) === null,
  "an unchecked blank has no verdict",
);

const blankHtml = renderDocument(EMPTY_QUIZ_BLANK, undefined, quizOptions);
assert(blankHtml.includes("md-quiz-blank"), "the card knows it is a blank");
assert(blankHtml.includes('class="md-quiz-field"'), "the blank becomes a text field");
assert(
  !blankHtml.slice(blankHtml.indexOf("md-quiz-preview")).includes("[____]"),
  "the placeholder is replaced by the field in the card",
);

const twoBlanks = parseQuiz("She [__] tired, but she [___] ill.\n= is|was\n= is not");
assert(twoBlanks.blanks === 2, "every gap in the question counts");
assert(
  quizExpectedFor(twoBlanks, 0).join() === "is,was",
  "a pipe lists the wordings one blank accepts",
);
assert(quizExpectedFor(twoBlanks, 1).join() === "is not", "each = line answers one blank");
assert(
  quizExpectedFor(parseQuiz("At [____]?\n= 0\n= zero"), 0).join() === "0,zero",
  "a single blank pools every = line",
);
assert(
  quizVerdict(parseQuiz("She [__] a, [__] b.\n= is\n= was\n< is\n< was"), {
    picked: [],
    checked: true,
  }) === "correct",
  "all blanks right is correct",
);
assert(
  quizVerdict(parseQuiz("She [__] a, [__] b.\n= is\n= was\n< is\n< is"), {
    picked: [],
    checked: true,
  }) === "wrong",
  "one wrong blank fails the question",
);

const twoBlanksHtml = renderDocument(
  "```quiz\nShe [__] tired, but she [___] ill.\n= is\n= is not\n```",
  undefined,
  quizOptions,
);
const twoBlanksCard = twoBlanksHtml.slice(twoBlanksHtml.indexOf("md-quiz-preview"));
assert(
  (twoBlanksCard.match(/md-quiz-field/g) ?? []).length === 2,
  "each blank gets its own field",
);
assert(
  twoBlanksCard.includes("She <input") && twoBlanksCard.includes("> tired, but she <"),
  "the sentence around the blanks survives the inline pass",
);
assert(
  !twoBlanksCard.includes("<u>") && !twoBlanksCard.includes("<em>"),
  "underscores in a blank are never read as emphasis",
);
assert(
  withQuizResponse("She [__] a, [__] b.\n= is\n= was", "was", 1) ===
    "She [__] a, [__] b.\n< \n< was\n= is\n= was",
  "writing the second blank leaves room for the first",
);

const answer = parseQuiz("Explain photosynthesis.\n> Plants eat light.");
assert(answer.kind === "answer", "no options and no blank means a written answer");
assert(
  quizVerdict(answer, { picked: [], checked: true }) === "shown",
  "a written answer is only ever revealed",
);

const answerHtml = renderDocument(EMPTY_QUIZ_ANSWER, undefined, quizOptions);
assert(answerHtml.includes("md-quiz-writing"), "a written answer gets a writing area");
assert(answerHtml.includes("md-quiz-check"), "it offers a reveal button");
assert(
  !renderDocument(EMPTY_QUIZ_ANSWER, undefined, quizOptions).includes("md-quiz-options\">\n"),
  "the options list stays empty",
);

const written = withQuizResponse("Explain it.\n> Because.", "my answer\n\nsecond line");
assert(
  written === "Explain it.\n< my answer\n< second line\n> Because.",
  "a written answer lands above the explanation",
);
assert(
  withQuizResponse(written, "") === "Explain it.\n> Because.",
  "clearing the field drops the response lines",
);
assert(
  withQuizResponse("At [____]?\n= 0\n< old", "new") === "At [____]?\n< new\n= 0",
  "a blank keeps its accepted answers below the response",
);

assert(
  !renderDocument(EMPTY_QUIZ).includes("md-quiz"),
  "quiz blocks stay plain code while the feature is off",
);
assert(
  !renderDocument("```js\nlet a\n```", undefined, quizOptions).includes("md-quiz"),
  "other languages are untouched",
);

console.log("markdownQuiz tests passed");
