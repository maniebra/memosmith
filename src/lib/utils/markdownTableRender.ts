import {
  emptyAnchor,
  escapeHtml,
  renderInline,
  renderLine,
  type RenderInlineOptions,
} from "./markdownInline";
import {
  parseMarkdownTable,
  parseTableCell,
  serializedTableCell,
  splitTableRow,
  tableSeparator,
  TABLE_BACKGROUNDS,
  type TableAlignment,
  type TableCell,
} from "./markdownTableModel";

function tableCell(
  content: string,
  tag: "td" | "th",
  alignment: TableAlignment,
  options: RenderInlineOptions,
) {
  const align = alignment ? `text-align:${alignment};` : "";
  const cell = parseTableCell(content);
  const colspan = cell.colspan > 1 ? ` colspan="${cell.colspan}"` : "";
  const rowspan = cell.rowspan > 1 ? ` rowspan="${cell.rowspan}"` : "";
  const background =
    cell.background && TABLE_BACKGROUNDS.has(cell.background)
      ? `background-color:${cell.background};`
      : "";
  const style = align || background ? ` style="${align}${background}"` : "";
  const body = renderInline(escapeHtml(cell.text), options);

  if (cell.covered) {
    return "";
  }

  return `<${tag} class="md-table-cell" data-table-cell data-row="" data-column="" contenteditable="true" spellcheck="true"${colspan}${rowspan}${style}>${body || emptyAnchor()}</${tag}>`;
}

export function renderTable(lines: string[], options: RenderInlineOptions) {
  const table = parseMarkdownTable(lines);

  if (!table) {
    return "";
  }

  const rowHtml = (row: TableCell[], rowIndex: number, tag: "td" | "th") =>
    `<tr>${row
      .map((cell, columnIndex) =>
        tableCell(
          serializedTableCell(cell),
          tag,
          table.alignments[columnIndex] ?? null,
          options,
        )
          .replace('data-row=""', `data-row="${rowIndex}"`)
          .replace('data-column=""', `data-column="${columnIndex}"`),
      )
      .join("")}</tr>`;

  return `<table class="md-table"><thead>${rowHtml(table.rows[0], 0, "th")}</thead><tbody>${table.rows
    .slice(1)
    .map((row, index) => rowHtml(row, index + 1, "td"))
    .join("")}</tbody></table>`;
}

export function isTableStart(lines: string[], index: number) {
  return (
    index + 1 < lines.length &&
    isTableRow(lines[index]) &&
    tableSeparator(lines[index + 1]) !== null
  );
}

export function isTableRow(line: string) {
  return splitTableRow(line).length > 1 || line.trim().startsWith("|");
}

export function tableLine(
  line: string,
  group: number,
  options: RenderInlineOptions,
) {
  return `<div dir="auto" class="md-block md-table-line" data-table="${group}">${renderLine(line, options)}</div>`;
}

export function tablePreview(
  lines: string[],
  group: number,
  showToolbar = true,
  options: RenderInlineOptions = {},
) {
  const divider =
    '<span class="md-table-tool-divider" aria-hidden="true">|</span>';
  const toolbar = showToolbar
    ? `<div class="md-table-tools-shell" contenteditable="false"><div class="md-table-tools"><button type="button" data-table-action="copy-all" title="Copy the whole table">Copy all</button>${divider}<button type="button" data-table-action="paste-all" title="Replace the whole table from the clipboard">Paste all</button>${divider}<button type="button" data-table-action="insert-row" title="Add row">Row +</button>${divider}<button type="button" data-table-action="insert-column" title="Add column">Col +</button>${divider}<button type="button" data-table-action="merge-right" title="Merge with cell on the right">Merge H</button>${divider}<button type="button" data-table-action="merge-down" title="Merge with cell below">Merge V</button>${divider}<button type="button" data-table-action="split-cell" title="Split cell">Split</button>${divider}${Array.from(
        TABLE_BACKGROUNDS,
      )
        .map(
          (color) =>
            `<button type="button" class="md-table-swatch" data-table-action="set-color" data-color="${color}" style="background-color:${color}" title="Cell color"></button>`,
        )
        .join(
          "",
        )}${divider}<button type="button" data-table-action="clear-color" title="Clear cell color">Clear</button></div></div>`
    : "";

  return `<div class="md-preview md-table-preview" data-table="${group}" contenteditable="false">${toolbar}<div class="md-table-scroll">${renderTable(
    lines,
    options,
  )}</div></div>`;
}
