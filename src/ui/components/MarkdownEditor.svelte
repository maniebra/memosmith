<script lang="ts">
  import type { DatabaseSummary } from "../../lib/tauri/databases";
  import { onDestroy, onMount } from "svelte";
  import { i18n } from "../../lib/i18n";
  import {
    defaultHighlightPalette,
    defaultLspSettings,
    defaultMermaidSettings,
    defaultPlantumlSettings,
    defaultRunnerSettings,
    type CalloutDefinition,
    type LspSettings,
    type MermaidSettings,
    type PaletteColor,
    type PlantumlSettings,
    type RunnerSettings,
  } from "../../lib/storage/settings";
  import { cn } from "../../lib/utils/cn";
  import type { WikilinkEmbed, WikilinkResolver } from "../../lib/utils/markdown";
  import ContextMenu from "./ContextMenu.svelte";
  import DiagramModal from "./DiagramModal.svelte";
  import DrawingModal from "./DrawingModal.svelte";
  import BlockToolbar from "./markdown-editor/BlockToolbar.svelte";
  import CompletionMenu from "./markdown-editor/CompletionMenu.svelte";
  import DecorationLayer from "./markdown-editor/DecorationLayer.svelte";
  import FindBar from "./markdown-editor/FindBar.svelte";
  import SlashMenu from "./markdown-editor/SlashMenu.svelte";
  import TailAddButton from "./markdown-editor/TailAddButton.svelte";
  import {
    createEditor,
    destroyEditor,
    mountEditor,
  } from "./markdown-editor/editor";
  import type { Decoration, EditorProps } from "./markdown-editor/types";

  export let value: string;
  export let element: HTMLElement | undefined = undefined;
  export let placeholder = "";
  export let textSize = 17;
  export let spellcheck = true;
  export let slashCommands = true;
  export let fancyTableEditor = true;
  export let callouts = true;
  export let calloutDefinitions: CalloutDefinition[] = [];
  export let highlightColors: PaletteColor[] = defaultHighlightPalette;
  export let drawings = false;
  export let diagrams = false;
  export let quizzes = true;
  export let codeExecution = false;
  export let plantuml = false;
  export let plantumlSettings: PlantumlSettings = defaultPlantumlSettings;
  export let mermaid = false;
  export let mermaidSettings: MermaidSettings = defaultMermaidSettings;
  /** Identifies the kernels a note owns, so its variables survive between cells. */
  export let runSession = "";
  export let runner: RunnerSettings = defaultRunnerSettings;
  export let lsp = false;
  export let lspSettings: LspSettings = defaultLspSettings;
  export let editable = true;
  export let className = "";
  export let onInput: () => void = () => {};
  /** Stores dropped/pasted/picked files next to the note and returns the markdown to insert. */
  export let onAssets: (source: {
    files?: File[];
    paths?: string[];
  }) => Promise<string> = async () => "";
  export let onPickAssets: (() => Promise<string>) | null = null;
  /** Takes the selected text as a prompt and returns generated markdown. */
  export let onGenerate: ((prompt: string) => Promise<string>) | null = null;
  export let onWikilink:
    | ((target: string) => void | Promise<void>)
    | null = null;
  export let resolveWikilink: WikilinkResolver | undefined = undefined;
  export let renderWikilinkEmbed:
    | ((target: string, depth: number) => WikilinkEmbed | null)
    | undefined = undefined;
  export let wikilinkKey = "";
  /** Space folder the embedded databases live in; empty disables database embeds. */
  export let databaseRoot = "";
  /** Databases offered by the slash menu and by relation columns. */
  export let databaseOptions: DatabaseSummary[] = [];
  export let onOpenDatabase: ((databaseId: string) => void) | null = null;
  export let onStatus: (message: string) => void = () => {};
  /** Source ranges to underline, drawn in an overlay so the editable DOM stays untouched. */
  export let decorations: Decoration[] = [];
  export let resolveAsset: ((source: string) => string) | null = null;

  let shell: HTMLElement | undefined;
  let databaseLayer: HTMLElement | undefined;
  let props: EditorProps;
  let uiVersion = 0;

  $: props = {
    placeholder, textSize, spellcheck, slashCommands, fancyTableEditor,
    callouts, calloutDefinitions, highlightColors, drawings, diagrams,
    quizzes, codeExecution,
    plantuml,
    plantumlSettings, mermaid, mermaidSettings, runSession, runner, lsp,
    lspSettings, editable, onInput, onAssets, onPickAssets, onGenerate,
    onWikilink, resolveWikilink, renderWikilinkEmbed, wikilinkKey, databaseRoot,
    databaseOptions, onOpenDatabase, onStatus, decorations, resolveAsset,
  };

  const editor = createEditor(
    {
      get value() {
        return value;
      },
      set value(next: string) {
        value = next;
      },
      get element() {
        return element;
      },
      get shell() {
        return shell;
      },
      get databaseLayer() {
        return databaseLayer;
      },
      get props() {
        return props;
      },
      t: (key, values) => $i18n.t(key, values),
    },
    () => (uiVersion += 1),
  );

  /** Re-read on every write the editor makes, so the markup follows its state. */
  function readUi(_version: number) {
    return editor.ui;
  }

  $: ui = readUi(uiVersion);
  /**
   * Recomputed from `ui`, not called straight from the markup: `editor` never
   * changes, so an inline call would be evaluated once and the open menu would
   * keep showing the matches for the query it opened with.
   */
  $: slashMatches = ui.slashStart === null ? [] : editor.slashMatches();

  /** The props these depend on are listed so Svelte knows when to run them. */
  function syncEditor(..._dependencies: unknown[]) {
    editor.syncValue();
    editor.syncFeatures();
    editor.scheduleMeasure();
    editor.syncBlockToolbar();
  }

  function syncDiagrams(..._dependencies: unknown[]) {
    editor.syncDiagramSettings();
  }

  $: syncEditor(element, value, props, decorations, textSize, editable);
  $: syncDiagrams(
    element,
    plantuml,
    mermaid,
    plantumlSettings,
    mermaidSettings,
  );

  onMount(() => mountEditor(editor));
  onDestroy(() => destroyEditor(editor));
