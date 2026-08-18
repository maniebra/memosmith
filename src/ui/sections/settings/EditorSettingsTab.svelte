<script lang="ts">
  import { i18n } from "../../../lib/i18n";
  import type { AppSettings, EditorWidth } from "../../../lib/storage/settings";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import Slider from "../../components/Slider.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  const compactSelectRoot = "w-full sm:w-56";

  $: widthOptions = [
    { label: $i18n.t("options.focused"), value: "focused" },
    { label: $i18n.t("options.comfortable"), value: "comfortable" },
    { label: $i18n.t("options.wide"), value: "wide" },
    { label: $i18n.t("options.fullWidth"), value: "full" },
  ] satisfies SelectOption[];

  function patch(nextSettings: Partial<AppSettings>) {
    updateSettings(settings, onChange, nextSettings);
  }
</script>

<div class="grid max-w-xl gap-6">
  <section class="grid gap-2 sm:grid-cols-[8rem_auto] sm:items-center">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.pageWidth")}
    </span>
    <Select
      value={settings.editorWidth}
      options={widthOptions}
      className="h-9"
      rootClassName={compactSelectRoot}
      onChange={(editorWidth) =>
        patch({ editorWidth: editorWidth as EditorWidth })}
    />
  </section>
  <section class="grid gap-4">
    <Slider
      value={settings.textSize}
      min={15}
      max={21}
      step={1}
      label={$i18n.t("settings.textSize")}
      onChange={(textSize) => patch({ textSize })}
    />
  </section>
  <section
    class="grid gap-3 border-t border-stone-200/50 pt-4 dark:border-stone-800/80"
  >
    <Switch
      checked={settings.showPageTitle}
      label={$i18n.t("settings.pageTitle")}
      onChange={(showPageTitle) => patch({ showPageTitle })}
    />
    <Switch
      checked={settings.focusOnOpen}
      label={$i18n.t("settings.focusOnOpen")}
      onChange={(focusOnOpen) => patch({ focusOnOpen })}
    />
    <Switch
      checked={settings.spellcheck}
      label={$i18n.t("settings.spellcheck")}
      onChange={(spellcheck) => patch({ spellcheck })}
    />
    <Switch
      checked={settings.slashCommands}
      label={$i18n.t("settings.slashCommands")}
      onChange={(slashCommands) => patch({ slashCommands })}
    />
  </section>
</div>
