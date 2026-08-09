<script lang="ts">
  import { ChevronDown } from "@lucide/svelte";
  import { cubicOut } from "svelte/easing";
  import { slide } from "svelte/transition";
  import { i18n } from "../../../lib/i18n";
  import type { AppSettings, LspSettings } from "../../../lib/storage/settings";
  import {
    detectLanguageServers,
    resetLanguageServers,
  } from "../../../lib/tauri/lsp";
  import { cn } from "../../../lib/utils/cn";
  import { KERNEL_LABELS, type Kernel } from "../../../lib/utils/runner";
  import Input from "../../components/Input.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateFeatures, updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  let lspOptionsOpen = false;
  let languageServers: Record<string, string> = {};

  async function refreshLanguageServers() {
    languageServers = await detectLanguageServers(settings.lsp).catch(
      () => ({}),
    );
  }

  function updateLsp(nextLsp: Partial<LspSettings>) {
    updateSettings(settings, onChange, {
      lsp: { ...settings.lsp, ...nextLsp },
    });
  }

  function updateLspCommand(kernel: Kernel, command: string) {
    updateLsp({ commands: { ...settings.lsp.commands, [kernel]: command } });
    void resetLanguageServers().catch(() => {});
    void refreshLanguageServers();
  }
</script>

<div class="grid gap-2">
  <div class="flex items-center gap-1">
    <Switch
      checked={settings.features.lsp}
      label={$i18n.t("feature.lsp")}
      className="h-10 w-full"
      onChange={(lsp) => {
        updateFeatures(settings, onChange, { lsp });
        if (lsp) {
          void refreshLanguageServers();
        } else {
          void resetLanguageServers().catch(() => {});
        }
      }}
    />
    <button
      type="button"
      class="grid size-10 shrink-0 place-items-center rounded-md text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:text-stone-200"
      aria-expanded={lspOptionsOpen}
      aria-label={$i18n.t("feature.lspOptions")}
      onclick={() => {
        lspOptionsOpen = !lspOptionsOpen;
        if (lspOptionsOpen) void refreshLanguageServers();
      }}
    >
      <ChevronDown
        class={cn(
          "size-4 transition-transform",
          lspOptionsOpen && "rotate-180",
        )}
      />
    </button>
  </div>
  {#if lspOptionsOpen}
    <div
      class="grid gap-4 rounded-md border border-stone-200 p-3 dark:border-stone-800"
      transition:slide={{ duration: 160, easing: cubicOut }}
    >
      <span class="text-xs text-stone-500">
        {$i18n.t("settings.lspHelp")}
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
                languageServers[kernel]
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400",
              )}
            >
              {languageServers[kernel] || $i18n.t("common.notFound")}
            </span>
          </span>
          <Input
            value={settings.lsp.commands[kernel as Kernel]}
            placeholder={languageServers[kernel] ||
              $i18n.t("settings.pathToLanguageServer")}
            oninput={(event) =>
              updateLspCommand(
                kernel as Kernel,
                (event.target as HTMLInputElement).value,
              )}
          />
        </label>
      {/each}
    </div>
  {/if}
</div>
