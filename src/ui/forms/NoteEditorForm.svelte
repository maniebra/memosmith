<script lang="ts">
  import MarkdownEditor from "../components/MarkdownEditor.svelte";

  export let contents: string;
  export let editor: HTMLElement | undefined = undefined;
  export let onInput: () => void;
</script>

<section class="min-h-0 overflow-y-auto" aria-label="Markdown editor">
  <div class="mx-auto w-full max-w-[46rem] px-6 pt-14 pb-32 sm:px-10">
    <MarkdownEditor
      bind:value={contents}
      bind:element={editor}
      placeholder="Type '/' for commands"
      {onInput}
    />
  </div>
</section>
