import { completeCode } from "../../../lib/tauri/lsp";
import {
  fenceContext,
  hasLanguageServer,
  rankCompletions,
  shouldComplete,
  wordPrefix,
  type Completion,
} from "../../../lib/utils/lsp";
import { editSurface, type EditSurface } from "./surface";
import type { CompletionApi, Editor } from "./types";

/** Long enough that a burst of typing costs one request, not one per key. */
const COMPLETION_DELAY = 300;

type FenceContext = NonNullable<ReturnType<typeof fenceContext>>;

export function createCompletions(e: Editor): CompletionApi {
  const service = new EditorCompletions(e);

  return {
    applyCompletion: service.applyCompletion.bind(service),
    closeCompletions: service.closeCompletions.bind(service),
    highlightCompletion: service.highlightCompletion.bind(service),
    syncCompletions: service.syncCompletions.bind(service),
  };
}

/** Completions come from a language server, asked for once typing pauses. */
class EditorCompletions {
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Only the newest request may paint; an earlier one lands stale. */
  private request = 0;
  /** A server answers one request at a time; asking twice builds a queue. */
  private busy = false;

  constructor(private e: Editor) {}

  highlightCompletion(index: number) {
    this.e.ui.completionIndex = index;
  }

  closeCompletions() {
    clearTimeout(this.timer);
    this.request += 1;
    this.e.ui.completions = [];
    this.e.ui.completionIndex = 0;
    this.e.ui.completionStart = null;
  }

  private rescheduleAtCaret() {
    const surface = editSurface(this.e, null);

    if (surface) {
      this.syncCompletions(surface);
    }
  }

  private async requestItems(context: FenceContext) {
    this.busy = true;

    try {
      return await completeCode(
        this.e.props.runSession || "scratch",
        context.language,
        context.code,
        context.line,
        context.character,
        this.e.props.lspSettings,
      );
    } catch (error) {
      console.warn("completions failed", error);
      return [];
    } finally {
      this.busy = false;
    }
  }

  private showCompletions(
    items: Completion[],
    prefix: string,
    offset: number,
  ) {
    const e = this.e;

    e.ui.completions = rankCompletions(items, prefix);
    e.ui.completionIndex = 0;
    e.ui.completionStart = e.ui.completions.length
      ? offset - prefix.length
      : null;

    const rect = getSelection()?.getRangeAt(0).getBoundingClientRect();

    if (rect) {
      e.ui.completionPosition = { top: rect.bottom + 4, left: rect.left };
    }
  }

  private scheduleRequest(
    context: FenceContext,
    prefix: string,
    offset: number,
    request: number,
  ) {
    this.timer = setTimeout(async () => {
      if (this.busy) {
        this.rescheduleAtCaret();
        return;
      }

      const items = await this.requestItems(context);

      // The caret must still sit where the request was made, same surface.
      const caret = editSurface(this.e, null)?.caret;

      if (request === this.request && caret === offset) {
        this.showCompletions(items, prefix, offset);
      }
    }, COMPLETION_DELAY);
  }

  syncCompletions(surface: EditSurface) {
    const e = this.e;
    const offset = surface.caret;

    clearTimeout(this.timer);

    if (!e.props.lsp || e.ui.slashStart !== null) {
      this.closeCompletions();
      return;
    }

    const context = fenceContext(surface.text, offset);

    if (!context || !hasLanguageServer(context.language)) {
      this.closeCompletions();
      return;
    }

    const line = context.code.split("\n")[context.line] ?? "";

    if (!shouldComplete(line, context.character)) {
      this.closeCompletions();
      return;
    }

    this.scheduleRequest(
      context,
      wordPrefix(line, context.character),
      offset,
      ++this.request,
    );
  }

  applyCompletion(item: Completion) {
    const surface = editSurface(this.e, null);
    const start = this.e.ui.completionStart;

    this.closeCompletions();

    if (!surface || start === null) {
      return;
    }

    surface.apply({
      start,
      end: surface.caret,
      text: item.insert,
      caret: start + item.insert.length,
    });
  }
}
