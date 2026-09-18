import { listAllTemplates, listTemplates } from "../tauri/files";
import { dirname, stripNoteExtension } from "./path";

export type NoteTemplate = { name: string; text: string };

/** One slash entry with every template in the note's `.templates` folders. */
export function templateMenu(templates: NoteTemplate[], label: string) {
  const children = templates.map(({ name, text }) => ({
    label: name,
    hint: "template",
    prefix: "",
    insert: text,
  }));
  return children.length
    ? [{ label, hint: ".templates/", prefix: "", children }]
    : [];
}

/** Templates the note at `note` inherits from its `.templates` folders. */
export async function loadTemplates(root: string | null, note: string | null) {
  const found =
    root && note
      ? await listTemplates(root, dirname(note)).catch(() => [])
      : [];
  return {
    note,
    templates: found.map(({ name, text }) => ({
      name: stripNoteExtension(name),
      text,
    })),
  };
}

/** Fills `{{title}}`, `{{date}}` (YYYY-MM-DD) and `{{time}}` (HH:MM), local. */
export function fillTemplate(text: string, title: string, now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const values: Record<string, string> = {
    title,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in values ? values[key] : match,
  );
}

/** A template plus the folder a note made from it goes into. */
export type SpaceTemplate = NoteTemplate & { folder: string; path: string };

/** Every template in the space; labels read `Folder / name`. */
export async function loadSpaceTemplates(
  root: string | null,
): Promise<SpaceTemplate[]> {
  const found = root ? await listAllTemplates(root).catch(() => []) : [];
  return found.map(({ folder, name, text }) => ({
    folder,
    name: [folder, stripNoteExtension(name)].filter(Boolean).join(" / "),
    text,
    path: `${folder ? `${folder}/` : ""}.templates/${name}`,
  }));
}
