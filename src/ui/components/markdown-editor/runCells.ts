import { resetSession, runCode } from "../../../lib/tauri/runner";
import { outputKey } from "../../../lib/utils/runner";
import type { Editor, RunCellApi } from "./types";

type CellRun = {
  state: "running" | "ok" | "error" | "timeout";
  text: string;
  seconds?: number;
  /** Set once the result has been shown, so re-renders do not replay it. */
  shown?: boolean;
};

export function createRunCells(e: Editor): RunCellApi {
  const service = new EditorRunCells(e);

  return {
    cellKey: service.cellKey.bind(service),
    handleRunPointer: service.handleRunPointer.bind(service),
    paintRunPreviews: service.paintRunPreviews.bind(service),
    restartCell: service.restartCell.bind(service),
    runCell: service.runCell.bind(service),
  };
}

/** Runnable code cells: their results, and the bar that shows them. */
class EditorRunCells {
  /** Keyed by cell content, so results follow their block, not its position. */
  private cellRuns = new Map<string, CellRun>();

  constructor(private e: Editor) {}

  private previews() {
    const previews = this.e.element?.querySelectorAll(".md-run-preview");

    return Array.from(previews ?? []) as HTMLElement[];
  }

  cellKey(preview: HTMLElement) {
    const language = preview.dataset.runLanguage ?? "";

    return outputKey(language, this.e.sceneOf(preview));
  }

  /** Results live in a map, so a re-render repaints them onto fresh bars. */
  paintRunPreviews() {
    for (const preview of this.previews()) {
      this.paintRunPreview(preview);
    }

    this.e.syncTailAdd();
  }

  private runStatusText(run: CellRun | undefined) {
    if (run?.state === "running") {
      return "running";
    }

    return run?.seconds === undefined
      ? ""
      : `${run.seconds.toFixed(run.seconds < 10 ? 2 : 1)}s`;
  }

  private paintRunPreview(preview: HTMLElement) {
    const run = this.cellRuns.get(this.cellKey(preview));
    const bar = preview.querySelector(".md-run-bar");
    const status = preview.querySelector(".md-run-status");
    let output = preview.querySelector(".md-run-output") as HTMLElement | null;

    preview.classList.toggle("md-run-busy", run?.state === "running");
    bar?.classList.toggle("md-run-bar-busy", run?.state === "running");

    if (status) {
      status.textContent = this.runStatusText(run);
    }

    if (!run?.text) {
      output?.remove();

      return;
    }

    if (!output) {
      output = document.createElement("div");
      output.className = "md-run-output";
      preview.append(output);
    }

    output.classList.remove("md-run-ok", "md-run-error", "md-run-timeout");
    output.classList.add(`md-run-${run.state === "running" ? "ok" : run.state}`);
    output.classList.toggle("md-run-quiet", Boolean(run.shown));
    output.textContent = run.text;
    run.shown = true;
  }

  private resultOf(
    result: Awaited<ReturnType<typeof runCode>>,
    seconds: number,
  ): CellRun {
    const failed = result.status === 0 ? "" : "Cell failed with no output.";

    return {
      state: result.timedOut ? "timeout" : result.status === 0 ? "ok" : "error",
      text: result.timedOut
        ? `${result.output}\nCell timed out and the kernel was restarted.`
        : result.output || failed,
      seconds,
    };
  }

  async runCell(preview: HTMLElement) {
    const e = this.e;
    const language = preview.dataset.runLanguage ?? "";
    const code = e.sceneOf(preview);
    const key = outputKey(language, code);

    if (this.cellRuns.get(key)?.state === "running") {
      return;
    }

    this.cellRuns.set(key, { state: "running", text: "" });
    this.paintRunPreviews();

    const started = performance.now();
    const session = e.props.runSession || "scratch";

    try {
      const result = await runCode(session, language, code, e.props.runner);

      this.cellRuns.set(
        key,
        this.resultOf(result, (performance.now() - started) / 1000),
      );
    } catch (error) {
      this.cellRuns.set(key, {
        state: "error",
        text: error instanceof Error ? error.message : String(error),
        seconds: (performance.now() - started) / 1000,
      });
    }

    this.paintRunPreviews();
  }

  async restartCell(preview: HTMLElement) {
    const language = preview.dataset.runLanguage ?? "";
    const session = this.e.props.runSession || "scratch";

    await resetSession(session, language).catch(() => {});

    for (const other of this.previews()) {
      if (other.dataset.runLanguage === language) {
        this.cellRuns.delete(this.cellKey(other));
      }
    }

    preview.classList.add("md-run-restarted");
    window.setTimeout(
      () => preview.classList.remove("md-run-restarted"),
      600,
    );
    this.paintRunPreviews();
  }

  handleRunPointer(event: PointerEvent, handle: HTMLElement) {
    const control = handle.closest?.(".md-run-button, .md-run-restart");
    const runControl = control as HTMLElement | null;

    if (!runControl) {
      return false;
    }

    const preview = runControl.closest(".md-run-preview") as HTMLElement | null;

    if (preview) {
      event.preventDefault();
      void (runControl.classList.contains("md-run-restart")
        ? this.restartCell(preview)
        : this.runCell(preview));
    }

    return true;
  }
}
