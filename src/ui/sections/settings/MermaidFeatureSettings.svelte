<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";
  import { i18n } from "../../../lib/i18n";
  import type {
    AppSettings,
    MermaidSettings,
    MermaidTheme,
  } from "../../../lib/storage/settings";
  import { cn } from "../../../lib/utils/cn";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateFeatures, updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  let mermaidOptionsOpen = false;
  const compactSelectRoot = "w-full sm:w-56";

  $: mermaidThemeOptions = [
    { label: $i18n.t("options.default"), value: "default" },
    { label: $i18n.t("options.dark"), value: "dark" },
    { label: $i18n.t("options.forest"), value: "forest" },
    { label: $i18n.t("options.neutral"), value: "neutral" },
  ] satisfies SelectOption[];

  function updateMermaid(next: Partial<MermaidSettings>) {
    updateSettings(settings, onChange, {
      mermaid: { ...settings.mermaid, ...next },
    });
  }
</script>

<div class="grid gap-2">
  <div class="flex items-center gap-1">
    <Switch
      checked={settings.features.mermaid}
      label={$i18n.t("feature.mermaid")}
      className="h-10 w-full"
      onChange={(mermaid) => updateFeatures(settings, onChange, { mermaid })}
    />
    <button
      type="button"
      class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
      aria-expanded={mermaidOptionsOpen}
      aria-label={$i18n.t("feature.mermaidOptions")}
      onclick={() => (mermaidOptionsOpen = !mermaidOptionsOpen)}
    >
      <ChevronDown
        class={cn(
          "size-4 transition-transform",
          mermaidOptionsOpen && "rotate-180",
        )}
      />
    </button>
  </div>
  {#if mermaidOptionsOpen}
    <div
      class="grid gap-4 rounded-md border border-stone-200 p-3 dark:border-stone-800"
      transition:slide={{ duration: 160, easing: cubicOut }}
    >
      <span class="text-xs text-stone-500">
        {$i18n.t("settings.mermaidHelp")}
      </span>
      <label class="grid gap-1">
        <span class="text-sm text-stone-700 dark:text-stone-200">
          {$i18n.t("settings.theme")}
        </span>
        <Select
          value={settings.mermaid.theme}
          options={mermaidThemeOptions}
          className="h-9"
          rootClassName={compactSelectRoot}
          onChange={(theme) => updateMermaid({ theme: theme as MermaidTheme })}
        />
      </label>
    </div>
  {/if}
</div>
