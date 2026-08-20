<script lang="ts">
  import { RotateCcw, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import type { AppSettings } from "../../lib/storage/settings";
  import Button from "../components/Button.svelte";
  import AppearanceSettingsTab from "./settings/AppearanceSettingsTab.svelte";
  import AiSettingsTab from "./settings/AiSettingsTab.svelte";
  import EditorSettingsTab from "./settings/EditorSettingsTab.svelte";
  import FeatureSettingsTab from "./settings/FeatureSettingsTab.svelte";
  import KeybindingSettings from "./settings/KeybindingSettings.svelte";
  import { cn } from "../../lib/utils/cn";

  export let settings: AppSettings;
  export let onClose: () => void;
  export let onReset: () => void;
  export let onChange: (settings: AppSettings) => void;

  type SettingsTab =
    | "appearance"
    | "features"
    | "editor"
    | "keybindings"
    | "ai";

  let activeTab: SettingsTab = "appearance";

  $: tabOptions = [
    { label: $i18n.t("settings.appearance"), value: "appearance" },
    { label: $i18n.t("settings.features"), value: "features" },
    { label: $i18n.t("settings.editor"), value: "editor" },
    { label: $i18n.t("settings.keybindings"), value: "keybindings" },
    { label: $i18n.t("settings.ai"), value: "ai" },
  ] satisfies { label: string; value: SettingsTab }[];
</script>

<div
  class="flex h-[min(760px,85vh)] w-[min(920px,92vw)] flex-col overflow-hidden rounded-xl bg-stone-50 shadow-xl dark:bg-stone-900"
  aria-label={$i18n.t("settings.title")}
>
  <div
    class="flex h-12 shrink-0 items-center justify-between border-b border-stone-200/50 px-4 dark:border-stone-800/80"
  >
    <h2 class="text-sm font-semibold text-stone-800 dark:text-stone-100">
      {$i18n.t("settings.title")}
    </h2>
    <div class="flex gap-1">
      <Button
        label={$i18n.t("common.reset")}
        icon={RotateCcw}
        onClick={onReset}
        variant="ghost"
        size="sm"
      />
      <Button
        label={$i18n.t("common.close")}
        icon={X}
        onClick={onClose}
        variant="ghost"
        size="sm"
      />
    </div>
  </div>
  <div
    class="grid min-h-0 flex-1 grid-cols-[8rem_minmax(0,1fr)] sm:grid-cols-[11rem_minmax(0,1fr)]"
  >
    <div
      class="flex flex-col gap-1 border-r border-stone-200/50 bg-stone-100/50 p-2 dark:border-stone-800/80 dark:bg-stone-950/25"
      aria-label={$i18n.t("settings.sections")}
      aria-orientation="vertical"
      role="tablist"
    >
      {#each tabOptions as tab}
        <button
          type="button"
          role="tab"
          class={cn(
            "rounded-md px-3 py-2 text-left text-sm font-medium",
            "transition-colors focus-visible:outline-none",
            "focus-visible:ring-2 focus-visible:ring-emerald-600/25",
            activeTab === tab.value
              ? "bg-white text-stone-900 shadow-sm dark:bg-stone-800 dark:text-stone-100"
              : "text-stone-500 hover:bg-white/60 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100",
          )}
          aria-selected={activeTab === tab.value}
          onclick={() => (activeTab = tab.value)}
        >
          {tab.label}
        </button>
      {/each}
    </div>
    <div class="min-h-0 overflow-y-auto p-5">
      {#if activeTab === "appearance"}
        <AppearanceSettingsTab {settings} {onChange} />
      {:else if activeTab === "features"}
        <FeatureSettingsTab {settings} {onChange} />
      {:else if activeTab === "keybindings"}
        <div class="grid max-w-xl gap-6">
          <KeybindingSettings {settings} {onChange} />
        </div>
      {:else if activeTab === "ai"}
        <AiSettingsTab {settings} {onChange} />
      {:else}
        <EditorSettingsTab {settings} {onChange} />
      {/if}
    </div>
  </div>
</div>
