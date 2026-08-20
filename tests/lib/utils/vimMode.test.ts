const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import { get } from "svelte/store";
import {
  isVimEnabled,
  setVimEnabled,
  syncVimMode,
  vimState,
  vimSubMode,
} from "../../../src/lib/utils/vimMode";

assert(!isVimEnabled(), "vim mode starts off");
assert(get(vimSubMode) === null, "no mode is shown while vim is off");

setVimEnabled(true);
assert(isVimEnabled(), "vim mode turns on");
assert(get(vimSubMode) === "normal", "vim mode starts in normal");
assert(vimState.mode === "normal", "the engine state follows");

syncVimMode("insert");
assert(get(vimSubMode) === "insert", "insert mode reaches the status bar");

setVimEnabled(false);
assert(get(vimSubMode) === null, "turning vim off clears the indicator");
assert(vimState.mode === "insert", "keys pass through when vim is off");

console.log("vim mode ok");
