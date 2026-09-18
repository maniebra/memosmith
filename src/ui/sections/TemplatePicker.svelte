<script lang="ts">
  import { tick } from "svelte";
  import { FileText } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import {
    fillTemplate,
    loadTemplates,
    type NoteTemplate,
  } from "../../lib/utils/templates";
  import Button from "../components/Button.svelte";

  export let root: string | null;
  export let note: string | null;
  export let title: string;
  export let contents: string;
  /** What the note inherits, placeholders filled, for the slash menu too. */
  export let templates: NoteTemplate[] = [];
  /** Called once the picked template is the note's contents. */
  export let onPick: () => void;

  async function pick(text: string) {
    contents = text;
    await tick();
    onPick();
  }

  let raw: NoteTemplate[] = [];
  // A slower load for a note already left must not overwrite the current one.
  $: void loadTemplates(root, note).then((found) => {
    if (found.note === note) raw = found.templates;
  });
  // ponytail: {{date}} is fixed when the note opens, not when it is inserted.
  $: templates = raw.map(({ name, text }) => ({
    name,
    text: fillTemplate(text, title),
  }));
</script>

{#if !contents.trim() && templates.length}
  <div
    class={[
      "absolute inset-x-0 bottom-6 z-10 mx-auto flex w-fit max-w-[90%]",
      "flex-wrap items-center justify-center gap-2 rounded-lg border",
      "border-stone-200 bg-surface px-3 py-2 shadow-sm",
      "dark:border-stone-700 dark:bg-stone-900",
    ].join(" ")}
  >
    <span class="text-xs text-stone-500">{$i18n.t("editor.startFromTemplate")}</span>
    {#each templates as template (template.name)}
      <Button
        label={template.name}
        icon={FileText}
        showLabel
        size="sm"
        variant="ghost"
        onClick={() => pick(template.text)}
      />
    {/each}
  </div>
{/if}
