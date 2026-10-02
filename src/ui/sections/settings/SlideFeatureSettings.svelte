<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";
  import { i18n } from "../../../lib/i18n";
  import type { AppSettings } from "../../../lib/storage/settings";
  import { cn } from "../../../lib/utils/cn";
  import { chooseSlideShellFile, readNote } from "../../../lib/tauri/files";
  import {
    loadSlideShells,
    slideShellName,
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

  let importError = "";

  // Re-read whenever the options open or an import lands.
  $: if (slideOptionsOpen) {
    void loadSlideShells(root, settings.slides.imported).then(
      (found) => (shells = found),
    );
  }

  $: importedActive = settings.slides.imported.some(
    (found) => found.name === settings.slides.shell,
  );

  /** Copies the file into settings and selects it; re-importing replaces it. */
  async function importShell() {
    const path = await chooseSlideShellFile();
    if (!path) {
      return;
    }
    const text = await readNote(path).catch(() => "");
    importError = text.trim() ? "" : $i18n.t("settings.slideShellInvalid");
    if (!text.trim()) {
      return;
    }
    const name = slideShellName(path);
    updateSettings(settings, onChange, {
      slides: {
        shell: name,
        imported: [
          ...settings.slides.imported.filter((found) => found.name !== name),
          { name, text },
        ],
      },
    });
  }

  function removeImported() {
    updateSettings(settings, onChange, {
      slides: {
        shell: "",
        imported: settings.slides.imported.filter(
          (found) => found.name !== settings.slides.shell,
        ),
      },
    });
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
            updateSettings(settings, onChange, {
              slides: { ...settings.slides, shell },
            })}
        />
      </label>
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="h-9 rounded-lg border border-stone-200 px-3 text-sm text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
          onclick={importShell}
        >
          {$i18n.t("settings.slideShellImport")}
        </button>
        {#if importedActive}
          <button
            type="button"
            class="h-9 rounded-lg px-3 text-sm text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
            onclick={removeImported}
          >
            {$i18n.t("settings.slideShellRemove")}
          </button>
        {/if}
        {#if importError}
          <span class="text-xs text-rose-600">{importError}</span>
        {/if}
      </div>
      {#if !shells.length}
        <span class="text-xs text-stone-500">
          {$i18n.t("settings.slideShellNone")}
        </span>
      {/if}
    </div>
  {/if}
</div>
