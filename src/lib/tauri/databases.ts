import { invoke } from "@tauri-apps/api/core";
import type { Database, Row, Table } from "../utils/database";

/** Everything but the rows, so menus can list a database's table views cheaply. */
export type DatabaseSummary = { id: string; name: string; tables?: Table[] };

export function listDatabases(root: string) {
  return invoke<DatabaseSummary[]>("list_databases", { root });
}

export function createDatabase(
  root: string,
  id: string,
  name: string,
  tables: Table[],
) {
  return invoke("create_database", { root, id, name, tables });
}

export function loadDatabase(root: string, id: string) {
  return invoke<Database>("load_database", { root, id });
}

export function saveDatabaseMeta(
  root: string,
  id: string,
  name: string,
  tables: Table[],
) {
  return invoke("save_database_meta", { root, id, name, tables });
}

export function saveDatabaseRow(root: string, id: string, row: Row) {
  return invoke("save_database_row", { root, id, row });
}

export function deleteDatabaseTable(root: string, id: string, tableId: string) {
  return invoke("delete_database_table", { root, id, tableId });
}

export function deleteDatabaseRow(root: string, id: string, rowId: string) {
  return invoke("delete_database_row", { root, id, rowId });
}

export function deleteDatabase(root: string, id: string) {
  return invoke("delete_database", { root, id });
}
