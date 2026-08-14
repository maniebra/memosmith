<script lang="ts">
  import { Check, Trash2 } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import {
    emojiIconGroups,
    lucideIconGroups,
    type IconGroup,
  } from "../../lib/utils/pageIcons";
  import {
    parsePageIcon,
    type PageIcon as PageIconType,
  } from "../../lib/utils/pageMeta";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
  import PageIcon from "./PageIcon.svelte";

  export let current: PageIconType | null | undefined = null;
  export let onSelect: (icon: PageIconType | null) => void;

  let tab: "emoji" | "lucide" = "emoji";
  let query = "";

  $: groups = tab === "emoji" ? emojiIconGroups : lucideIconGroups;
  $: filteredGroups = filterGroups(groups, query);

  function filterGroups(source: readonly IconGroup[], needleInput: string) {
    const needle = needleInput.trim().toLowerCase();

    if (!needle) {
      return source;
    }

    return source
      .map((group) => ({
        ...group,
        names: group.names.filter((name) =>
          name.toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.names.length > 0);
  }

  function applyQuery() {
    const icon = parsePageIcon(query);

    if (icon) {
      query = "";
      onSelect(icon);
    }
  }
</script>

<div
  class="absolute top-14 left-0 z-40 w-80 rounded-xl border border-stone-200/80 bg-stone-50/95 p-3 shadow-lg shadow-stone-900/8 backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20"
  data-menu
>
  <div class="flex gap-1 rounded-lg bg-stone-200/60 p-0.5 dark:bg-stone-800/60">
    {#each [["emoji", "page.emojis"], ["lucide", "page.icons"]] as const as [name, labelKey] (name)}
      <button
        type="button"
        class={cn(
          "flex-1 rounded-md px-2 py-1 text-[0.8125rem] font-medium transition-colors",
          tab === name
            ? "bg-stone-50 text-stone-900 shadow-sm dark:bg-stone-900 dark:text-stone-100"
            : "text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100",
        )}
        aria-pressed={tab === name}
        onclick={() => (tab = name)}
      >
        {$i18n.t(labelKey)}
      </button>
    {/each}
  </div>

  <Input
    bind:value={query}
    placeholder={$i18n.t("page.searchIcons")}
    className="mt-2 h-8"
  />

  <div class="mt-2 max-h-64 overflow-y-auto pr-1">
    {#if filteredGroups.length === 0}
      <p class="px-1 py-4 text-center text-xs text-stone-500">
        {$i18n.t("page.noIconMatches")}
      </p>
    {/if}
    {#each filteredGroups as group (group.labelKey)}
      <p
        class="mt-2 mb-1 px-1 text-[0.6875rem] font-medium tracking-wide text-stone-500 uppercase first:mt-0 dark:text-stone-400"
      >
        {$i18n.t(group.labelKey)}
      </p>
      <div class="grid grid-cols-8 gap-1">
        {#each group.names as name (name)}
          <button
            type="button"
            class="flex size-8 items-center justify-center rounded-md text-lg text-stone-600 transition-colors hover:bg-stone-200/70 hover:text-stone-900 focus-visible:ring-2 focus-visible:ring-emerald-600/25 focus-visible:outline-none dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
            title={name}
            aria-label={$i18n.t("page.use", { name })}
            onclick={() => onSelect({ type: tab, value: name })}
          >
            {#if tab === "emoji"}
              {name}
            {:else}
              <PageIcon
                icon={{ type: "lucide", value: name }}
                className="size-4"
              />
            {/if}
          </button>
        {/each}
      </div>
    {/each}
  </div>

  <form
    class="mt-3 flex items-center gap-2"
    onsubmit={(event) => {
      event.preventDefault();
      applyQuery();
    }}
  >
    <Button
      label={$i18n.t("page.setIcon")}
      icon={Check}
      size="sm"
      variant="primary"
      onClick={applyQuery}
    />
    {#if current}
      <Button
        label={$i18n.t("page.removeIcon")}
        icon={Trash2}
        size="sm"
        variant="ghost"
        onClick={() => onSelect(null)}
      />
    {/if}
  </form>
</div>