</script>

<svelte:document onselectionchange={editor.markActiveBlock} />
<svelte:window
  onpointermove={editor.handleBlockDragMove}
  onpointerup={editor.handleBlockDragEnd}
  onscrollcapture={editor.trackMenu}
  onresize={editor.trackMenu}
/>

<div
  bind:this={shell}
  class="md-editor-shell relative"
  role="presentation"
  onpointermove={editor.trackHoveredBlock}
  onmouseleave={editor.scheduleBlockToolbarHide}
>
  {#if ui.find}
    <FindBar
      state={ui.find}
      {editable}
      onQuery={editor.setFindQuery}
      onReplacement={editor.setFindReplacement}
      onGoto={editor.gotoMatch}
      onReplaceOne={editor.replaceCurrent}
      onReplaceAll={editor.replaceAll}
      onClose={editor.closeFind}
      onOpen={editor.openFind}
    />
  {/if}

  {#if editable && ui.blockToolbar.visible}
    <BlockToolbar
      top={ui.blockToolbar.top}
      onAdd={editor.addBlockAfter}
      onMenu={editor.openBlockMenu}
      onDragStart={editor.startBlockDrag}
      onHover={editor.clearBlockToolbarHide}
    />
  {/if}

  {#if ui.dragIndicatorTop !== null}
    <div
      class="md-block-drop-indicator"
      style={`top: ${ui.dragIndicatorTop}px;`}
      aria-hidden="true"
    ></div>
  {/if}

  <div
    bind:this={element}
    contenteditable={editable}
    {spellcheck}
    role="textbox"
    tabindex="0"
    aria-multiline="true"
    aria-label={$i18n.t("editor.aria")}
    style="--md-placeholder: '{placeholder}'; font-size: {textSize}px; font-family: var(--ms-editor-font); line-height: var(--ms-editor-line-height);"
    class={cn(
      "min-h-[60vh] w-full leading-[1.75] whitespace-pre-wrap caret-emerald-700",
      "md-editor-surface",
      "focus-visible:outline-none",
      "text-stone-900 dark:text-stone-100",
      editable || "cursor-default",
      "dark:caret-emerald-400",
      className,
    )}
    oninput={editor.handleInput}
    onchange={editor.handleChange}
    onfocusout={editor.handleDatabaseBlur}
    onkeydown={editor.handleKeydown}
    oncontextmenu={editor.openContextMenu}
    onfocusin={(event) => {
      editor.enterDatabaseIsland(event);
    }}
    onpointerdown={(event) => {
      if (editor.enterDatabaseIsland(event)) {
        return;
      }

      if (
        !editor.handleTailPointerDown(event) &&
        !editor.handleTablePointerDown(event)
      ) {
        editor.handlePointerDown(event);
      }
    }}
    onpaste={editor.handlePaste}
    onblur={() => {
      editor.closeMenu();
      editor.closeCompletions();
    }}
    oncompositionstart={editor.handleCompositionStart}
    oncompositionend={editor.handleCompositionEnd}
  ></div>

  <div
    bind:this={databaseLayer}
    class="pointer-events-none absolute inset-0 z-10"
    role="presentation"
    onfocusout={editor.handleDatabaseBlur}
    oncontextmenu={editor.openContextMenu}
  ></div>

  {#if editable}
    <TailAddButton top={ui.tailAddTop} onAdd={editor.openTailBlock} />
  {/if}

  <DecorationLayer boxes={ui.decorationBoxes} />
</div>

{#if ui.editingDrawing}
  <DrawingModal
    scene={ui.editingDrawing.scene}
    onSave={editor.saveDrawing}
    onClose={editor.closeDrawingModal}
  />
{/if}

{#if ui.editingDiagram}
  <DiagramModal
    diagram={ui.editingDiagram.diagram}
    onSave={editor.saveDiagram}
    onClose={editor.closeDiagramModal}
  />
{/if}

{#if ui.contextMenu}
  <ContextMenu
    x={ui.contextMenu.x}
    y={ui.contextMenu.y}
    items={editor.contextItems()}
    onClose={editor.closeContextMenu}
  />
{/if}

{#if ui.blockMenu}
  <ContextMenu
    x={ui.blockMenu.x}
    y={ui.blockMenu.y}
    items={editor.blockContextItems()}
    onClose={editor.closeBlockMenu}
  />
{/if}

{#if ui.slashStart !== null && slashMatches.length}
  <SlashMenu
    commands={slashMatches}
    index={ui.slashIndex}
    depth={ui.slashPath.length}
    top={ui.menuPosition.top}
    left={ui.menuPosition.left}
    label={$i18n.t("editor.commands")}
    onHover={editor.highlightSlash}
    onPick={editor.pickCommand}
  />
{/if}

{#if ui.completions.length}
  <CompletionMenu
    items={ui.completions}
    index={ui.completionIndex}
    top={ui.completionPosition.top}
    left={ui.completionPosition.left}
    label={$i18n.t("editor.completions")}
    onHover={editor.highlightCompletion}
    onPick={(item) => editor.applyCompletion(item)}
  />
{/if}

<style>
  /* Fence lines are scaffolding until the caret enters that code block. */
  [contenteditable] :global(.md-fence:not([data-active])) {
    display: none;
  }

  /* Hint on the caret's empty line, and on an empty document. */
  [contenteditable]
    :global(
      .md-block:not(.md-codeblock, .md-fence):has(> br:only-child):is(
          [data-active],
          :only-child
        )
    )::before {
    content: var(--md-placeholder);
    position: absolute;
    inset-inline-start: 0;
    color: rgb(168 162 158 / 0.7);
    pointer-events: none;
  }
</style>
