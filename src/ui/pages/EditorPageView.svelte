<script lang="ts">
  /* eslint-disable max-lines */
  import TemplatePicker from "../sections/TemplatePicker.svelte";
  import { slide } from "svelte/transition";
  import { i18n } from "../../lib/i18n";
  import { displayNoteName, entryPathFromNote } from "../../lib/utils/path";
  import BacklinksPanel from "../sections/BacklinksPanel.svelte";
  import DatabaseManager from "../sections/DatabaseManager.svelte";
  import DatabaseView from "../sections/DatabaseView.svelte";
  import EditorStatusBar from "../sections/EditorStatusBar.svelte";
  import EditorTabs from "../sections/EditorTabs.svelte";
  import EditorToolbar from "../sections/EditorToolbar.svelte";
  import GrammarPolice from "../sections/GrammarPolice.svelte";
  import NoteEditorForm from "../forms/NoteEditorForm.svelte";
  import CommandPalette from "../components/CommandPalette.svelte";
  import DiagramPreview from "../components/DiagramPreview.svelte";
  import PdfExportModal from "../components/PdfExportModal.svelte";
  import SettingsPanel from "../sections/SettingsPanel.svelte";
  import ModalOverlay from "../components/ModalOverlay.svelte";
  import SpaceSidebar from "../sections/SpaceSidebar.svelte";
  import WelcomeDashboard from "../sections/WelcomeDashboard.svelte";
  import type { EditorPageActions } from "./editorPageContext";
  import type {
    DiagramPreview as DiagramPreviewData,
  } from "../../lib/utils/diagramPreview";

  export let activePageMeta: any;
  export let activeDiagramPreview: DiagramPreviewData | null;
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
  export let splitTab: string | null = null;
  export let splitContents = "";
  export let onSplitTab: (id: string) => void = () => {};
  export let onSplitInput: () => void = () => {};
  export let onSplitOpen: (id: string) => void = () => {};
  export let onPreviewDiagram:
    (preview: DiagramPreviewData) => void | Promise<void>;
  export let explainGrammarIssue: (issue: any) => Promise<string>;
  export let actions: EditorPageActions;

  /** Session-only: locks the open note against edits. */
  let readOnly = false;
  let templates: { name: string; text: string }[] = [];

  /** Tab dropped on an edge of the editor row: snap it into that side. */
  const tabDragType = "application/x-memosmith-tab";
  let dropZone: { axis: "row" | "column"; side: "start" | "end" } | null =
    null;

  const draggedTabId = (event: DragEvent) =>
    event.dataTransfer?.types.includes(tabDragType)
      ? (event.dataTransfer.getData(tabDragType) || null)
      : null;

  /** Only notes can take a pane; databases and previews stay single. */
  const splittable = (id: string) =>
    !id.startsWith("db:") && !id.startsWith("preview:");

  /** The edge the pointer is nearest wins: sides split across, top and
   * bottom split down. */
  function dropZoneAt(event: DragEvent) {
    if (!splitRow || !event.dataTransfer?.types.includes(tabDragType)) {
      return null;
    }
    const rect = splitRow.getBoundingClientRect();
    const across =
      $i18n.dir === "rtl"
        ? (rect.right - event.clientX) / rect.width
        : (event.clientX - rect.left) / rect.width;
    const down = (event.clientY - rect.top) / rect.height;
    const edges = [
      { axis: "row" as const, side: "start" as const, distance: across },
      { axis: "row" as const, side: "end" as const, distance: 1 - across },
      { axis: "column" as const, side: "start" as const, distance: down },
      { axis: "column" as const, side: "end" as const, distance: 1 - down },
    ].sort((a, b) => a.distance - b.distance);
    const nearest = edges[0];
    return nearest.distance < 0.25
      ? { axis: nearest.axis, side: nearest.side }
      : null;
  }

  function dropTab(event: DragEvent) {
    const zone = dropZone;
    dropZone = null;
    const id = draggedTabId(event);
    if (!id || !zone) {
      return;
    }
    event.preventDefault();
    if (zone.side === "start") {
      onSelectTab(id);
      return;
    }
    if (splittable(id)) {
      splitAxis = zone.axis;
      onSplitOpen(id);
    }
  }

  /** Session-only: how the panes sit, and the share the active one keeps. */
  let splitAxis: "row" | "column" = "row";
  let splitRatio = 0.5;
  let splitRow: HTMLElement | undefined;
  let draggingSplit = false;

  function splitPointerOffset(event: PointerEvent) {
    if (!splitRow) {
      return splitRatio;
    }
    const rect = splitRow.getBoundingClientRect();
    if (splitAxis === "column") {
      return (event.clientY - rect.top) / rect.height;
    }
    const x =
      $i18n.dir === "rtl"
        ? rect.right - event.clientX
        : event.clientX - rect.left;
    return x / rect.width;
  }

  const clampSplit = (ratio: number) => Math.min(0.8, Math.max(0.2, ratio));

  /** Drag snaps to these once it is within 3% of one. */
  const splitStops = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];

  const snapSplit = (ratio: number) =>
    splitStops.find((stop) => Math.abs(stop - ratio) < 0.03) ?? ratio;

  function moveSplit(event: PointerEvent) {
    if (!draggingSplit) {
      return;
    }
    event.preventDefault();
    splitRatio = snapSplit(clampSplit(splitPointerOffset(event)));
  }

  /** Shift + arrow jumps to the neighbouring snap stop. */
  function nextStop(direction: number) {
    const found = splitStops.findIndex((stop) => stop >= splitRatio - 0.001);
    const current = found === -1 ? splitStops.length : found;
    const index = Math.min(
      splitStops.length - 1,
      Math.max(0, current + (direction > 0 ? 1 : -1)),
    );
    return splitStops[index];
  }

  function splitKeyResize(event: KeyboardEvent) {
    const forward = splitAxis === "column" ? "ArrowDown" : "ArrowRight";
    const back = splitAxis === "column" ? "ArrowUp" : "ArrowLeft";
    if (event.key !== forward && event.key !== back) {
      return;
    }
    event.preventDefault();
    const direction =
      (event.key === forward ? 1 : -1) *
      (splitAxis === "row" && $i18n.dir === "rtl" ? -1 : 1);
    splitRatio = event.shiftKey
      ? nextStop(direction)
      : clampSplit(splitRatio + direction * 0.02);
  }

  $: splitEntryPath = splitTab ? entryPathFromNote(splitTab) : null;
  $: splitTitle = splitTab ? displayNoteName(splitTab) : "";

  $: activeDatabaseTabId =
    activeTab?.startsWith("db:") ? activeTab.slice(3) : null;

