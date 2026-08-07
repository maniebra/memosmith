import { invoke } from "@tauri-apps/api/core";
import type { Column, Database, Row, View } from "../utils/database";

export type DatabaseSummary = { id: string; name: string };

export function listDatabases(root: string) {
  return invoke<DatabaseSummary[]>("list_databases", { root });
}

export function createDatabase(root: string, id: string, name: string, columns: Column[], views: View[]) {
  return invoke("create_database", { root, id, name, columns, views });
}

export function loadDatabase(root: string, id: string) {
  return invoke<Database>("load_database", { root, id });
}

export function saveDatabaseMeta(root: string, id: string, name: string, columns: Column[], views: View[]) {
  return invoke("save_database_meta", { root, id, name, columns, views });
}

export function saveDatabaseRow(root: string, id: string, row: Row) {
  return invoke("save_database_row", { root, id, row });
}

export function deleteDatabaseRow(root: string, id: string, rowId: string) {
  return invoke("delete_database_row", { root, id, rowId });
}

export function deleteDatabase(root: string, id: string) {
  return invoke("delete_database", { root, id });
}
