import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { translate } from "../i18n";
import { confirm } from "../utils/confirm";
import type { PageMeta, SpaceMeta } from "../utils/pageMeta";

export function readNote(path: string) {
  return invoke<string>("read_note", { path });
}

export function writeNote(path: string, contents: string) {
  return invoke("write_note", { path, contents });
}

export async function chooseSpaceRoot() {
  const selectedPath = await open({ directory: true, multiple: false });

  return typeof selectedPath === "string" ? selectedPath : null;
}

export function listSpace(root: string) {
  return invoke<string[]>("list_space", { root });
}

export function createNote(path: string) {
  return invoke("create_note", { path });
}

export function renamePath(from: string, to: string) {
  return invoke("rename_path", { from, to });
}

export function deletePath(path: string) {
  return invoke("delete_path", { path });
}

/** Stored asset path, absolute and `/`-separated. */
export function writeAsset(dir: string, name: string, bytes: number[]) {
  return invoke<string>("write_asset", { dir, name, bytes });
}

export function copyAsset(dir: string, source: string) {
  return invoke<string>("copy_asset", { dir, source });
}

/** Number of unreferenced asset files deleted under `dir`. */
export function pruneAssets(dir: string) {
  return invoke<number>("prune_assets", { dir });
}

export async function chooseFiles() {
  const selected = await open({ multiple: true });

  return Array.isArray(selected) ? selected : selected ? [selected] : [];
}

export function confirmDelete(name: string) {
  return confirm({
    title: translate("common.deleteTitle"),
    message: translate("dialog.deleteConfirm", { name }),
    confirmLabel: translate("common.delete"),
    danger: true,
  });
}

export function searchNotes(root: string, query: string) {
  return invoke<string[]>("search_notes", { root, query });
}

export function loadSpaceMeta(root: string) {
  return invoke<SpaceMeta>("load_space_meta", { root });
}

export function savePageMeta(root: string, path: string, meta: PageMeta) {
  return invoke("save_page_meta", { root, path, meta });
}

export function renamePageMeta(
  root: string,
  from: string,
  to: string,
  folder: boolean,
) {
  return invoke("rename_page_meta", { root, from, to, folder });
}

export function deletePageMeta(root: string, path: string, folder: boolean) {
  return invoke("delete_page_meta", { root, path, folder });
}
