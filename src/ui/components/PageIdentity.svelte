<script lang="ts">
  import { Check, FileText, Image, Link, Trash2, Upload } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import {
    preferredTextDirection,
    type StrongTextDirection,
  } from "../../lib/utils/textDirection";
  import {
    emojiIconChoices,
    lucideIconNames,
    parsePageIcon,
    type PageIcon as PageIconType,
    type PageMeta,
  } from "../../lib/utils/pageMeta";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";
  import PageIcon from "./PageIcon.svelte";

  export let title = "";
  export let meta: PageMeta = {};
  export let editable = false;
  export let showTitle = true;
  export let resolveAsset: (source: string) => string;
  export let onIconChange: (icon: PageIconType | null) => void | Promise<void>;
  export let onCoverChange: (cover: string | null) => void | Promise<void>;
  export let onPickCover: () => void | Promise<void>;

  let iconOpen = false;
  let coverMenuOpen = false;
  let coverUrl = "";
  let iconInput = "";
  let pageChromeDirection: StrongTextDirection = "ltr";

  $: coverSource = meta.cover ? resolveAsset(meta.cover) : "";
  $: titleDirection = preferredTextDirection(title);
  $: pageChromeDirection =
    titleDirection === "rtl" || $i18n.dir === "rtl" ? "rtl" : "ltr";

  function selectIcon(icon: PageIconType | null) {
    iconInput = "";
    iconOpen = false;
    void onIconChange(icon);
  }

  function applyIconInput() {
    const icon = parsePageIcon(iconInput);

    if (icon) {
      selectIcon(icon);
    }
  }

  function applyCoverUrl() {
    const url = coverUrl.trim();

    if (!url) {
      return;
    }

    coverUrl = "";
    coverMenuOpen = false;
    void onCoverChange(url);
  }

  function pickCover() {
    coverMenuOpen = false;
    void onPickCover();
  }

  function removeCover() {
    coverMenuOpen = false;
    void onCoverChange(null);
  }
</script>

