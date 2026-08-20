<script lang="ts">
  import { i18n } from "../../../lib/i18n";
  import type {
    AppSettings,
    KeybindingMode,
  } from "../../../lib/storage/settings";
  import { listKeybindings } from "../../../lib/utils/keybindings";
  import Input from "../../components/Input.svelte";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import { updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  $: modeOptions = [
    { label: $i18n.t("options.keybindingsDefault"), value: "default" },
    { label: $i18n.t("options.keybindingsVim"), value: "vim" },
    { label: $i18n.t("options.keybindingsCustom"), value: "custom" },
  ] satisfies SelectOption[];

  // Re-read the live combinations whenever the mode or an override changes.
  $: bindings = (settings.keybindings, listKeybindings());

  function patchMode(mode: KeybindingMode) {
    updateSettings(settings, onChange, {
      keybindings: { ...settings.keybindings, mode },
    });
  }

  function patchCombination(name: string, combination: string) {
    const combinations = { ...settings.keybindings.combinations };

    if (combination.trim()) {
      combinations[name] = combination.trim().toLowerCase();
    } else {
      delete combinations[name];
    }

    updateSettings(settings, onChange, {
      keybindings: { ...settings.keybindings, combinations },
    });
  }
</script>

<section class="grid gap-2 sm:grid-cols-[8rem_auto] sm:items-center">
  <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
    {$i18n.t("settings.keybindings")}
  </span>
  <Select
    value={settings.keybindings.mode}
    options={modeOptions}
    className="h-9"
    rootClassName="w-full sm:w-56"
    onChange={(mode) => patchMode(mode as KeybindingMode)}
  />
</section>

{#if settings.keybindings.mode === "custom"}
  <section class="grid gap-2">
    <p class="text-xs text-stone-500 dark:text-stone-400">
      {$i18n.t("settings.keybindingsHelp")}
    </p>
    {#each bindings as binding (binding.name)}
      <label class="grid gap-1 sm:grid-cols-[14rem_auto] sm:items-center">
        <span class="text-sm text-stone-700 dark:text-stone-300">
          {binding.name}
        </span>
        <Input
          value={settings.keybindings.combinations[binding.name] ?? ""}
          placeholder={binding.combination}
          className="h-9"
          oninput={(event) =>
            patchCombination(
              binding.name,
              (event.currentTarget as HTMLInputElement).value,
            )}
        />
      </label>
    {/each}
  </section>
{/if}
