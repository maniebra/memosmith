import type { Editor } from "./types";

/** Arrow/Enter/Escape while the completion menu is open; true when it took the key. */
export function handleCompletionKeydown(e: Editor, event: KeyboardEvent) {
  const completions = e.ui.completions;

  if (!completions.length) {
    return false;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const step = event.key === "ArrowDown" ? 1 : completions.length - 1;

    event.preventDefault();
    e.ui.completionIndex =
      (e.ui.completionIndex + step) % completions.length;
    return true;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    e.applyCompletion(completions[e.ui.completionIndex]);
    return true;
  }

  if (event.key === "Escape") {
    e.closeCompletions();
    return true;
  }

  return false;
}

/** The same, for the slash menu. */
export function handleSlashKeydown(e: Editor, event: KeyboardEvent) {
  const matches = e.slashMatches();

  if (!e.props.slashCommands || e.ui.slashStart === null || !matches.length) {
    return false;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    const step = event.key === "ArrowDown" ? 1 : matches.length - 1;

    event.preventDefault();
    e.ui.slashIndex = (e.ui.slashIndex + step) % matches.length;
    return true;
  }

  if (event.key === "Enter" || event.key === "Tab") {
    event.preventDefault();
    e.pickCommand(matches[e.ui.slashIndex]);
    return true;
  }

  if (event.key === "Escape") {
    e.closeMenu();
    return true;
  }

  return false;
}
