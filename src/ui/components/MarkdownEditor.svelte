<script lang="ts">
  import { cn } from "../../lib/utils/cn";
  import { continueList, renderDocument } from "../../lib/utils/markdown";

  export let value: string;
  export let element: HTMLElement | undefined = undefined;
  export let placeholder = "";
  export let className = "";
  export let onInput: () => void = () => {};

  let composing = false;

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

      if (node) {
        range.setStart(node, remaining);
      } else {
        range.setStart(block, 0);
      }

      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
      return;
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
  }

  function replace(start: number, end: number, text: string) {
    value = value.slice(0, start) + text + value.slice(end);
    render(start + text.length);
    onInput();
  }

  function handleInput() {
    if (composing) {
      return;
    }

    value = getText();
    render(caretOffset());
    onInput();
  }

  function handleKeydown(event: KeyboardEvent) {
    const offset = caretOffset();

    if (offset === null || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const lineStart = value.lastIndexOf("\n", offset - 1) + 1;

    if (event.key === "Enter") {
      event.preventDefault();
      const line = value.slice(lineStart, offset);
      const prefix = continueList(line);

      if (!prefix && /^(\s*)([-*+]|\d+\.)( \[[ x]\])? $/.test(line)) {
        replace(lineStart, offset, "");
        return;
      }

      replace(offset, offset, `\n${prefix}`);
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      replace(event.shiftKey ? lineStart : offset, offset, event.shiftKey ? value.slice(lineStart, offset).replace(/^ {1,2}/, "") : "  ");
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
    "h-full min-h-[17.5rem] w-full overflow-y-auto rounded-lg border border-stone-300 bg-stone-50 px-5 py-4 text-base leading-relaxed whitespace-pre-wrap text-stone-950 shadow-inner caret-emerald-700",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30",
    "dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100",
    className,
  )}
  oninput={handleInput}
  onkeydown={handleKeydown}
  onpaste={handlePaste}
  oncompositionstart={() => (composing = true)}
  oncompositionend={() => {
    composing = false;
    handleInput();
  }}
></div>

<style>
  [contenteditable]:has(> :global(div:only-child > br:only-child))::before,
  [contenteditable]:empty::before {
    content: attr(data-placeholder);
    color: rgb(168 162 158);
    pointer-events: none;
  }
</style>
