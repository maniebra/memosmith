import { invoke } from "@tauri-apps/api/core";
import { ask, open, save } from "@tauri-apps/plugin-dialog";

const textFileFilters = [
  {
    name: "Markdown",
    extensions: ["md", "markdown", "txt"],
  },
  {
    name: "All files",
    extensions: ["*"],
  },
];

export async function chooseNotePath() {
  const selectedPath = await open({
    multiple: false,
    filters: textFileFilters,
  });

  return typeof selectedPath === "string" ? selectedPath : null;
}

export function chooseSavePath(defaultPath: string | null) {
  return save({
    defaultPath: defaultPath || "untitled.md",
    filters: textFileFilters,
  });
}

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

export function confirmDelete(name: string) {
  return ask(`Delete ${name}? This cannot be undone.`, { title: "Delete", kind: "warning" });
}
