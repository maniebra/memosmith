<script lang="ts">
  import {
    FilePlus,
    Database,
    FileDown,
    Link2,
    Lock,
    Minus,
    Pencil,
    PanelLeftClose,
    PanelLeftOpen,
    Settings,
    ShieldCheck,
    Square,
    X,
  } from "@lucide/svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import Button from "../components/Button.svelte";
  import ModalOverlay from "../components/ModalOverlay.svelte";
  import TemplateManager from "./TemplateManager.svelte";
  import {
    fillTemplate,
    type SpaceTemplate,
  } from "../../lib/utils/templates";
  import type { EditorPageActions } from "../pages/editorPageContext";
  import type { WindowButtons } from "../../lib/utils/theme";

  type ToolbarBreadcrumb = {
    label: string;
    path?: string;
  };

  export let title: string;
  export let fileLabel: string;
  export let breadcrumbs: ToolbarBreadcrumb[] = [];
  export let isDirty: boolean;
  export let spacePaneOpen: boolean;
  export let grammarEnabled = true;
  export let databasesEnabled = true;
  export let backlinksAvailable = false;
  export let backlinksOpen = true;
  export let backlinksCount = 0;
  export let readOnly = false;
  // "native" leaves the buttons to the OS frame, so the toolbar draws none.
  export let windowButtons: WindowButtons = "windows";
  export let onSelectBreadcrumb: (path: string) => void;
  export let onToggleSpacePane: () => void;
  export let onToggleBacklinks: () => void;
  export let onToggleReadOnly: () => void;
  export let onToggleSettings: () => void;
  export let onToggleDatabases: () => void;
  export let onToggleGrammar: () => void;
  export let onExportPdf: (() => void) | null = null;
  export let spaceRoot: string | null = null;
  export let spaceNotes: string[] = [];
  export let actions: Pick<
    EditorPageActions,
    "runWithStatus" | "selectSpaceNote" | "createSpaceNote"
  >;

  function editTemplate(relativePath: string) {
    templatesOpen = false;
    void actions.runWithStatus(() => actions.selectSpaceNote(relativePath));
  }

  function useTemplate(template: SpaceTemplate) {
    templatesOpen = false;
    const title = $i18n.t("welcome.untitled");
    const text = fillTemplate(template.text, title);
    void actions.runWithStatus(() =>
      actions.createSpaceNote(template.folder, title, false, text),
    );
  }

  let templatesOpen = false;

  // Without the OS frame, the toolbar carries the window controls.
  const windowControls = [
    { key: "toolbar.minimize", icon: Minus, run: () => getCurrentWindow().minimize() },
    { key: "toolbar.maximize", icon: Square, run: () => getCurrentWindow().toggleMaximize() },
    { key: "toolbar.close", icon: X, run: () => getCurrentWindow().close() },
  ] as const;

  // macOS order and colors: close, minimize, maximize.
  const trafficLights = [
    { key: "toolbar.close", color: "bg-[#ff5f57]", run: () => getCurrentWindow().close() },
    { key: "toolbar.minimize", color: "bg-[#febc2e]", run: () => getCurrentWindow().minimize() },
    { key: "toolbar.maximize", color: "bg-[#28c840]", run: () => getCurrentWindow().toggleMaximize() },
  ] as const;

  $: visibleBreadcrumbs = breadcrumbs.length
    ? breadcrumbs
    : [{ label: fileLabel }];
</script>

<header
  class="ms-island-chrome flex h-12 items-center gap-1.5 border-b border-stone-200/70 bg-stone-50/80 px-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/70"
  aria-label={$i18n.t("toolbar.aria")}
  data-tauri-drag-region
