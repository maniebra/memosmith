import type { DatabaseSummary } from "../../lib/tauri/databases";
import type { I18nKey } from "../../lib/i18n";
import type { EditorPageActions } from "./editorPageContext";

export type PaletteKind = "entry" | "action" | "heading";

export type PaletteItem = {
  id: string;
  kind: PaletteKind;
  label: string;
  hint?: string;
  run: () => void;
};

/** `>` narrows to actions, `#` to headings of the open note, like VS Code. */
export function palettePrefix(query: string) {
  const kind: PaletteKind | null =
    query.startsWith(">") ? "action" : query.startsWith("#") ? "heading" : null;

  return { kind, needle: (kind ? query.slice(1) : query).trim().toLowerCase() };
}

/** Headings of the open note, skipping fenced code. */
export function headingItems(
  contents: string,
  jumpToLine: (line: number) => void,
  hint: string,
): PaletteItem[] {
  const items: PaletteItem[] = [];
  let fenced = false;

  for (const [line, text] of contents.split("\n").entries()) {
    if (text.trimStart().startsWith("```")) {
      fenced = !fenced;
      continue;
    }
    const heading = fenced ? null : /^(#{1,6})\s+(.+)$/.exec(text);

    if (heading) {
      items.push({
        id: `heading:${line}`,
        kind: "heading",
        label: `${"  ".repeat(heading[1].length - 1)}${heading[2].trim()}`,
        hint,
        run: () => jumpToLine(line),
      });
    }
  }

  return items;
}

type CommandSource = {
  actions: EditorPageActions;
  databases: DatabaseSummary[];
  databasesEnabled: boolean;
  hasNote: boolean;
  spaceNotes: string[];
  contents: string;
  jumpToLine: (line: number) => void;
  t: (key: I18nKey) => string;
  openSettings: () => void;
  toggleReadOnly: () => void;
  exportPdf: () => void;
};

function entryItems(source: CommandSource): PaletteItem[] {
  const { actions, t } = source;
  const notes = source.spaceNotes.map((relativePath) => ({
    id: `note:${relativePath}`,
    kind: "entry" as const,
    label: relativePath.replace(/\.md$/, ""),
    hint: t("command.note"),
    run: () =>
      void actions.runWithStatus(() => actions.selectSpaceNote(relativePath)),
  }));
  const databases = source.databasesEnabled
    ? source.databases.map((database) => ({
        id: `db:${database.id}`,
        kind: "entry" as const,
        label: database.name,
        hint: t("command.database"),
        run: () =>
          void actions.runWithStatus(() => actions.selectDatabase(database.id)),
      }))
    : [];
  return [...notes, ...databases];
}

function actionItems(source: CommandSource): PaletteItem[] {
  const { actions, t } = source;
  const commands: Omit<PaletteItem, "kind">[] = [
    {
      id: "action:settings",
      label: t("command.openSettings"),
      run: source.openSettings,
    },
    {
      id: "action:sidebar",
      label: t("command.toggleSidebar"),
      run: actions.toggleSpacePane,
    },
    {
      id: "action:readOnly",
      label: t("command.toggleReadOnly"),
      run: source.toggleReadOnly,
    },
    ...(source.hasNote
      ? [
          {
            id: "action:pdf",
            label: t("command.exportPdf"),
            run: source.exportPdf,
          },
        ]
      : []),
    ...(source.hasNote
      ? [
          {
            id: "action:save",
            label: t("command.saveNote"),
            run: () => void actions.runWithStatus(actions.flushNoteSave),
          },
          {
            id: "action:saveAs",
            label: t("command.saveNoteAs"),
            run: () => void actions.runWithStatus(actions.saveNoteAs),
          },
          {
            id: "action:grammarCheck",
            label: t("command.runGrammarCheck"),
            run: () => void actions.runWithStatus(actions.runGrammarCheck),
          },
          {
            id: "action:cover",
            label: t("command.pickCover"),
            run: () => void actions.runWithStatus(actions.pickActiveCover),
          },
          {
            id: "action:removeCover",
            label: t("command.removeCover"),
            run: () =>
              void actions.runWithStatus(() => actions.updateActiveCover(null)),
          },
        ]
      : []),
    {
      id: "action:grammar",
      label: t("command.toggleGrammar"),
      run: actions.toggleGrammar,
    },
    {
      id: "action:chooseSpace",
      label: t("command.chooseSpace"),
      run: () => void actions.runWithStatus(actions.chooseSpace),
    },
    {
      id: "action:refresh",
      label: t("command.refreshSpace"),
      run: () => void actions.runWithStatus(actions.refreshSpace),
    },
  ];
  return commands.map((command) => ({
    ...command,
    kind: "action" as const,
    hint: t("command.action"),
  }));
}

/** Notes and databases first, so typing a name jumps straight to it. */
export function commandPaletteItems(source: CommandSource): PaletteItem[] {
  return [
    ...entryItems(source),
    ...(source.hasNote
      ? headingItems(
          source.contents,
          source.jumpToLine,
          source.t("command.heading"),
        )
      : []),
    ...actionItems(source),
  ];
}
