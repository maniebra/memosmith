<script lang="ts">
  import { Check, FileText, Image } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import {
    preferredTextDirection,
    type StrongTextDirection,
  } from "../../lib/utils/textDirection";
  import {
    type PageIcon as PageIconType,
    type PageMeta,
  } from "../../lib/utils/pageMeta";
  import Button from "./Button.svelte";
  import PageIcon from "./PageIcon.svelte";
  import PageIconPicker from "./PageIconPicker.svelte";
  import PageCoverMenu from "./PageCoverMenu.svelte";

  export let title = "";
  export let meta: PageMeta = {};
  export let editable = false;
  export let showTitle = true;
  export let resolveAsset: (source: string) => string;
  export let onIconChange: (icon: PageIconType | null) => void | Promise<void>;
  export let onCoverChange: (cover: string | null) => void | Promise<void>;
  export let onCoverPositionChange: (
    position: number,
  ) => void | Promise<void> = () => {};
  export let onPickCover: () => void | Promise<void>;
  export let onTitleChange: ((name: string) => void | Promise<void>) | null =
    null;

  let titleElement: HTMLElement | undefined;
  let iconOpen = false;
  let coverMenuOpen = false;
  let pageChromeDirection: StrongTextDirection = "ltr";
  let repositioning = false;
  let dragPosition: number | null = null;
  let dragStartY = 0;
  let dragStartPosition = 50;
  let coverElement: HTMLElement | undefined;

  $: coverSource = meta.cover ? resolveAsset(meta.cover) : "";
  $: titleDirection = preferredTextDirection(title);
  $: pageChromeDirection =
    titleDirection === "rtl" || $i18n.dir === "rtl" ? "rtl" : "ltr";
  $: coverPosition = dragPosition ?? meta.coverPosition ?? 50;
  // Svelte does not re-render children of a contenteditable node, so the title
  // stays stale when the same element is reused for another note.
  $: if (
    titleElement &&
    title !== titleElement.textContent &&
    document.activeElement !== titleElement
  ) {
    titleElement.textContent = title;
  }
  function closeMenus(event: MouseEvent) {
    if ((event.target as HTMLElement | null)?.closest("[data-menu]")) {
      return;
    }

    iconOpen = false;
    coverMenuOpen = false;
  }

  function selectIcon(icon: PageIconType | null) {
    iconOpen = false;
    void onIconChange(icon);
  }

  function applyCoverUrl(url: string) {
    coverMenuOpen = false;
    void onCoverChange(url);
  }

  function pickCover() {
    coverMenuOpen = false;
    void onPickCover();
  }

  function removeCover() {
    coverMenuOpen = false;
    repositioning = false;
    void onCoverChange(null);
  }

  function startReposition() {
    coverMenuOpen = false;
    repositioning = true;
  }

  function finishReposition() {
    repositioning = false;

    if (dragPosition !== null) {
      const next = dragPosition;
      dragPosition = null;
      void onCoverPositionChange(next);
    }
  }

  function dragStart(event: PointerEvent) {
    if (!repositioning) {
      return;
    }

    event.preventDefault();
    dragStartY = event.clientY;
    dragStartPosition = coverPosition;
    dragPosition = coverPosition;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function dragMove(event: PointerEvent) {
    if (dragPosition === null || !coverElement) {
      return;
    }

    // Dragging down reveals the upper part of the image.
    const height = coverElement.clientHeight || 1;
    const delta = ((event.clientY - dragStartY) / height) * 100;
    dragPosition = Math.min(100, Math.max(0, dragStartPosition - delta));
  }

  function dragEnd() {
    if (dragPosition === null) {
      return;
    }

    const next = dragPosition;
    dragPosition = null;
    void onCoverPositionChange(next);
  }

  function commitTitle() {
    if (!titleElement) {
      return;
    }

    const next = (titleElement.textContent ?? "").replace(/\s+/g, " ").trim();

    if (!next || next === title) {
      titleElement.textContent = title;
      return;
    }

    void onTitleChange?.(next);
  }

  function titleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      titleElement?.blur();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();

      if (titleElement) {
        titleElement.textContent = title;
      }

      titleElement?.blur();
    }
  }
</script>

<svelte:window
  onclick={closeMenus}
  onkeydown={(event) => {
    if (event.key === "Escape") {
      iconOpen = false;
      coverMenuOpen = false;
      repositioning = false;
    }
  }}
/>

