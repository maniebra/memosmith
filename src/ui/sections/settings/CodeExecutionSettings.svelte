<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";
  import { i18n } from "../../../lib/i18n";
  import type {
    AppSettings,
    RunnerSettings,
  } from "../../../lib/storage/settings";
  import { detectRuntimes } from "../../../lib/tauri/runner";
  import { cn } from "../../../lib/utils/cn";
  import { KERNEL_LABELS, type Kernel } from "../../../lib/utils/runner";
  import Input from "../../components/Input.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateFeatures, updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  let codeOptionsOpen = false;
  function toggleCodeOptions() {
    codeOptionsOpen = !codeOptionsOpen;
    if (codeOptionsOpen) void refreshRuntimes();
  }
  let runtimes: Record<string, string> = {};

  async function refreshRuntimes() {
    runtimes = await detectRuntimes(settings.runner).catch(() => ({}));
  }

  function updateRunner(nextRunner: Partial<RunnerSettings>) {
    updateSettings(settings, onChange, {
      runner: { ...settings.runner, ...nextRunner },
    });
  }

  function updateRunnerCommand(kernel: Kernel, command: string) {
    updateRunner({
      commands: { ...settings.runner.commands, [kernel]: command },
    });
    void refreshRuntimes();
  }
</script>

<div class="grid gap-2">
  <div class="flex items-center gap-1">
    <Switch
      checked={settings.features.codeExecution}
      label={$i18n.t("feature.codeExecution")}
      onLabel={() => toggleCodeOptions()}
      className="h-10 w-full"
      onChange={(codeExecution) => {
        updateFeatures(settings, onChange, { codeExecution });
        if (codeExecution) void refreshRuntimes();
      }}
    />
    <button
      type="button"
      class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
      aria-expanded={codeOptionsOpen}
      aria-label={$i18n.t("feature.codeOptions")}
      onclick={() => {
        toggleCodeOptions();
      }}
    >
      <ChevronDown
        class={cn(
          "size-4 transition-transform",
          codeOptionsOpen && "rotate-180",
        )}
      />
    </button>
  </div>
  {#if codeOptionsOpen}
    <div
      class="grid gap-4 rounded-md border border-stone-200 p-3 dark:border-stone-800"
      transition:slide={{ duration: 160, easing: cubicOut }}
    >
      <span class="text-xs text-stone-500">
        {$i18n.t("settings.codeRuntimeHelp")}
      </span>
      {#each Object.keys(KERNEL_LABELS) as kernel (kernel)}
        <label class="grid gap-1">
          <span
            class="flex items-center justify-between text-sm text-stone-700 dark:text-stone-200"
          >
            {KERNEL_LABELS[kernel as Kernel]}
            <span
              class={cn(
                "font-mono text-xs",
                runtimes[kernel]
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {runtimes[kernel] || $i18n.t("common.notFound")}
            </span>
          </span>
          <Input
            value={settings.runner.commands[kernel as Kernel]}
            placeholder={runtimes[kernel] ||
              $i18n.t("settings.pathToInterpreter")}
            oninput={(event) =>
              updateRunnerCommand(
                kernel as Kernel,
                (event.target as HTMLInputElement).value,
              )}
          />
        </label>
      {/each}
      <div class="grid gap-1">
        <Switch
          checked={settings.runner.sharedKernel}
          label={$i18n.t("settings.sharedKernel")}
          className="h-10 w-full"
          onChange={(sharedKernel) => updateRunner({ sharedKernel })}
        />
        <span class="text-xs text-stone-500">
          {$i18n.t("settings.sharedKernelHelp")}
        </span>
      </div>
      <label class="grid gap-1">
        <span class="text-sm text-stone-700 dark:text-stone-200">
          {$i18n.t("settings.cellTimeout")}
        </span>
        <Input
          value={String(settings.runner.timeoutMs / 1000)}
          oninput={(event) => {
            const seconds = Number((event.target as HTMLInputElement).value);
            if (Number.isFinite(seconds) && seconds > 0) {
              updateRunner({ timeoutMs: Math.round(seconds * 1000) });
            }
          }}
        />
      </label>
    </div>
  {/if}
</div>