</script>

<svelte:window
  onbeforeunload={() => void actions.flushNoteSave()}
  onpointermove={(event) => {
    actions.handleResize(event);
    moveSplit(event);
  }}
  onpointerup={() => {
    actions.stopResize();
    draggingSplit = false;
  }}
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
    backlinksAvailable={Boolean(backlinks.length) && !activeDatabaseTabId &&
      !activeDiagramPreview}
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
    onToggleDatabases={() =>
      void (databasesOpen = settings.features.databases && !databasesOpen)}
    {spaceRoot}
    {spaceNotes}
    {actions}
    onToggleGrammar={actions.toggleGrammar}
    onExportPdf={path && !activeDiagramPreview
      ? () => (pdfPreviewOpen = true)
      : null}
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
        {splitTab}
        onSplit={onSplitTab}
      />
      <div
        class="relative flex min-h-0 min-w-0 flex-1"
        class:flex-col={splitTab && splitAxis === "column"}
        bind:this={splitRow}
        role="presentation"
        ondragover={(event) => {
          dropZone = dropZoneAt(event);
          if (dropZone) {
            event.preventDefault();
          }
        }}
        ondragleave={(event) => {
          if (!splitRow?.contains(event.relatedTarget as Node | null)) {
            dropZone = null;
          }
        }}
        ondrop={dropTab}
      >
        {#if dropZone}
          <div
            class="pointer-events-none absolute z-20 bg-emerald-500/20 ring-2 ring-emerald-500/50 ring-inset"
            style={dropZone.axis === "row"
              ? `inset-block: 0; inset-inline-${dropZone.side}: 0; width: 25%`
              : `inset-inline: 0; ${
                  dropZone.side === "start" ? "top" : "bottom"
                }: 0; height: 25%`}
          ></div>
        {/if}
      <div
        class="relative min-h-0 min-w-0 flex-1"
        style={splitTab ? `flex: ${splitRatio} 1 0%` : undefined}
      >
      {#if !activeTab}
        <WelcomeDashboard
          root={spaceRoot}
          notes={spaceNotes}
          meta={spaceMeta}
          onNewNote={(text, folder = "", title = $i18n.t("welcome.untitled")) =>
            actions.runWithStatus(() =>
              actions.createSpaceNote(folder, title, false, text),
            )}
          onChooseSpace={() => actions.runWithStatus(actions.chooseSpace)}
          onOpenNote={(relativePath) =>
            actions.runWithStatus(() =>
              actions.selectSpaceNote(relativePath),
            )}
        />
      {:else if activeDiagramPreview}
        <DiagramPreview preview={activeDiagramPreview} />
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
        <TemplatePicker
          root={spaceRoot} note={activeRelativePath} title={noteTitle}
          bind:contents
          bind:templates
          onPick={actions.updateNote}
        />
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
          youtube={settings.features.youtube}
          spotify={settings.features.spotify}
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
          {templates}
          onOpenDatabase={(id) =>
            actions.runWithStatus(() => actions.selectDatabase(id))}
          {onPreviewDiagram}
          onStatus={(message) => (statusMessage = message)}
          {wikilinkKey}
          decorations={settings.features.grammarPolice && grammarOpen
            ? grammarDecorations
            : []}
          resolveAsset={actions.resolveAsset}
        />
      {/if}
      </div>
      {#if splitTab}
        <button
          type="button"
          class="z-10 shrink-0 border-0 bg-transparent p-0 transition-colors hover:bg-emerald-600/20 focus-visible:bg-emerald-600/20 focus-visible:outline-none"
          class:w-1.5={splitAxis === "row"}
          class:cursor-col-resize={splitAxis === "row"}
          class:h-1.5={splitAxis === "column"}
          class:cursor-row-resize={splitAxis === "column"}
          aria-label={$i18n.t("tabs.splitResize")}
          title={$i18n.t("tabs.splitResize")}
          onpointerdown={(event) => {
            event.preventDefault();
            draggingSplit = true;
          }}
          onkeydown={splitKeyResize}
          ondblclick={() => (splitRatio = 0.5)}
        ></button>
        <div
          class="relative min-h-0 min-w-0 flex-1 overflow-y-auto border-stone-200/70 dark:border-stone-800"
          class:border-s={splitAxis === "row"}
          class:border-t={splitAxis === "column"}
          style={`flex: ${1 - splitRatio} 1 0%`}
        >
          <NoteEditorForm
            bind:contents={splitContents}
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
            noteTitle={splitTitle}
            pageMeta={spaceMeta[splitEntryPath ?? ""] ?? {}}
            showPageTitle={settings.showPageTitle}
            onInput={onSplitInput}
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
            onStatus={(message) => (statusMessage = message)}
            resolveAsset={actions.resolveAsset}
          />
        </div>
      {/if}
      </div>
    </div>
    {#if backlinks.length && !activeDatabaseTabId && !activeDiagramPreview}
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
    {#if settings.features.grammarPolice && grammarOpen &&
      !activeDatabaseTabId && !activeDiagramPreview}
      <div
        class="ms-island ms-island-gap flex min-h-0"
        transition:slide={paneSlide}
      >
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
      <ModalOverlay onClose={() => (databasesOpen = false)}>
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
      </ModalOverlay>
    {/if}
    {#if settingsOpen}
      <ModalOverlay onClose={() => (settingsOpen = false)}>
          <SettingsPanel
            {settings}
            root={settings.features.databases ? spaceRoot : null}
            onClose={() => (settingsOpen = false)}
            onReset={actions.resetSettings}
            onChange={actions.updateSettings}
          />
      </ModalOverlay>
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
  root={spaceRoot}
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
