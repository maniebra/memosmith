/* eslint-disable max-lines */
import {
  defaultCalloutDefinitions,
  type CalloutDefinition,
} from "../storage/settings";
import { isRunnable, RUN_STORE_LINE } from "./runner";
import {
  attribute,
  escapeHtml,
  lineClass,
  mathLine,
  mathPreview,
  renderCode,
  renderLine,
  type RenderInlineOptions,
} from "./markdownInline";
import { MEDIA_LINE, mediaPreview } from "./markdownMedia";
import { GITHUB_LANGUAGE, GITLAB_LANGUAGE, gitlabPreview } from "./gitlab";
import {
  isTableRow,
  isTableStart,
  tableLine,
  tablePreview,
} from "./markdownTableRender";
import {
  COLUMN_SUBBLOCK_OPEN,
  renderMarkdownLines,
  renderVerticalSubblocks,
} from "./markdownSubblocks";
import {
  CALLOUT_LINE,
  CALLOUT_START,
  DATABASE_LANGUAGE,
  DIAGRAM_LANGUAGE,
  DRAWING_LANGUAGE,
  WIKILINK_EMBED_LINE,
  calloutDefinition,
  calloutLine,
  calloutPreview,
  databasePreview,
  diagramPreview,
  drawingPreview,
  embedLineClass,
  liveDiagramEngine,
  liveDiagramPreview,
  runPreview,
  wikilinkEmbedPreview,
  type LiveDiagramEngine,
  type RenderDocumentOptions,
} from "./markdownEmbeds";
import { QUIZ_LANGUAGE } from "./markdownQuiz";
import { quizPreview } from "./markdownQuizRender";
const EQUATION_BLOCK = /^\s*\$\$\s*(\S.*?)\s*\$\$\s*$/;
const FENCE = /^\s*```(\w*)([^\n]*)/;
const LIST_CLASSES = new Set([
  "md-bullet",
  "md-ordered",
  "md-task",
  "md-task md-task-done",
]);
const MAX_SUBBLOCK_DEPTH = 6;
/** Embeds whose card is their only face: the raw source never unfolds under the caret. */
const NON_EDITABLE_EMBEDS = new Set<string | null>([
  GITLAB_LANGUAGE,
  GITHUB_LANGUAGE,
  DATABASE_LANGUAGE,
  DIAGRAM_LANGUAGE,
  DRAWING_LANGUAGE,
]);
class DocumentRenderer {
  private readonly calloutDefinitions: CalloutDefinition[];
  private readonly callouts: boolean;
  private readonly codeExecution: boolean;
  private readonly diagrams: boolean;
  private readonly drawings: boolean;
  private readonly fancyTableEditor: boolean;
  private readonly inlineOptions: RenderInlineOptions;
  private readonly output: string[] = [];
  private readonly quizzes: boolean;
  private calloutGroup = 0;
  private codeGroup = 0;
  private diagramEngine: LiveDiagramEngine | null = null;
  private diagramInfo = "";
  private diagramLines: string[] | null = null;
  private embedGroup: number | null = null;
  private embedLanguage: string | null = null;
  private embedSourceLines: string[] | null = null;
  private language: string | null = null;
  private mathGroup = 0;
  private mathLines: string[] | null = null;
  private quizInfo = "";
  private quizLines: string[] | null = null;
  private tableGroup = 0;
  private listGroup = 0;
  private inList = false;
  private runLanguage: string | null = null;
  private subblockGroup = 0;
  constructor(
    private readonly text: string,
    private readonly resolveAsset: ((source: string) => string) | undefined,
    private readonly options: RenderDocumentOptions,
  ) {
    this.calloutDefinitions =
      options.calloutDefinitions ?? defaultCalloutDefinitions;
    this.callouts = options.callouts ?? false;
    this.codeExecution = options.codeExecution ?? false;
    this.diagrams = options.diagrams ?? false;
    this.drawings = options.drawings ?? false;
    this.fancyTableEditor = options.fancyTableEditor ?? true;
    this.quizzes = options.quizzes ?? false;
    this.inlineOptions = {
      resolveWikilink: options.resolveWikilink,
      highlightColors: options.highlightColors,
    };
  }
  private renderNestedMarkdown(source: string) {
    const depth = (this.options.subblockDepth ?? 0) + 1;
    return depth > MAX_SUBBLOCK_DEPTH
      ? renderMarkdownLines(source, this.inlineOptions)
      : renderDocument(source, this.resolveAsset, {
          ...this.options,
          subblockDepth: depth,
        });
  }
  render() {
    const lines = this.text.split("\n");
    for (let i = 0; i < lines.length;) {
      i = this.renderNextLine(lines, i);
    }
    if (this.mathLines) {
      this.pushMathLines(this.mathLines, false);
    }
    return this.output.join("");
  }
  private renderNextLine(lines: string[], index: number) {
    const line = lines[index];
    if (this.mathLines) {
      return this.renderMathBlockLine(line, index);
    }
    // Stored cell results stay in the document text, but never on screen.
    if (this.language === null && RUN_STORE_LINE.test(line)) {
      this.output.push(
        `<div class="md-block md-run-store">${escapeHtml(line)}</div>`,
      );
      return index + 1;
    }
    const fence = FENCE.exec(line);
    if (fence) {
      return this.renderFenceLine(line, fence, index);
    }
    if (this.language !== null) {
      return this.renderCodeLine(line, index);
    }
    return this.renderMarkdownLine(lines, index);
  }
  private pushMathLines(lines: string[], closed: boolean) {
    const group = this.mathGroup++;
    for (const line of lines) {
      this.output.push(mathLine(line, group, closed));
    }
    if (closed) {
      this.output.push(mathPreview(lines.slice(1, -1).join("\n"), group));
    }
  }
  private renderMathBlockLine(line: string, index: number) {
    this.mathLines?.push(line);
    if (line.trim() === "$$" && this.mathLines) {
      this.pushMathLines(this.mathLines, true);
      this.mathLines = null;
    }
    return index + 1;
  }
  private embeddedLanguage(isOpening: boolean) {
    if (!isOpening) {
      return this.embedGroup !== null ? this.embedLanguage : null;
    }
    if (
      (this.drawings && this.language === DRAWING_LANGUAGE) ||
      (this.diagrams && this.language === DIAGRAM_LANGUAGE) ||
      (this.options.databaseEmbeds && this.language === DATABASE_LANGUAGE) ||
      this.language === GITLAB_LANGUAGE ||
      this.language === GITHUB_LANGUAGE
    ) {
      return this.language;
    }
    return null;
  }
  private renderFenceLine(line: string, fence: RegExpExecArray, index: number) {
    const isOpening = this.language === null;
    const className = isOpening
      ? "md-fence md-fence-open"
      : "md-fence md-fence-close";
    this.language = isOpening ? fence[1].toLowerCase() : null;
    const codeIndex = isOpening ? this.codeGroup : this.codeGroup++;
    const embedded = this.embeddedLanguage(isOpening);
    const opensDiagram =
      isOpening && !embedded
        ? liveDiagramEngine(fence[1].toLowerCase(), this.options)
        : null;
    this.setFenceState(line, isOpening, embedded, opensDiagram, fence[2]);
    this.output.push(
      this.fenceLineHtml(line, className, embedded, opensDiagram, codeIndex),
    );
    this.closeFencePreviews(line, isOpening, embedded, codeIndex);
    return index + 1;
  }
  private setFenceState(
    line: string,
    isOpening: boolean,
    embedded: string | null,
    opensDiagram: LiveDiagramEngine | null,
    info: string,
  ) {
    this.embedLanguage = isOpening ? embedded : null;
    this.embedGroup = embedded && isOpening ? this.codeGroup : null;
    this.embedSourceLines =
      embedded && isOpening ? [line] : this.embedSourceLines;
    if (isOpening) {
      this.runLanguage =
        this.codeExecution && !embedded && isRunnable(this.language ?? "")
          ? this.language
          : null;
      this.quizLines =
        this.quizzes && this.language === QUIZ_LANGUAGE ? [] : null;
      this.quizInfo = this.quizLines ? info : "";
      this.diagramLines = opensDiagram ? [] : null;
      this.diagramEngine = opensDiagram;
      this.diagramInfo = opensDiagram ? info : "";
    }
  }
  private fenceLineHtml(
    line: string,
    className: string,
    embedded: string | null,
    opensDiagram: LiveDiagramEngine | null,
    index: number,
  ) {
    const embedClass = embedded ? ` ${embedLineClass(embedded)}` : "";
    const diagramClass =
      (opensDiagram || this.diagramLines ? " md-livediagram-line" : "") +
      (this.quizLines ? " md-quiz-line" : "");
    const editable = NON_EDITABLE_EMBEDS.has(
      embedded ?? this.embedLanguage ?? "",
    )
      ? ' contenteditable="false"'
      : "";
    return `<div dir="auto" class="md-block ${className}${embedClass}${diagramClass}"${editable} data-code="${index}">${escapeHtml(line)}</div>`;
  }
  private closeFencePreviews(
    line: string,
    isOpening: boolean,
    embedded: string | null,
    index: number,
  ) {
    if (isOpening) {
      return;
    }
    this.pushRunPreview(index);
    this.pushQuizPreview(index);
    this.pushLiveDiagramPreview(index);
    if (embedded) {
      this.pushEmbedPreview(line, embedded, index);
    }
  }
  private pushRunPreview(index: number) {
    if (this.runLanguage) {
      this.output.push(runPreview(index, this.runLanguage));
      this.runLanguage = null;
    }
  }
  private pushQuizPreview(index: number) {
    if (this.quizLines) {
      this.output.push(
        quizPreview(
          index,
          this.quizLines.join("\n"),
          this.quizInfo,
          this.inlineOptions,
          this.options.quizLabels,
        ),
      );
      this.quizLines = null;
    }
  }
  private pushLiveDiagramPreview(index: number) {
    if (this.diagramLines && this.diagramEngine) {
      this.output.push(
        liveDiagramPreview(
          index,
          this.diagramEngine,
          this.diagramLines.join("\n"),
          this.diagramInfo,
        ),
      );
      this.diagramLines = null;
      this.diagramEngine = null;
    }
  }
  private pushEmbedPreview(line: string, embedded: string, index: number) {
    this.embedSourceLines?.push(line);
    const embedSource = this.embedSourceLines?.slice(1, -1).join("\n") ?? "";
    this.output.push(
      embedded === DIAGRAM_LANGUAGE
        ? diagramPreview(index, embedSource, this.options.staticDiagramPreviews)
        : embedded === DATABASE_LANGUAGE
          ? databasePreview(index, embedSource)
          : embedded === GITLAB_LANGUAGE || embedded === GITHUB_LANGUAGE
            ? gitlabPreview(index, embedSource, this.options.resolveGitlab)
            : drawingPreview(index),
    );
    this.embedSourceLines = null;
  }
  private renderCodeLine(line: string, index: number) {
    if (this.embedLanguage) {
      const embedClass = embedLineClass(this.embedLanguage);
      const editable = NON_EDITABLE_EMBEDS.has(this.embedLanguage)
        ? ' contenteditable="false"'
        : "";
      this.embedSourceLines?.push(line);
      this.output.push(
        `<div dir="auto" class="md-block ${embedClass}"${editable} data-code="${this.codeGroup}">${escapeHtml(line)}</div>`,
      );
      return index + 1;
    }
    this.diagramLines?.push(line);
    this.quizLines?.push(line);
    this.output.push(
      `<div dir="auto" class="md-block md-codeblock${this.diagramLines ? " md-livediagram-line" : ""}${this.quizLines ? " md-quiz-line" : ""}" data-code="${this.codeGroup}" data-language="${attribute(this.language ?? "")}">${renderCode(line, this.language ?? "")}</div>`,
    );
    return index + 1;
  }
  private renderMarkdownLine(lines: string[], index: number) {
    const line = lines[index];
    const equation = EQUATION_BLOCK.exec(line);
    if (equation) {
      return this.renderEquationLine(line, equation[1], index);
    }
    if (line.trim() === "$$") {
      this.mathLines = [line];
      return index + 1;
    }
    if (COLUMN_SUBBLOCK_OPEN.test(line)) {
      const block = renderVerticalSubblocks(
        lines,
        index,
        this.subblockGroup++,
        this.inlineOptions,
        this.renderNestedMarkdown.bind(this),
      );
      this.output.push(block.html);
      return block.next;
    }
    return this.renderRichMarkdownLine(lines, index);
  }
  private renderEquationLine(line: string, source: string, index: number) {
    const group = this.mathGroup++;
    this.output.push(mathLine(line, group, true), mathPreview(source, group));
    return index + 1;
  }
  private renderRichMarkdownLine(lines: string[], index: number) {
    const line = lines[index];
    const wikilinkEmbed = WIKILINK_EMBED_LINE.exec(line);
    if (wikilinkEmbed) {
      this.output.push(
        `<div dir="auto" class="md-block md-wikilink-embed-line">${renderLine(line, this.inlineOptions)}</div>`,
        wikilinkEmbedPreview(wikilinkEmbed[1], this.options),
      );
      return index + 1;
    }
    if (this.callouts && CALLOUT_START.test(line)) {
      return this.renderCalloutLines(lines, index);
    }
    return this.renderMediaTableOrPlainLine(lines, index);
  }
  private renderCalloutLines(lines: string[], index: number) {
    const calloutLines = [lines[index]];
    let next = index + 1;
    while (
      next < lines.length &&
      CALLOUT_LINE.test(lines[next]) &&
      !CALLOUT_START.test(lines[next])
    ) {
      calloutLines.push(lines[next]);
      next++;
    }
    const group = this.calloutGroup++;
    const start = CALLOUT_START.exec(calloutLines[0]);
    const definition = calloutDefinition(
      start?.[1] ?? "note",
      this.calloutDefinitions,
    );
    for (const [lineIndex, sourceLine] of calloutLines.entries()) {
      this.output.push(
        calloutLine(
          sourceLine,
          group,
          definition,
          lineIndex,
          calloutLines.length,
          this.inlineOptions,
        ),
      );
    }
    this.output.push(
      calloutPreview(
        calloutLines,
        group,
        this.calloutDefinitions,
        this.inlineOptions,
      ),
    );
    return next;
  }
  private renderMediaTableOrPlainLine(lines: string[], index: number) {
    const line = lines[index];
    const media = this.resolveAsset ? MEDIA_LINE.exec(line) : null;
    if (media && this.resolveAsset) {
      this.output.push(
        `<div dir="auto" class="md-block md-media-line">${renderLine(line, this.inlineOptions)}</div>`,
        mediaPreview(
          line,
          media[2],
          media[3],
          this.resolveAsset,
          this.options.youtubeOnline,
          this.options.spotifyOnline,
        ),
      );
      return index + 1;
    }
    return isTableStart(lines, index)
      ? this.renderTableLines(lines, index)
      : this.renderPlainLine(line, index);
  }
  private renderTableLines(lines: string[], index: number) {
    const tableLines = [lines[index], lines[index + 1]];
    let next = index + 2;
    while (next < lines.length && isTableRow(lines[next])) {
      tableLines.push(lines[next]);
      next++;
    }
    const group = this.tableGroup++;
    for (const tableSourceLine of tableLines) {
      this.output.push(tableLine(tableSourceLine, group, this.inlineOptions));
    }
    this.output.push(
      tablePreview(
        tableLines,
        group,
        this.fancyTableEditor,
        this.inlineOptions,
      ),
    );
    return next;
  }
  private renderPlainLine(line: string, index: number) {
    const indent = / */.exec(line)![0].length;
    const style = indent ? ` style="padding-left:${indent * 0.75}rem"` : "";
    const className = lineClass(line);
    // A run of bullets, tasks or numbers is one block: one handle, one drag.
    const listed = LIST_CLASSES.has(className);

    if (listed && !this.inList) {
      this.listGroup++;
    }
    this.inList = listed;
    const list = listed ? ` data-list="${this.listGroup}"` : "";

    this.output.push(
      `<div dir="auto" class="md-block ${className}"${style}${list}>${renderLine(line, this.inlineOptions)}</div>`,
    );
    return index + 1;
  }
}
export function renderDocument(
  text: string,
  resolveAsset?: (source: string) => string,
  options: RenderDocumentOptions = {},
) {
  return new DocumentRenderer(text, resolveAsset, options).render();
}
