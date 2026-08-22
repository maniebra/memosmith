<script lang="ts">
  import { Plus, RotateCcw, X } from "@lucide/svelte";
  import { i18n } from "../../../lib/i18n";
  import type { I18nKey } from "../../../lib/i18n";
  import type { AppSettings, PaletteColor } from "../../../lib/storage/settings";
  import { chipStyle } from "../../../lib/utils/optionColors";
  import { updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;
  /** Which palette this section edits, and the swatches its reset restores. */
  export let field: "databasePalette" | "highlightPalette";
  export let defaults: PaletteColor[];
  export let label: I18nKey;
  export let help: I18nKey;

  $: colors = settings[field];

  function apply(next: PaletteColor[]) {
    updateSettings(settings, onChange, { [field]: next });
  }

  function patch(id: string, next: Partial<PaletteColor>) {
    apply(
      colors.map((color) => (color.id === id ? { ...color, ...next } : color)),
    );
  }

  function add() {
    // Ids are what columns store, so a new one must not collide with a used id.
    apply([
      ...colors,
      {
        id: `color-${Date.now().toString(36)}`,
        label: $i18n.t("settings.paletteNewColor"),
        hex: "#6366f1",
      },
    ]);
  }

  function remove(id: string) {
    // Options pointing at a removed colour fall back to their name-derived one.
    apply(colors.filter((color) => color.id !== id));
  }
</script>

<section
  class="grid gap-3 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_minmax(0,1fr)] dark:border-stone-800/80"
>
  <span class="text-sm font-medium text-stone-800 sm:pt-1 dark:text-stone-200">
    {$i18n.t(label)}
  </span>
  <div class="grid gap-2">
    <span class="text-xs leading-relaxed text-stone-500">
      {$i18n.t(help)}
    </span>

    <div class="grid gap-1.5">
      {#each colors as color (color.id)}
        <div class="flex items-center gap-2">
          <input
            type="color"
            class="size-8 shrink-0 cursor-pointer rounded-md border border-stone-200/80 bg-transparent p-0.5 dark:border-stone-700/80"
            aria-label={color.label}
            value={color.hex}
            oninput={(event) =>
              patch(color.id, { hex: event.currentTarget.value })}
          />
          <input
            class="h-8 w-32 rounded-md border border-stone-200/80 bg-transparent px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/30 dark:border-stone-700/80"
            aria-label={$i18n.t("settings.paletteColorName")}
            value={color.label}
            oninput={(event) =>
              patch(color.id, { label: event.currentTarget.value })}
          />
          <span
            class="db-chip rounded-full px-2 py-0.5 text-xs"
            style={chipStyle(color.hex)}
          >
            {color.label}
          </span>
          {#if colors.length > 1}
            <button
              type="button"
              class="ml-auto flex size-7 items-center justify-center rounded-md text-stone-400 hover:bg-rose-500/10 hover:text-rose-600"
              aria-label={$i18n.t("settings.paletteRemove", {
                name: color.label,
              })}
              onclick={() => remove(color.id)}
            >
              <X class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            </button>
          {/if}
        </div>
      {/each}
    </div>

    <div class="flex gap-2">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
        onclick={add}
      >
        <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        {$i18n.t("settings.paletteAdd")}
      </button>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10 hover:text-stone-800 dark:hover:text-stone-200"
        onclick={() => apply(defaults.map((color) => ({ ...color })))}
      >
        <RotateCcw class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        {$i18n.t("common.reset")}
      </button>
    </div>
  </div>
</section>
