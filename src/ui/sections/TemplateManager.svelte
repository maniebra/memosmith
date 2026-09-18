<script lang="ts">
  import { FilePlus, Pencil, Plus, Trash2, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { confirmDelete, createNote, deletePath } from "../../lib/tauri/files";
  import { dirname, joinPath, withNoteExtension } from "../../lib/utils/path";
  import {
    loadSpaceTemplates,
    type SpaceTemplate,
  } from "../../lib/utils/templates";
  import Button from "../components/Button.svelte";
  import Select from "../components/Select.svelte";

  export let root: string;
  export let notes: string[];
  /** Opens a template file in the editor to write it. */
  export let onEdit: (relativePath: string) => void;
  export let onUse: (template: SpaceTemplate) => void;
  export let onClose: () => void;

  let templates: SpaceTemplate[] = [];
  let folder = "";
  let newName = "";

  const reload = async () => (templates = await loadSpaceTemplates(root));
  $: if (root) void reload();

  // Every folder in the space, so any of them can get its own templates.
  $: folders = [
    "",
    ...new Set(
      notes.flatMap((note) =>
        dirname(note)
          .split("/")
          .filter(Boolean)
          .map((_, index, parts) => parts.slice(0, index + 1).join("/")),
      ),
    ),
  ].sort();

  async function create() {
    const name = newName.trim().replace(/[\\/]/g, "-");
    if (!name) {
      return;
    }
    const relativePath = `${folder ? `${folder}/` : ""}.templates/${withNoteExtension(name)}`;
    await createNote(joinPath(root, relativePath));
    newName = "";
    await reload();
    onEdit(relativePath);
  }

  async function remove(template: SpaceTemplate) {
    if (await confirmDelete(template.name)) {
      await deletePath(joinPath(root, template.path));
      await reload();
    }
  }
</script>

<div
  class="flex h-[70vh] w-[90vw] flex-col overflow-hidden rounded-xl bg-stone-50 shadow-xl md:max-h-[640px] md:w-[36rem] dark:bg-stone-900"
  aria-label={$i18n.t("template.title")}
>
  <div
    class="flex h-12 shrink-0 items-center justify-between border-b border-stone-200/50 px-4 dark:border-stone-800/80"
  >
    <h2 class="text-sm font-semibold text-stone-800 dark:text-stone-100">
      {$i18n.t("template.title")}
    </h2>
    <Button
      label={$i18n.t("common.close")}
      icon={X}
      onClick={onClose}
      variant="ghost"
      size="sm"
    />
  </div>

  <div
    class="flex shrink-0 gap-2 border-b border-stone-200/50 p-3 dark:border-stone-800/80"
  >
    <Select
      rootClassName="w-40 shrink-0"
      ariaLabel={$i18n.t("template.folder")}
      value={folder}
      options={folders.map((value) => ({
        value,
        label: value || $i18n.t("template.spaceRoot"),
      }))}
      onChange={(value) => (folder = value)}
    />
    <input
      class="h-9 min-w-0 flex-1 rounded-md border border-stone-200 bg-transparent px-2.5 text-sm text-stone-800 outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 dark:border-stone-700 dark:text-stone-100"
      placeholder={$i18n.t("template.newName")}
      bind:value={newName}
      onkeydown={(event) => event.key === "Enter" && create()}
    />
    <Button
      label={$i18n.t("common.create")}
      icon={Plus}
      onClick={create}
      variant="primary"
      size="sm"
    />
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto p-2">
    {#each templates as template (template.path)}
      <div class="group flex items-center gap-1">
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-stone-700 transition-colors hover:bg-stone-500/10 dark:text-stone-200"
          title={$i18n.t("template.use")}
          onclick={() => onUse(template)}
        >
          <FilePlus class="size-4 shrink-0 opacity-70" strokeWidth={1.8} />
          <span class="truncate">{template.name}</span>
        </button>
        <Button
          label={$i18n.t("template.edit")}
          icon={Pencil}
          onClick={() => onEdit(template.path)}
          variant="ghost"
          size="sm"
        />
        <Button
          label={$i18n.t("common.delete")}
          icon={Trash2}
          onClick={() => remove(template)}
          variant="ghost"
          size="sm"
        />
      </div>
    {/each}

    {#if !templates.length}
      <p class="px-2 py-8 text-center text-sm text-stone-400">
        {$i18n.t("template.empty")}
      </p>
    {/if}
  </div>
</div>
