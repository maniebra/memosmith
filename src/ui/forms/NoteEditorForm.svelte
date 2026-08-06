<script lang="ts">
  import TextArea from "../components/TextArea.svelte";

  export let contents: string;
  export let editor: HTMLTextAreaElement | undefined = undefined;
  export let onInput: () => void;
</script>

<section class="min-h-0 p-2 sm:p-4" aria-label="Text editor">
  <TextArea
    bind:value={contents}
    bind:element={editor}
    size="fill"
    placeholder="Start typing..."
    {onInput}
  />
</section>
