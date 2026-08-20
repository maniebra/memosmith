export type VimMode = "normal" | "insert" | "visual" | "visual-line";

export type VimRegister = { text: string; linewise: boolean };

export type FindKind = "f" | "F" | "t" | "T";

export type VimState = {
  mode: VimMode;
  /** Digits typed so far, e.g. "12" in `12dd`. */
  count: string;
  /** The operator waiting for a motion: `d`, `c`, `y`, `>`, `<`, `gu`, `gU`. */
  operator: string | null;
  operatorCount: string;
  /** A key that needs one more key, e.g. `g`, `f`, `r`, `"`, `i`, `a`. */
  pending: string | null;
  register: string | null;
  registers: Record<string, VimRegister>;
  /** Where visual mode started. */
  anchor: number | null;
  lastFind: { kind: FindKind; char: string } | null;
  /** Keys of the last change, replayed by `.`. */
  lastChange: string[] | null;
  /** Keys of the change being typed, collected until it completes. */
  recording: string[] | null;
  /** Column the caret tries to keep across `j`/`k`. */
  desiredColumn: number | null;
};

export type VimDoc = {
  text: string;
  caret: number;
  selection: { start: number; end: number };
};

/** A replacement over the whole document text. */
export type VimEdit = { start: number; end: number; text: string };

/** Things the engine cannot do to plain text, handed back to the editor. */
export type VimCommand =
  | "undo"
  | "redo"
  | "find"
  | "findNext"
  | "findPrevious"
  | "nextTab"
  | "previousTab";

export type VimResult = {
  handled: boolean;
  edit?: VimEdit;
  caret?: number;
  selection?: { start: number; end: number } | null;
  mode: VimMode;
  command?: VimCommand;
};

export function createVimState(): VimState {
  return {
    mode: "normal",
    count: "",
    operator: null,
    operatorCount: "",
    pending: null,
    register: null,
    registers: {},
    anchor: null,
    lastFind: null,
    lastChange: null,
    recording: null,
    desiredColumn: null,
  };
}
