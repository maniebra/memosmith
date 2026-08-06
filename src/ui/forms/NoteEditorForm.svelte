<script lang="ts">
  import type { EditorWidth } from "../../lib/storage/settings";
  import { cn } from "../../lib/utils/cn";
  import MarkdownEditor from "../components/MarkdownEditor.svelte";

  export let contents: string;
  export let editor: HTMLElement | undefined = undefined;
  export let onInput: () => void;
  export let editorWidth: EditorWidth;
  export let textSize: number;
  export let spellcheck: boolean;
  export let slashCommands: boolean;
  export let editable: boolean;
  export let noteTitle: string;
  export let showPageTitle: boolean;
  export let placeholder = "Select or create a note";

  const widthClasses: Record<EditorWidth, string> = {
    focused: "max-w-[38rem]",
    comfortable: "max-w-[46rem]",
    wide: "max-w-[58rem]",
  };

  $: editorClass = cn("leading-[1.75]", widthClasses[editorWidth]);
</script>

<section class="h-full min-h-0 overflow-y-auto" aria-label="Markdown editor">
  <div class={cn("mx-auto w-full px-6 pt-14 pb-32 sm:px-10", editorClass)}>
    {#if editable && showPageTitle}
      <h1 class="mb-8 text-[2.5rem] leading-tight font-bold tracking-normal text-stone-900 dark:text-stone-100">
        {noteTitle}
      </h1>
    {/if}

    <MarkdownEditor
      bind:value={contents}
      bind:element={editor}
      {placeholder}
      {textSize}
      {spellcheck}
      {slashCommands}
      {editable}
      {onInput}
    />
  </div>
</section>
