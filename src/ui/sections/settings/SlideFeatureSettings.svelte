<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";
  import { i18n } from "../../../lib/i18n";
  import type { AppSettings } from "../../../lib/storage/settings";
  import { cn } from "../../../lib/utils/cn";
  import {
    loadSlideShells,
    type SlideShell,
  } from "../../../lib/utils/slideShells";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateFeatures, updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;
  export let root: string | null = null;

  let slideOptionsOpen = false;
  let shells: SlideShell[] = [];
  const compactSelectRoot = "w-full sm:w-56";

  // Re-read whenever the options open, so a newly added file shows up.
  $: if (slideOptionsOpen) {
    void loadSlideShells(root).then((found) => (shells = found));
  }

  $: shellOptions = [
    { label: $i18n.t("settings.slideShellBuiltIn"), value: "" },
    // A shell whose file is gone stays listed, so the choice is not silently lost.
    ...[
      ...new Set([
        ...shells.map((shell) => shell.name),
        ...(settings.slides.shell ? [settings.slides.shell] : []),
      ]),
    ].map((name) => ({ label: name, value: name })),
  ] satisfies SelectOption[];
</script>

<div class="grid gap-2">
  <div class="flex items-center gap-1">
    <Switch
      checked={settings.features.slides}
      label={$i18n.t("feature.slides")}
      onLabel={() => (slideOptionsOpen = !slideOptionsOpen)}
      className="h-10 w-full"
      onChange={(slides) => updateFeatures(settings, onChange, { slides })}
    />
    <button
      type="button"
      class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
      aria-expanded={slideOptionsOpen}
      aria-label={$i18n.t("feature.slidesOptions")}
      onclick={() => (slideOptionsOpen = !slideOptionsOpen)}
    >
      <ChevronDown
        class={cn(
          "size-4 transition-transform",
          slideOptionsOpen && "rotate-180",
        )}
      />
    </button>
  </div>
  {#if slideOptionsOpen}
    <div
      class="grid gap-4 rounded-md border border-stone-200 p-3 dark:border-stone-800"
      transition:slide={{ duration: 160, easing: cubicOut }}
    >
      <span class="text-xs text-stone-500">
        {$i18n.t("settings.slideShellHelp")}
      </span>
      <label class="grid gap-1">
        <span class="text-sm text-stone-700 dark:text-stone-200">
          {$i18n.t("settings.slideShell")}
        </span>
        <Select
          value={settings.slides.shell}
          options={shellOptions}
          className="h-9"
          rootClassName={compactSelectRoot}
          onChange={(shell) =>
            updateSettings(settings, onChange, { slides: { shell } })}
        />
      </label>
      {#if !shells.length}
        <span class="text-xs text-stone-500">
          {$i18n.t("settings.slideShellNone")}
        </span>
      {/if}
    </div>
  {/if}
</div>
