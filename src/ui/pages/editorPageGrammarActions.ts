import { checkGrammar } from "../../lib/tauri/llm";
import { applyIssue, issueRange } from "../../lib/utils/grammar";
import type { GrammarIssue, GrammarMode } from "../../lib/utils/grammar";
import type { GrammarProfile } from "../../lib/storage/settings";
import type { EditorPageContext } from "./editorPageContext";

type CoreActions = {
  updateNote: () => void;
};

export function createGrammarActions(
  context: EditorPageContext,
  core: CoreActions,
) {
  const service = new GrammarActions(context, core);
  return {
    applyGrammarIssue: service.applyGrammarIssue.bind(service),
    dismissGrammarIssue: service.dismissGrammarIssue.bind(service),
    grammarDecorations: service.grammarDecorations.bind(service),
    runGrammarCheck: service.runGrammarCheck.bind(service),
    scheduleGrammarCheck: service.scheduleGrammarCheck.bind(service),
    setGrammarMode: service.setGrammarMode.bind(service),
    toggleGrammar: service.toggleGrammar.bind(service),
    updateGrammarProfile: service.updateGrammarProfile.bind(service),
  };
}

class GrammarActions {
  constructor(
    private context: EditorPageContext,
    private core: CoreActions,
  ) {}

  grammarDecorations(
    _report = this.context.grammarReport,
    _contents = this.context.contents,
  ) {
    return (this.context.grammarReport?.issues ?? []).flatMap((issue) => {
      const range = issueRange(this.context.contents, issue);
      return range ? [{ ...range, tone: issue.kind }] : [];
    });
  }

  async runGrammarCheck() {
    if (
      !this.context.settings.features.grammarPolice ||
      !this.context.contents.trim() ||
      this.context.grammarChecking
    ) {
      return;
    }
    this.context.grammarChecking = true;
    this.context.grammarError = "";
    this.context.grammarCheckedText = this.context.contents;
    this.context.statusMessage = this.context.t("app.grammarReading");
    await this.check();
  }

  scheduleGrammarCheck() {
    if (!this.canSchedule()) {
      return;
    }
    if (this.context.grammarTimer) {
      clearTimeout(this.context.grammarTimer);
    }
    this.context.grammarTimer = setTimeout(() => {
      this.context.grammarTimer = undefined;
      if (this.context.contents !== this.context.grammarCheckedText) {
        void this.runGrammarCheck();
      }
    }, 2500);
  }

  updateGrammarProfile(profile: GrammarProfile) {
    this.context.settings = {
      ...this.context.settings,
      grammarProfiles: {
        ...this.context.settings.grammarProfiles,
        [this.context.settings.grammarMode]: profile,
      },
    };
  }

  setGrammarMode(mode: GrammarMode) {
    if (mode === this.context.settings.grammarMode) {
      return;
    }
    this.context.settings = { ...this.context.settings, grammarMode: mode };
    this.context.grammarReport = null;
    this.context.grammarError = "";
    this.context.grammarCheckedText = "";
    if (this.canAutoCheckGrammar()) {
      void this.runGrammarCheck();
    }
  }

  toggleGrammar() {
    if (!this.context.settings.features.grammarPolice) {
      return;
    }
    this.context.grammarOpen = !this.context.grammarOpen;
    if (this.shouldCheckOnOpen()) {
      void this.runGrammarCheck();
    }
  }

  dismissGrammarIssue(issue: GrammarIssue) {
    if (this.context.grammarReport) {
      this.context.grammarReport = {
        ...this.context.grammarReport,
        issues: this.context.grammarReport.issues.filter(
          (entry) => entry !== issue,
        ),
      };
    }
  }

  applyGrammarIssue(issue: GrammarIssue) {
    const next = applyIssue(this.context.contents, issue);
    if (next === null) {
      this.context.statusMessage = this.context.t("app.textChanged");
    } else {
      this.context.contents = next;
      this.core.updateNote();
    }
    this.dismissGrammarIssue(issue);
  }

  private async check() {
    try {
      this.context.grammarReport = await checkGrammar(
        this.context.settings.llm,
        this.context.contents,
        this.context.settings.grammarMode,
        this.context.grammarProfile,
      );
      this.context.statusMessage = this.context.t("app.writingScoreStatus", {
        score: this.context.grammarReport.score,
      });
    } catch (error) {
      this.context.grammarError =
        error instanceof Error ? error.message : String(error);
      this.context.statusMessage = this.context.grammarError;
    } finally {
      this.context.grammarChecking = false;
    }
  }

  private canSchedule() {
    return (
      (this.context.grammarAutoFull || this.context.grammarAutoDiff) &&
      this.context.grammarOpen
    );
  }

  private canAutoCheckGrammar() {
    return (
      this.context.grammarAutoFull ||
      (this.context.grammarAutoDiff &&
        Boolean(this.context.grammarCheckedText))
    );
  }

  private shouldCheckOnOpen() {
    return (
      this.context.grammarOpen &&
      this.canAutoCheckGrammar() &&
      !this.context.grammarReport &&
      !this.context.grammarError
    );
  }
}
