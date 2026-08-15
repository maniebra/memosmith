import {
  isMultiQuiz,
  parseQuiz,
  parseQuizState,
  quizFenceInfo,
  withQuizResponse,
  type QuizState,
} from "../../../lib/utils/markdown";
import type { Editor } from "./types";

const CONTROLS = ".md-quiz-option, .md-quiz-check, .md-quiz-reset";

export function quizFieldOf(node: Node | null) {
  const element = node instanceof HTMLElement ? node : node?.parentElement;

  return (element?.closest?.(".md-quiz-field") ?? null) as HTMLElement | null;
}

function previewOf(handle: HTMLElement) {
  return (handle.closest?.(".md-quiz-preview") ?? null) as HTMLElement | null;
}

/** Everything the fence carries: its info string and the body under it. */
function quizBlock(e: Editor, preview: HTMLElement) {
  const blocks = e.codeSourceBlocks(preview);
  const info = blocks[0] ? e.sourceText(blocks[0]).replace(/^\s*```/, "") : "";

  return {
    open: blocks[0] as HTMLElement | undefined,
    info,
    source: blocks
      .slice(1, -1)
      .map((block) => e.sourceText(block))
      .join("\n"),
  };
}

function writeQuizState(e: Editor, preview: HTMLElement, state: QuizState) {
  const { source } = quizBlock(e, preview);

  e.replaceFencedSource(preview, quizFenceInfo(state), source);
  return true;
}

function pickOption(e: Editor, preview: HTMLElement, option: HTMLElement) {
  const index = Number(option.dataset.quizOption);
  const { info, source } = quizBlock(e, preview);
  const state = parseQuizState(info);
  const multi = isMultiQuiz(parseQuiz(source));

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

/** Clicking the card itself is a request to edit the block, not to answer it. */
function editQuizSource(e: Editor, preview: HTMLElement) {
  const { open } = quizBlock(e, preview);
  const offset = open ? e.offsetForPosition(open, 0) : null;

  if (!e.props.editable || !open || offset === null) {
    return false;
  }

  e.element?.focus({ preventScroll: true });
  e.setActiveBlock(open);
  e.setCaret(offset + e.sourceLength(open));
  return true;
}

/**
 * Picking, checking, retrying and opening a quiz, each one a rewrite of the
 * block so the answer survives a reload.
 */
export function handleQuizPointer(
  e: Editor,
  event: PointerEvent,
  handle: HTMLElement,
) {
  const preview = previewOf(handle);

  if (!preview) {
    return false;
  }

  // The reader is aiming at a text field: let the browser focus it.
  if (quizFieldOf(handle)) {
    return true;
  }

  const option = handle.closest?.(".md-quiz-option") as HTMLElement | null;
  const state = parseQuizState(quizBlock(e, preview).info);
  const handled = handle.closest?.(".md-quiz-reset")
    ? writeQuizState(e, preview, { picked: [], checked: false })
    : handle.closest?.(".md-quiz-check")
      ? writeQuizState(e, preview, { ...state, checked: true })
      : option
        ? pickOption(e, preview, option)
        : !handle.closest?.(CONTROLS) && editQuizSource(e, preview);

  if (handled) {
    event.preventDefault();
  }

  return handled;
}

/** A written blank or answer lands in the block when the field is left. */
export function handleQuizChange(e: Editor, event: Event) {
  const field = quizFieldOf(event.target as Node | null);
  const preview = field ? previewOf(field) : null;

  if (!field || !preview) {
    return false;
  }

  const { info, source } = quizBlock(e, preview);
  const value = (field as HTMLInputElement | HTMLTextAreaElement).value;
  const blank = field.dataset.quizBlank;

  e.replaceFencedSource(
    preview,
    info,
    withQuizResponse(source, value, blank === undefined ? undefined : +blank),
  );
  return true;
}

/** Typing in a quiz field never reaches the note; Enter just commits it. */
export function handleQuizFieldKeydown(event: KeyboardEvent) {
  const field = quizFieldOf(event.target as Node | null);

  if (!field) {
    return false;
  }

  if (event.key === "Enter" && !event.shiftKey) {
    field.blur();
  }

  return true;
}
