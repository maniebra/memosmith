import { open, save } from "@tauri-apps/plugin-dialog";
import { readNote, writeNote } from "../../lib/tauri/files";
import { translate } from "../../lib/i18n";
import { CREATED_AT, EDITED_AT } from "../../lib/utils/database";
import type { Column, Row, Table } from "../../lib/utils/database";
import { fromCsv, toCsv } from "../../lib/utils/databaseCsv";

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** Writes the rows a view shows to a file; returns the status to report, if any. */
export async function exportTableCsv(
  name: string,
  columns: Column[],
  rows: Row[],
) {
  try {
    const path = await save({
      defaultPath: `${name || "table"}.csv`,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (!path) {
      return null;
    }
    await writeNote(path, toCsv(columns, rows));
    return translate("database.exported", { name: path });
  } catch (error) {
    return message(error);
  }
}

/** Rows and columns read from a picked file; null when the user cancelled. */
export async function importTableCsv(table: Table, lastPosition: number) {
  try {
    const picked = await open({
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (typeof picked !== "string") {
      return null;
    }
    const now = new Date().toISOString();
    const imported = fromCsv(
      await readNote(picked),
      table.columns,
      table.id,
      lastPosition,
    );
    return {
      columns: imported.columns,
      rows: imported.rows.map((row) => ({
        ...row,
        data: { ...row.data, [CREATED_AT]: now, [EDITED_AT]: now },
      })),
      error: "",
    };
  } catch (error) {
    return { columns: table.columns, rows: [] as Row[], error: message(error) };
  }
}
