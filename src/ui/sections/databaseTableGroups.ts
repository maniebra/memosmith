import { groupRows, uncategorized } from "../../lib/utils/database";
import type { Choice, Column, Row } from "../../lib/utils/database";
import { hasOptionColors, optionChipStyle } from "../../lib/utils/optionColors";
import type { PaletteColor } from "../../lib/utils/optionColors";

/** One bucket per choice, or a single unnamed bucket when the view is ungrouped. */
export function tableGroups(
  rows: Row[],
  groupColumn: Column | undefined,
  choices: Choice[],
) {
  return groupColumn
    ? groupRows(
        rows,
        groupColumn,
        choices.map((choice) => choice.value),
      )
    : [{ key: "", rows }];
}

export function groupLabelOf(
  choices: Choice[],
  key: string,
  noValueLabel: string,
) {
  return key === uncategorized
    ? noValueLabel
    : (choices.find((choice) => choice.value === key)?.label ?? key);
}

/** Chip colours only apply to option columns, and never to the empty bucket. */
export function groupChipStyle(
  groupColumn: Column | undefined,
  key: string,
  colors: PaletteColor[],
) {
  return groupColumn && hasOptionColors(groupColumn) && key !== uncategorized
    ? optionChipStyle(groupColumn, key, colors)
    : "";
}
