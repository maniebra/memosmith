<script lang="ts">
  import {
    BadgeAlert,
    ChevronDown,
    CircleQuestionMark,
    CircleX,
    Info,
    Lightbulb,
    Plus,
    RotateCcw,
    Star,
    Trash2,
    TriangleAlert,
    Zap,
  } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { fade, slide } from "svelte/transition";
  import { i18n } from "../../../lib/i18n";
  import {
    defaultCalloutDefinitions,
    type AppSettings,
    type CalloutDefinition,
  } from "../../../lib/storage/settings";
  import {
    CALLOUT_ICON_OPTIONS,
    normalizeCalloutIcon,
  } from "../../../lib/utils/calloutIcons";
  import { cn } from "../../../lib/utils/cn";
  import Input from "../../components/Input.svelte";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateFeatures, updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  let calloutOptionsOpen = false;

  const calloutIconOptions = CALLOUT_ICON_OPTIONS as SelectOption[];
  const calloutColorOptions = [
    "#2563eb",
    "#059669",
    "#7c3aed",
    "#d97706",
    "#dc2626",
    "#0891b2",
    "#64748b",
    "#db2777",
  ];
  const calloutIconComponents: Record<string, any> = {
    Info,
    Lightbulb,
    BadgeAlert,
    TriangleAlert,
    CircleX,
    CircleQuestionMark,
    Star,
    Zap,
  };

  function calloutIconComponent(icon: string) {
    return calloutIconComponents[normalizeCalloutIcon(icon)] ?? Info;
  }

  function normalizeCalloutId(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 32);
  }

  function updateCallouts(callouts: CalloutDefinition[]) {
    updateSettings(settings, onChange, { callouts });
  }

  function updateCallout(
    index: number,
    nextCallout: Partial<CalloutDefinition>,
  ) {
    updateCallouts(
      settings.callouts.map((callout, calloutIndex) =>
        calloutIndex === index ? { ...callout, ...nextCallout } : callout,
      ),
    );
  }

  function updateCalloutId(index: number, value: string) {
    const id = normalizeCalloutId(value);
    if (
      id &&
      settings.callouts.some(
        (callout, calloutIndex) => calloutIndex !== index && callout.id === id,
      )
    ) {
      return;
    }
    updateCallout(index, { id });
  }

  function addCallout() {
    let suffix = settings.callouts.length + 1;
    let id = `custom-${suffix}`;
    while (settings.callouts.some((callout) => callout.id === id)) {
      suffix++;
      id = `custom-${suffix}`;
    }
    updateCallouts([
      ...settings.callouts,
      { id, label: "Custom", color: "#64748b", icon: "i" },
    ]);
  }

  function removeCallout(index: number) {
    updateCallouts(
      settings.callouts.filter((_, calloutIndex) => calloutIndex !== index),
    );
  }

  function resetCallouts() {
    updateCallouts(
      defaultCalloutDefinitions.map((callout) => ({ ...callout })),
    );
  }
</script>

