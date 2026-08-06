import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

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
