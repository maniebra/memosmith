import type { I18nKey } from "../../../lib/i18n";
import {
  applyPrefix,
  DEFAULT_TABLE_MARKDOWN,
  emptyDatabaseEmbed,
  EMPTY_DIAGRAM,
  EMPTY_DRAWING,
  EMPTY_MERMAID,
  EMPTY_PLANTUML,
  SLASH_COMMANDS,
} from "../../../lib/utils/markdown";
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
      ...databases.map((option) => ({
        label: this.e.t("editor.database", { name: option.name }),
        hint: "embed",
        prefix: emptyDatabaseEmbed(option.id),
      })),
    ];
  }

  slashMatches() {
    const query = this.e.ui.slashQuery.toLowerCase();
    const commands = [
      ...SLASH_COMMANDS.map((command) => ({
        ...command,
        label: this.slashLabel(command.label),
      })),
      ...this.featureCommands(),
    ];

    return commands.filter((command) =>
      command.label.toLowerCase().includes(query),
    );
  }

  highlightSlash(index: number) {
    this.e.ui.slashIndex = index;
  }

  closeMenu() {
    this.e.ui.slashStart = null;
    this.e.ui.slashQuery = "";
    this.e.ui.slashIndex = 0;
  }

  syncMenu(offset: number) {
    const e = this.e;

    if (!e.props.slashCommands) {
      this.closeMenu();
      return;
    }

    const line = e.value.slice(e.lineStartAt(offset), offset);
    const typed = /(?:^|\s)\/([\w ]*)$/.exec(line);

    if (!typed) {
      this.closeMenu();
      return;
    }

    e.ui.slashStart = offset - typed[1].length - 1;
    e.ui.slashQuery = typed[1];
    e.ui.slashIndex = 0;

    const rect = getSelection()?.getRangeAt(0).getBoundingClientRect();

    if (rect) {
      e.ui.menuPosition = { top: rect.bottom + 4, left: rect.left };
    }
  }

  runCommand(prefix: string) {
    const e = this.e;
    const offset = e.caretOffset();
    const slashStart = e.ui.slashStart;

    if (offset === null || slashStart === null) {
      return;
    }

    const start = e.lineStartAt(offset);
    const newline = e.value.indexOf("\n", offset);
    const lineEnd = newline === -1 ? e.value.length : newline;
    const tail = e.value.slice(offset, lineEnd);
    const head = e.value.slice(start, slashStart);

    this.closeMenu();

    if (prefix === DEFAULT_TABLE_MARKDOWN) {
      e.replace(start, lineEnd, prefix, start + prefix.length);
      return;
    }

    if (prefix.startsWith("```")) {
      this.runFenceCommand(prefix, start, lineEnd, head, tail);
      return;
    }

    const nextLine = applyPrefix(head + tail, prefix);

    e.replace(start, lineEnd, nextLine, start + nextLine.length - tail.length);
  }

  private runFenceCommand(
    prefix: string,
    start: number,
    lineEnd: number,
    head: string,
    tail: string,
  ) {
    const opening = applyPrefix(head, prefix);

    // Embeds carry their own source, so the caret waits under the card.
    if (prefix.includes("\n")) {
      this.e.replace(
        start,
        lineEnd,
        `${opening}\n\n${tail}`,
        start + opening.length + 2,
      );
      return;
    }

    // A code block needs its closing fence, with the caret on the line between.
    this.e.replace(
      start,
      lineEnd,
      `${opening}\n${tail}\n\`\`\``,
      start + opening.length + 1,
    );
  }
}
