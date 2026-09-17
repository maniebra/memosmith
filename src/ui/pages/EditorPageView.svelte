<script lang="ts">
  import { scale, slide } from "svelte/transition";
  import { i18n } from "../../lib/i18n";
  import BacklinksPanel from "../sections/BacklinksPanel.svelte";
  import DatabaseManager from "../sections/DatabaseManager.svelte";
  import DatabaseView from "../sections/DatabaseView.svelte";
  import EditorStatusBar from "../sections/EditorStatusBar.svelte";
  import EditorTabs from "../sections/EditorTabs.svelte";
  import EditorToolbar from "../sections/EditorToolbar.svelte";
  import GrammarPolice from "../sections/GrammarPolice.svelte";
  import NoteEditorForm from "../forms/NoteEditorForm.svelte";
  import CommandPalette from "../components/CommandPalette.svelte";
  import PdfExportModal from "../components/PdfExportModal.svelte";
  import SettingsPanel from "../sections/SettingsPanel.svelte";
  import SpaceSidebar from "../sections/SpaceSidebar.svelte";
  import WelcomeDashboard from "../sections/WelcomeDashboard.svelte";
  import type { EditorPageActions } from "./editorPageContext";

  export let activePageMeta: any;
  export let activeRelativePath: string | null;
  export let appTitle: string;
  export let backlinks: any[];
  export let breadcrumbs: any[];
  export let characters: number;
  export let contents: string;
  export let databases: any[];
  export let databasesOpen: boolean;
  export let editor: HTMLElement | undefined;
  export let fileLabel: string;
  export let grammarChecking: boolean;
  export let grammarDecorations: any[];
  export let grammarError: string;
  export let grammarOpen: boolean;
  export let grammarProfile: any;
  export let grammarReport: any;
  export let isDirty: boolean;
  export let noteTitle: string;
  export let paneSlide: any;
  export let path: string | null;
  export let pdfPreviewOpen: boolean;
  export let settings: any;
  export let settingsOpen: boolean;
  export let spaceMeta: any;
  export let spaceNotes: string[];
  export let spaceRoot: string | null;
  export let statusMessage: string;
  export let wikilinkKey: string;
  export let words: number;
  export let openTabs: string[];
  export let pinnedTabs: string[];
  export let activeTab: string | null;
  export let onSelectTab: (id: string) => void;
  export let onCloseTab: (id: string) => void;
  export let onPinTab: (id: string) => void;
  export let onReorderTabs: (id: string, target: string) => void;
  export let explainGrammarIssue: (issue: any) => Promise<string>;
  export let actions: EditorPageActions;

  /** Session-only: locks the open note against edits. */
  let readOnly = false;

  $: activeDatabaseTabId =
    activeTab?.startsWith("db:") ? activeTab.slice(3) : null;

</script>

<svelte:window
  onbeforeunload={() => void actions.flushNoteSave()}
  onpointermove={actions.handleResize}
  onpointerup={actions.stopResize}
/>
<main
  class="ms-islands grid h-screen overflow-hidden bg-canvas text-stone-900 dark:bg-canvas dark:text-stone-100"
  style="grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr);"
