<script lang="ts">
  import { RotateCcw, X } from "@lucide/svelte";
  import type {
    AppSettings,
    EditorWidth,
    ThemePreference,
  } from "../../lib/storage/settings";
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

  let activeTab: "appearance" | "editor" | "ai" = "appearance";

  function updateSettings(nextSettings: Partial<AppSettings>) {
    onChange({ ...settings, ...nextSettings });
  }

  function updateLlm(nextLlm: Partial<AppSettings["llm"]>) {
    updateSettings({ llm: { ...settings.llm, ...nextLlm } });
  }

  const reasoningOptions: SelectOption[] = REASONING_LEVELS.map((level) => ({
    label: level ? level[0].toUpperCase() + level.slice(1) : "Provider default",
    value: level,
  }));

  const samplingFields: { key: keyof AppSettings["llm"]; label: string; placeholder: string }[] = [
    { key: "temperature", label: "Temperature", placeholder: "1" },
    { key: "topP", label: "Top P", placeholder: "1" },
    { key: "maxTokens", label: "Max tokens", placeholder: "unlimited" },
    { key: "presencePenalty", label: "Presence penalty", placeholder: "0" },
    { key: "frequencyPenalty", label: "Frequency penalty", placeholder: "0" },
    { key: "seed", label: "Seed", placeholder: "random" },
  ];
</script>

<div class="flex flex-col h-[85vh] w-[90vw] md:w-[70vw] md:max-w-[1080px] md:max-h-[800px] bg-stone-50 dark:bg-stone-900 rounded-xl overflow-hidden shadow-xl" aria-label="Settings Modal">
  <!-- Header -->
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

  <!-- Tabs -->
  <div class="flex border-b border-stone-200/50 px-4 dark:border-stone-800/80">
    <button
      class={cn(
        "px-4 py-2 text-sm font-medium transition-colors hover:text-stone-800 dark:hover:text-stone-100",
        activeTab === "appearance"
          ? "border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400"
          : "text-stone-500"
      )}
      onclick={() => (activeTab = "appearance")}
    >
      Appearance
    </button>
    <button
      class={cn(
        "px-4 py-2 text-sm font-medium transition-colors hover:text-stone-800 dark:hover:text-stone-100",
        activeTab === "editor"
          ? "border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400"
          : "text-stone-500"
      )}
      onclick={() => (activeTab = "editor")}
    >
      Editor
    </button>
    <button
      class={cn(
        "px-4 py-2 text-sm font-medium transition-colors hover:text-stone-800 dark:hover:text-stone-100",
        activeTab === "ai"
          ? "border-b-2 border-emerald-600 text-emerald-600 dark:text-emerald-400"
          : "text-stone-500"
      )}
      onclick={() => (activeTab = "ai")}
    >
      AI
    </button>
  </div>

  <!-- Content -->
  <div class="flex-1 overflow-y-auto px-6 py-6">
    {#if activeTab === "appearance"}
      <div class="grid gap-6">
        <section class="grid gap-4">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Theme
          </span>
          <Select
            value={settings.theme}
            options={themeOptions}
            className="h-9"
            onChange={(theme) =>
              updateSettings({ theme: theme as ThemePreference })}
          />
        </section>
      </div>
    {:else if activeTab === "ai"}
      <div class="grid max-w-xl gap-6">
        <section class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Base URL
          </span>
          <Input
            value={settings.llm.baseUrl}
            placeholder="https://api.openai.com/v1"
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
            value={settings.llm.apiKey}
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
            value={settings.llm.model}
            placeholder="gpt-4o-mini"
            oninput={(event) =>
              updateLlm({ model: (event.target as HTMLInputElement).value })}
          />
        </section>

        <section class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            System prompt
          </span>
          <TextArea
            value={settings.llm.systemPrompt}
            size="sm"
            className="text-sm"
            onInput={(event) =>
              updateLlm({ systemPrompt: (event.target as HTMLTextAreaElement).value })}
          />
        </section>

        <section class="grid gap-2 border-t border-stone-200/50 pt-5 dark:border-stone-800/80">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Reasoning effort
          </span>
          <Select
            value={settings.llm.reasoningEffort}
            options={reasoningOptions}
            className="h-9"
            onChange={(reasoningEffort) => updateLlm({ reasoningEffort })}
          />
          <span class="text-xs text-stone-500">
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
                  value={settings.llm[field.key]}
                  placeholder={field.placeholder}
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
            value={settings.llm.stop}
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
            value={settings.llm.extraBody}
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
      <div class="grid gap-6">
        <section class="grid gap-4">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
            Page width
          </span>
          <Select
            value={settings.editorWidth}
            options={widthOptions}
            className="h-9"
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