{#if editable || title || meta.cover || meta.icon}
  <div class="mb-8">
    {#if meta.cover}
      <div
        bind:this={coverElement}
        class="group/cover relative -mx-6 -mt-14 mb-7 h-44 overflow-hidden bg-stone-200 sm:-mx-10 sm:h-56 dark:bg-stone-800"
      >
        <img
          src={coverSource}
          alt=""
          class={cn(
            "h-full w-full object-cover select-none",
            repositioning && "cursor-grab active:cursor-grabbing",
          )}
          style={`object-position: 50% ${coverPosition}%`}
          draggable="false"
          onpointerdown={dragStart}
          onpointermove={dragMove}
          onpointerup={dragEnd}
          onpointercancel={dragEnd}
        />

        {#if editable && repositioning}
          <div
            class="absolute inset-x-0 bottom-3 flex justify-center"
            data-menu
          >
            <div
              class="flex items-center gap-3 rounded-md border border-stone-200/80 bg-stone-50/90 px-3 py-1.5 text-[0.8125rem] text-stone-700 shadow-sm backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/90 dark:text-stone-200"
            >
              <span>{$i18n.t("page.repositionHint")}</span>
              <Button
                label={$i18n.t("common.save")}
                icon={Check}
                size="sm"
                variant="primary"
                onClick={finishReposition}
              />
            </div>
          </div>
        {:else if editable}
          <button
            type="button"
            class={cn(
              "absolute top-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200/80 bg-stone-50/90 px-2.5 text-[0.8125rem] font-medium text-stone-700 opacity-0 shadow-sm backdrop-blur transition-opacity hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30 group-hover/cover:opacity-100 dark:border-stone-700/80 dark:bg-stone-900/90 dark:text-stone-200 dark:hover:bg-stone-800",
              pageChromeDirection === "rtl" ? "left-3" : "right-3",
            )}
            aria-haspopup="menu"
            aria-expanded={coverMenuOpen}
            onclick={(event) => {
              event.stopPropagation();
              iconOpen = false;
              coverMenuOpen = !coverMenuOpen;
            }}
          >
            <Image class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            <span>{$i18n.t("page.cover")}</span>
          </button>
        {/if}

        {#if coverMenuOpen}
          <PageCoverMenu
            hasCover
            direction={pageChromeDirection}
            onUpload={pickCover}
            onUrl={applyCoverUrl}
            onReposition={startReposition}
            onRemove={removeCover}
          />
        {/if}
      </div>
    {/if}

    <div class="group/page relative">
      {#if editable && !meta.cover}
        <button
          type="button"
          class={cn(
            "absolute top-1 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium text-stone-500 opacity-0 transition-opacity hover:bg-stone-500/10 hover:text-stone-900 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 group-hover/page:opacity-100 dark:text-stone-400 dark:hover:text-stone-100",
            pageChromeDirection === "rtl" ? "left-0" : "right-0",
          )}
          aria-haspopup="menu"
          aria-expanded={coverMenuOpen}
          onclick={(event) => {
            event.stopPropagation();
            iconOpen = false;
            coverMenuOpen = !coverMenuOpen;
          }}
        >
          <Image class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
          <span>{$i18n.t("page.cover")}</span>
        </button>
      {/if}

      {#if editable && coverMenuOpen && !meta.cover}
        <PageCoverMenu
          direction={pageChromeDirection}
          onUpload={pickCover}
          onUrl={applyCoverUrl}
        />
      {/if}

      <div
        dir={pageChromeDirection}
        class={cn(
          "mb-3 flex items-start gap-3",
          pageChromeDirection === "rtl" ? "pl-24" : "pr-24",
        )}
      >
        {#if !editable}
          {#if meta.icon}
            <span
              class="mt-1 flex size-11 shrink-0 items-center justify-center rounded-md text-3xl text-stone-500 dark:text-stone-400"
            >
              <PageIcon
                icon={meta.icon}
                fallback={FileText}
                className="size-7"
              />
            </span>
          {/if}
        {:else}
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
          onclick={(event) => {
            event.stopPropagation();
            coverMenuOpen = false;
            iconOpen = !iconOpen;
          }}
        >
          <PageIcon icon={meta.icon} fallback={FileText} className="size-7" />
          </button>
        {/if}

        <div class="min-w-0 flex-1">
          {#if showTitle}
            <h1
              bind:this={titleElement}
              dir={titleDirection}
              contenteditable={editable && Boolean(onTitleChange)}
              spellcheck="false"
              aria-label={$i18n.t("page.renameTitle")}
              class={cn(
                "min-w-0 rounded-md text-start text-[2.5rem] leading-tight font-bold tracking-normal break-words text-stone-900 focus-visible:outline-none dark:text-stone-100",
                editable &&
                  onTitleChange &&
                  "focus:ring-2 focus:ring-emerald-600/25 focus:ring-offset-2 focus:ring-offset-transparent",
              )}
              onkeydown={titleKeydown}
              onblur={commitTitle}
            >
              {title}
            </h1>
          {/if}
        </div>
      </div>

      {#if editable && iconOpen}
        <PageIconPicker current={meta.icon} onSelect={selectIcon} />
      {/if}
    </div>
  </div>
{/if}
