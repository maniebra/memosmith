<script lang="ts">
  import NoteEditorForm from "../forms/NoteEditorForm.svelte";
  import { displayNoteName, entryPathFromNote } from "../../lib/utils/path";
  import type { EditorPageActions } from "../pages/editorPageContext";

  export let note: string;
  export let text: string;
  export let settings: any;
  export let spaceMeta: any;
  export let spaceRoot: string | null;
  export let databases: any[];
  export let readOnly: boolean;
  export let actions: EditorPageActions;
  export let onInput: (note: string, text: string) => void;
  export let onStatus: (message: string) => void;

  /** Own copy: each pane edits its note without touching the active tab. */
  let contents = text;
  let loaded = note;

  $: if (note !== loaded) {
    loaded = note;
    contents = text;
  }

  $: entryPath = entryPathFromNote(note);
</script>

<div class="relative min-h-0 min-w-0 flex-1 overflow-y-auto">
  <NoteEditorForm
    bind:contents
    editorWidth={settings.editorWidth}
    textSize={settings.textSize}
    spellcheck={settings.spellcheck}
    slashCommands={settings.slashCommands}
    fancyTableEditor={settings.features.fancyTableEditor}
    callouts={settings.features.callouts}
    calloutDefinitions={settings.callouts}
    highlightColors={settings.highlightPalette}
    drawings={settings.features.drawings}
    diagrams={settings.features.diagrams}
    inlineEmbeds={settings.appearance.embedEditing === "inline"}
    quizzes={settings.features.quizzes}
    codeExecution={settings.features.codeExecution}
    plantuml={settings.features.plantuml}
    plantumlSettings={settings.plantuml}
    mermaid={settings.features.mermaid}
    mermaidSettings={settings.mermaid}
    youtube={settings.features.youtube}
    spotify={settings.features.spotify}
    runner={settings.runner}
    lsp={false}
    lspSettings={settings.lsp}
    editable={Boolean(spaceRoot) && !readOnly}
    noteTitle={displayNoteName(note)}
    pageMeta={spaceMeta[entryPath] ?? {}}
    showPageTitle={settings.showPageTitle}
    onInput={() => onInput(note, contents)}
    onIconChange={() => {}}
    onCoverChange={() => {}}
    onCoverPositionChange={() => {}}
    onPickCover={() => {}}
    onAssets={async () => ""}
    onPickAssets={async () => ""}
    onWikilink={(target) =>
      actions.runWithStatus(() => actions.openWikilink(target))}
    resolveWikilink={actions.resolveActiveWikilink}
    renderWikilinkEmbed={actions.renderActiveWikilinkEmbed}
    databaseRoot={settings.features.databases ? (spaceRoot ?? "") : ""}
    databaseOptions={databases}
    {onStatus}
    resolveAsset={actions.resolveAsset}
  />
</div>
