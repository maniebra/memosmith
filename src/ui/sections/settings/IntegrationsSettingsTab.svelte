<script lang="ts">
  import { ChevronRight, Plus, RefreshCw, Trash2 } from "@lucide/svelte";
  import { i18n } from "../../../lib/i18n";
  import type {
    AppSettings,
    GitlabInstance,
    IntegrationProvider,
  } from "../../../lib/storage/settings";
  import { syncGitlab } from "../../../lib/tauri/gitlab";
  import { newId } from "../../../lib/utils/database";
  import Button from "../../components/Button.svelte";
  import Input from "../../components/Input.svelte";
  import Switch from "../../components/Switch.svelte";
  import { updateFeatures, updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;
  export let root: string | null = null;
  /** Null shows the list of integrations; picking one opens its page. */
  let provider: IntegrationProvider | "youtube" | null = null;

  let status: Record<string, string> = {};
  let syncing: Record<string, boolean> = {};

  const providers = [
    {
      id: "gitlab",
      title: "gitlab.title",
      summary: "gitlab.summary",
      help: "gitlab.help",
      url: "https://gitlab.com",
      fields: [
        { key: "name", label: "gitlab.name", placeholder: "Work" },
        { key: "url", label: "gitlab.url", placeholder: "https://gitlab.com" },
        {
          key: "token",
          label: "gitlab.token",
          placeholder: "glpat-...",
          type: "password",
        },
        { key: "group", label: "gitlab.group", placeholder: "my-org/team" },
        { key: "interval", label: "gitlab.interval", placeholder: "30" },
      ],
    },
    {
      id: "github",
      title: "github.title",
      summary: "github.summary",
      help: "github.help",
      url: "https://github.com",
      fields: [
        { key: "name", label: "gitlab.name", placeholder: "Work" },
        { key: "url", label: "gitlab.url", placeholder: "https://github.com" },
        {
          key: "token",
          label: "github.token",
          placeholder: "ghp_... / github_pat_...",
          type: "password",
        },
        { key: "group", label: "github.scope", placeholder: "owner/repo" },
        { key: "interval", label: "gitlab.interval", placeholder: "30" },
      ],
    },
  ] as const;

  function setInstances(gitlab: GitlabInstance[]) {
    updateSettings(settings, onChange, { gitlab });
  }

  function patch(id: string, next: Partial<GitlabInstance>) {
    setInstances(
      settings.gitlab.map((item) =>
        item.id === id ? { ...item, ...next } : item,
      ),
    );
  }

  function add(provider: IntegrationProvider, url: string) {
    setInstances([
      ...settings.gitlab,
      {
        id: newId(),
        provider,
        enabled: true,
        name: "",
        url,
        token: "",
        group: "",
        interval: "",
      },
    ]);
  }

  $: instancesOf = (provider: IntegrationProvider) =>
    settings.gitlab.filter((item) => item.provider === provider);

  function remove(id: string) {
    setInstances(settings.gitlab.filter((item) => item.id !== id));
  }

  async function sync(instance: GitlabInstance) {
    if (!root) return;
    syncing = { ...syncing, [instance.id]: true };
    status = { ...status, [instance.id]: $i18n.t("gitlab.syncing") };
    try {
      const counts = await syncGitlab(root, instance);
      status = {
        ...status,
        [instance.id]: $i18n.t(`${instance.provider}.synced`, {
          issues: counts.issues ?? 0,
          mrs: counts.merge_requests ?? 0,
          epics: counts.epics ?? 0,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : error;
      status = { ...status, [instance.id]: String(message) };
    } finally {
      syncing = { ...syncing, [instance.id]: false };
    }
  }
</script>

<div class="grid max-w-2xl gap-6">
{#if provider === null}
  <div class="grid gap-2">
    {#each providers as item (item.id)}
      {@const count = instancesOf(item.id).length}
      {@const active = instancesOf(item.id).filter((i) => i.enabled).length}
      <button
        type="button"
        class="flex items-center gap-3 rounded-lg border border-stone-200 bg-surface px-4 py-3 text-left transition-colors hover:border-stone-300 hover:bg-stone-100/60 focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:outline-none dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700 dark:hover:bg-stone-800/60"
        onclick={() => (provider = item.id)}
      >
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span class="text-sm font-medium text-stone-800 dark:text-stone-100">
            {$i18n.t(item.title)}
          </span>
          <span class="truncate text-xs text-stone-500">
            {$i18n.t(item.summary)}
          </span>
        </span>
        <span class="shrink-0 text-xs text-stone-500">
          {count
            ? $i18n.t("integrations.count", { active, count })
            : $i18n.t("integrations.none")}
        </span>
        <ChevronRight class="size-4 shrink-0 text-stone-400" aria-hidden="true" />
      </button>
    {/each}
    <button
      type="button"
      class="flex items-center gap-3 rounded-lg border border-stone-200 bg-surface px-4 py-3 text-left transition-colors hover:border-stone-300 hover:bg-stone-100/60 focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:outline-none dark:border-stone-800 dark:bg-stone-900 dark:hover:border-stone-700 dark:hover:bg-stone-800/60"
      onclick={() => (provider = "youtube")}
    >
      <span class="grid min-w-0 flex-1 gap-0.5">
        <span class="text-sm font-medium text-stone-800 dark:text-stone-100">
          YouTube
        </span>
        <span class="truncate text-xs text-stone-500">
          {$i18n.t("youtube.summary")}
        </span>
      </span>
      <span class="shrink-0 text-xs text-stone-500">
        {settings.features.youtube
          ? $i18n.t("integrations.on")
          : $i18n.t("integrations.off")}
      </span>
      <ChevronRight class="size-4 shrink-0 text-stone-400" aria-hidden="true" />
    </button>
  </div>
{:else}
  <nav class="flex items-center gap-1.5 text-sm">
    <button
      type="button"
      class="text-stone-500 hover:text-stone-800 dark:hover:text-stone-100"
      onclick={() => (provider = null)}
    >
      {$i18n.t("settings.integrations")}
    </button>
    <ChevronRight class="size-3.5 text-stone-400" aria-hidden="true" />
    <span class="font-medium text-stone-800 dark:text-stone-100">
      {provider === "github"
        ? "GitHub"
        : provider === "youtube"
          ? "YouTube"
          : "GitLab"}
    </span>
  </nav>
  {#if provider === "youtube"}
    <section class="grid gap-2">
      <Switch
        checked={settings.features.youtube}
        label={$i18n.t("youtube.enable")}
        onChange={(youtube) => updateFeatures(settings, onChange, { youtube })}
      />
      <span class="text-xs text-stone-500">{$i18n.t("youtube.help")}</span>
    </section>
  {/if}
{#each providers.filter((item) => item.id === provider) as section (section.id)}
<div class="grid gap-6">
  <section class="grid gap-2">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
        {$i18n.t(section.title)}
      </span>
      <Button
        label={$i18n.t("gitlab.add")}
        icon={Plus}
        onClick={() => add(section.id, section.url)}
        size="sm"
        showLabel
      />
    </div>
    <span class="text-xs text-stone-500">{$i18n.t(section.help)}</span>
    {#if !root}
      <span class="text-xs text-amber-600">{$i18n.t("gitlab.needsSpace")}</span>
    {/if}
  </section>
  {#each instancesOf(section.id) as instance (instance.id)}
    <section
      class="grid gap-3 border-t border-stone-200/50 pt-5 dark:border-stone-800/80"
    >
      <Switch
        checked={instance.enabled}
        label={instance.name || instance.url || $i18n.t(section.title)}
        onChange={(enabled) => patch(instance.id, { enabled })}
      />
      <div
        class="grid grid-cols-2 gap-3"
        class:opacity-50={!instance.enabled}
      >
        {#each section.fields as field (field.key)}
          <label class="grid gap-1.5 text-xs text-stone-500">
            {$i18n.t(field.label)}
            <Input
              value={instance[field.key]}
              type={"type" in field ? field.type : "text"}
              placeholder={field.placeholder}
              oninput={(event) =>
                patch(instance.id, {
                  [field.key]: (event.target as HTMLInputElement).value,
                })}
            />
          </label>
        {/each}
      </div>
      <div class="flex items-center gap-2">
        <Button
          label={$i18n.t("gitlab.sync")}
          icon={RefreshCw}
          onClick={() => sync(instance)}
          disabled={!root || !instance.enabled || syncing[instance.id]}
          size="sm"
          showLabel
        />
        <Button
          label={$i18n.t("gitlab.remove")}
          icon={Trash2}
          onClick={() => remove(instance.id)}
          variant="ghost"
          size="sm"
          showLabel
        />
        {#if status[instance.id]}
          <span class="text-xs text-stone-500">{status[instance.id]}</span>
        {/if}
      </div>
    </section>
  {/each}
</div>
{/each}
{/if}
</div>