<div class="grid w-full gap-2">
  <div class="flex h-10 w-full items-center gap-2">
    <Switch
      checked={settings.features.callouts}
      label={$i18n.t("feature.callouts")}
      onLabel={() => calloutOptionsOpen = !calloutOptionsOpen}
      className="h-full min-w-0 flex-1"
      onChange={(callouts) => updateFeatures(settings, onChange, { callouts })}
    />
    <button
      type="button"
      class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
      aria-expanded={calloutOptionsOpen}
      aria-label={$i18n.t("settings.calloutOptions")}
      title={$i18n.t("settings.calloutOptions")}
      onclick={() => (calloutOptionsOpen = !calloutOptionsOpen)}
    >
      <ChevronDown
        class={cn(
          "size-4 shrink-0 transition-transform duration-200 ease-out",
          calloutOptionsOpen && "rotate-180",
        )}
        strokeWidth={1.8}
        aria-hidden="true"
      />
    </button>
  </div>
  {#if calloutOptionsOpen}
    <div
      class="ml-14 grid gap-3 pl-2"
      transition:slide={{ duration: 160, easing: cubicOut }}
    >
      <div
        class="flex flex-wrap items-center justify-between gap-2"
        in:fade={{ duration: 120 }}
        out:fade={{ duration: 80 }}
      >
        <span class="text-xs font-medium text-stone-500">
          {$i18n.t("settings.calloutClasses")}
        </span>
        <div class="flex gap-1.5">
          <button
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-300 dark:hover:text-stone-100"
            onclick={resetCallouts}
          >
            <RotateCcw class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            {$i18n.t("common.defaults")}
          </button>
          <button
            type="button"
            class="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-300 dark:hover:text-stone-100"
            onclick={addCallout}
          >
            <Plus class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            {$i18n.t("common.add")}
          </button>
        </div>
      </div>
      <div class="grid gap-3">
        {#each settings.callouts as callout, index (index)}
          <div
            class="grid gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-800 dark:bg-stone-950/35"
            in:fade={{ duration: 120 }}
            out:fade={{ duration: 80 }}
          >
            <div class="flex items-center gap-2">
              <span
                class="grid size-8 shrink-0 place-items-center rounded-md text-sm font-semibold text-white shadow-sm"
                style={`background:${callout.color};`}
                aria-hidden="true"
              >
                <svelte:component
                  this={calloutIconComponent(callout.icon)}
                  class="size-4"
                  strokeWidth={2}
                />
              </span>
              <div class="min-w-0 flex-1">
                <Input
                  value={callout.id}
                  className="h-8 font-mono text-xs"
                  placeholder="note"
                  oninput={(event) =>
                    updateCalloutId(
                      index,
                      (event.target as HTMLInputElement).value,
                    )}
                />
              </div>
              <button
                type="button"
                class="grid size-8 shrink-0 place-items-center rounded-md text-stone-400 transition-colors hover:bg-rose-500/10 hover:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600/25 dark:hover:text-rose-300"
                aria-label={$i18n.t("settings.removeCallout")}
                title={$i18n.t("settings.removeCallout")}
                onclick={() => removeCallout(index)}
              >
                <Trash2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>
            <div class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <label class="grid gap-1.5 text-xs text-stone-500">
                {$i18n.t("settings.label")}
                <Input
                  value={callout.label}
                  className="h-8 text-xs"
                  placeholder="Note"
                  oninput={(event) =>
                    updateCallout(index, {
                      label: (event.target as HTMLInputElement).value,
                    })}
                />
              </label>
              <label class="grid gap-1.5 text-xs text-stone-500">
                {$i18n.t("settings.icon")}
                <Select
                  value={callout.icon}
                  options={calloutIconOptions}
                  className="h-8"
                  rootClassName="w-full"
                  onChange={(icon) =>
                    updateCallout(index, {
                      icon: normalizeCalloutIcon(icon),
                    })}
                />
              </label>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              {#each calloutColorOptions as color (color)}
                <button
                  type="button"
                  class={cn(
                    "size-7 rounded-md shadow-inner ring-1 ring-black/10 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30",
                    callout.color === color &&
                      "scale-90 ring-2 ring-stone-900/40 dark:ring-white/60",
                  )}
                  style={`background:${color};`}
                  aria-label={$i18n.t("settings.useColor", { color })}
                  aria-pressed={callout.color === color}
                  onclick={() => updateCallout(index, { color })}
                ></button>
              {/each}
              <input
                type="color"
                value={callout.color}
                class="size-8 rounded-md border border-stone-200 bg-transparent p-0.5 dark:border-stone-700"
                aria-label={$i18n.t("settings.customCalloutColor")}
                oninput={(event) =>
                  updateCallout(index, {
                    color: (event.target as HTMLInputElement).value,
                  })}
              />
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
