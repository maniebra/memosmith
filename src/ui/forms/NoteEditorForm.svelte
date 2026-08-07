<script lang="ts">
  import type { EditorWidth } from "../../lib/storage/settings";
  import { cn } from "../../lib/utils/cn";
  import type { PageIcon, PageMeta } from "../../lib/utils/pageMeta";
  import MarkdownEditor from "../components/MarkdownEditor.svelte";
  import PageIdentity from "../components/PageIdentity.svelte";

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
  export let pageMeta: PageMeta = {};
  export let placeholder = "Select or create a note";
  export let onAssets: (source: { files?: File[]; paths?: string[] }) => Promise<string>;
  export let onPickAssets: () => Promise<string>;
  export let onIconChange: (icon: PageIcon | null) => void | Promise<void>;
  export let onCoverChange: (cover: string | null) => void | Promise<void>;
  export let onPickCover: () => void | Promise<void>;
  export let resolveAsset: (source: string) => string;

  const widthClasses: Record<EditorWidth, string> = {
    focused: "max-w-[38rem]",
    comfortable: "max-w-[46rem]",
    wide: "max-w-[58rem]",
  };

  $: editorClass = cn("leading-[1.75]", widthClasses[editorWidth]);
</script>

<!-- overflow-x-hidden so a wide equation scrolls inside its own box instead of widening the app. -->
<section class="h-full min-h-0 overflow-x-hidden overflow-y-auto" aria-label="Markdown editor">
  <div class={cn("mx-auto w-full px-6 pt-14 pb-32 sm:px-10", editorClass)}>
    <PageIdentity
      title={noteTitle}
      meta={pageMeta}
      {editable}
      showTitle={showPageTitle}
      {resolveAsset}
      {onIconChange}
      {onCoverChange}
      {onPickCover}
    />

    <MarkdownEditor
      bind:value={contents}
      bind:element={editor}
      {placeholder}
      {textSize}
      {spellcheck}
      {slashCommands}
      {editable}
      {onInput}
      {onAssets}
      {onPickAssets}
      {resolveAsset}
    />
  </div>
</section>
