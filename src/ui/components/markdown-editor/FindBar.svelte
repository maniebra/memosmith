<script lang="ts">
  import { ChevronDown, ChevronUp, X } from "@lucide/svelte";
  import { i18n } from "../../../lib/i18n";
  import Button from "../Button.svelte";
  import Input from "../Input.svelte";
  import type { FindState } from "./find";

  export let state: FindState;
  export let editable = true;
  export let onQuery: (query: string) => void;
  export let onReplacement: (replacement: string) => void;
  export let onGoto: (delta: number) => void;
  export let onReplaceOne: () => void;
  export let onReplaceAll: () => void;
  export let onClose: () => void;
  export let onOpen: (replaceMode: boolean) => void;

  /** Opening the bar should let the user type straight away. */
  function focusQuery(node: HTMLElement) {
    const input = node.querySelector("input");

    input?.focus();
    input?.select();
  }

  function handleKeydown(event: KeyboardEvent) {
    const key = event.key.toLowerCase();

    // The shortcuts keep working while the bar itself holds the focus.
    if ((event.ctrlKey || event.metaKey) && (key === "f" || key === "h")) {
      event.preventDefault();
      onOpen(key === "h");
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      onGoto(event.shiftKey ? -1 : 1);
    }
  }
</script>

<search
  class="sticky top-2 z-30 mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-surface/95 p-2 shadow-lg shadow-stone-900/10 backdrop-blur dark:border-stone-700 dark:bg-stone-900/95 dark:shadow-black/40"
  role="search"
>
  <div class="w-48" use:focusQuery>
    <Input
      value={state.query}
      type="search"
      placeholder={$i18n.t("editor.findPlaceholder")}
      className="h-8"
      oninput={(event) => onQuery((event.target as HTMLInputElement).value)}
      onkeydown={handleKeydown}
    />
  </div>

  <span class="min-w-16 text-xs text-stone-500 dark:text-stone-400">
    {state.matches.length
      ? $i18n.t("editor.matchCount", {
          index: state.index + 1,
          total: state.matches.length,
        })
      : $i18n.t("editor.noMatches")}
  </span>

  <Button
    icon={ChevronUp}
    size="sm"
    variant="ghost"
    label={$i18n.t("editor.previousMatch")}
    disabled={!state.matches.length}
    onClick={() => onGoto(-1)}
  />
  <Button
    icon={ChevronDown}
    size="sm"
    variant="ghost"
    label={$i18n.t("editor.nextMatch")}
    disabled={!state.matches.length}
    onClick={() => onGoto(1)}
  />

  {#if state.replaceMode}
    <div class="w-48">
      <Input
        value={state.replacement}
        placeholder={$i18n.t("editor.replacePlaceholder")}
        className="h-8"
        oninput={(event) =>
          onReplacement((event.target as HTMLInputElement).value)}
        onkeydown={handleKeydown}
      />
    </div>

    <Button
      size="sm"
      label={$i18n.t("editor.replaceOne")}
      disabled={!editable || !state.matches.length}
      onClick={onReplaceOne}
    />
    <Button
      size="sm"
      label={$i18n.t("editor.replaceAll")}
      disabled={!editable || !state.matches.length}
      onClick={onReplaceAll}
    />
  {/if}

  <Button
    icon={X}
    size="sm"
    variant="ghost"
    className="ml-auto"
    label={$i18n.t("editor.closeFind")}
    onClick={onClose}
  />
</search>
