<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";
  import { i18n } from "../../../lib/i18n";
  import type {
    AppSettings,
    PlantumlFormat,
    PlantumlSettings,
  } from "../../../lib/storage/settings";
  import { cn } from "../../../lib/utils/cn";
  import Input from "../../components/Input.svelte";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateFeatures, updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  let plantumlOptionsOpen = false;
  const compactSelectRoot = "w-full sm:w-56";

  $: plantumlFormatOptions = [
    { label: "SVG", value: "svg" },
    { label: "PNG", value: "png" },
    { label: $i18n.t("options.asciiArt"), value: "txt" },
  ] satisfies SelectOption[];

  function updatePlantuml(next: Partial<PlantumlSettings>) {
    updateSettings(settings, onChange, {
      plantuml: { ...settings.plantuml, ...next },
    });
  }
</script>

<div class="grid gap-2">
  <div class="flex items-center gap-1">
    <Switch
      checked={settings.features.plantuml}
      label={$i18n.t("feature.plantuml")}
      onLabel={() => plantumlOptionsOpen = !plantumlOptionsOpen}
      className="h-10 w-full"
      onChange={(plantuml) => updateFeatures(settings, onChange, { plantuml })}
    />
    <button
      type="button"
      class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
      aria-expanded={plantumlOptionsOpen}
      aria-label={$i18n.t("feature.plantumlOptions")}
      onclick={() => (plantumlOptionsOpen = !plantumlOptionsOpen)}
    >
      <ChevronDown
        class={cn(
          "size-4 transition-transform",
          plantumlOptionsOpen && "rotate-180",
        )}
      />
    </button>
  </div>
  {#if plantumlOptionsOpen}
    <div
      class="grid gap-4 rounded-md border border-stone-200 p-3 dark:border-stone-800"
      transition:slide={{ duration: 160, easing: cubicOut }}
    >
      <span class="text-xs text-stone-500">
        {$i18n.t("settings.plantumlHelp")}
      </span>
      <label class="grid gap-1">
        <span class="text-sm text-stone-700 dark:text-stone-200">
          {$i18n.t("settings.binaryCommand")}
        </span>
        <Input
          value={settings.plantuml.command}
          placeholder="plantuml (or: java -jar /path/plantuml.jar)"
          oninput={(event) =>
            updatePlantuml({
              command: (event.target as HTMLInputElement).value,
            })}
        />
      </label>
      <label class="grid gap-1">
        <span class="text-sm text-stone-700 dark:text-stone-200">
          {$i18n.t("settings.serverUrl")}
        </span>
        <Input
          value={settings.plantuml.server}
          placeholder="http://localhost:8080"
          oninput={(event) =>
            updatePlantuml({
              server: (event.target as HTMLInputElement).value,
            })}
        />
      </label>
      <label class="grid gap-1">
        <span class="text-sm text-stone-700 dark:text-stone-200">
          {$i18n.t("settings.theme")}
        </span>
        <Input
          value={settings.plantuml.theme}
          placeholder="none (try: carbon-gray, cyborg, hacker, sketchy)"
          oninput={(event) =>
            updatePlantuml({ theme: (event.target as HTMLInputElement).value })}
        />
        <span class="text-xs text-stone-500">
          {$i18n.t("settings.plantumlThemeHelp")}
        </span>
      </label>
      <label class="grid gap-1">
        <span class="text-sm text-stone-700 dark:text-stone-200">
          {$i18n.t("settings.output")}
        </span>
        <Select
          value={settings.plantuml.format}
          options={plantumlFormatOptions}
          className="h-9"
          rootClassName={compactSelectRoot}
          onChange={(format) =>
            updatePlantuml({ format: format as PlantumlFormat })}
        />
      </label>
    </div>
  {/if}
</div>
