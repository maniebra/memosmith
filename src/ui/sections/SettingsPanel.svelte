<script lang="ts">
  import { ChevronDown, RotateCcw, X } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, slide } from "svelte/transition";
  import type {
    AppSettings,
    EditorWidth,
    FeatureSettings,
    GrammarCheckMode,
    ThemePreference,
  } from "../../lib/storage/settings";
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
  ];

  const grammarCheckModeOptions: SelectOption[] = [
    { label: "Auto diff", value: "auto-diff" },
    { label: "Auto full", value: "auto-full" },
    { label: "Manual", value: "manual" },
  ];

  type SettingsTab = "appearance" | "features" | "editor" | "ai";

  let activeTab: SettingsTab = "appearance";
  let grammarOptionsOpen = false;
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
