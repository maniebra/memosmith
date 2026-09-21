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

  // Only images preview: video frames would need the whole file in memory.
  $: preview = kind === "image";

  let failed = false;
</script>

{#if preview && !failed}
  <img
    src={convertFileSrc(path)}
    alt=""
    loading="lazy"
    class="{className} rounded-sm object-cover"
    onerror={() => (failed = true)}
  />
{:else}
  <svelte:component this={icons[kind ?? ""] ?? BookOpen} class={className} />
{/if}
