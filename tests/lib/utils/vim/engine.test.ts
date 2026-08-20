const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { handleVimKey } from "../../../../src/lib/utils/vim/engine";
import {
  createVimState,
  type VimDoc,
  type VimState,
} from "../../../../src/lib/utils/vim/types";

type Session = {
  state: VimState;
  doc: VimDoc;
  feed: (keys: string) => Session;
  commands: string[];
};

/** Feeds keys one at a time and applies each edit, like the editor does. */
function session(text: string, caret = 0): Session {
  const state = createVimState();
  const doc: VimDoc = { text, caret, selection: { start: caret, end: caret } };
  const commands: string[] = [];
  const api: Session = {
    state,
    doc,
    commands,
    feed(keys: string) {
      for (const key of [...keys]) {
        const result = handleVimKey(state, doc, key === "…" ? "Escape" : key);

        if (result.command) {
          commands.push(result.command);
        }

        if (result.edit) {
          doc.text =
            doc.text.slice(0, result.edit.start) +
            result.edit.text +
            doc.text.slice(result.edit.end);
        }

        if (typeof result.caret === "number") {
          doc.caret = result.caret;
          doc.selection = result.selection ?? {
            start: result.caret,
            end: result.caret,
          };
        }
      }

      return api;
    },
  };

  return api;
}

// Motions
{
  const s = session("hello world\nsecond line", 0);
  s.feed("w");
  assert(s.doc.caret === 6, "w moves to the next word");
  s.feed("e");
  assert(s.doc.caret === 10, "e moves to the word end");
  s.feed("0");
  assert(s.doc.caret === 0, "0 moves to the line start");
  s.feed("$");
  assert(s.doc.caret === 10, "$ stops on the last character");
  s.feed("j");
  assert(s.doc.caret === 22, "j keeps the column where it can");
  s.feed("b");
  assert(s.doc.caret === 19, "b moves back a word");
  s.feed("gg");
  assert(s.doc.caret === 0, "gg goes to the first line");
  s.feed("G");
  assert(s.doc.caret === 12, "G goes to the last line");
}

// Counts and finds
{
  const s = session("alpha beta gamma delta", 0);
  s.feed("3w");
  assert(s.doc.caret === 17, "3w moves three words");
  s.feed("0fa");
  assert(s.doc.caret === 4, "fa finds the next a");
  s.feed(";");
  assert(s.doc.caret === 9, "; repeats the find");
  s.feed("0ta");
  assert(s.doc.caret === 3, "ta stops before the match");
}

// Operators with motions
{
  const s = session("hello world", 0);
  s.feed("dw");
  assert(s.doc.text === "world", "dw deletes to the next word");
  assert(s.state.registers['"'].text === "hello ", "dw fills the register");
}

{
  const s = session("hello world", 6);
  s.feed("cw");
  assert(s.doc.text === "hello ", "cw changes to the word end");
  assert(s.state.mode === "insert", "cw leaves the engine in insert mode");
}

{
  const s = session("one\ntwo\nthree", 4);
  s.feed("dd");
  assert(s.doc.text === "one\nthree", "dd deletes the whole line");
  s.feed("P");
  assert(s.doc.text === "one\ntwo\nthree", "P puts the line back");
}

{
  const s = session("one\ntwo\nthree", 0);
  s.feed("2dd");
  assert(s.doc.text === "three", "2dd deletes two lines");
}

{
  const s = session("alpha beta", 0);
  s.feed("yw");
  assert(s.state.registers['"'].text === "alpha ", "yw yanks a word");
  s.feed("$p");
  assert(s.doc.text === "alpha betaalpha ", "p pastes after the caret");
}

// Text objects
{
  const s = session('say "hello there" now', 7);
  s.feed('di"');
  assert(s.doc.text === 'say "" now', 'di" empties the quotes');
}

{
  const s = session("call(alpha, beta)", 8);
  s.feed("da(");
  assert(s.doc.text === "call", "da( removes the parentheses too");
}

