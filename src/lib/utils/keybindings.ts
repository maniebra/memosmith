import { shortcutKey } from "./shortcutKey";

/**
 * A keyboard shortcut declaration.
 *
 * `combination` is one or more steps separated by spaces. Each step is
 * `modifier+...+key`, e.g. `"mod+shift+n"` or `"mod+k mod+s"`. Modifiers are
 * `mod` (Ctrl or Cmd), `ctrl`, `meta`, `shift` and `alt`.
 *
 * `combinational` bindings fire on a single step, `sequential` ones fire after
 * every step is pressed in order.
 */
export type Keybinding<Context = void> = {
  combination: string;
  type: "sequential" | "combinational";
  name: string;
  /** Returning `false` means "not handled", so other handlers still see it. */
  action: (event: KeyboardEvent, context: Context) => boolean | void;
  description?: string | null;
};

const MODIFIER_KEYS = new Set(["control", "meta", "shift", "alt"]);

/** Key names that are easier to write than the raw `event.key` value. */
const KEY_ALIASES: Record<string, string> = {
  space: " ",
  esc: "escape",
};

/** How long a half-typed sequential binding waits for its next step. */
const SEQUENCE_TIMEOUT = 1500;

function steps(binding: Keybinding<never>) {
  return combinationOf(binding).trim().toLowerCase().split(/\s+/);
}

function matchStep(event: KeyboardEvent, step: string) {
  const parts = step.split("+");
  const raw = parts.pop() ?? "";
  const key = KEY_ALIASES[raw] ?? raw;
  const wanted = new Set(parts);
  const primary = event.ctrlKey || event.metaKey;

  if (wanted.has("mod")) {
    if (!primary) {
      return false;
    }
  } else if (
    wanted.has("ctrl") !== event.ctrlKey ||
    wanted.has("meta") !== event.metaKey
  ) {
    return false;
  }

  if (wanted.has("shift") !== event.shiftKey) {
    return false;
  }

  if (wanted.has("alt") !== event.altKey) {
    return false;
  }

  return key === shortcutKey(event) || key === event.key.toLowerCase();
}

/**
 * Builds a keydown handler for a set of bindings. Sequential bindings keep
 * their pending prefix between calls, so the runner is stateful, create one
 * per handler and reuse it.
 */
export function createKeybindings<Context = void>(
  source: Keybinding<Context>[] | (() => Keybinding<Context>[]),
) {
  if (Array.isArray(source)) {
    catalog.add(source as unknown as Keybinding<never>[]);
  }

  let pending: Keybinding<Context>[] = [];
  let depth = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function reset() {
    pending = [];
    depth = 0;
    clearTimeout(timer);
  }

  return function run(event: KeyboardEvent, context: Context) {
    if (MODIFIER_KEYS.has(event.key.toLowerCase())) {
      return false;
    }

    // A plain letter inside a text field is typing, not a shortcut.
    if (isTyping(event)) {
      reset();
      return false;
    }

    const pool = depth
      ? pending
      : typeof source === "function"
        ? source()
        : source;
    const hits = pool.filter((binding) =>
      matchStep(event, steps(binding as Keybinding<never>)[depth] ?? ""),
    );

    if (!hits.length) {
      reset();
      return false;
    }

    const complete = hits.find(
      (binding) => steps(binding as Keybinding<never>).length === depth + 1,
    );

    if (complete) {
      reset();
      return complete.action(event, context) !== false;
    }

    // Half-typed sequence: swallow the step and wait for the rest.
    pending = hits;
    depth += 1;
    clearTimeout(timer);
    timer = setTimeout(reset, SEQUENCE_TIMEOUT);
    event.preventDefault();
    return true;
  };
}

const catalog = new Set<Keybinding<never>[]>();

/** Every declared binding with its live combination, for the settings editor. */
export function listKeybindings() {
  return [...catalog]
    .flat()
    .map((binding) => ({
      name: binding.name,
      combination: combinationOf(binding),
      description: binding.description ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

let overrides: Record<string, string> = {};

/**
 * Swaps in the combinations of the active keybinding mode, keyed by binding
 * name. Applies to every runner, including the editor's own.
 */
export function setKeybindingOverrides(next: Record<string, string>) {
  overrides = next;
}

function combinationOf(binding: Keybinding<never>) {
  return overrides[binding.name] ?? binding.combination;
}

let vimNormal = false;

/** Vim's normal mode makes bare letters commands rather than typing. */
export function setVimNormal(next: boolean) {
  vimNormal = next;
}

function isTyping(event: KeyboardEvent) {
  if (vimNormal) {
    return false;
  }

  const plain = !event.ctrlKey && !event.metaKey && !event.altKey;

  if (!plain || event.key.length !== 1) {
    return false;
  }

  const target = event.target as HTMLElement | null;

  return Boolean(
    target?.closest?.(
      "input, textarea, [contenteditable]:not([contenteditable='false'])",
    ),
  );
}

const globalGroups = new Set<Keybinding[]>();

const runGlobalKeybindings = createKeybindings(() => [...globalGroups].flat());

/**
 * Adds bindings to the single window-level set, so a half-typed sequence is
 * shared instead of racing between one listener per component. Returns the
 * unregister function, which is what Svelte's `onMount` expects back.
 */
export function registerKeybindings(bindings: Keybinding[]) {
  globalGroups.add(bindings);
  catalog.add(bindings as Keybinding<never>[]);

  return () => {
    globalGroups.delete(bindings);
  };
}

const seen = new WeakSet<KeyboardEvent>();

/** Runs a registered binding by name, for commands that arrive another way. */
export function runKeybinding(name: string) {
  const binding = [...globalGroups].flat().find((entry) => entry.name === name);

  if (!binding) {
    return false;
  }

  return binding.action(new KeyboardEvent("keydown"), undefined) !== false;
}

export function handleGlobalKeydown(event: KeyboardEvent) {
  // Capture-phase callers get here first; the window handler must not rerun
  // the same event and step through a half-typed sequence twice.
  if (event.defaultPrevented || seen.has(event)) {
    return false;
  }

  seen.add(event);

  return runGlobalKeybindings(event, undefined);
}
