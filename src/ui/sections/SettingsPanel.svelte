<script lang="ts">
  import type { AppSettings, EditorWidth, ThemePreference } from "../../lib/storage/settings";
  import Button from "../components/Button.svelte";
  import Select, { type SelectOption } from "../components/Select.svelte";
  import Slider from "../components/Slider.svelte";
  import Switch from "../components/Switch.svelte";

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

  function updateSettings(nextSettings: Partial<AppSettings>) {
    onChange({ ...settings, ...nextSettings });
  }
</script>

<aside
  class="flex w-80 shrink-0 flex-col border-l border-stone-200/50 bg-stone-50/90 dark:border-stone-800/80 dark:bg-stone-900/90"
  aria-label="Settings"
>
  <div class="flex h-12 shrink-0 items-center gap-2 border-b border-stone-200/50 px-3 dark:border-stone-800/80">
    <h2 class="min-w-0 flex-1 truncate text-sm font-semibold text-stone-800 dark:text-stone-100">
      Settings
    </h2>
    <Button label="Reset" onClick={onReset} variant="ghost" size="sm" />
    <Button label="Close" onClick={onClose} variant="ghost" size="sm" />
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto px-4 py-5">
    <div class="grid gap-6">
      <section class="grid gap-3" aria-labelledby="appearance-settings">
        <h3 id="appearance-settings" class="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Appearance
        </h3>

        <div class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">Theme</span>
          <Select
            value={settings.theme}
            options={themeOptions}
            className="h-9"
            onChange={(theme) => updateSettings({ theme: theme as ThemePreference })}
          />
        </div>
      </section>

      <section class="grid gap-4" aria-labelledby="editor-settings">
        <h3 id="editor-settings" class="text-xs font-semibold tracking-wide text-stone-500 uppercase">
          Editor
        </h3>

        <div class="grid gap-2">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-200">Page width</span>
          <Select
            value={settings.editorWidth}
            options={widthOptions}
            className="h-9"
            onChange={(editorWidth) => updateSettings({ editorWidth: editorWidth as EditorWidth })}
          />
        </div>

        <Slider
          value={settings.textSize}
          min={15}
          max={21}
          step={1}
          label="Text size"
          onChange={(textSize) => updateSettings({ textSize })}
        />

        <div class="grid gap-3 border-t border-stone-200/50 pt-4 dark:border-stone-800/80">
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
        </div>
      </section>
    </div>
  </div>
</aside>
