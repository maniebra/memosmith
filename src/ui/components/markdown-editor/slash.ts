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
  EMPTY_QUIZ,
  EMPTY_QUIZ_ANSWER,
  EMPTY_QUIZ_BLANK,
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
    pickCommand: service.pickCommand.bind(service),
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
    const databases = props.databaseRoot ? props.databaseOptions : [];

    return [
      ...(props.callouts ? [this.calloutCommand()] : []),
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
      ...(props.quizzes ? [this.quizCommand()] : []),
      ...this.databaseCommands(databases),
    ];
  }

  /** One entry, with every configured callout type hanging off it. */
  private calloutCommand(): SlashCommand {
    const definitions = this.e.props.calloutDefinitions.filter(
      (definition) => definition.id,
    );
    const children = definitions.map((definition) => ({
      label: definition.label || definition.id,
      hint: definition.id,
      prefix: `> [!${definition.id}] `,
      icon: definition.icon,
      color: definition.color,
    }));

    return {
      label: this.e.t("editor.callout"),
      hint: children[0]?.hint ?? "note",
      icon: definitions[0]?.icon,
      color: definitions[0]?.color,
      prefix: children.length ? "" : "> [!note] ",
      ...(children.length ? { children } : {}),
    };
  }

  /** One entry with the three shapes a question can take under it. */
  private quizCommand(): SlashCommand {
    return {
      label: this.e.t("editor.quiz"),
      hint: "quiz",
      prefix: "",
      children: [
        {
          label: this.e.t("editor.quizChoice"),
          hint: "quiz",
          prefix: EMPTY_QUIZ,
        },
        {
          label: this.e.t("editor.quizBlank"),
          hint: "[____]",
          prefix: EMPTY_QUIZ_BLANK,
        },
        {
          label: this.e.t("editor.quizAnswer"),
          hint: "quiz",
          prefix: EMPTY_QUIZ_ANSWER,
        },
      ],
    };
  }

  /** One entry, not one per view: the databases hang off it as submenus. */
  private databaseCommands(databases: DatabaseSummary[]): SlashCommand[] {
    if (!databases.length) {
      return [];
    }

    return [
      {
        label: this.e.t("editor.databaseGroup"),
        hint: "embed",
        prefix: "",
        children: databases.map((option) => ({
          label: option.name,
          hint: "embed",
          prefix: "",
          children: [
            {
              label: this.e.t("editor.databaseWhole"),
              hint: "embed",
              prefix: emptyDatabaseEmbed(option.id),
            },
            ...this.databaseViewCommands(option),
          ],
        })),
      },
    ];
  }

  /**
   * One command per table view, so a note can embed a single table with the
   * filters and sorts that view already carries, and nothing else.
   */
  private databaseViewCommands(option: DatabaseSummary): SlashCommand[] {
    return (option.tables ?? []).flatMap((table) =>
      table.views.map((view) => ({
        label: `${table.name} · ${view.name}`,
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
    const ui = this.e.ui;
    let commands: SlashCommand[] = [
      ...SLASH_COMMANDS.map((command) => ({
        ...command,
        label: this.slashLabel(command.label),
        // Matching reads aliases off the English label, which translations lose.
        source: command.label,
      })),
      ...this.featureCommands(),
    ];

    for (const label of ui.slashPath) {
      commands =
        commands.find((command) => command.label === label)?.children ??
        commands;
    }

    // Inside a submenu only what was typed after drilling in filters it.
    return matchCommands(
      commands,
      ui.slashQuery.toLowerCase().slice(ui.slashPathQuery),
    );
  }

  /** A command with children opens its submenu; a leaf inserts. */
  pickCommand(command: SlashCommand) {
    if (!command.children?.length) {
      this.runCommand(command.prefix);
      return;
    }

    this.e.ui.slashPath = [...this.e.ui.slashPath, command.label];
    this.e.ui.slashPathQuery = this.e.ui.slashQuery.length;
    this.e.ui.slashIndex = 0;
  }

  highlightSlash(index: number) {
    this.e.ui.slashIndex = index;
  }

  closeMenu() {
    this.e.ui.slashStart = null;
    this.e.ui.slashQuery = "";
    this.e.ui.slashIndex = 0;
    this.e.ui.slashPath = [];
    this.e.ui.slashPathQuery = 0;
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

    // Backspacing past where the submenu was opened leaves it.
    if (typed[1].length < e.ui.slashPathQuery) {
      e.ui.slashPath = [];
      e.ui.slashPathQuery = 0;
    }

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
      // A table touching the line above or below is parsed as one table, so it
      // needs a blank line on either side to stay its own.
      const rest = text.slice(lineEnd);
      const lead =
        start === 0 || text.slice(0, start).endsWith("\n\n") ? "" : "\n";
      const trail = rest === "" || rest.startsWith("\n\n") ? "" : "\n";

      surface.apply({
        start,
        end: lineEnd,
        text: `${lead}${prefix}${trail}`,
        caret: start + lead.length + prefix.length,
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
