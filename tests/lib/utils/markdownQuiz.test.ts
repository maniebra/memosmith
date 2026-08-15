const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  EMPTY_QUIZ,
  isMultiQuiz,
  parseQuiz,
  parseQuizState,
  quizFenceLine,
  quizScore,
  renderDocument,
} from "../../../src/lib/utils/markdown";

const quizOptions = { quizzes: true };

const quiz = parseQuiz(
  "What is **2 + 2**?\n- [x] 4\n- [ ] 5\n> Two plus two is four.\n> Really.",
);

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

assert(
  !renderDocument(EMPTY_QUIZ).includes("md-quiz"),
  "quiz blocks stay plain code while the feature is off",
);
assert(
  !renderDocument("```js\nlet a\n```", undefined, quizOptions).includes("md-quiz"),
  "other languages are untouched",
);

console.log("markdownQuiz tests passed");
