/** Language of the fenced block that holds a question. */
export const QUIZ_LANGUAGE = "quiz";

/** Where the reader writes in a fill-in-the-blank question. */
export const QUIZ_BLANK = /\[_{2,}\]/;

const OPTION = /^\s*[-*+] \[( |x|X)\]\s?(.*)$/;
const EXPECTED = /^\s*=\s?(.*)$/;
const RESPONSE = /^\s*<\s?(.*)$/;
const EXPLANATION = /^\s*>\s?(.*)$/;

export const EMPTY_QUIZ = [
  "```quiz",
  "What is 2 + 2?",
  "- [x] 4",
  "- [ ] 5",
  "> Two plus two is four.",
  "```",
].join("\n");

export const EMPTY_QUIZ_BLANK = [
  "```quiz",
  "Water freezes at [____] °C.",
  "= 0",
  "> At sea level pressure.",
  "```",
].join("\n");

export const EMPTY_QUIZ_ANSWER = [
  "```quiz",
  "Explain why the sky is blue.",
  "> Shorter wavelengths scatter more in the atmosphere.",
  "```",
].join("\n");

/**
 * `choice` has `- [ ]` options, `blank` has a `[____]` in its question, and
 * anything else is a free `answer` the reader writes in their own words.
 */
export type QuizKind = "choice" | "blank" | "answer";

export type QuizOption = { text: string; correct: boolean };

export type Quiz = {
  kind: QuizKind;
  question: string;
  /** How many `[____]` gaps the question has. */
  blanks: number;
  options: QuizOption[];
  /** Accepted answers, one `=` line per blank. */
  expected: string[];
  /** What the reader wrote, one `<` line per blank. */
  responses: string[];
  /** Every written line as one text, for a free answer. */
  response: string;
  explanation: string;
};

/** What the reader picked, and whether those picks were checked already. */
export type QuizState = { picked: number[]; checked: boolean };

export type QuizScore = {
  correct: number;
  hits: number;
  misses: number;
  perfect: boolean;
};

/**
 * Lines before the first option are the question, `=` lines are accepted
 * answers, `<` lines are the reader's own words, `>` lines are the explanation
 * shown once answered, and stray text after the options joins the explanation
 * rather than being dropped.
 */
export function parseQuiz(source: string): Quiz {
  const question: string[] = [];
  const options: QuizOption[] = [];
  const expected: string[] = [];
  const response: string[] = [];
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

    const parsed = [
      [EXPECTED, expected],
      [RESPONSE, response],
      [EXPLANATION, explanation],
    ] as const;
    const match = parsed.find(([pattern]) => pattern.test(line));

    if (match) {
      match[1].push(match[0].exec(line)![1]);
      continue;
    }

    if (line.trim()) {
      (options.length ? explanation : question).push(line.trim());
    }
  }

  const text = question.join(" ");
  const blanks = text.split(QUIZ_BLANK).length - 1;

  return {
    kind: options.length ? "choice" : blanks ? "blank" : "answer",
    question: text,
    blanks,
    options,
    expected,
    responses: response,
    response: response.join("\n"),
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

/** The opening fence for a state, without its leading backticks. */
export function quizFenceInfo(state: QuizState) {
  return [
    QUIZ_LANGUAGE,
    state.picked.length ? `picked=${[...state.picked].sort().join(",")}` : "",
    state.checked ? "checked" : "",
  ]
    .filter(Boolean)
    .join("|");
}

export function quizFenceLine(state: QuizState) {
  return "```" + quizFenceInfo(state);
}

/**
 * Written answers replace the `<` lines and sit right after the question. A
 * blank index writes only its own line, so the other blanks keep their answers.
 */
export function withQuizResponse(
  source: string,
  response: string,
  index?: number,
) {
  const previous = source
    .split("\n")
    .map((line) => RESPONSE.exec(line)?.[1])
    .filter((line) => line !== undefined);
  const kept = source.split("\n").filter((line) => !RESPONSE.test(line));
  const lines =
    index === undefined
      ? response.split("\n").filter((line) => line.trim())
      : Object.assign(
          Array.from({ length: Math.max(previous.length, index + 1) }, (
            _unused,
            at,
          ) => previous[at] ?? ""),
          { [index]: response },
        );
  // Trailing empties would shift the blanks that follow, so only they are cut.
  const written = lines
    .slice(
      0,
      lines.reduce((last, line, at) => (line.trim() ? at + 1 : last), 0),
    )
    .map((line) => `< ${line.trim()}`);
  const at = kept.findIndex((line) =>
    [EXPECTED, EXPLANATION, OPTION].some((pattern) => pattern.test(line)),
  );
  const cut = at === -1 ? kept.length : at;

  return [...kept.slice(0, cut), ...written, ...kept.slice(cut)].join("\n");
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

const normalize = (text: string) => text.trim().toLowerCase();

/**
 * One `=` line answers one blank, with `|` between the wordings it accepts. A
 * question with a single blank pools every `=` line instead, so a list of
 * accepted spellings needs no pipes.
 */
export function quizExpectedFor(quiz: Quiz, index: number) {
  const lines = quiz.blanks > 1 ? [quiz.expected[index] ?? ""] : quiz.expected;

  return lines
    .flatMap((line) => line.split("|"))
    .map((answer) => answer.trim())
    .filter(Boolean);
}

function blanksAreRight(quiz: Quiz) {
  return Array.from({ length: quiz.blanks }).every((_unused, index) => {
    const expected = quizExpectedFor(quiz, index);

    return expected.some(
      (answer) => normalize(answer) === normalize(quiz.responses[index] ?? ""),
    );
  });
}

/**
 * A blank is right when the written answer matches one accepted answer; a free
 * answer has nothing to compare against, so it is only ever revealed.
 */
export function quizVerdict(quiz: Quiz, state: QuizState) {
  if (!state.checked) {
    return null;
  }

  if (quiz.kind === "choice") {
    return quizScore(quiz, state.picked).perfect ? "correct" : "wrong";
  }

  if (quiz.kind === "blank" && quiz.expected.length) {
    return blanksAreRight(quiz) ? "correct" : "wrong";
  }

  return "shown";
}
