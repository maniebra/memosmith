<script lang="ts">
  import { cn } from "../../lib/utils/cn";
  import { applyPrefix, continueList, renderDocument, SLASH_COMMANDS } from "../../lib/utils/markdown";

  export let value: string;
  export let element: HTMLElement | undefined = undefined;
  export let placeholder = "";
  export let className = "";
  export let onInput: () => void = () => {};

  let composing = false;
  let slashStart: number | null = null;
  let slashQuery = "";
  let slashIndex = 0;
  let menuPosition = { top: 0, left: 0 };

  $: matches = SLASH_COMMANDS.filter((command) =>
    command.label.toLowerCase().includes(slashQuery.toLowerCase()),
  );
  $: if (element && !composing && getText() !== value) {
    render(caretOffset());
  }

  function blocks() {
    return Array.from(element?.children ?? []) as HTMLElement[];
  }

  function getText() {
    return blocks()
      .map((block) => block.textContent ?? "")
      .join("\n");
  }

  function caretOffset() {
    const selection = getSelection();

    if (!element || !selection?.focusNode || !element.contains(selection.focusNode)) {
      return null;
    }

    let offset = 0;

    for (const block of blocks()) {
      if (block.contains(selection.focusNode) || block === selection.focusNode) {
        const range = document.createRange();
        range.selectNodeContents(block);
        range.setEnd(selection.focusNode, selection.focusOffset);

        return offset + range.toString().length;
      }

      offset += (block.textContent ?? "").length + 1;
    }

    return null;
  }

  function setCaret(offset: number) {
    let remaining = offset;

    for (const block of blocks()) {
      const length = (block.textContent ?? "").length;

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();

      while (node && remaining > (node.textContent ?? "").length) {
        remaining -= (node.textContent ?? "").length;
        node = walker.nextNode();
      }

      const selection = getSelection();
      const range = document.createRange();

      range.setStart(node ?? block, node ? remaining : 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
  }

  /** Markdown markers stay hidden except on the block holding the caret. */
  function markActiveBlock() {
    const selection = getSelection();

    for (const block of blocks()) {
      const isActive = Boolean(selection?.focusNode && block.contains(selection.focusNode));

      block.toggleAttribute("data-active", isActive);
    }
  }

  function render(offset: number | null) {
    if (!element) {
      return;
    }

    element.innerHTML = renderDocument(value);

    if (offset !== null) {
      setCaret(offset);
    }

    markActiveBlock();
  }

  function replace(start: number, end: number, text: string, caret = start + text.length) {
    value = value.slice(0, start) + text + value.slice(end);
    render(caret);
    onInput();
  }

  function lineStartAt(offset: number) {
    return value.lastIndexOf("\n", offset - 1) + 1;
  }

  function closeMenu() {
    slashStart = null;
    slashQuery = "";
    slashIndex = 0;
  }

  function syncMenu(offset: number) {
    const typed = /(?:^|\s)\/([\w ]*)$/.exec(value.slice(lineStartAt(offset), offset));

    if (!typed) {
      closeMenu();
      return;
    }

    slashStart = offset - typed[1].length - 1;
    slashQuery = typed[1];
    slashIndex = 0;

    const rect = getSelection()?.getRangeAt(0).getBoundingClientRect();

    if (rect) {
      menuPosition = { top: rect.bottom + 4, left: rect.left };
    }
  }

  function runCommand(prefix: string) {
    const offset = caretOffset();

    if (offset === null || slashStart === null) {
      return;
    }

    const start = lineStartAt(offset);
    const lineEnd = value.indexOf("\n", offset) === -1 ? value.length : value.indexOf("\n", offset);
    const tail = value.slice(offset, lineEnd);
    const nextLine = applyPrefix(value.slice(start, slashStart) + tail, prefix);

    closeMenu();
    replace(start, lineEnd, nextLine, start + nextLine.length - tail.length);
  }

  function handleInput() {
    if (composing) {
      return;
    }

    value = getText();
    const offset = caretOffset();
    render(offset);

    if (offset !== null) {
      syncMenu(offset);
    }

    onInput();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (slashStart !== null && matches.length) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        slashIndex = (slashIndex + (event.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length;
        return;
      }

      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        runCommand(matches[slashIndex].prefix);
        return;
      }

      if (event.key === "Escape") {
        closeMenu();
        return;
      }
    }

    const offset = caretOffset();

    if (offset === null || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const start = lineStartAt(offset);

    if (event.key === "Enter") {
      event.preventDefault();
      closeMenu();

      const line = value.slice(start, offset);
      const prefix = continueList(line);

      if (!prefix && /^\s*([-*+]|\d+\.)( \[[ x]\])? $/.test(line)) {
        replace(start, offset, "");
        return;
      }

      replace(offset, offset, `\n${prefix}`);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();

      if (event.shiftKey) {
        replace(start, offset, value.slice(start, offset).replace(/^ {1,2}/, ""));
      } else {
        replace(offset, offset, "  ");
      }
    }
  }

  function handlePaste(event: ClipboardEvent) {
    const offset = caretOffset();
    const text = event.clipboardData?.getData("text/plain");

    if (offset === null || !text) {
      return;
    }

    event.preventDefault();
    replace(offset, offset, text);
  }
</script>

<svelte:document onselectionchange={markActiveBlock} />

<div
  bind:this={element}
  contenteditable="true"
  spellcheck="true"
  role="textbox"
  tabindex="0"
  aria-multiline="true"
  aria-label="Markdown editor"
  data-placeholder={placeholder}
  class={cn(
    "min-h-[60vh] w-full text-[1.0625rem] leading-[1.75] whitespace-pre-wrap text-stone-900 caret-emerald-700",
    "focus-visible:outline-none",
    "dark:text-stone-100 dark:caret-emerald-400",
    className,
  )}
  oninput={handleInput}
  onkeydown={handleKeydown}
  onpaste={handlePaste}
  onblur={closeMenu}
  oncompositionstart={() => (composing = true)}
  oncompositionend={() => {
    composing = false;
    handleInput();
  }}
></div>

{#if slashStart !== null && matches.length}
  <ul
    class="fixed z-50 max-h-72 w-64 overflow-y-auto rounded-xl border border-stone-200 bg-white/95 p-1 shadow-xl shadow-stone-900/10 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 dark:shadow-black/40"
    style="top: {menuPosition.top}px; left: {menuPosition.left}px;"
    role="listbox"
    aria-label="Block commands"
  >
    {#each matches as command, index}
      <li>
        <button
          type="button"
          role="option"
          aria-selected={index === slashIndex}
          class={cn(
            "flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
            index === slashIndex
              ? "bg-emerald-600/10 text-emerald-800 dark:text-emerald-300"
              : "text-stone-700 dark:text-stone-200",
          )}
          onmousedown={(event) => {
            event.preventDefault();
            runCommand(command.prefix);
          }}
          onmouseenter={() => (slashIndex = index)}
        >
          <span>{command.label}</span>
          <span
            class="rounded border border-stone-200 px-1.5 py-px font-mono text-[0.7rem] text-stone-400 dark:border-stone-700 dark:text-stone-500"
            >{command.hint}</span
          >
        </button>
      </li>
    {/each}
  </ul>
{/if}

<style>
  [contenteditable]:has(> :global(div:only-child > br:only-child))::before,
  [contenteditable]:empty::before {
    content: attr(data-placeholder);
    color: rgb(168 162 158);
    pointer-events: none;
  }

  /* Notion-style hint on whichever empty line holds the caret. */
  [contenteditable]:not(:empty) :global(.md-block[data-active]:has(> br:only-child))::before {
    content: "Type '/' for commands";
    position: absolute;
    inset-inline-start: 0;
    color: rgb(168 162 158 / 0.7);
    pointer-events: none;
  }
</style>
