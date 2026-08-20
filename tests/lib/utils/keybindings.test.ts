const assert = (ok: unknown, msg: string) => {
  if (!ok) throw new Error(msg);
};
import {
  createKeybindings,
  setKeybindingOverrides,
  type Keybinding,
} from "../../../src/lib/utils/keybindings";
import { keybindingOverrides } from "../../../src/lib/utils/keybindingModes";

const press = (key: string, modifiers: Partial<KeyboardEvent> = {}) =>
  ({
    key,
    code: /^[a-z]$/.test(key) ? `Key${key.toUpperCase()}` : "",
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: () => {},
    ...modifiers,
  }) as KeyboardEvent;

const fired: string[] = [];

const bindings: Keybinding[] = [
  {
    combination: "mod+b",
    type: "combinational",
    name: "bold",
    action: () => void fired.push("bold"),
  },
  {
    combination: "mod+shift+n",
    type: "combinational",
    name: "newFolder",
    action: () => void fired.push("newFolder"),
  },
  {
    combination: "mod+k mod+s",
    type: "sequential",
    name: "settings",
    description: null,
    action: () => void fired.push("settings"),
  },
  {
    combination: "escape",
    type: "combinational",
    name: "close",
    action: () => false,
  },
];

const run = createKeybindings(bindings);

assert(run(press("b", { ctrlKey: true }), undefined), "ctrl+b handled");
assert(fired[fired.length - 1] === "bold", "ctrl+b runs bold");
assert(run(press("b", { metaKey: true }), undefined), "mod matches meta too");

assert(!run(press("b"), undefined), "bare b is not a shortcut");
assert(
  !run(press("b", { ctrlKey: true, altKey: true }), undefined),
  "extra modifiers do not match",
);
assert(
  !run(press("n", { ctrlKey: true }), undefined),
  "missing shift does not match a shift binding",
);
assert(
  run(press("n", { ctrlKey: true, shiftKey: true }), undefined),
  "ctrl+shift+n handled",
);

assert(run(press("k", { ctrlKey: true }), undefined), "chord prefix swallowed");
assert(fired[fired.length - 1] === "newFolder", "prefix alone fires nothing");
assert(
  run(press("Shift"), undefined) === false,
  "modifier-only keydown is ignored",
);
assert(run(press("s", { ctrlKey: true }), undefined), "chord completes");
assert(fired[fired.length - 1] === "settings", "ctrl+k ctrl+s runs settings");

assert(
  !run(press("s", { ctrlKey: true }), undefined),
  "second step alone does not fire",
);

run(press("k", { ctrlKey: true }), undefined);
assert(!run(press("z", { ctrlKey: true }), undefined), "bad step aborts chord");
assert(!run(press("s", { ctrlKey: true }), undefined), "chord state was reset");

assert(
  !run(press("Escape"), undefined),
  "an action returning false reports unhandled",
);

setKeybindingOverrides({ settings: "space s" });
assert(run(press(" "), undefined), "override prefix swallowed");
assert(run(press("s"), undefined), "override replaces the combination");
assert(fired[fired.length - 1] === "settings", "space s runs settings");
run(press("k", { ctrlKey: true }), undefined);
assert(
  !run(press("s", { ctrlKey: true }), undefined),
  "the replaced combination no longer fires",
);
setKeybindingOverrides({});

assert(
  keybindingOverrides({ mode: "default", combinations: { a: "b" } }).a ===
    undefined,
  "default mode ignores custom combinations",
);
assert(
  keybindingOverrides({ mode: "vim", combinations: {} })["app.nextTab"] ===
    "g t",
  "vim mode maps tab cycling to g t",
);
assert(
  keybindingOverrides({ mode: "custom", combinations: { a: "b" } }).a === "b",
  "custom mode uses the stored combinations",
);

console.log("keybindings ok");
