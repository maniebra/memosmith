<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, slide } from "svelte/transition";
  import { i18n } from "../../../lib/i18n";
  import type {
    AppSettings,
    GrammarCheckMode,
  } from "../../../lib/storage/settings";
  import { cn } from "../../../lib/utils/cn";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateFeatures } from "./settingsHelpers";
  import CalloutFeatureSettings from "./CalloutFeatureSettings.svelte";
  import CodeExecutionSettings from "./CodeExecutionSettings.svelte";
  import LspFeatureSettings from "./LspFeatureSettings.svelte";
  import MermaidFeatureSettings from "./MermaidFeatureSettings.svelte";
  import PlantumlFeatureSettings from "./PlantumlFeatureSettings.svelte";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  let grammarOptionsOpen = false;

  const compactSelectRoot = "w-full sm:w-56";

  $: grammarCheckModeOptions = [
    { label: $i18n.t("options.autoDiff"), value: "auto-diff" },
    { label: $i18n.t("options.autoFull"), value: "auto-full" },
    { label: $i18n.t("options.manual"), value: "manual" },
  ] satisfies SelectOption[];

  function patchFeatures(nextFeatures: Partial<AppSettings["features"]>) {
    updateFeatures(settings, onChange, nextFeatures);
  }
</script>

<div class="grid w-full gap-4">
  <section class="grid w-full gap-2">
    <div class="flex h-10 w-full items-center gap-2">
      <Switch
        checked={settings.features.grammarPolice}
        label={$i18n.t("feature.grammarPolice")}
        onLabel={() => (grammarOptionsOpen = !grammarOptionsOpen)}
        className="h-full min-w-0 flex-1"
        onChange={(grammarPolice) => patchFeatures({ grammarPolice })}
      />
      <button
        type="button"
        class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
        aria-expanded={grammarOptionsOpen}
        aria-label={$i18n.t("feature.grammarOptions")}
        title={$i18n.t("feature.grammarOptions")}
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
        <div
          class="grid gap-1.5"
          in:fade={{ duration: 120 }}
          out:fade={{ duration: 80 }}
        >
          <label class="grid gap-1.5">
            {$i18n.t("settings.checkMode")}
            <Select
              value={settings.features.grammarCheckMode}
              options={grammarCheckModeOptions}
              className="h-9"
              rootClassName={compactSelectRoot}
              onChange={(grammarCheckMode) =>
                patchFeatures({
                  grammarCheckMode: grammarCheckMode as GrammarCheckMode,
                })}
            />
          </label>
        </div>
      </div>
    {/if}
    <Switch
      checked={settings.features.databases}
      label={$i18n.t("feature.databases")}
      className="h-10 w-full"
      onChange={(databases) => patchFeatures({ databases })}
    />
    <Switch
      checked={settings.features.fancyTableEditor}
      label={$i18n.t("feature.fancyTableEditor")}
      className="h-10 w-full"
      onChange={(fancyTableEditor) => patchFeatures({ fancyTableEditor })}
    />
    <CalloutFeatureSettings {settings} {onChange} />
    <Switch
      checked={settings.features.badges}
      label={$i18n.t("feature.badges")}
      className="h-10 w-full"
      onChange={(badges) => patchFeatures({ badges })}
    />
    <Switch
      checked={settings.features.drawings}
      label={$i18n.t("feature.drawings")}
      className="h-10 w-full"
      onChange={(drawings) => patchFeatures({ drawings })}
    />
    <Switch
      checked={settings.features.diagrams}
      label={$i18n.t("feature.diagrams")}
      className="h-10 w-full"
      onChange={(diagrams) => patchFeatures({ diagrams })}
    />
    <CodeExecutionSettings {settings} {onChange} />
    <PlantumlFeatureSettings {settings} {onChange} />
    <MermaidFeatureSettings {settings} {onChange} />
    <LspFeatureSettings {settings} {onChange} />
  </section>
</div>
