<script lang="ts">
  import type {
    CalloutDefinition,
    EditorWidth,
    LspSettings,
    RunnerSettings,
  } from "../../lib/storage/settings";
  import { cn } from "../../lib/utils/cn";
  import type { PageIcon, PageMeta } from "../../lib/utils/pageMeta";
  import type { WikilinkEmbed } from "../../lib/utils/markdown";
  import type { Backlink, WikilinkResolution } from "../../lib/utils/wikilinks";
  import MarkdownEditor from "../components/MarkdownEditor.svelte";
  import PageIdentity from "../components/PageIdentity.svelte";
  import BacklinksPanel from "../sections/BacklinksPanel.svelte";

  export let contents: string;
  export let editor: HTMLElement | undefined = undefined;
  export let onInput: () => void;
  export let editorWidth: EditorWidth;
  export let textSize: number;
  export let spellcheck: boolean;
  export let slashCommands: boolean;
  export let fancyTableEditor: boolean;
  export let callouts: boolean;
  export let calloutDefinitions: CalloutDefinition[] = [];
  export let drawings: boolean;
  export let diagrams: boolean;
  export let codeExecution: boolean;
  export let runSession = "";
  export let runner: RunnerSettings;
  export let lsp: boolean;
  export let lspSettings: LspSettings;
  export let editable: boolean;
  export let noteTitle: string;
  export let showPageTitle: boolean;
  export let pageMeta: PageMeta = {};
  export let placeholder = "Select or create a note";
  export let onAssets: (source: { files?: File[]; paths?: string[] }) => Promise<string>;
  export let onPickAssets: () => Promise<string>;
  export let onGenerate: ((prompt: string) => Promise<string>) | null = null;
  export let onWikilink: ((target: string) => void | Promise<void>) | null = null;
  export let resolveWikilink: ((target: string) => WikilinkResolution) | undefined = undefined;
  export let renderWikilinkEmbed:
    | ((target: string, depth: number) => WikilinkEmbed | null)
    | undefined = undefined;
  export let wikilinkKey = "";
  export let backlinks: Backlink[] = [];
  export let onSelectBacklink: (relativePath: string) => void | Promise<void>;
  export let decorations: { start: number; end: number; tone: "mistake" | "suggestion" }[] = [];
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
  <div class={cn("ms-editor-frame mx-auto w-full px-6 pt-14 pb-32 sm:px-10", editorClass)}>
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
      {fancyTableEditor}
      {callouts}
      {calloutDefinitions}
      {drawings}
      {diagrams}
      {codeExecution}
      {runSession}
      {runner}
      {lsp}
      {lspSettings}
      {editable}
      {onInput}
      {onAssets}
      {onPickAssets}
      {onGenerate}
      {onWikilink}
      {resolveWikilink}
      {renderWikilinkEmbed}
      {wikilinkKey}
      {decorations}
      {resolveAsset}
    />

    {#if editable}
      <BacklinksPanel {backlinks} onSelect={onSelectBacklink} />
    {/if}
  </div>
</section>
