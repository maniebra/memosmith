import { Bold, Italic, Strikethrough, Underline } from "@lucide/svelte";
import { inlineMarkEdit, type InlineMarker } from "../../../lib/utils/markdown";
import type { ContextMenuItem } from "../ContextMenu.svelte";
import type { Editor } from "./types";

/**
 * The stored range is the source of truth: clicking a menu item moves focus
 * out of the editor, so the DOM selection is gone by the time this runs.
 */
function toggleMark(e: Editor, marker: InlineMarker) {
  const range = e.ui.contextMenu?.textSelection;

  if (!range || range.start === range.end) {
    return;
  }

  const { edit, select } = inlineMarkEdit(
    e.value,
    range.start,
    range.end,
    marker,
  );

  e.element?.focus();
  e.replace(edit.start, edit.end, edit.text, edit.caret);

  if (select) {
    e.selectRange(select.start, select.end);
  }
}

/** Bold, italic, underline and strikethrough over the right-clicked text. */
export function formatMenuItems(
  e: Editor,
  hasSelection: boolean,
): ContextMenuItem[] {
  // A table cell or subblock keeps its own offsets, which the stored
  // document range cannot address.
  const disabled =
    !e.props.editable || !hasSelection || Boolean(e.tableSelection());

  const item = (
    key: "bold" | "italic" | "underline" | "strikethrough",
    shortcut: string,
    icon: typeof Bold,
    marker: InlineMarker,
  ): ContextMenuItem => ({
    label: e.t(`editor.${key}`),
    shortcut,
    icon,
    disabled,
    onSelect: () => toggleMark(e, marker),
  });

  return [
    item("bold", "Ctrl B", Bold, "**"),
    item("italic", "Ctrl I", Italic, "*"),
    item("underline", "Ctrl U", Underline, "__"),
    item("strikethrough", "Ctrl Shift X", Strikethrough, "~~"),
  ];
}
