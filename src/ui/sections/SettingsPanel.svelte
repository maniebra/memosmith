<script lang="ts">
  import { RotateCcw, X } from "@lucide/svelte";
  import type {
    AppSettings,
    EditorWidth,
    ThemePreference,
  } from "../../lib/storage/settings";
  import Button from "../components/Button.svelte";
  import Select, { type SelectOption } from "../components/Select.svelte";
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

  let activeTab: "appearance" | "editor" = "appearance";

  function updateSettings(nextSettings: Partial<AppSettings>) {
    onChange({ ...settings, ...nextSettings });
  }
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
