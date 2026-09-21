<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { i18n } from "../../lib/i18n";
  import type { ReadableKind } from "../../lib/storage/readables";

  export let path: string;
  export let kind: ReadableKind;
  export let name = "";

  // The asset protocol streams the file; nothing is copied into the space.
  $: src = convertFileSrc(path);
</script>

<div class="flex min-h-0 flex-1 flex-col bg-stone-100 dark:bg-stone-900">
  <div
    class="flex h-9 shrink-0 items-center gap-2 border-b border-stone-200/70 px-3 dark:border-stone-800"
  >
    <span class="min-w-0 truncate text-xs text-stone-500" title={path}>
      {name || path}
    </span>
  </div>
  <div
    class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3"
  >
    {#if kind === "image"}
      <img
        {src}
        alt={name || path}
        class="max-h-full max-w-full object-contain"
      />
    {:else if kind === "video"}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video {src} controls class="max-h-full max-w-full"></video>
    {:else}
      <audio {src} controls class="w-full max-w-lg">
        {$i18n.t("readables.unsupported")}
      </audio>
    {/if}
  </div>
</div>
