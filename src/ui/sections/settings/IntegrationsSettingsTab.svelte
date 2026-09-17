<script lang="ts">
  import { Plus, RefreshCw, Trash2 } from "@lucide/svelte";
  import { i18n } from "../../../lib/i18n";
  import type {
    AppSettings,
    GitlabInstance,
  } from "../../../lib/storage/settings";
  import { syncGitlab } from "../../../lib/tauri/gitlab";
  import { newId } from "../../../lib/utils/database";
  import Button from "../../components/Button.svelte";
  import Input from "../../components/Input.svelte";
  import { updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;
  export let root: string | null = null;

  let status: Record<string, string> = {};
  let syncing: Record<string, boolean> = {};

  const fields = [
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

  function add() {
    setInstances([
      ...settings.gitlab,
      {
        id: newId(),
        name: "",
        url: "https://gitlab.com",
        token: "",
        group: "",
        interval: "",
      },
    ]);
  }

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
        [instance.id]: $i18n.t("gitlab.synced", {
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
  <section class="grid gap-2">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
        {$i18n.t("gitlab.title")}
      </span>
      <Button
        label={$i18n.t("gitlab.add")}
        icon={Plus}
        onClick={add}
        size="sm"
        showLabel
      />
    </div>
    <span class="text-xs text-stone-500">{$i18n.t("gitlab.help")}</span>
    {#if !root}
      <span class="text-xs text-amber-600">{$i18n.t("gitlab.needsSpace")}</span>
    {/if}
  </section>
  {#each settings.gitlab as instance (instance.id)}
    <section
      class="grid gap-3 border-t border-stone-200/50 pt-5 dark:border-stone-800/80"
    >
      <div class="grid grid-cols-2 gap-3">
        {#each fields as field (field.key)}
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
          disabled={!root || syncing[instance.id]}
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
