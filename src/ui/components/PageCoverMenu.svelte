<script lang="ts">
  import { Link, Move, Trash2, Upload } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import type { StrongTextDirection } from "../../lib/utils/textDirection";
  import Button from "./Button.svelte";
  import Input from "./Input.svelte";

  /** Shown for a page that already has a cover: adds reposition and remove. */
  export let hasCover = false;
  export let direction: StrongTextDirection = "ltr";
  export let onUpload: () => void;
  export let onUrl: (url: string) => void;
  export let onReposition: () => void = () => {};
  export let onRemove: () => void = () => {};

  let url = "";

  function applyUrl() {
    const next = url.trim();

    if (!next) {
      return;
    }

    url = "";
    onUrl(next);
  }
</script>

<div
  class={cn(
    "absolute z-50 w-80 rounded-xl border border-stone-200/80 bg-stone-50/95 p-3 shadow-lg shadow-stone-900/8 backdrop-blur dark:border-stone-700/80 dark:bg-stone-900/95 dark:shadow-black/20",
    hasCover ? "top-12" : "top-10",
    hasCover
      ? direction === "rtl"
        ? "left-3"
        : "right-3"
      : direction === "rtl"
        ? "left-0"
        : "right-0",
  )}
  data-menu
>
  <div class="flex flex-wrap gap-2">
    <Button
      label={$i18n.t("common.upload")}
      icon={Upload}
      size="sm"
      variant="secondary"
      onClick={onUpload}
    />
    {#if hasCover}
      <Button
        label={$i18n.t("page.reposition")}
        icon={Move}
        size="sm"
        variant="ghost"
        onClick={onReposition}
      />
      <Button
        label={$i18n.t("common.remove")}
        icon={Trash2}
        size="sm"
        variant="ghost"
        onClick={onRemove}
      />
    {/if}
  </div>

  <form
    class="mt-3 flex gap-2"
    onsubmit={(event) => {
      event.preventDefault();
      applyUrl();
    }}
  >
    <Input
      bind:value={url}
      type="url"
      placeholder={$i18n.t("page.pasteImageUrl")}
      className="h-8"
    />
    <Button
      label={$i18n.t("page.setUrl")}
      icon={Link}
      size="sm"
      variant="ghost"
      onClick={applyUrl}
    />
  </form>
</div>
