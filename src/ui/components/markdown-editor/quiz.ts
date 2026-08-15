import {
  isMultiQuiz,
  parseQuiz,
  parseQuizState,
  quizFenceLine,
  type QuizState,
} from "../../../lib/utils/markdown";
import type { Editor } from "./types";

/** The fenced source behind a card, minus its own fence lines. */
function quizSource(e: Editor, preview: HTMLElement) {
  return e
    .codeSourceBlocks(preview)
    .slice(1, -1)
    .map((block) => e.sourceText(block))
    .join("\n");
}

/** Answers live on the opening fence, so the option lines are never rewritten. */
function writeQuizState(e: Editor, preview: HTMLElement, state: QuizState) {
  const open = e.codeSourceBlocks(preview)[0];
  const start = open ? e.offsetForPosition(open, 0) : null;

  if (!open || start === null) {
    return false;
  }

  e.value =
    e.value.slice(0, start) +
    quizFenceLine(state) +
    e.value.slice(start + e.sourceLength(open));
  // Read mode has no caret to restore.
  e.render(null);
  e.props.onInput();
  return true;
}

function pickOption(e: Editor, preview: HTMLElement, option: HTMLElement) {
  const index = Number(option.dataset.quizOption);
  const state = parseQuizState(fenceInfo(e, preview));
  const multi = isMultiQuiz(parseQuiz(quizSource(e, preview)));

  if (state.checked) {
    return false;
  }

  // One right answer means the click is the answer; several mean pick, then check.
  return writeQuizState(e, preview, {
    picked: multi
      ? state.picked.includes(index)
        ? state.picked.filter((picked) => picked !== index)
        : [...state.picked, index]
      : [index],
    checked: !multi,
  });
}

function fenceInfo(e: Editor, preview: HTMLElement) {
  const open = e.codeSourceBlocks(preview)[0];

  return open ? e.sourceText(open) : "";
}

/**
 * Picking, checking and retrying a quiz, each one a rewrite of the opening
 * fence so the answer survives a reload.
 */
export function handleQuizPointer(
  e: Editor,
  event: PointerEvent,
  handle: HTMLElement,
) {
  const preview = handle.closest?.(".md-quiz-preview") as HTMLElement | null;

  if (!preview) {
    return false;
  }

  const option = handle.closest?.(".md-quiz-option") as HTMLElement | null;
  const state = parseQuizState(fenceInfo(e, preview));
  let handled = false;

  if (handle.closest?.(".md-quiz-reset")) {
    handled = writeQuizState(e, preview, { picked: [], checked: false });
  } else if (handle.closest?.(".md-quiz-check")) {
    handled = writeQuizState(e, preview, { ...state, checked: true });
  } else if (option) {
    handled = pickOption(e, preview, option);
  }

  if (handled) {
    event.preventDefault();
  }

  return handled;
}
