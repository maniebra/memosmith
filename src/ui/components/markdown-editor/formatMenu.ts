import {
  Baseline,
  Bold,
  Eraser,
  Highlighter,
  Italic,
  Strikethrough,
  Underline,
} from "@lucide/svelte";
import {
  highlightEdit,
  inlineMarkEdit,
  type HighlightColor,
  type InlineMarker,
} from "../../../lib/utils/markdown";
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

/** Same stored-range dance as `toggleMark`, with the colour the item carries. */
function applyHighlight(e: Editor, color: HighlightColor | null) {
  const range = e.ui.contextMenu?.textSelection;

  if (!range || range.start === range.end) {
    return;
  }

  const { edit, select } = highlightEdit(
    e.value,
    range.start,
    range.end,
    color,
  );

  e.element?.focus();
  e.replace(edit.start, edit.end, edit.text, edit.caret);

  if (select) {
    e.selectRange(select.start, select.end);
  }
}

/** The palette itself, one row per swatch, for a fill or for the text colour. */
function paletteItems(
  e: Editor,
  disabled: boolean,
  color: (id: string) => HighlightColor,
): ContextMenuItem[] {
  return e.props.highlightColors.map((swatch) => ({
    label: swatch.label,
    swatch: swatch.hex,
    disabled,
    onSelect: () => applyHighlight(e, color(swatch.id)),
  }));
}

/** One entry that opens the palettes, so the swatches never crowd the menu. */
function highlightItems(e: Editor, disabled: boolean): ContextMenuItem {
  return {
    label: e.t("editor.highlight"),
    icon: Highlighter,
    disabled,
    children: [
      ...paletteItems(e, disabled, (bg) => ({ bg })),
      { separator: true },
      {
        label: e.t("editor.highlightText"),
        icon: Baseline,
        disabled,
        children: paletteItems(e, disabled, (fg) => ({ fg })),
      },
      {
        label: e.t("editor.removeHighlight"),
        icon: Eraser,
        disabled,
        onSelect: () => applyHighlight(e, null),
      },
    ],
  };
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
    highlightItems(e, disabled),
  ];
}
