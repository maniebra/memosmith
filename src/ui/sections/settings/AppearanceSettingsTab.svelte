<script lang="ts">
  import { i18n, localeOptions, type Locale } from "../../../lib/i18n";
  import {
    defaultDatabasePalette,
    defaultHighlightPalette,
  } from "../../../lib/storage/settings";
  import type {
    AppSettings,
    ThemePreference,
  } from "../../../lib/storage/settings";
  import {
    accentOptions,
    cornerOptions,
    densityOptions,
    editorLineHeightOptions,
    fontOptions,
    type CornerStyle,
    type Density,
    type EditorLineHeight,
    type FontChoice,
    type WindowButtons,
  } from "../../../lib/utils/theme";
  import { cn } from "../../../lib/utils/cn";
  import Input from "../../components/Input.svelte";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import Switch from "../../components/Switch.svelte";
  import {
    updateAppearance,
    updateFeatures,
    updateSettings,
  } from "./settingsHelpers";
  import PaletteSettings from "./PaletteSettings.svelte";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  const compactSelectRoot = "w-full sm:w-56";
  const shortSelectRoot = "w-full sm:w-44";

  $: themeOptions = [
    { label: $i18n.t("options.system"), value: "system" },
    { label: $i18n.t("options.light"), value: "light" },
    { label: $i18n.t("options.dark"), value: "dark" },
  ] satisfies SelectOption[];
  $: windowButtonOptions = [
    { label: $i18n.t("options.windows"), value: "windows" },
    { label: $i18n.t("options.macos"), value: "macos" },
    { label: $i18n.t("options.native"), value: "native" },
  ] satisfies SelectOption[];
  $: translatedAccentOptions = accentOptions.map((accent) => ({
    ...accent,
    label: $i18n.t(`options.${accent.value}` as const),
  }));
  $: translatedFontOptions = fontOptions.map((font) => ({
    ...font,
    label:
      font.value === "system"
        ? $i18n.t("options.system")
        : font.value === "inter"
          ? $i18n.t("options.inter")
          : font.value === "serif"
            ? $i18n.t("options.serif")
            : $i18n.t("options.mono"),
  }));
  $: translatedCornerOptions = cornerOptions.map((corner) => ({
    ...corner,
    label:
      corner.value === "soft"
        ? $i18n.t("options.soft")
        : corner.value === "rounded"
          ? $i18n.t("options.rounded")
          : $i18n.t("options.square"),
  }));
  $: translatedDensityOptions = densityOptions.map((density) => ({
    ...density,
    label:
      density.value === "compact"
        ? $i18n.t("options.compact")
        : $i18n.t("options.comfortable"),
  }));
  $: translatedLineHeightOptions = editorLineHeightOptions.map(
    (lineHeight) => ({
      ...lineHeight,
      label:
        lineHeight.value === "compact"
          ? $i18n.t("options.compact")
          : lineHeight.value === "comfortable"
            ? $i18n.t("options.comfortable")
            : $i18n.t("options.loose"),
    }),
  );

  function patch(nextSettings: Partial<AppSettings>) {
    updateSettings(settings, onChange, nextSettings);
  }
</script>

