<script lang="ts">
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { BookOpen, Image, Music, Video } from "@lucide/svelte";

  /** Disk path of the readable the row points at. */
  export let path: string;
  export let kind: string | undefined;
  export let className = "";

  const icons: Record<string, typeof BookOpen> = {
    image: Image,
    video: Video,
    audio: Music,
  };

  // A frame offset makes the webview paint a still instead of a black box.
  $: src =
    kind === "video"
      ? `${convertFileSrc(path)}#t=0.5`
      : convertFileSrc(path);
  $: preview = kind === "image" || kind === "video";

  let failed = false;
</script>

{#if preview && !failed}
  {#if kind === "image"}
    <img
      {src}
      alt=""
      loading="lazy"
      class="{className} rounded-sm object-cover"
      onerror={() => (failed = true)}
    />
  {:else}
    <video
      {src}
      muted
      preload="metadata"
      class="{className} rounded-sm object-cover"
      onerror={() => (failed = true)}
    ></video>
  {/if}
{:else}
  <svelte:component this={icons[kind ?? ""] ?? BookOpen} class={className} />
{/if}
