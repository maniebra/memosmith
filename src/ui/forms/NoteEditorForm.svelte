<script lang="ts">
  import MarkdownEditor from "../components/MarkdownEditor.svelte";

  export let contents: string;
  export let editor: HTMLElement | undefined = undefined;
  export let onInput: () => void;
</script>

<section class="min-h-0 p-2 sm:p-4" aria-label="Markdown editor">
  <MarkdownEditor bind:value={contents} bind:element={editor} placeholder="Type markdown..." {onInput} />
</section>
