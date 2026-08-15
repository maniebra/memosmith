import {
  attribute,
  escapeHtml,
  renderInline,
  type RenderInlineOptions,
} from "./markdownInline";
import {
  QUIZ_BLANK,
  isMultiQuiz,
  parseQuiz,
  parseQuizState,
  quizScore,
  quizVerdict,
  type Quiz,
  type QuizScore,
  type QuizState,
} from "./markdownQuiz";

/** Card wording, so the editor can hand over translated strings. */
export type QuizLabels = {
  check: string;
  reveal: string;
  retry: string;
  write: string;
  score: (score: QuizScore) => string;
};

const DEFAULT_QUIZ_LABELS: QuizLabels = {
  check: "Check answers",
  reveal: "Show answer",
  retry: "Try again",
  write: "Write your answer",
  score: ({ hits, correct, misses }) =>
    `${hits} / ${correct} correct${misses ? `, ${misses} wrong` : ""}`,
};

type Inline = (text: string) => string;

function quizOptionsHtml(quiz: Quiz, state: QuizState, inline: Inline) {
  return `<div class="md-quiz-options">${quiz.options
    .map((choice, index) => {
      const picked = state.picked.includes(index) ? ' data-quiz-picked=""' : "";

      return `<button type="button" class="md-quiz-option" data-quiz-option="${index}"${
        choice.correct ? ' data-quiz-correct=""' : ""
      }${picked}><span class="md-quiz-mark"></span><span class="md-quiz-text">${inline(
        choice.text,
      )}</span></button>`;
    })
    .join("")}</div>`;
}

/**
 * The blank itself is the input, so the question reads as one sentence. Each
 * gap is rendered on its own: run through the inline pass, a `[____]` would be
 * read as emphasis and lose its underscores.
 */
function quizQuestionHtml(quiz: Quiz, state: QuizState, inline: Inline) {
  if (quiz.kind !== "blank") {
    return `<div class="md-quiz-question">${inline(quiz.question)}</div>`;
  }

  const html = quiz.question
    .split(QUIZ_BLANK)
    .map(inline)
    .reduce(
      (text, part, index) =>
        text +
        `<input type="text" class="md-quiz-field" data-quiz-blank="${
          index - 1
        }" value="${attribute(quiz.responses[index - 1] ?? "")}"${
          state.checked ? " disabled" : ""
        } />` +
        part,
    );

  return `<div class="md-quiz-question">${html}</div>`;
}

function quizWritingHtml(quiz: Quiz, state: QuizState, labels: QuizLabels) {
  if (quiz.kind !== "answer") {
    return "";
  }

  return `<textarea class="md-quiz-field md-quiz-writing" rows="3" placeholder="${attribute(
    labels.write,
  )}"${state.checked ? " disabled" : ""}>${escapeHtml(quiz.response)}</textarea>`;
}

function quizFooterHtml(quiz: Quiz, state: QuizState, labels: QuizLabels) {
  const multi = quiz.kind === "choice" && isMultiQuiz(quiz);

  if (!state.checked) {
    // A single-answer choice is settled by the click itself.
    return quiz.kind === "choice" && !multi
      ? ""
      : `<div class="md-quiz-actions"><button type="button" class="md-quiz-check">${escapeHtml(
          quiz.kind === "answer" ? labels.reveal : labels.check,
        )}</button></div>`;
  }

  const score = multi
    ? `<span class="md-quiz-score">${escapeHtml(
        labels.score(quizScore(quiz, state.picked)),
      )}</span>`
    : "";

  return `<div class="md-quiz-actions">${score}<button type="button" class="md-quiz-reset">${escapeHtml(
    labels.retry,
  )}</button></div>`;
}

/**
 * The card carries the answer key and what the reader did with it; every click
 * rewrites the block itself, so nothing is lost on reload.
 */
export function quizPreview(
  group: number,
  source: string,
  info = "",
  options: RenderInlineOptions = {},
  labels: QuizLabels = DEFAULT_QUIZ_LABELS,
) {
  const quiz = parseQuiz(source);
  const state = parseQuizState(info);
  const inline: Inline = (text) => renderInline(escapeHtml(text), options);
  const verdict = quizVerdict(quiz, state);
  const explanation = quiz.explanation
    ? `<div class="md-quiz-explanation">${quiz.explanation
        .split("\n")
        .map((line) => `<div>${inline(line)}</div>`)
        .join("")}</div>`
    : "";

  return `<div class="md-preview md-quiz-preview md-quiz-${quiz.kind}${
    isMultiQuiz(quiz) ? " md-quiz-multi" : ""
  }" data-code="${group}"${
    verdict ? ` data-quiz-answered="${verdict}"` : ""
  } contenteditable="false">${quizQuestionHtml(
    quiz,
    state,
    inline,
  )}${quizWritingHtml(quiz, state, labels)}${quizOptionsHtml(
    quiz,
    state,
    inline,
  )}${explanation}${quizFooterHtml(quiz, state, labels)}</div>`;
}
