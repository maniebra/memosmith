import {
  escapeHtml,
  renderInline,
  type RenderInlineOptions,
} from "./markdownInline";

/** Language of the fenced block that holds a multiple-choice question. */
export const QUIZ_LANGUAGE = "quiz";

export const EMPTY_QUIZ = [
  "```quiz",
  "What is 2 + 2?",
  "- [x] 4",
  "- [ ] 5",
  "> Two plus two is four.",
  "```",
].join("\n");

const OPTION = /^\s*[-*+] \[( |x|X)\]\s?(.*)$/;
const EXPLANATION = /^\s*>\s?(.*)$/;

export type QuizOption = { text: string; correct: boolean };

export type Quiz = {
  question: string;
  options: QuizOption[];
  explanation: string;
};

/** What the reader picked, and whether those picks were checked already. */
export type QuizState = { picked: number[]; checked: boolean };

/**
 * Lines before the first `- [ ]` option are the question, `>` lines are the
 * explanation shown once answered, and anything else after the options joins
 * the explanation rather than being dropped.
 */
export function parseQuiz(source: string): Quiz {
  const question: string[] = [];
  const options: QuizOption[] = [];
  const explanation: string[] = [];

  for (const line of source.split("\n")) {
    const option = OPTION.exec(line);

    if (option) {
      options.push({
        text: option[2].trim(),
        correct: option[1].toLowerCase() === "x",
      });
      continue;
    }

    const note = EXPLANATION.exec(line);

    if (note) {
      explanation.push(note[1]);
      continue;
    }

    if (line.trim()) {
      (options.length ? explanation : question).push(line.trim());
    }
  }

  return {
    question: question.join(" "),
    options,
    explanation: explanation.join("\n").trim(),
  };
}

/**
 * The answer rides on the opening fence — ```quiz|picked=0,2|checked — so it
 * survives a reload without the option lines themselves being rewritten.
 */
export function parseQuizState(info: string): QuizState {
  const parts = info.split("|").map((part) => part.trim());
  const picked = parts
    .find((part) => part.startsWith("picked="))
    ?.slice("picked=".length);

  return {
    picked: (picked ?? "")
      .split(",")
      .filter((part) => part.trim())
      .map(Number)
      .filter((index) => Number.isInteger(index) && index >= 0),
    checked: parts.includes("checked"),
  };
}

export function quizFenceLine(state: QuizState) {
  return [
    "```" + QUIZ_LANGUAGE,
    state.picked.length ? `picked=${[...state.picked].sort().join(",")}` : "",
    state.checked ? "checked" : "",
  ]
    .filter(Boolean)
    .join("|");
}

/** Several correct options turn the card into a check-then-score exercise. */
export function isMultiQuiz(quiz: Quiz) {
  return quiz.options.filter((option) => option.correct).length > 1;
}

export function quizScore(quiz: Quiz, picked: number[]): QuizScore {
  const correct = quiz.options.filter((option) => option.correct).length;
  const hits = picked.filter((index) => quiz.options[index]?.correct).length;
  const misses = picked.length - hits;

  return { correct, hits, misses, perfect: hits === correct && misses === 0 };
}

function quizButtons(
  quiz: Quiz,
  state: QuizState,
  inline: (text: string) => string,
) {
  return quiz.options
    .map((choice, index) => {
      const picked = state.picked.includes(index) ? ' data-quiz-picked=""' : "";

      return `<button type="button" class="md-quiz-option" data-quiz-option="${index}"${
        choice.correct ? ' data-quiz-correct=""' : ""
      }${picked}><span class="md-quiz-mark"></span><span class="md-quiz-text">${inline(
        choice.text,
      )}</span></button>`;
    })
    .join("");
}

export type QuizScore = {
  correct: number;
  hits: number;
  misses: number;
  perfect: boolean;
};

/** Card wording, so the editor can hand over translated strings. */
export type QuizLabels = {
  check: string;
  retry: string;
  score: (score: QuizScore) => string;
};

const DEFAULT_QUIZ_LABELS: QuizLabels = {
  check: "Check answers",
  retry: "Try again",
  score: ({ hits, correct, misses }) =>
    `${hits} / ${correct} correct${misses ? `, ${misses} wrong` : ""}`,
};

function quizFooter(
  quiz: Quiz,
  state: QuizState,
  multi: boolean,
  labels: QuizLabels,
) {
  if (!state.checked) {
    return multi
      ? `<div class="md-quiz-actions"><button type="button" class="md-quiz-check">${escapeHtml(
          labels.check,
        )}</button></div>`
      : "";
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
 * The card carries which options are correct and which were picked; clicking
 * rewrites only the opening fence.
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
  const multi = isMultiQuiz(quiz);
  const inline = (text: string) => renderInline(escapeHtml(text), options);
  const explanation = quiz.explanation
    ? `<div class="md-quiz-explanation">${quiz.explanation
        .split("\n")
        .map((line) => `<div>${inline(line)}</div>`)
        .join("")}</div>`
    : "";
  const answered = state.checked
    ? ` data-quiz-answered="${quizScore(quiz, state.picked).perfect ? "correct" : "wrong"}"`
    : "";

  return `<div class="md-preview md-quiz-preview${
    multi ? " md-quiz-multi" : ""
  }" data-code="${group}"${answered} contenteditable="false"><div class="md-quiz-question">${inline(
    quiz.question,
  )}</div><div class="md-quiz-options">${quizButtons(
    quiz,
    state,
    inline,
  )}</div>${explanation}${quizFooter(quiz, state, multi, labels)}</div>`;
}