>
  <EditorToolbar
    title={appTitle}
    {fileLabel}
    {breadcrumbs}
    {isDirty}
    spacePaneOpen={settings.spacePaneOpen}
    grammarEnabled={settings.features.grammarPolice}
    databasesEnabled={settings.features.databases}
    backlinksAvailable={Boolean(backlinks.length) && !activeDatabaseTabId}
    backlinksOpen={settings.backlinksPaneOpen}
    backlinksCount={backlinks.length}
    {readOnly}
    onToggleReadOnly={() => (readOnly = !readOnly)}
    windowButtons={settings.features.windowControls
      ? settings.appearance.windowButtons
      : "native"}
    onSelectBreadcrumb={(relativePath) =>
      actions.runWithStatus(() => actions.selectSpaceNote(relativePath))}
    onToggleSpacePane={actions.toggleSpacePane}
    onToggleBacklinks={() =>
      (settings = {
        ...settings,
        backlinksPaneOpen: !settings.backlinksPaneOpen,
      })}
    onToggleSettings={() => (settingsOpen = !settingsOpen)}
    onToggleDatabases={() => {
      if (settings.features.databases) {
        databasesOpen = !databasesOpen;
      }
    }}
    onToggleGrammar={actions.toggleGrammar}
    onExportPdf={path ? () => (pdfPreviewOpen = true) : null}
  />
  <div class="ms-islands-row flex min-h-0 min-w-0">
    {#if settings.spacePaneOpen}
      <div class="flex min-h-0 shrink-0" transition:slide={paneSlide}>
        <SpaceSidebar
          width={settings.spacePaneWidth}
          root={spaceRoot}
          notes={spaceNotes}
          meta={spaceMeta}
          activePath={activeRelativePath}
          openPaths={openTabs}
          onChooseSpace={() => actions.runWithStatus(actions.chooseSpace)}
          onRefresh={() => actions.runWithStatus(actions.refreshSpace)}
          onSelect={(relativePath) =>
            actions.runWithStatus(() =>
              actions.selectSpaceNote(relativePath),
            )}
          onCreate={(parentPath, name, folder) =>
            actions.runWithStatus(() =>
              actions.createSpaceNote(parentPath, name, folder),
            )}
          onRename={(relativePath, name) =>
            actions.runWithStatus(() =>
              actions.renameSpaceEntry(relativePath, name),
            )}
          onDelete={(relativePath) =>
            actions.runWithStatus(() =>
              actions.deleteSpaceEntry(relativePath),
            )}
          onMove={(relativePath, destFolder, siblingOrder) =>
            actions.runWithStatus(() =>
              actions.moveSpaceEntry(relativePath, destFolder, siblingOrder),
            )}
        />
        <button
          type="button"
          class="z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-emerald-600/20 focus-visible:bg-emerald-600/20 focus-visible:outline-none"
          aria-label={$i18n.t("sidebar.resize")}
          title={$i18n.t("sidebar.resize")}
          onpointerdown={(event) => actions.startResize(event, "space")}
          onkeydown={(event) => actions.resizeWithKeyboard(event, "space")}
        ></button>
      </div>
    {/if}
    <div class="ms-island flex min-w-0 flex-1 flex-col">
      <EditorTabs
        tabs={openTabs}
        pinned={pinnedTabs}
        {activeTab}
        meta={spaceMeta}
        {databases}
        onSelect={onSelectTab}
        onClose={onCloseTab}
        onPin={onPinTab}
        onReorder={onReorderTabs}
      />
      <div class="min-h-0 flex-1">
      {#if !activeTab}
        <WelcomeDashboard
          root={spaceRoot}
          notes={spaceNotes}
          meta={spaceMeta}
          onNewNote={() =>
            actions.runWithStatus(() =>
              actions.createSpaceNote("", $i18n.t("welcome.untitled")),
            )}
          onChooseSpace={() => actions.runWithStatus(actions.chooseSpace)}
          onOpenNote={(relativePath) =>
            actions.runWithStatus(() =>
              actions.selectSpaceNote(relativePath),
            )}
        />
      {:else if settings.features.databases && activeDatabaseTabId && spaceRoot}
        <DatabaseView
          root={spaceRoot}
          databaseId={activeDatabaseTabId}
          databaseOptions={databases}
          onStatus={(message) => (statusMessage = message)}
          onRenamed={(name) =>
            (databases = databases.map((entry) =>
              entry.id === activeDatabaseTabId ? { ...entry, name } : entry,
            ))}
        />
      {:else}
        <NoteEditorForm
          bind:contents
          bind:editor
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
          runSession={path ?? ""}
          runner={settings.runner}
          lsp={settings.features.lsp}
          lspSettings={settings.lsp}
          editable={Boolean(path) && !readOnly}
          {noteTitle}
          pageMeta={activePageMeta}
          showPageTitle={settings.showPageTitle}
          placeholder={spaceRoot
            ? $i18n.t("app.selectOrCreateNote")
            : $i18n.t("app.chooseSpaceFromSidebar")}
          onInput={actions.updateNote}
          onIconChange={(icon) =>
            actions.runWithStatus(() => actions.updateActiveIcon(icon))}
          onCoverChange={(cover) =>
            actions.runWithStatus(() => actions.updateActiveCover(cover))}
          onCoverPositionChange={(position) =>
            actions.runWithStatus(() =>
              actions.updateActiveCoverPosition(position),
            )}
          onPickCover={() => actions.runWithStatus(actions.pickActiveCover)}
          onTitleChange={activeRelativePath && !readOnly
            ? (name) =>
                actions.runWithStatus(() =>
                  actions.renameSpaceEntry(activeRelativePath, name),
                )
            : null}
          onAssets={(source) =>
            actions.storeAssets(source).catch((error) => {
              statusMessage =
                error instanceof Error ? error.message : String(error);
              return "";
            })}
          onPickAssets={() =>
            actions.pickAssets().catch((error) => {
              statusMessage =
                error instanceof Error ? error.message : String(error);
              return "";
            })}
          onGenerate={actions.generateFromPrompt}
          onWikilink={(target) =>
            actions.runWithStatus(() => actions.openWikilink(target))}
          resolveWikilink={actions.resolveActiveWikilink}
          renderWikilinkEmbed={actions.renderActiveWikilinkEmbed}
          databaseRoot={settings.features.databases ? (spaceRoot ?? "") : ""}
          databaseOptions={databases}
          onOpenDatabase={(id) =>
            actions.runWithStatus(() => actions.selectDatabase(id))}
          onStatus={(message) => (statusMessage = message)}
          {wikilinkKey}
          decorations={settings.features.grammarPolice && grammarOpen
            ? grammarDecorations
            : []}
          resolveAsset={actions.resolveAsset}
        />
      {/if}
      </div>
    </div>
    {#if backlinks.length && !activeDatabaseTabId}
      {#if settings.backlinksPaneOpen}
        <div class="flex min-h-0 shrink-0" transition:slide={paneSlide}>
          <button
            type="button"
            class="z-10 w-1.5 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-emerald-600/20 focus-visible:bg-emerald-600/20 focus-visible:outline-none"
            aria-label={$i18n.t("backlinks.resize")}
            title={$i18n.t("backlinks.resize")}
            onpointerdown={(event) => actions.startResize(event, "backlinks")}
            onkeydown={(event) => actions.resizeWithKeyboard(event, "backlinks")}
          ></button>
          <div
            class="ms-island flex min-h-0 shrink-0 border-l border-stone-200/70 bg-sidebar dark:border-stone-800"
            style={`width: ${settings.backlinksPaneWidth}px`}
          >
            <BacklinksPanel
              {backlinks}
              onSelect={(relativePath) =>
                actions.runWithStatus(() =>
                  actions.selectSpaceNote(relativePath),
                )}
              onClose={() =>
                (settings = {
                  ...settings,
                  backlinksPaneOpen: false,
                })}
              className="h-full w-full overflow-y-auto px-5 py-6"
            />
          </div>
        </div>
      {:else}
        <button
          type="button"
          class="ms-island flex w-9 shrink-0 items-center justify-center border-l border-stone-200/70 bg-sidebar text-xs font-semibold tracking-wide text-stone-500 uppercase transition-colors hover:bg-emerald-50/70 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/25 dark:border-stone-800 dark:text-stone-400 dark:hover:bg-emerald-950/20 dark:hover:text-emerald-300"
          title={$i18n.t("toolbar.showBacklinks")}
          aria-label={$i18n.t("toolbar.showBacklinks")}
          onclick={() => (settings = { ...settings, backlinksPaneOpen: true })}
          transition:slide={paneSlide}
        >
          <span class="rotate-90 whitespace-nowrap"
            >{$i18n.t("backlinks.title")} {backlinks.length}</span
          >
        </button>
      {/if}
    {/if}
    {#if settings.features.grammarPolice && grammarOpen && !activeDatabaseTabId}
      <div class="ms-island ms-island-gap flex min-h-0" transition:slide={paneSlide}>
        <GrammarPolice
          report={grammarReport}
          checking={grammarChecking}
          error={grammarError}
          canCheck={Boolean(path) && Boolean(contents.trim())}
          mode={settings.grammarMode}
          onModeChange={actions.setGrammarMode}
          onCheck={actions.runGrammarCheck}
          onApply={actions.applyGrammarIssue}
          onDismiss={actions.dismissGrammarIssue}
          onExplain={explainGrammarIssue}
          profile={grammarProfile}
          onProfileChange={actions.updateGrammarProfile}
          {words}
          onClose={() => (grammarOpen = false)}
        />
      </div>
    {/if}
    {#if settings.features.databases && databasesOpen}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
        role="presentation"
        onclick={() => (databasesOpen = false)}
      >
        <div
          class="relative z-50 overflow-hidden rounded-xl border border-stone-200/50 shadow-xl dark:border-stone-800/50"
          role="presentation"
          transition:scale={{ duration: 150, start: 0.95 }}
          onclick={(event) => event.stopPropagation()}
        >
          <DatabaseManager
            {databases}
            activeDatabaseId={activeDatabaseTabId}
            onSelect={(id) =>
              actions.runWithStatus(() => actions.selectDatabase(id))}
            onCreate={(name) =>
              actions.runWithStatus(() => actions.createSpaceDatabase(name))}
            onDelete={(id) =>
              actions.runWithStatus(() => actions.deleteSpaceDatabase(id))}
            onClose={() => (databasesOpen = false)}
          />
        </div>
      </div>
    {/if}
    {#if settingsOpen}
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 backdrop-blur-sm"
        role="presentation"
        onclick={() => (settingsOpen = false)}
      >
        <div
          class="relative z-50 overflow-hidden rounded-xl border border-stone-200/50 shadow-xl dark:border-stone-800/50"
          role="presentation"
          transition:scale={{ duration: 150, start: 0.95 }}
          onclick={(e) => e.stopPropagation()}
        >
          <SettingsPanel
            {settings}
            onClose={() => (settingsOpen = false)}
            onReset={actions.resetSettings}
            onChange={actions.updateSettings}
          />
        </div>
      </div>
    {/if}
  </div>
  <EditorStatusBar {statusMessage} {words} {characters} />
</main>
<CommandPalette
  {actions}
  {contents}
  {databases}
  {editor}
  {path}
  {settings}
  {spaceNotes}
  bind:settingsOpen
  bind:pdfPreviewOpen
  toggleReadOnly={() => (readOnly = !readOnly)}
/>
{#if pdfPreviewOpen}
  <PdfExportModal
    source={(editor?.closest(".ms-editor-frame") as HTMLElement | null) ??
      undefined}
    title={noteTitle}
    onStatus={(message) => (statusMessage = message)}
    onClose={() => (pdfPreviewOpen = false)}
  />
{/if}
