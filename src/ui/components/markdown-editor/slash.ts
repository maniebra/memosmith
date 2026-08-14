import type { I18nKey } from "../../../lib/i18n";
import type { DatabaseSummary } from "../../../lib/tauri/databases";
import {
  applyPrefix,
  databaseEmbed,
  DEFAULT_TABLE_MARKDOWN,
  lineStartAt,
  emptyDatabaseEmbed,
  EMPTY_DIAGRAM,
  EMPTY_DRAWING,
  EMPTY_MERMAID,
  EMPTY_PLANTUML,
  SLASH_COMMANDS,
} from "../../../lib/utils/markdown";
import { matchCommands } from "../../../lib/utils/slashMatching";
import { editSurface, type EditSurface } from "./surface";
import type { Editor, SlashApi, SlashCommand } from "./types";

const SLASH_LABELS: Record<string, I18nKey> = {
  Text: "editor.text",
  "Heading 1": "editor.heading1",
  "Heading 2": "editor.heading2",
  "Heading 3": "editor.heading3",
  "Bulleted list": "editor.bulletedList",
  "Numbered list": "editor.numberedList",
  "To-do": "editor.todo",
  Quote: "editor.quote",
  Code: "editor.code",
  Columns: "editor.columns",
};

export function createSlash(e: Editor): SlashApi {
  const service = new EditorSlash(e);

  return {
    closeMenu: service.closeMenu.bind(service),
    highlightSlash: service.highlightSlash.bind(service),
    runCommand: service.runCommand.bind(service),
    slashMatches: service.slashMatches.bind(service),
    syncMenu: service.syncMenu.bind(service),
  };
}

/** The slash menu: which commands it offers and what they insert. */
class EditorSlash {
  constructor(private e: Editor) {}

  private slashLabel(label: string) {
    return SLASH_LABELS[label] ? this.e.t(SLASH_LABELS[label]) : label;
  }

  private featureCommands(): SlashCommand[] {
    const props = this.e.props;
    const callout =
      props.calloutDefinitions.find((definition) => definition.id)?.id ?? "note";
    const databases = props.databaseRoot ? props.databaseOptions : [];

    return [
      ...(props.callouts
        ? [
            {
              label: this.e.t("editor.callout"),
              hint: callout,
              prefix: `> [!${callout}] `,
            },
          ]
        : []),
      ...(props.drawings
        ? [
            {
              label: this.e.t("editor.drawing"),
              hint: "excalidraw",
              prefix: EMPTY_DRAWING,
            },
          ]
        : []),
      ...(props.diagrams
        ? [
            {
              label: this.e.t("editor.diagram"),
              hint: "draw.io",
              prefix: EMPTY_DIAGRAM,
            },
          ]
        : []),
      ...(props.plantuml
        ? [{ label: "PlantUML", hint: "diagram", prefix: EMPTY_PLANTUML }]
        : []),
      ...(props.mermaid
        ? [{ label: "Mermaid", hint: "diagram", prefix: EMPTY_MERMAID }]
        : []),
      ...databases.flatMap((option) => [
        {
          label: this.e.t("editor.database", { name: option.name }),
          hint: "embed",
          prefix: emptyDatabaseEmbed(option.id),
        },
        ...this.databaseViewCommands(option),
      ]),
    ];
  }

  /**
   * One command per table view, so a note can embed a single table with the
   * filters and sorts that view already carries, and nothing else.
   */
  private databaseViewCommands(option: DatabaseSummary): SlashCommand[] {
    return (option.tables ?? []).flatMap((table) =>
      table.views.map((view) => ({
        label: this.e.t("editor.databaseView", {
          name: option.name,
          table: table.name,
          view: view.name,
        }),
        hint: view.type,
        prefix: databaseEmbed({
          database: option.id,
          table: table.id,
          view: view.id,
          locked: true,
        }),
      })),
    );
  }

  slashMatches() {
    const query = this.e.ui.slashQuery.toLowerCase();
    const commands = [
      ...SLASH_COMMANDS.map((command) => ({
        ...command,
        label: this.slashLabel(command.label),
        // Matching reads aliases off the English label, which translations lose.
        source: command.label,
      })),
      ...this.featureCommands(),
    ];

    return matchCommands(commands, query);
  }

  highlightSlash(index: number) {
    this.e.ui.slashIndex = index;
  }

  closeMenu() {
    this.e.ui.slashStart = null;
    this.e.ui.slashQuery = "";
    this.e.ui.slashIndex = 0;
  }

  syncMenu(surface: EditSurface) {
    const e = this.e;

    if (!e.props.slashCommands) {
      this.closeMenu();
      return;
    }

    const { text, caret } = surface;
    const line = text.slice(lineStartAt(text, caret), caret);
    const typed = /(?:^|\s)\/([\w -]*)$/.exec(line);

    if (!typed) {
      this.closeMenu();
      return;
    }

    e.ui.slashStart = caret - typed[1].length - 1;
    e.ui.slashQuery = typed[1];
    e.ui.slashIndex = 0;

    const rect = getSelection()?.getRangeAt(0).getBoundingClientRect();

    if (rect) {
      e.ui.menuPosition = { top: rect.bottom + 4, left: rect.left };
    }
  }

  /** Commands rewrite the caret's line, in the document or in a column alike. */
  runCommand(prefix: string) {
    const e = this.e;
    const surface = editSurface(e, null);
    const slashStart = e.ui.slashStart;

    if (!surface || slashStart === null) {
      return;
    }

    const { text, caret } = surface;
    const start = lineStartAt(text, caret);
    const newline = text.indexOf("\n", caret);
    const lineEnd = newline === -1 ? text.length : newline;
    const tail = text.slice(caret, lineEnd);
    const head = text.slice(start, slashStart);

    this.closeMenu();

    if (prefix === DEFAULT_TABLE_MARKDOWN) {
      surface.apply({
        start,
        end: lineEnd,
        text: prefix,
        caret: start + prefix.length,
      });
      return;
    }

    if (prefix.startsWith("```")) {
      this.runFenceCommand(surface, prefix, { start, lineEnd, head, tail });
      return;
    }

    const nextLine = applyPrefix(head + tail, prefix);

    surface.apply({
      start,
      end: lineEnd,
      text: nextLine,
      caret: start + nextLine.length - tail.length,
    });
  }

  private runFenceCommand(
    surface: EditSurface,
    prefix: string,
    line: { start: number; lineEnd: number; head: string; tail: string },
  ) {
    const { start, lineEnd, head, tail } = line;
    const opening = applyPrefix(head, prefix);

    // Embeds carry their own source, so the caret waits under the card.
    if (prefix.includes("\n")) {
      surface.apply({
        start,
        end: lineEnd,
        text: `${opening}\n\n${tail}`,
        caret: start + opening.length + 2,
      });
      return;
    }

    // A code block needs its closing fence, with the caret on the line between.
    surface.apply({
      start,
      end: lineEnd,
      text: `${opening}\n${tail}\n\`\`\``,
      caret: start + opening.length + 1,
    });
  }
}
