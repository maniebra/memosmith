<script lang="ts">
  import {
    BadgeAlert,
    ChevronDown,
    CircleQuestionMark,
    CircleX,
    Info,
    Lightbulb,
    Plus,
    RotateCcw,
    Star,
    Trash2,
    TriangleAlert,
    X,
    Zap,
  } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, slide } from "svelte/transition";
  import type {
    AppSettings,
    CalloutDefinition,
    EditorWidth,
    FeatureSettings,
    GrammarCheckMode,
    ThemePreference,
  } from "../../lib/storage/settings";
  import {
    defaultCalloutDefinitions,
    type LspSettings,
    type PlantumlFormat,
    type PlantumlSettings,
    type RunnerSettings,
  } from "../../lib/storage/settings";
  import { detectRuntimes } from "../../lib/tauri/runner";
  import { detectLanguageServers, resetLanguageServers } from "../../lib/tauri/lsp";
  import { KERNEL_LABELS, type Kernel } from "../../lib/utils/runner";
  import {
    CALLOUT_ICON_OPTIONS,
    normalizeCalloutIcon,
  } from "../../lib/utils/calloutIcons";
  import {
    accentOptions,
    cornerOptions,
    densityOptions,
    editorLineHeightOptions,
    fontOptions,
    type AppearanceSettings,
    type CornerStyle,
    type Density,
    type EditorLineHeight,
    type FontChoice,
  } from "../../lib/utils/theme";
  import Button from "../components/Button.svelte";
  import Input from "../components/Input.svelte";
  import TextArea from "../components/TextArea.svelte";
  import Select, { type SelectOption } from "../components/Select.svelte";
  import { REASONING_LEVELS } from "../../lib/utils/llmOptions";
  import Slider from "../components/Slider.svelte";
  import Switch from "../components/Switch.svelte";
  import { cn } from "../../lib/utils/cn";

  export let settings: AppSettings;
  export let onClose: () => void;
  export let onReset: () => void;
  export let onChange: (settings: AppSettings) => void;

  const themeOptions: SelectOption[] = [
    { label: "System", value: "system" },
    { label: "Light", value: "light" },
    { label: "Dark", value: "dark" },
  ];

  const widthOptions: SelectOption[] = [
    { label: "Focused", value: "focused" },
    { label: "Comfortable", value: "comfortable" },
    { label: "Wide", value: "wide" },
    { label: "Full width", value: "full" },
  ];

  const grammarCheckModeOptions: SelectOption[] = [
    { label: "Auto diff", value: "auto-diff" },
    { label: "Auto full", value: "auto-full" },
    { label: "Manual", value: "manual" },
  ];

  type SettingsTab = "appearance" | "features" | "editor" | "ai";

  let activeTab: SettingsTab = "appearance";
  let grammarOptionsOpen = false;
  let codeOptionsOpen = false;
  let plantumlOptionsOpen = false;
  let lspOptionsOpen = false;
  /** Resolved language server per kernel, refreshed whenever the paths change. */
  let languageServers: Record<string, string> = {};
  /** Resolved interpreter per kernel, refreshed whenever the paths change. */
  let runtimes: Record<string, string> = {};

  async function refreshRuntimes() {
    runtimes = await detectRuntimes(settings.runner).catch(() => ({}));
  }

  async function refreshLanguageServers() {
    languageServers = await detectLanguageServers(settings.lsp).catch(() => ({}));
  }

  function updateLsp(nextLsp: Partial<LspSettings>) {
    updateSettings({ lsp: { ...settings.lsp, ...nextLsp } });
  }

  function updateLspCommand(kernel: Kernel, command: string) {
    updateLsp({ commands: { ...settings.lsp.commands, [kernel]: command } });
    void resetLanguageServers().catch(() => {});
    void refreshLanguageServers();
  }

  function updateRunner(nextRunner: Partial<RunnerSettings>) {
    updateSettings({ runner: { ...settings.runner, ...nextRunner } });
  }

  const plantumlFormatOptions = [
    { label: "SVG", value: "svg" },
    { label: "PNG", value: "png" },
    { label: "ASCII art", value: "txt" },
  ];

  function updatePlantuml(next: Partial<PlantumlSettings>) {
    updateSettings({ plantuml: { ...settings.plantuml, ...next } });
  }

  function updateRunnerCommand(kernel: Kernel, command: string) {
    updateRunner({ commands: { ...settings.runner.commands, [kernel]: command } });
    void refreshRuntimes();
  }
  let calloutOptionsOpen = false;
  const tabOptions: { label: string; value: SettingsTab }[] = [
    { label: "Appearance", value: "appearance" },
    { label: "Features", value: "features" },
    { label: "Editor", value: "editor" },
    { label: "AI", value: "ai" },
  ];

  function updateSettings(nextSettings: Partial<AppSettings>) {
    onChange({ ...settings, ...nextSettings });
  }

  function updateAppearance(nextAppearance: Partial<AppearanceSettings>) {
    updateSettings({
      appearance: { ...settings.appearance, ...nextAppearance },
    });
  }

  function updateFeatures(nextFeatures: Partial<FeatureSettings>) {
    updateSettings({
      features: { ...settings.features, ...nextFeatures },
    });
  }

  function normalizeCalloutId(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 32);
  }

  function updateCallouts(callouts: CalloutDefinition[]) {
    updateSettings({ callouts });
  }

  function updateCallout(index: number, nextCallout: Partial<CalloutDefinition>) {
    updateCallouts(
      settings.callouts.map((callout, calloutIndex) =>
        calloutIndex === index ? { ...callout, ...nextCallout } : callout,
      ),
    );
  }

  function updateCalloutId(index: number, value: string) {
    const id = normalizeCalloutId(value);

    if (id && settings.callouts.some((callout, calloutIndex) => calloutIndex !== index && callout.id === id)) {
      return;
    }

    updateCallout(index, { id });
  }

  function addCallout() {
    let suffix = settings.callouts.length + 1;
    let id = `custom-${suffix}`;

    while (settings.callouts.some((callout) => callout.id === id)) {
      suffix++;
      id = `custom-${suffix}`;
    }

    updateCallouts([
      ...settings.callouts,
      { id, label: "Custom", color: "#64748b", icon: "i" },
    ]);
  }

  function removeCallout(index: number) {
    updateCallouts(settings.callouts.filter((_, calloutIndex) => calloutIndex !== index));
  }

  function resetCallouts() {
    updateCallouts(defaultCalloutDefinitions.map((callout) => ({ ...callout })));
  }

  const calloutIconComponents: Record<string, any> = {
    Info,
    Lightbulb,
    BadgeAlert,
    TriangleAlert,
    CircleX,
    CircleQuestionMark,
    Star,
    Zap,
  };

  function calloutIconComponent(icon: string) {
    return calloutIconComponents[normalizeCalloutIcon(icon)] ?? Info;
  }

  $: activeLlm = settings.llm;

  function updateLlm(nextLlm: Partial<AppSettings["llm"]>) {
    updateSettings({ llm: { ...settings.llm, ...nextLlm } });
  }

  function hint(key: keyof AppSettings["llm"], fallback: string) {
    return settings.llm[key] || fallback;
  }

  $: reasoningOptions = REASONING_LEVELS.map((level) => ({
    label: level
      ? level[0].toUpperCase() + level.slice(1)
      : "Provider default",
    value: level,
  })) as SelectOption[];

  const samplingFields: { key: keyof AppSettings["llm"]; label: string; placeholder: string }[] = [
    { key: "temperature", label: "Temperature", placeholder: "1" },
    { key: "topP", label: "Top P", placeholder: "1" },
    { key: "maxTokens", label: "Max tokens", placeholder: "unlimited" },
    { key: "presencePenalty", label: "Presence penalty", placeholder: "0" },
    { key: "frequencyPenalty", label: "Frequency penalty", placeholder: "0" },
    { key: "seed", label: "Seed", placeholder: "random" },
  ];

  const compactSelectRoot = "w-full sm:w-56";
  const shortSelectRoot = "w-full sm:w-44";
  const calloutIconOptions = CALLOUT_ICON_OPTIONS as SelectOption[];
  const calloutColorOptions = [
    "#2563eb",
    "#059669",
    "#7c3aed",
    "#d97706",
    "#dc2626",
    "#0891b2",
    "#64748b",
    "#db2777",
  ];