{#if editable}
  <div class="mb-8">
    {#if meta.cover}
      <div
        class="group/cover relative -mx-6 mb-7 h-44 bg-stone-200 sm:-mx-10 sm:h-56 dark:bg-stone-800"
      >
        <img
          src={coverSource}
          alt=""
          class="h-full w-full object-cover"
          draggable="false"
        />
        <button
          type="button"
          class={cn(
            "absolute top-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200/80 bg-stone-50/90 px-2.5 text-[0.8125rem] font-medium text-stone-700 opacity-0 shadow-sm backdrop-blur transition-opacity hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 group-hover/cover:opacity-100 dark:border-stone-700/80 dark:bg-stone-900/90 dark:text-stone-200 dark:hover:bg-stone-800",
            pageChromeDirection === "rtl" ? "left-3" : "right-3",
          )}
          aria-haspopup="menu"
          aria-expanded={coverMenuOpen}
          onclick={() => (coverMenuOpen = !coverMenuOpen)}
        >
          <Image class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          <span>{$i18n.t("page.cover")}</span>
        </button>

        {#if coverMenuOpen}
          <div
            class={cn(
              "absolute top-12 z-50 w-80 rounded-xl border border-stone-200/80 bg-stone-50/95 p-3 shadow-lg shadow-stone-900/8 backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20",
              pageChromeDirection === "rtl" ? "left-3" : "right-3",
            )}
          >
            <div class="flex gap-2">
              <Button
                label={$i18n.t("common.upload")}
                icon={Upload}
                size="sm"
                variant="secondary"
                onClick={pickCover}
              />
              <Button
                label={$i18n.t("common.remove")}
                icon={Trash2}
                size="sm"
                variant="ghost"
                onClick={removeCover}
              />
            </div>

            <form
              class="mt-3 flex gap-2"
              onsubmit={(event) => {
                event.preventDefault();
                applyCoverUrl();
              }}
            >
              <Input
                bind:value={coverUrl}
                type="url"
                placeholder={$i18n.t("page.pasteImageUrl")}
                className="h-8"
              />
              <Button
                label={$i18n.t("page.setUrl")}
                icon={Link}
                size="sm"
                variant="ghost"
                onClick={applyCoverUrl}
              />
            </form>
          </div>
        {/if}
      </div>
    {/if}

    <div class="group/page relative">
      {#if !meta.cover}
        <button
          type="button"
          class={cn(
            "absolute top-1 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium text-stone-500 opacity-0 transition-opacity hover:bg-stone-500/10 hover:text-stone-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 group-hover/page:opacity-100 dark:text-stone-400 dark:hover:text-stone-100",
            pageChromeDirection === "rtl" ? "left-0" : "right-0",
          )}
          aria-haspopup="menu"
          aria-expanded={coverMenuOpen}
          onclick={() => (coverMenuOpen = !coverMenuOpen)}
        >
          <Image class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          <span>{$i18n.t("page.cover")}</span>
        </button>
      {/if}

      {#if coverMenuOpen && !meta.cover}
        <div
          class={cn(
            "absolute top-10 z-50 w-80 rounded-xl border border-stone-200/80 bg-stone-50/95 p-3 shadow-lg shadow-stone-900/8 backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20",
            pageChromeDirection === "rtl" ? "left-0" : "right-0",
          )}
        >
          <div class="flex gap-2">
            <Button
              label={$i18n.t("common.upload")}
              icon={Upload}
              size="sm"
              variant="secondary"
              onClick={pickCover}
            />
          </div>

          <form
            class="mt-3 flex gap-2"
            onsubmit={(event) => {
              event.preventDefault();
              applyCoverUrl();
            }}
          >
            <Input
              bind:value={coverUrl}
              type="url"
              placeholder={$i18n.t("page.pasteImageUrl")}
              className="h-8"
            />
            <Button
              label={$i18n.t("page.setUrl")}
              icon={Link}
              size="sm"
              variant="ghost"
              onClick={applyCoverUrl}
            />
          </form>
        </div>
      {/if}

      <div
        dir={pageChromeDirection}
        class={cn(
          "mb-3 flex items-start gap-3",
          pageChromeDirection === "rtl" ? "pl-24" : "pr-24",
        )}
      >
        <button
          type="button"
          class={cn(
            "mt-1 flex size-11 shrink-0 items-center justify-center rounded-md text-3xl transition-colors",
            "text-stone-500 hover:bg-stone-500/10 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25",
            "dark:text-stone-400 dark:hover:text-stone-100",
          )}
          title={meta.icon
            ? $i18n.t("page.changeIcon")
            : $i18n.t("page.addIcon")}
          aria-label={meta.icon
            ? $i18n.t("page.changeIcon")
            : $i18n.t("page.addIcon")}
          onclick={() => (iconOpen = !iconOpen)}
        >
          <PageIcon icon={meta.icon} fallback={FileText} className="size-7" />
        </button>

        <div class="min-w-0 flex-1">
          {#if showTitle}
            <h1
              dir={titleDirection}
              class="min-w-0 text-start text-[2.5rem] leading-tight font-bold tracking-normal break-words text-stone-900 dark:text-stone-100"
            >
              {title}
            </h1>
          {/if}
        </div>
      </div>

      {#if iconOpen}
        <div
          class="absolute top-14 left-0 z-40 w-80 rounded-xl border border-stone-200/80 bg-stone-50/95 p-3 shadow-lg shadow-stone-900/8 backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20"
        >
          <div class="grid grid-cols-6 gap-1">
            {#each emojiIconChoices as emoji}
              <button
                type="button"
                class="flex size-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-stone-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:hover:bg-stone-800"
                aria-label={$i18n.t("page.use", { name: emoji })}
                onclick={() => selectIcon({ type: "emoji", value: emoji })}
              >
                {emoji}
              </button>
            {/each}
          </div>

          <div class="mt-3 grid grid-cols-5 gap-1">
            {#each lucideIconNames as name}
              <button
                type="button"
                class="flex size-9 items-center justify-center rounded-md text-stone-600 transition-colors hover:bg-stone-200/70 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                title={name}
                aria-label={$i18n.t("page.use", { name })}
                onclick={() => selectIcon({ type: "lucide", value: name })}
              >
                <PageIcon
                  icon={{ type: "lucide", value: name }}
                  className="size-4"
                />
              </button>
            {/each}
          </div>

          <form
            class="mt-3 flex items-center gap-2"
            onsubmit={(event) => {
              event.preventDefault();
              applyIconInput();
            }}
          >
            <Input
              bind:value={iconInput}
              placeholder={$i18n.t("page.iconPlaceholder")}
              className="h-8 min-w-0 flex-1"
            />
            <Button
              label={$i18n.t("page.setIcon")}
              icon={Check}
              size="sm"
              variant="primary"
              onClick={applyIconInput}
            />
            {#if meta.icon}
              <Button
                label={$i18n.t("page.removeIcon")}
                icon={Trash2}
                size="sm"
                variant="ghost"
                onClick={() => selectIcon(null)}
              />
            {/if}
          </form>
        </div>
      {/if}
    </div>
  </div>
{/if}