<div class="grid max-w-2xl gap-5">
  <section class="grid gap-2 sm:grid-cols-[8rem_auto] sm:items-center">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.language")}
    </span>
    <Select
      value={settings.locale}
      options={localeOptions}
      className="h-9"
      rootClassName={compactSelectRoot}
      onChange={(nextLocale) => patch({ locale: nextLocale as Locale })}
    />
  </section>
  <section class="grid gap-2 sm:grid-cols-[8rem_auto] sm:items-center">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.colorMode")}
    </span>
    <Select
      value={settings.theme}
      options={themeOptions}
      className="h-9"
      rootClassName={compactSelectRoot}
      onChange={(theme) => patch({ theme: theme as ThemePreference })}
    />
  </section>
  <section class="grid gap-2 sm:grid-cols-[8rem_auto] sm:items-center">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.windowControls")}
    </span>
    <Switch
      checked={settings.features.windowControls}
      label={$i18n.t("settings.windowControlsHint")}
      className="h-10 w-full"
      onChange={(windowControls) =>
        updateFeatures(settings, onChange, { windowControls })}
    />
    {#if settings.features.windowControls}
      <span class="hidden sm:block"></span>
      <Select
        value={settings.appearance.windowButtons}
        options={windowButtonOptions}
        className="h-9"
        rootClassName={compactSelectRoot}
        onChange={(windowButtons) =>
          updateAppearance(settings, onChange, {
            windowButtons: windowButtons as WindowButtons,
          })}
      />
    {/if}
  </section>
  <section
    class="grid gap-3 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_minmax(0,1fr)] dark:border-stone-800/80"
  >
    <span
      class="text-sm font-medium text-stone-800 sm:pt-2 dark:text-stone-200"
    >
      {$i18n.t("settings.accentColor")}
    </span>
    <div class="flex flex-wrap gap-2">
      {#each translatedAccentOptions as accent (accent.value)}
        <button
          type="button"
          class={cn(
            "flex h-10 items-center gap-2 rounded-lg border px-2.5 text-left text-sm font-medium transition-colors",
            settings.appearance.accentColor === accent.value
              ? "border-emerald-600 text-emerald-700 ring-2 ring-emerald-600/20 dark:text-emerald-300"
              : "border-stone-200 text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800",
          )}
          aria-pressed={settings.appearance.accentColor === accent.value}
          onclick={() =>
            updateAppearance(settings, onChange, { accentColor: accent.value })}
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
  <section
    class="grid gap-3 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_minmax(0,1fr)] dark:border-stone-800/80"
  >
    <span
      class="text-sm font-medium text-stone-800 sm:pt-6 dark:text-stone-200"
    >
      {$i18n.t("settings.fonts")}
    </span>
    <div class="flex flex-wrap gap-3">
      <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-56">
        {$i18n.t("settings.interface")}
        <Select
          value={settings.appearance.uiFont}
          options={translatedFontOptions}
          className="h-9"
          rootClassName={compactSelectRoot}
          onChange={(uiFont) =>
            updateAppearance(settings, onChange, {
              uiFont: uiFont as FontChoice,
            })}
        />
      </label>
      <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-56">
        {$i18n.t("settings.editor")}
        <Select
          value={settings.appearance.editorFont}
          options={translatedFontOptions}
          className="h-9"
          rootClassName={compactSelectRoot}
          onChange={(editorFont) =>
            updateAppearance(settings, onChange, {
              editorFont: editorFont as FontChoice,
            })}
        />
      </label>
      <label class="grid w-full gap-1.5 text-xs text-stone-500">
        {$i18n.t("settings.interfaceStack")}
        <Input
          value={settings.appearance.uiFontStack}
          className="h-9 font-mono text-xs"
          placeholder={$i18n.t("settings.fontStackPlaceholder")}
          oninput={(event) =>
            updateAppearance(settings, onChange, {
              uiFontStack: (event.target as HTMLInputElement).value,
            })}
        />
      </label>
      <label class="grid w-full gap-1.5 text-xs text-stone-500">
        {$i18n.t("settings.editorStack")}
        <Input
          value={settings.appearance.editorFontStack}
          className="h-9 font-mono text-xs"
          placeholder={$i18n.t("settings.fontStackPlaceholder")}
          oninput={(event) =>
            updateAppearance(settings, onChange, {
              editorFontStack: (event.target as HTMLInputElement).value,
            })}
        />
      </label>
      <span class="text-xs leading-relaxed text-stone-500 sm:col-span-2">
        {$i18n.t("settings.fontStackHelp")}
      </span>
    </div>
  </section>
  <section
    class="grid gap-3 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_minmax(0,1fr)] dark:border-stone-800/80"
  >
    <span
      class="text-sm font-medium text-stone-800 sm:pt-6 dark:text-stone-200"
    >
      {$i18n.t("settings.style")}
    </span>
    <div class="flex flex-wrap gap-3">
      <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-44">
        {$i18n.t("settings.corners")}
        <Select
          value={settings.appearance.cornerStyle}
          options={translatedCornerOptions}
          className="h-9"
          rootClassName={shortSelectRoot}
          onChange={(cornerStyle) =>
            updateAppearance(settings, onChange, {
              cornerStyle: cornerStyle as CornerStyle,
            })}
        />
      </label>
      <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-44">
        {$i18n.t("settings.density")}
        <Select
          value={settings.appearance.density}
          options={translatedDensityOptions}
          className="h-9"
          rootClassName={shortSelectRoot}
          onChange={(density) =>
            updateAppearance(settings, onChange, {
              density: density as Density,
            })}
        />
      </label>
      <label class="grid w-full gap-1.5 text-xs text-stone-500 sm:w-44">
        {$i18n.t("settings.lineSpacing")}
        <Select
          value={settings.appearance.editorLineHeight}
          options={translatedLineHeightOptions}
          className="h-9"
          rootClassName={shortSelectRoot}
          onChange={(editorLineHeight) =>
            updateAppearance(settings, onChange, {
              editorLineHeight: editorLineHeight as EditorLineHeight,
            })}
        />
      </label>
    </div>
  </section>
  <PaletteSettings
    {settings}
    {onChange}
    field="databasePalette"
    defaults={defaultDatabasePalette}
    label="settings.palette"
    help="settings.paletteHelp"
  />
  <PaletteSettings
    {settings}
    {onChange}
    field="highlightPalette"
    defaults={defaultHighlightPalette}
    label="settings.highlightPalette"
    help="settings.highlightPaletteHelp"
  />
</div>