</script>

<div
  class="flex h-[min(760px,85vh)] w-[min(920px,92vw)] flex-col overflow-hidden rounded-xl bg-stone-50 shadow-xl dark:bg-stone-900"
  aria-label="Settings Modal"
>
  <div class="flex h-12 shrink-0 items-center justify-between border-b border-stone-200/50 px-4 dark:border-stone-800/80">
    <h2 class="text-sm font-semibold text-stone-800 dark:text-stone-100">
      Settings
    </h2>
    <div class="flex gap-1">
      <Button
        label="Reset"
        icon={RotateCcw}
        onClick={onReset}
        variant="ghost"
        size="sm"
      />
      <Button
        label="Close"
        icon={X}
        onClick={onClose}
        variant="ghost"
        size="sm"
      />
    </div>
  </div>

  <div class="grid min-h-0 flex-1 grid-cols-[8rem_minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)]">
    <div
      class="flex flex-col gap-1 border-r border-stone-200/50 bg-stone-100/50 p-2 dark:border-stone-800/80 dark:bg-stone-950/25"
      aria-label="Settings sections"
      aria-orientation="vertical"
      role="tablist"
    >
      {#each tabOptions as tab}
        <button
          type="button"
          role="tab"
          class={cn(
            "flex h-9 w-full items-center border-l-2 px-3 text-left text-sm font-medium transition-colors",
            activeTab === tab.value
              ? "border-emerald-600 bg-emerald-600/12 text-emerald-700 dark:text-emerald-300"
              : "border-transparent text-stone-600 hover:bg-stone-500/10 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
          )}
          aria-selected={activeTab === tab.value}
          onclick={() => (activeTab = tab.value)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="min-w-0 overflow-y-auto px-4 py-5 sm:px-7 sm:py-6" role="tabpanel">
    {#if activeTab === "appearance"}
      <div class="grid max-w-2xl gap-5">
        <section class="grid gap-2 sm:grid-cols-[8rem_auto] sm:items-center">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Color mode
          </span>
          <Select
            value={settings.theme}
            options={themeOptions}
            className="h-9"
            rootClassName={compactSelectRoot}
            onChange={(theme) =>
              updateSettings({ theme: theme as ThemePreference })}
          />
        </section>

        <section class="grid gap-3 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_minmax(0,1fr)] dark:border-stone-800/80">
          <span class="text-sm font-medium text-stone-800 sm:pt-2 dark:text-stone-200">
            Accent color
          </span>
          <div class="flex flex-wrap gap-2">
            {#each accentOptions as accent (accent.value)}
              <button
                type="button"
                class={cn(
                  "flex h-10 items-center gap-2 rounded-lg border px-2.5 text-left text-sm font-medium transition-colors",
                  settings.appearance.accentColor === accent.value
                    ? "border-emerald-600 text-emerald-700 ring-2 ring-emerald-600/20 dark:text-emerald-300"
                    : "border-stone-200 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800",
                )}
                aria-pressed={settings.appearance.accentColor === accent.value}
                onclick={() => updateAppearance({ accentColor: accent.value })}
              >
                <span
                  class="size-4 shrink-0 rounded-full shadow-inner ring-1 ring-black/10"
                  style={`background: ${accent.preview};`}
                  aria-hidden="true"
                ></span>
                <span class="truncate">{accent.label}</span>
              </button>
            {/each}
          </div>
        </section>

        <section class="grid gap-3 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_minmax(0,1fr)] dark:border-stone-800/80">
          <span class="text-sm font-medium text-stone-800 sm:pt-6 dark:text-stone-200">
            Fonts
          </span>
          <div class="flex flex-wrap gap-3">
            <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-56">
              Interface
              <Select
                value={settings.appearance.uiFont}
                options={fontOptions}
                className="h-9"
                rootClassName={compactSelectRoot}
                onChange={(uiFont) => updateAppearance({ uiFont: uiFont as FontChoice })}
              />
            </label>
            <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-56">
              Editor
              <Select
                value={settings.appearance.editorFont}
                options={fontOptions}
                className="h-9"
                rootClassName={compactSelectRoot}
                onChange={(editorFont) =>
                  updateAppearance({ editorFont: editorFont as FontChoice })}
              />
            </label>
          </div>
        </section>

        <section class="grid gap-3 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_minmax(0,1fr)] dark:border-stone-800/80">
          <span class="text-sm font-medium text-stone-800 sm:pt-6 dark:text-stone-200">
            Style
          </span>
          <div class="flex flex-wrap gap-3">
            <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-44">
              Corners
              <Select
                value={settings.appearance.cornerStyle}
                options={cornerOptions}
                className="h-9"
                rootClassName={shortSelectRoot}
                onChange={(cornerStyle) =>
                  updateAppearance({ cornerStyle: cornerStyle as CornerStyle })}
              />
            </label>
            <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-44">
              Density
              <Select
                value={settings.appearance.density}
                options={densityOptions}
                className="h-9"
                rootClassName={shortSelectRoot}
                onChange={(density) => updateAppearance({ density: density as Density })}
              />
            </label>
            <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-44">
              Line spacing
              <Select
                value={settings.appearance.editorLineHeight}
                options={editorLineHeightOptions}
                className="h-9"
                rootClassName={shortSelectRoot}
                onChange={(editorLineHeight) =>
                  updateAppearance({
                    editorLineHeight: editorLineHeight as EditorLineHeight,
                  })}
              />
            </label>
          </div>
        </section>
      </div>
    {:else if activeTab === "features"}
      <div class="grid w-full gap-4">
        <section class="grid w-full gap-2">
          <div class="flex h-10 w-full items-center gap-2">
            <Switch
              checked={settings.features.grammarPolice}
              label="Grammar Police"
              className="h-full min-w-0 flex-1"
              onChange={(grammarPolice) => updateFeatures({ grammarPolice })}
            />
            <button
              type="button"
              class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
              aria-expanded={grammarOptionsOpen}
              aria-label="Grammar Police options"
              title="Grammar Police options"
              onclick={() => (grammarOptionsOpen = !grammarOptionsOpen)}
            >
              <ChevronDown
                class={cn(
                  "size-4 shrink-0 transition-transform duration-200 ease-out",
                  grammarOptionsOpen && "rotate-180",
                )}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </button>
          </div>
          {#if grammarOptionsOpen}
            <div
              class="ml-14 grid gap-2 pl-2 text-xs text-stone-500"
              transition:slide={{ duration: 160, easing: cubicOut }}
            >
              <div class="grid gap-1.5" in:fade={{ duration: 120 }} out:fade={{ duration: 80 }}>
                <label class="grid gap-1.5">
                  Check mode
                  <Select
                    value={settings.features.grammarCheckMode}
                    options={grammarCheckModeOptions}
                    className="h-9"
                    rootClassName={compactSelectRoot}
                    onChange={(grammarCheckMode) =>
                      updateFeatures({ grammarCheckMode: grammarCheckMode as GrammarCheckMode })}
                  />
                </label>
              </div>
            </div>
          {/if}
          <Switch
            checked={settings.features.databases}
            label="Databases"
            className="h-10 w-full"
            onChange={(databases) => updateFeatures({ databases })}
          />
          <Switch
            checked={settings.features.fancyTableEditor}
            label="Fancy table editor"
            className="h-10 w-full"
            onChange={(fancyTableEditor) => updateFeatures({ fancyTableEditor })}
          />
          <div class="grid w-full gap-2">
            <div class="flex h-10 w-full items-center gap-2">
              <Switch
                checked={settings.features.callouts}
                label="Callouts"
                className="h-full min-w-0 flex-1"
                onChange={(callouts) => updateFeatures({ callouts })}
              />
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
                aria-expanded={calloutOptionsOpen}
                aria-label="Callout options"
                title="Callout options"
                onclick={() => (calloutOptionsOpen = !calloutOptionsOpen)}
              >
                <ChevronDown
                  class={cn(
                    "size-4 shrink-0 transition-transform duration-200 ease-out",
                    calloutOptionsOpen && "rotate-180",
                  )}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </button>
            </div>
            {#if calloutOptionsOpen}
              <div
                class="ml-14 grid gap-3 pl-2"
                transition:slide={{ duration: 160, easing: cubicOut }}
              >
                <div
                  class="flex flex-wrap items-center justify-between gap-2"
                  in:fade={{ duration: 120 }}
                  out:fade={{ duration: 80 }}
                >
                  <span class="text-xs font-medium text-stone-500">
                    Callout classes
                  </span>
                  <div class="flex gap-1.5">
                    <button
                      type="button"
                      class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-300 dark:hover:text-stone-100"
                      onclick={resetCallouts}
                    >
                      <RotateCcw class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                      Defaults
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-300 dark:hover:text-stone-100"
                      onclick={addCallout}
                    >
                      <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                      Add
                    </button>
                  </div>
                </div>

                <div class="grid gap-3">
                  {#each settings.callouts as callout, index (index)}
                    <div
                      class="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-800 dark:bg-stone-950/35"
                      in:fade={{ duration: 120 }}
                      out:fade={{ duration: 80 }}
                    >
                      <div class="flex items-center gap-2">
                        <span
                          class="grid size-8 shrink-0 place-items-center rounded-md text-sm font-semibold text-white shadow-sm"
                          style={`background:${callout.color};`}
                          aria-hidden="true"
                        >
                          <svelte:component
                            this={calloutIconComponent(callout.icon)}
                            class="size-4"
                            strokeWidth={2}
                          />
                        </span>
                        <div class="min-w-0 flex-1">
                          <Input
                            value={callout.id}
                            className="h-8 font-mono text-xs"
                            placeholder="note"
                            oninput={(event) =>
                              updateCalloutId(index, (event.target as HTMLInputElement).value)}
                          />
                        </div>
                        <button
                          type="button"
                          class="grid size-8 shrink-0 place-items-center rounded-md text-stone-400 transition-colors hover:bg-rose-500/10 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600/25 dark:hover:text-rose-300"
                          aria-label="Remove callout"
                          title="Remove callout"
                          onclick={() => removeCallout(index)}
                        >
                          <Trash2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      </div>

                      <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
                        <label class="grid gap-1.5 text-xs text-stone-500">
                          Label
                          <Input
                            value={callout.label}
                            className="h-8 text-xs"
                            placeholder="Note"
                            oninput={(event) =>
                              updateCallout(index, {
                                label: (event.target as HTMLInputElement).value,
                              })}
                          />
                        </label>
                        <label class="grid gap-1.5 text-xs text-stone-500">
                          Icon
                          <Select
                            value={callout.icon}
                            options={calloutIconOptions}
                            className="h-8"
                            rootClassName="w-full"
                            onChange={(icon) =>
                              updateCallout(index, {
                                icon: normalizeCalloutIcon(icon),
                              })}
                          />
                        </label>
                      </div>

                      <div class="flex flex-wrap items-center gap-2">
                        {#each calloutColorOptions as color (color)}
                          <button
                            type="button"
                            class={cn(
                              "size-7 rounded-md shadow-inner ring-1 ring-black/10 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30",
                              callout.color === color && "scale-90 ring-2 ring-stone-900/40 dark:ring-white/60",
                            )}
                            style={`background:${color};`}
                            aria-label={`Use ${color}`}
                            aria-pressed={callout.color === color}
                            onclick={() => updateCallout(index, { color })}
                          ></button>
                        {/each}
                        <input
                          type="color"
                          value={callout.color}
                          class="size-8 rounded-md border border-stone-200 bg-transparent p-0.5 dark:border-stone-700"
                          aria-label="Custom callout color"
                          oninput={(event) =>
                            updateCallout(index, {
                              color: (event.target as HTMLInputElement).value,
                            })}
                        />
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          <Switch
            checked={settings.features.drawings}
            label="Drawing blocks (Excalidraw)"
            className="h-10 w-full"
            onChange={(drawings) => updateFeatures({ drawings })}
          />
          <Switch
            checked={settings.features.diagrams}
            label="Diagram blocks (draw.io)"
            className="h-10 w-full"
            onChange={(diagrams) => updateFeatures({ diagrams })}
          />
          <div class="grid gap-2">
            <div class="flex items-center gap-1">
              <Switch
                checked={settings.features.codeExecution}
                label="Code execution (Jupyter-style cells)"
                className="h-10 w-full"
                onChange={(codeExecution) => {
                  updateFeatures({ codeExecution });

                  if (codeExecution) {
                    void refreshRuntimes();
                  }
                }}
              />
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
                aria-expanded={codeOptionsOpen}
                aria-label="Code execution options"
                onclick={() => {
                  codeOptionsOpen = !codeOptionsOpen;

                  if (codeOptionsOpen) {
                    void refreshRuntimes();
                  }
                }}
              >
                <ChevronDown
                  class={cn("size-4 transition-transform", codeOptionsOpen && "rotate-180")}
                />
              </button>
            </div>

            {#if codeOptionsOpen}
              <div
                class="grid gap-4 rounded-md border border-stone-200 p-3 dark:border-stone-800"
                transition:slide={{ duration: 160, easing: cubicOut }}
              >
                <span class="text-xs text-stone-500">
                  Runtimes are found on PATH; fill a box only to point at a different one. Each note
                  keeps its own kernel, so cells share variables like a notebook.
                </span>

                {#each Object.keys(KERNEL_LABELS) as kernel (kernel)}
                  <label class="grid gap-1">
                    <span class="flex items-center justify-between text-sm text-stone-700 dark:text-stone-200">
                      {KERNEL_LABELS[kernel as Kernel]}
                      <span
                        class={cn(
                          "font-mono text-xs",
                          runtimes[kernel] ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {runtimes[kernel] || "not found"}
                      </span>
                    </span>
                    <Input
                      value={settings.runner.commands[kernel as Kernel]}
                      placeholder={runtimes[kernel] || "path to the interpreter"}
                      oninput={(event) =>
                        updateRunnerCommand(kernel as Kernel, (event.target as HTMLInputElement).value)}
                    />
                  </label>
                {/each}

                <label class="grid gap-1">
                  <span class="text-sm text-stone-700 dark:text-stone-200">Cell timeout (seconds)</span>
                  <Input
                    value={String(settings.runner.timeoutMs / 1000)}
                    oninput={(event) => {
                      const seconds = Number((event.target as HTMLInputElement).value);

                      if (Number.isFinite(seconds) && seconds > 0) {
                        updateRunner({ timeoutMs: Math.round(seconds * 1000) });
                      }
                    }}
                  />
                </label>
              </div>
            {/if}
          </div>

          <div class="grid gap-2">
            <div class="flex items-center gap-1">
              <Switch
                checked={settings.features.plantuml}
                label="PlantUML blocks (live render)"
                className="h-10 w-full"
                onChange={(plantuml) => updateFeatures({ plantuml })}
              />
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
                aria-expanded={plantumlOptionsOpen}
                aria-label="PlantUML options"
                onclick={() => (plantumlOptionsOpen = !plantumlOptionsOpen)}
              >
                <ChevronDown
                  class={cn("size-4 transition-transform", plantumlOptionsOpen && "rotate-180")}
                />
              </button>
            </div>

            {#if plantumlOptionsOpen}
              <div
                class="grid gap-4 rounded-md border border-stone-200 p-3 dark:border-stone-800"
                transition:slide={{ duration: 160, easing: cubicOut }}
              >
                <span class="text-xs text-stone-500">
                  Point at a local PlantUML binary, or at a PlantUML server. The server is used when
                  both are filled in. Diagrams render in the background, so a slow one never blocks
                  typing.
                </span>

                <label class="grid gap-1">
                  <span class="text-sm text-stone-700 dark:text-stone-200">Binary or command</span>
                  <Input
                    value={settings.plantuml.command}
                    placeholder="plantuml (or: java -jar /path/plantuml.jar)"
                    oninput={(event) =>
                      updatePlantuml({ command: (event.target as HTMLInputElement).value })}
                  />
                </label>

                <label class="grid gap-1">
                  <span class="text-sm text-stone-700 dark:text-stone-200">Server URL</span>
                  <Input
                    value={settings.plantuml.server}
                    placeholder="http://localhost:8080"
                    oninput={(event) =>
                      updatePlantuml({ server: (event.target as HTMLInputElement).value })}
                  />
                </label>

                <label class="grid gap-1">
                  <span class="text-sm text-stone-700 dark:text-stone-200">Theme</span>
                  <Input
                    value={settings.plantuml.theme}
                    placeholder="none (try: carbon-gray, cyborg, hacker, sketchy)"
                    oninput={(event) =>
                      updatePlantuml({ theme: (event.target as HTMLInputElement).value })}
                  />
                  <span class="text-xs text-stone-500">
                    Added as <code>!theme</code> to every diagram that does not set one itself. A
                    dark theme is what makes diagrams sit well next to a dark editor.
                  </span>
                </label>

                <label class="grid gap-1">
                  <span class="text-sm text-stone-700 dark:text-stone-200">Output</span>
                  <Select
                    value={settings.plantuml.format}
                    options={plantumlFormatOptions}
                    className="h-9"
                    rootClassName={compactSelectRoot}
                    onChange={(format) => updatePlantuml({ format: format as PlantumlFormat })}
                  />
                </label>
              </div>
            {/if}
          </div>

          <div class="grid gap-2">
            <div class="flex items-center gap-1">
              <Switch
                checked={settings.features.lsp}
                label="Code suggestions (language servers)"
                className="h-10 w-full"
                onChange={(lsp) => {
                  updateFeatures({ lsp });

                  if (lsp) {
                    void refreshLanguageServers();
                  } else {
                    void resetLanguageServers().catch(() => {});
                  }
                }}
              />
              <button
                type="button"
                class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
                aria-expanded={lspOptionsOpen}
                aria-label="Code suggestion options"
                onclick={() => {
                  lspOptionsOpen = !lspOptionsOpen;

                  if (lspOptionsOpen) {
                    void refreshLanguageServers();
                  }
                }}
              >
                <ChevronDown
                  class={cn("size-4 transition-transform", lspOptionsOpen && "rotate-180")}
                />
              </button>
            </div>

            {#if lspOptionsOpen}
              <div
                class="grid gap-4 rounded-md border border-stone-200 p-3 dark:border-stone-800"
                transition:slide={{ duration: 160, easing: cubicOut }}
              >
                <span class="text-xs text-stone-500">
                  Typing inside a code block asks the matching language server for completions.
                  Servers are found on PATH; fill a box only to point at a different one.
                </span>

                {#each Object.keys(KERNEL_LABELS) as kernel (kernel)}
                  <label class="grid gap-1">
                    <span class="flex items-center justify-between text-sm text-stone-700 dark:text-stone-200">
                      {KERNEL_LABELS[kernel as Kernel]}
                      <span
                        class={cn(
                          "font-mono text-xs",
                          languageServers[kernel] ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {languageServers[kernel] || "not found"}
                      </span>
                    </span>
                    <Input
                      value={settings.lsp.commands[kernel as Kernel]}
                      placeholder={languageServers[kernel] || "path to the language server"}
                      oninput={(event) =>
                        updateLspCommand(kernel as Kernel, (event.target as HTMLInputElement).value)}
                    />
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        </section>
      </div>
    {:else if activeTab === "ai"}
      <div class="grid max-w-2xl gap-6">
        <section class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Base URL
          </span>
          <Input
            value={activeLlm.baseUrl}
            placeholder={hint("baseUrl", "https://api.openai.com/v1")}
            oninput={(event) =>
              updateLlm({ baseUrl: (event.target as HTMLInputElement).value })}
          />
          <span class="text-xs text-stone-500">
            Any OpenAI-compatible endpoint (OpenAI, OpenRouter, Groq, Ollama, LM Studio).
          </span>
        </section>

        <section class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            API key
          </span>
          <Input
            value={activeLlm.apiKey}
            type="password"
            placeholder="sk-..."
            oninput={(event) =>
              updateLlm({ apiKey: (event.target as HTMLInputElement).value })}
          />
        </section>

        <section class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Model
          </span>
          <Input
            value={activeLlm.model}
            placeholder={hint("model", "gpt-4o-mini")}
            oninput={(event) =>
              updateLlm({ model: (event.target as HTMLInputElement).value })}
          />
        </section>

        <section class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            System prompt
          </span>
          <TextArea
            value={activeLlm.systemPrompt}
            size="sm"
            className="text-sm"
            placeholder=""
            onInput={(event) =>
              updateLlm({ systemPrompt: (event.target as HTMLTextAreaElement).value })}
          />
        </section>

        <section class="grid gap-2 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_auto] sm:items-start dark:border-stone-800/80">
          <span class="text-sm font-medium text-stone-800 sm:pt-2 dark:text-stone-200">
            Reasoning effort
          </span>
          <Select
            value={activeLlm.reasoningEffort}
            options={reasoningOptions}
            className="h-9"
            rootClassName={compactSelectRoot}
            onChange={(reasoningEffort) => updateLlm({ reasoningEffort })}
          />
          <span class="text-xs text-stone-500 sm:col-start-2">
            Sent as <code>reasoning_effort</code>. Only reasoning models accept it; leave it on the
            provider default otherwise.
          </span>
        </section>

        <section class="grid gap-3">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Sampling
          </span>
          <div class="grid grid-cols-2 gap-3">
            {#each samplingFields as field (field.key)}
              <label class="grid gap-1.5 text-xs text-stone-500">
                {field.label}
                <Input
                  value={activeLlm[field.key]}
                  placeholder={hint(field.key, field.placeholder)}
                  oninput={(event) =>
                    updateLlm({ [field.key]: (event.target as HTMLInputElement).value })}
                />
              </label>
            {/each}
          </div>
          <span class="text-xs text-stone-500">Empty fields are left out of the request.</span>
        </section>

        <section class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Stop sequences
          </span>
          <Input
            value={activeLlm.stop}
            placeholder="END, ###"
            oninput={(event) => updateLlm({ stop: (event.target as HTMLInputElement).value })}
          />
          <span class="text-xs text-stone-500">Comma separated.</span>
        </section>

        <section class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Extra body (JSON)
          </span>
          <TextArea
            value={activeLlm.extraBody}
            size="sm"
            className="text-sm"
            placeholder={'{"top_k": 40}'}
            onInput={(event) =>
              updateLlm({ extraBody: (event.target as HTMLTextAreaElement).value })}
          />
          <span class="text-xs text-stone-500">
            Merged into the request body last, so it overrides the fields above. Use it for
            provider-specific options.
          </span>
        </section>
      </div>
    {:else}
      <div class="grid max-w-xl gap-6">
        <section class="grid gap-2 sm:grid-cols-[8rem_auto] sm:items-center">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Page width
          </span>
          <Select
            value={settings.editorWidth}
            options={widthOptions}
            className="h-9"
            rootClassName={compactSelectRoot}
            onChange={(editorWidth) =>
              updateSettings({ editorWidth: editorWidth as EditorWidth })}
          />
        </section>

        <section class="grid gap-4">
          <Slider
            value={settings.textSize}
            min={15}
            max={21}
            step={1}
            label="Text size"
            onChange={(textSize) => updateSettings({ textSize })}
          />
        </section>

        <section class="grid gap-3 border-t border-stone-200/50 pt-4 dark:border-stone-800/80">
          <Switch
            checked={settings.showPageTitle}
            label="Page title"
            onChange={(showPageTitle) => updateSettings({ showPageTitle })}
          />
          <Switch
            checked={settings.spellcheck}
            label="Spellcheck"
            onChange={(spellcheck) => updateSettings({ spellcheck })}
          />
          <Switch
            checked={settings.slashCommands}
            label="Slash commands"
            onChange={(slashCommands) => updateSettings({ slashCommands })}
          />
        </section>
      </div>
    {/if}
    </div>
  </div>
</div>