{
  const s = session("one two three", 4);
  s.feed("diw");
  assert(s.doc.text === "one  three", "diw removes the inner word");
}

// Character edits
{
  const s = session("abcd", 1);
  s.feed("x");
  assert(s.doc.text === "acd", "x deletes the character under the caret");
  s.feed("2x");
  assert(s.doc.text === "a", "2x deletes two characters");
}

{
  const s = session("abc", 0);
  s.feed("rz");
  assert(s.doc.text === "zbc", "r replaces one character");
  s.feed("~");
  assert(s.doc.text === "zBc" || s.doc.text === "Zbc", "~ flips the case");
}

{
  const s = session("one\ntwo", 0);
  s.feed("J");
  assert(s.doc.text === "one two", "J joins the next line with a space");
}

// Indent
{
  const s = session("line", 0);
  s.feed(">>");
  assert(s.doc.text === "  line", ">> indents the line");
  s.feed("<<");
  assert(s.doc.text === "line", "<< outdents it again");
}

// Visual mode
{
  const s = session("hello world", 0);
  s.feed("vey");
  assert(s.state.registers['"'].text === "hello", "visual y yanks the word");
  assert(s.state.mode === "normal", "visual mode ends after the operator");
}

{
  const s = session("one\ntwo\nthree", 4);
  s.feed("Vd");
  assert(s.doc.text === "one\nthree", "V then d deletes the line");
}

// Insert entries
{
  const s = session("ab", 0);
  s.feed("a");
  assert(s.state.mode === "insert", "a enters insert mode");
  assert(s.doc.caret === 1, "a moves one character right");
  s.feed("…");
  assert(s.state.mode === "normal", "Escape returns to normal");
}

{
  const s = session("one", 0);
  s.feed("o");
  assert(s.doc.text === "one\n", "o opens a line below");
  assert(s.state.mode === "insert", "o enters insert mode");
}

// Registers
{
  const s = session("alpha\nbeta", 0);
  s.feed('"ayy');
  assert(s.state.registers.a.text === "alpha\n", "yy fills the named register");
  s.feed('j"ap');
  assert(s.doc.text === "alpha\nbeta\nalpha\n", "p reads the named register");
}

// Dot repeat
{
  const s = session("aaa bbb ccc", 0);
  s.feed("dw");
  assert(s.doc.text === "bbb ccc", "dw removes the first word");
  s.feed(".");
  assert(s.doc.text === "ccc", ". repeats the delete");
}

// Editor commands
{
  const s = session("text", 0);
  s.feed("u");
  assert(s.commands[0] === "undo", "u asks the editor to undo");
  s.feed("n");
  assert(s.commands[1] === "findNext", "n asks for the next match");
}

// Escape
{
  const s = session("one two", 0);
  s.feed("d");
  const busy = handleVimKey(s.state, s.doc, "Escape");
  assert(busy.handled, "Escape cancels a pending operator");
  const idle = handleVimKey(s.state, s.doc, "Escape");
  assert(!idle.handled, "a bare Escape in normal mode is left to the app");
}

// Visual selection follows the caret
{
  const s = session("hello world", 0);
  s.feed("v");
  s.feed("l");
  assert(s.doc.selection.start === 0, "visual keeps the anchor");
  assert(s.doc.selection.end === 2, "visual grows with the motion");
  s.feed("…");
  assert(s.state.mode === "normal", "Escape leaves visual mode");
}

// Dot repeat replays typed text
{
  const s = session("aaa bbb", 0);
  s.feed("cw");
  assert(s.state.mode === "insert", "cw enters insert mode");
  for (const key of [..."zz"]) {
    handleVimKey(s.state, s.doc, key);
  }
  s.doc.text = "zz bbb";
  s.doc.caret = 2;
  s.feed("…");
  s.feed("w.");
  assert(s.doc.text === "zz zz", ". replays the change with its typed text");
}

console.log("vim engine ok");