>
  {#if windowButtons === "macos"}
    <div class="group/lights mr-2 flex shrink-0 items-center gap-2">
      {#each trafficLights as light}
        <button
          type="button"
          class={cn(
            "size-3 rounded-full ring-1 ring-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
            light.color,
          )}
          aria-label={$i18n.t(light.key)}
          title={$i18n.t(light.key)}
          onclick={light.run}
        ></button>
      {/each}
    </div>
  {/if}
  <button
    type="button"
    class="group flex size-7 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
    aria-label={$i18n.t("toolbar.toggleSpace")}
    aria-pressed={spacePaneOpen}
    title={$i18n.t("toolbar.toggleSpaceShortcut")}
    onclick={onToggleSpacePane}
  >
    {#if spacePaneOpen}
      <PanelLeftClose class="size-4" strokeWidth={1.8} aria-hidden="true" />
    {:else}
      <PanelLeftOpen class="size-4" strokeWidth={1.8} aria-hidden="true" />
    {/if}
  </button>

  <nav
    class="flex min-w-0 items-center gap-0 text-sm font-medium leading-none"
    aria-label={$i18n.t("toolbar.currentNote")}
  >
    <span class="shrink-0 text-stone-500 dark:text-stone-400">
      {title}
    </span>
    {#each visibleBreadcrumbs as crumb, index}
      <span
        class="mx-1.5 shrink-0 text-stone-300 dark:text-stone-600"
        aria-hidden="true">/</span
      >
      {#if crumb.path}
        <button
          type="button"
          class="min-w-0 truncate rounded-sm text-left text-stone-700 transition-colors hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-200 dark:hover:text-white"
          aria-current={index === visibleBreadcrumbs.length - 1
            ? "page"
            : undefined}
          onclick={() => onSelectBreadcrumb(crumb.path!)}
        >
          {crumb.label}
        </button>
      {:else}
        <span
          class="min-w-0 truncate text-stone-700 dark:text-stone-200"
          aria-current={index === visibleBreadcrumbs.length - 1
            ? "page"
            : undefined}>{crumb.label}</span
        >
      {/if}
    {/each}
    {#if isDirty}
      <span
        class="ml-0.5 size-1.5 shrink-0 rounded-full bg-amber-500"
        title={$i18n.t("toolbar.unsaved")}
        aria-label={$i18n.t("toolbar.unsaved")}
      ></span>
    {/if}
  </nav>

  <div class="ml-auto flex shrink-0 items-center gap-0.5">
    {#if backlinksAvailable}
      <button
        type="button"
        class={cn(
          "relative inline-flex size-8 items-center justify-center rounded-lg border border-transparent text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:text-stone-400 dark:hover:text-stone-100",
          backlinksOpen &&
            "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
        )}
        aria-label={backlinksOpen
          ? $i18n.t("toolbar.hideBacklinks")
          : $i18n.t("toolbar.showBacklinks")}
        aria-pressed={backlinksOpen}
        title={backlinksOpen
          ? $i18n.t("toolbar.hideBacklinks")
          : $i18n.t("toolbar.showBacklinks")}
        onclick={onToggleBacklinks}
      >
        <Link2 class="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
        <span
          class="absolute -top-0.5 -right-0.5 min-w-4 rounded bg-stone-500/10 px-1 text-[0.6rem] leading-4 text-stone-500 dark:text-stone-300"
        >
          {backlinksCount}
        </span>
      </button>
    {/if}
    <button
      type="button"
      class={cn(
        "inline-flex size-8 items-center justify-center rounded-lg border border-transparent text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:text-stone-400 dark:hover:text-stone-100",
        readOnly && "bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
      )}
      aria-label={readOnly
        ? $i18n.t("toolbar.enableEditing")
        : $i18n.t("toolbar.readOnly")}
      aria-pressed={readOnly}
      title={readOnly
        ? $i18n.t("toolbar.enableEditing")
        : $i18n.t("toolbar.readOnly")}
      onclick={onToggleReadOnly}
    >
      {#if readOnly}
        <Lock class="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      {:else}
        <Pencil class="size-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
      {/if}
    </button>
    {#if grammarEnabled}
      <Button
        label={$i18n.t("toolbar.grammar")}
        icon={ShieldCheck}
        onClick={onToggleGrammar}
        variant="ghost"
        size="sm"
      />
    {/if}
    {#if onExportPdf}
      <Button
        label={$i18n.t("toolbar.exportPdf")}
        icon={FileDown}
        onClick={onExportPdf}
        variant="ghost"
        size="sm"
      />
    {/if}
    {#if spaceRoot}
      <Button
        label={$i18n.t("template.title")}
        icon={FilePlus}
        onClick={() => void (templatesOpen = !templatesOpen)}
        variant="ghost"
        size="sm"
      />
    {/if}
    {#if databasesEnabled}
      <Button
        label={$i18n.t("toolbar.databases")}
        icon={Database}
        onClick={onToggleDatabases}
        variant="ghost"
        size="sm"
      />
    {/if}
    <Button
      label={$i18n.t("toolbar.settings")}
      icon={Settings}
      onClick={onToggleSettings}
      variant="ghost"
      size="sm"
    />
    {#if windowButtons === "windows"}
      <span
        class="mx-1 h-5 w-px bg-stone-300/70 dark:bg-stone-700"
        aria-hidden="true"
      ></span>
    {/if}
    {#each windowButtons === "windows" ? windowControls : [] as control}
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 dark:text-stone-400 dark:hover:text-stone-100"
        aria-label={$i18n.t(control.key)}
        title={$i18n.t(control.key)}
        onclick={control.run}
      >
        <control.icon
          class="size-4 shrink-0"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
    {/each}
  </div>
</header>

{#if templatesOpen && spaceRoot}
  <ModalOverlay onClose={() => (templatesOpen = false)}>
    <TemplateManager
      root={spaceRoot}
      notes={spaceNotes}
      onEdit={editTemplate}
      onUse={useTemplate}
      onClose={() => (templatesOpen = false)}
    />
  </ModalOverlay>
{/if}
