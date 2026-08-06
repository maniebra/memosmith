<script lang="ts">
  import { onMount } from "svelte";
  import { cn } from "../../lib/utils/cn";
  import ContextMenu, { type ContextMenuItem } from "./ContextMenu.svelte";
  import {
    applyPrefix,
    continueList,
    insideFence,
    mathUnclosed,
    renderDocument,
    SLASH_COMMANDS,
  } from "../../lib/utils/markdown";

  export let value: string;
  export let element: HTMLElement | undefined = undefined;
  export let placeholder = "";
  export let textSize = 17;
  export let spellcheck = true;
  export let slashCommands = true;
  export let editable = true;
  export let className = "";
  export let onInput: () => void = () => {};

  let composing = false;

  /** Without an initial render the editor has no blocks, so typed text has nowhere to land. */
  onMount(() => render(null));

  let slashStart: number | null = null;
  let slashQuery = "";
  let slashIndex = 0;
  let menuPosition = { top: 0, left: 0 };
  let contextMenu:
    | {
        x: number;
        y: number;
        hasSelection: boolean;
      }
    | null = null;

  $: matches = SLASH_COMMANDS.filter((command) =>
    command.label.toLowerCase().includes(slashQuery.toLowerCase()),
  );
  $: if (!slashCommands && slashStart !== null) {
    closeMenu();
  }
  $: if (element && !composing && getText() !== value) {
    render(caretOffset());
  }

  /** Previews are rendered output, not source: they must not shift caret offsets or line counts. */
  function blocks() {
    return (Array.from(element?.children ?? []) as HTMLElement[]).filter(
      (block) => !block.classList.contains("md-preview"),
    );
  }

  function isRenderedMath(node: Node) {
    return node instanceof HTMLElement && node.classList.contains("md-math-rendered");
  }

  function sourceText(node: Node): string {
    if (isRenderedMath(node)) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent ?? "";
    }

    return Array.from(node.childNodes).map(sourceText).join("");
  }

  function sourceLength(node: Node) {
    return sourceText(node).length;
  }

  function sourceLengthBefore(node: Node, offset: number) {
    if (node.nodeType === Node.TEXT_NODE) {
      return (node.textContent ?? "").slice(0, offset).length;
    }

    return Array.from(node.childNodes)
      .slice(0, offset)
      .reduce((length, child) => length + sourceLength(child), 0);
  }

  function sourceOffsetWithin(root: Node, target: Node, targetOffset: number) {
    let offset = 0;
    let found = false;

    function visit(node: Node) {
      if (isRenderedMath(node)) {
        return;
      }

      if (node === target) {
        offset += sourceLengthBefore(node, targetOffset);
        found = true;
        return;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        offset += node.textContent?.length ?? 0;
        return;
      }

      for (const child of Array.from(node.childNodes)) {
        if (found) {
          return;
        }

        visit(child);
      }
    }

    visit(root);

    return found ? offset : null;
  }

  function caretPositionIn(node: Node, offset: number): { node: Node; offset: number } | null {
    if (isRenderedMath(node)) {
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return {
        node,
        offset: Math.min(offset, node.textContent?.length ?? 0),
      };
    }

    let remaining = offset;

    for (const [index, child] of Array.from(node.childNodes).entries()) {
      const length = sourceLength(child);

      if (remaining > length) {
        remaining -= length;
        continue;
      }

      if (length === 0) {
        return { node, offset: index };
      }

      return caretPositionIn(child, remaining);
    }

    return { node, offset: node.childNodes.length };
  }

  let activeBlock: HTMLElement | undefined;

  function setActiveBlock(active: HTMLElement | undefined) {
    // selectionchange fires far more often than the active block actually moves.
    if (active === activeBlock) {
      return;
    }

    activeBlock = active;
    const group = active?.dataset.code ?? active?.dataset.math;
    const groupName =
      active?.dataset.code !== undefined ? "code" : active?.dataset.math !== undefined ? "math" : null;

    for (const block of Array.from(element?.children ?? []) as HTMLElement[]) {
      block.toggleAttribute(
        "data-active",
        block === active || (groupName !== null && block.dataset[groupName] === group),
      );
    }
  }

  function blockAtOffset(offset: number) {
    let remaining = offset;

    for (const block of blocks()) {
      const length = sourceLength(block);

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      return block;
    }

    const currentBlocks = blocks();

    return currentBlocks[currentBlocks.length - 1];
  }

  function getText() {
    return blocks()
      .map(sourceText)
      .join("\n");
  }

  function caretOffset() {
    const selection = getSelection();

    return selection?.focusNode ? offsetForPosition(selection.focusNode, selection.focusOffset) : null;
  }

  function offsetForPosition(node: Node, nodeOffset: number): number | null {
    if (!element || !element.contains(node)) {
      return null;
    }

    // A caret parked in a preview belongs to the source line above it, not to nowhere.
    const preview = (node instanceof HTMLElement ? node : node.parentElement)?.closest(".md-preview");

    if (preview) {
      const source = preview.previousElementSibling;

      return source ? offsetForPosition(source, source.childNodes.length) : null;
    }

    let offset = 0;

    for (const block of blocks()) {
      if (block.contains(node) || block === node) {
        const lineOffset = sourceOffsetWithin(block, node, nodeOffset);

        return lineOffset === null ? null : offset + lineOffset;
      }

      offset += sourceLength(block) + 1;
    }

    return null;
  }

  function selectionOffsets() {
    const selection = getSelection();

    if (!selection?.anchorNode || !selection.focusNode) {
      return null;
    }

    const anchor = offsetForPosition(selection.anchorNode, selection.anchorOffset);
    const focus = offsetForPosition(selection.focusNode, selection.focusOffset);

    if (anchor === null || focus === null) {
      return null;
    }

    return {
      start: Math.min(anchor, focus),
      end: Math.max(anchor, focus),
    };
  }

  function setCaret(offset: number) {
    let remaining = offset;

    for (const block of blocks()) {
      const length = sourceLength(block);

      if (remaining > length) {
        remaining -= length + 1;
        continue;
      }

      const position = caretPositionIn(block, remaining);

      const selection = getSelection();
      const range = document.createRange();

      range.setStart(position?.node ?? block, position?.offset ?? 0);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
    }
  }

  /** Markdown markers stay hidden except on the block holding the caret; a code block counts as one. */
  function markActiveBlock() {
    const selection = getSelection();
    const containing = blocks().find((block) =>
      Boolean(selection?.focusNode && block.contains(selection.focusNode)),
    );
    const offset = containing ? null : caretOffset();

    setActiveBlock(containing ?? (offset === null ? undefined : blockAtOffset(offset)));
  }

  function render(offset: number | null) {
    if (!element) {
      return;
    }

    element.innerHTML = renderDocument(value);

    if (offset !== null) {
      setActiveBlock(blockAtOffset(offset));
      setCaret(offset);
    }

    markActiveBlock();
  }

  function replace(start: number, end: number, text: string, caret = start + text.length) {
    value = value.slice(0, start) + text + value.slice(end);
    render(caret);
    onInput();
  }

  function replaceSelection(text: string) {
    const selection = selectionOffsets();
    const start = selection?.start ?? caretOffset();

    if (start === null) {
      return;
    }

    replace(start, selection?.end ?? start, text);
  }

  function placeCaretAtPoint(event: MouseEvent) {
    const selection = selectionOffsets();

    if (selection && selection.start !== selection.end) {
      return;
    }

    const caretDocument = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let range = caretDocument.caretRangeFromPoint?.(event.clientX, event.clientY) ?? null;

    if (!range) {
      const position = caretDocument.caretPositionFromPoint?.(event.clientX, event.clientY);

      if (position) {
        range = document.createRange();
        range.setStart(position.offsetNode, position.offset);
      }
    }

    if (!range || !element?.contains(range.startContainer)) {
      return;
    }

    range.collapse(true);
    const nextSelection = getSelection();
    nextSelection?.removeAllRanges();
    nextSelection?.addRange(range);
    markActiveBlock();
  }

  async function copySelection() {
    const selection = selectionOffsets();

    if (!selection || selection.start === selection.end) {
      return;
    }

    await navigator.clipboard.writeText(value.slice(selection.start, selection.end));
  }

  async function cutSelection() {
    const selection = selectionOffsets();

    if (!selection || selection.start === selection.end) {
      return;
    }

    await navigator.clipboard.writeText(value.slice(selection.start, selection.end));
    replace(selection.start, selection.end, "");
  }

  async function pasteClipboard() {
    const text = await navigator.clipboard.readText();

    if (text) {
      replaceSelection(text);
    }
  }

  function selectAll() {
    if (!element) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    markActiveBlock();
  }

  function openContextMenu(event: MouseEvent) {
    event.preventDefault();
    element?.focus();
    closeMenu();
    placeCaretAtPoint(event);

    const selection = selectionOffsets();

    contextMenu = {
      x: event.clientX,
      y: event.clientY,
      hasSelection: Boolean(selection && selection.start !== selection.end),
    };
  }

  function contextItems(): ContextMenuItem[] {
    return [
      {
        label: "Cut",
        shortcut: "Ctrl X",
        disabled: !editable || !contextMenu?.hasSelection,
        onSelect: cutSelection,
      },
      {
        label: "Copy",
        shortcut: "Ctrl C",
        disabled: !contextMenu?.hasSelection,
        onSelect: copySelection,
      },
      {
        label: "Paste",
        shortcut: "Ctrl V",
        disabled: !editable,
        onSelect: pasteClipboard,
      },
      { separator: true },
      {
        label: "Select all",
        shortcut: "Ctrl A",
        disabled: !value,
        onSelect: selectAll,
      },
    ];
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
    if (!slashCommands) {
      closeMenu();
      return;
    }

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

    // A code block needs its closing fence, with the caret waiting on the line between.
    if (prefix.startsWith("```")) {
      const opening = applyPrefix(value.slice(start, slashStart), prefix);

      replace(start, lineEnd, `${opening}\n${tail}\n\`\`\``, start + opening.length + 1);
      return;
    }

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
    if (slashCommands && slashStart !== null && matches.length) {
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

    // Third backtick opens a fenced block and closes it, caret on the line between.
    if (event.key === "`" && /^[ \t]*``$/.test(value.slice(start, offset)) && !insideFence(value.slice(0, start))) {
      event.preventDefault();
      closeMenu();
      replace(offset, offset, "`\n\n```", offset + 2);
      return;
    }

    // Only close a `$$` that has no partner; inside an existing block Enter is just a new line.
    if (event.key === "Enter" && /^[ \t]*\$\$$/.test(value.slice(start, offset)) && mathUnclosed(value)) {
      event.preventDefault();
      closeMenu();
      replace(offset, offset, "\n\n$$", offset + 1);
      return;
    }

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
  contenteditable={editable}
  {spellcheck}
  role="textbox"
  tabindex="0"
  aria-multiline="true"
  aria-label="Markdown editor"
  style="--md-placeholder: '{placeholder}'; font-size: {textSize}px;"
  class={cn(
    "min-h-[60vh] w-full leading-[1.75] whitespace-pre-wrap caret-emerald-700",
    "focus-visible:outline-none",
    editable
      ? "text-stone-900 dark:text-stone-100"
      : "cursor-default text-stone-400 dark:text-stone-500",
    "dark:caret-emerald-400",
    className,
  )}
  oninput={handleInput}
  onkeydown={handleKeydown}
  oncontextmenu={openContextMenu}
  onpaste={handlePaste}
  onblur={closeMenu}
  oncompositionstart={() => (composing = true)}
  oncompositionend={() => {
    composing = false;
    handleInput();
  }}
></div>

{#if contextMenu}
  <ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    items={contextItems()}
    onClose={() => (contextMenu = null)}
  />
{/if}

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
  /* The fence lines are scaffolding: only show them while the caret is in that code block. */
  [contenteditable] :global(.md-fence:not([data-active])) {
    display: none;
  }

  /* Hint on the caret's empty line, and on an empty document. */
  [contenteditable]
    :global(
      .md-block:not(.md-codeblock, .md-fence):has(> br:only-child):is([data-active], :only-child)
    )::before {
    content: var(--md-placeholder);
    position: absolute;
    inset-inline-start: 0;
    color: rgb(168 162 158 / 0.7);
    pointer-events: none;
  }
</style>
