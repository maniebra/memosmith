<script lang="ts">
  import { onMount } from "svelte";
  import { convertFileSrc } from "@tauri-apps/api/core";
  import { Maximize, ZoomIn, ZoomOut } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import {
    loadPositions,
    savePosition,
    type ReadableKind,
  } from "../../lib/storage/readables";
  import { mediaUrl } from "../../lib/tauri/readables";

  export let path: string;
  export let kind: ReadableKind;
  export let name = "";

  const button =
    "rounded-md p-1.5 text-stone-500 hover:bg-stone-500/10" +
    " focus-visible:outline-none focus-visible:ring-2" +
    " focus-visible:ring-emerald-600/25 dark:text-stone-400";

  // Images come off the asset protocol; video and audio stream over the
  // loopback server, the only source GStreamer can both fetch and seek.
  let streamUrl = "";
  let error = "";

  $: src = kind === "image" ? convertFileSrc(path) : streamUrl;

  $: void openStream(path, kind);

  async function openStream(file: string, mediaKind: ReadableKind) {
    if (mediaKind === "image") {
      return;
    }

    streamUrl = "";
    error = "";

    try {
      streamUrl = await mediaUrl(file);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
  }

  let zoom = 1;
  let pan = { x: 0, y: 0 };
  let dragFrom: { x: number; y: number } | null = null;
  let player: HTMLMediaElement | undefined;

  $: percent = `${Math.round(zoom * 100)}%`;

  function setZoom(next: number, keepPan = false) {
    zoom = Math.min(8, Math.max(0.2, Number(next.toFixed(2))));

    if (!keepPan || zoom === 1) {
      pan = { x: 0, y: 0 };
    }
  }

  /** Ctrl+wheel zooms, like every image viewer; plain wheel scrolls. */
  function onWheel(event: WheelEvent) {
    if (!event.ctrlKey || kind !== "image") {
      return;
    }

    event.preventDefault();
    setZoom(zoom * (event.deltaY < 0 ? 1.1 : 0.9), true);
  }

  function startPan(event: PointerEvent) {
    if (kind !== "image" || zoom === 1) {
      return;
    }

    dragFrom = { x: event.clientX - pan.x, y: event.clientY - pan.y };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function movePan(event: PointerEvent) {
    if (dragFrom) {
      pan = { x: event.clientX - dragFrom.x, y: event.clientY - dragFrom.y };
    }
  }

  /** What the element itself says went wrong, rather than a guess. */
  function playbackError(element: HTMLMediaElement | undefined) {
    const detail = element?.error?.message;

    return detail
      ? `${$i18n.t("readables.unsupported")} (${detail})`
      : $i18n.t("readables.unsupported");
  }

  /** Playback picks up where it stopped, the way the reader keeps a page. */
  function restorePosition() {
    const stored = Number(loadPositions()[path]);

    if (player && Number.isFinite(stored) && stored > 0) {
      player.currentTime = stored;
    }
  }

  let lastSaved = 0;

  function rememberPosition() {
    const at = player?.currentTime ?? 0;

    // Once every few seconds is enough, and keeps localStorage quiet.
    if (player && Math.abs(at - lastSaved) >= 3) {
      lastSaved = at;
      savePosition(path, String(Math.floor(at)));
    }
  }

  onMount(() => () => rememberPosition());
</script>

<svelte:window on:beforeunload={rememberPosition} />

<div class="flex min-h-0 flex-1 flex-col bg-stone-100 dark:bg-stone-900">
  <div
    class="flex h-9 shrink-0 items-center gap-2 border-b border-stone-200/70
      px-3 dark:border-stone-800"
  >
    <span class="min-w-0 flex-1 truncate text-xs text-stone-500" title={path}>
      {name || path}
    </span>
    {#if kind === "image"}
      <button
        type="button"
        class={button}
        aria-label={$i18n.t("readables.zoomOut")}
        title={$i18n.t("readables.zoomOut")}
        onclick={() => setZoom(zoom - 0.2)}
      >
        <ZoomOut class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>
      <span class="w-10 text-center text-xs tabular-nums text-stone-500">
        {percent}
      </span>
      <button
        type="button"
        class={button}
        aria-label={$i18n.t("readables.zoomIn")}
        title={$i18n.t("readables.zoomIn")}
        onclick={() => setZoom(zoom + 0.2)}
      >
        <ZoomIn class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button
        type="button"
        class={button}
        aria-label={$i18n.t("readables.resetZoom")}
        title={$i18n.t("readables.resetZoom")}
        onclick={() => setZoom(1)}
      >
        <Maximize class="size-4" strokeWidth={1.8} aria-hidden="true" />
      </button>
    {/if}
  </div>
  <div
    class="flex min-h-0 flex-1 items-center justify-center overflow-auto p-3"
    role="presentation"
    onwheel={onWheel}
    onpointerdown={startPan}
    onpointermove={movePan}
    onpointerup={() => (dragFrom = null)}
    onpointercancel={() => (dragFrom = null)}
  >
    {#if error}
      <p class="px-3 text-center text-xs text-rose-500">{error}</p>
    {:else if kind !== "image" && !streamUrl}
      <p class="px-3 text-center text-xs text-stone-400">
        {$i18n.t("readables.loading")}
      </p>
    {:else if kind === "image"}
      <img
        {src}
        alt={name || path}
        draggable="false"
        class="max-h-full max-w-full object-contain"
        class:cursor-grab={zoom > 1 && !dragFrom}
        class:cursor-grabbing={Boolean(dragFrom)}
        style="transform: translate({pan.x}px, {pan.y}px) scale({zoom});
          transform-origin: center;"
      />
    {:else if kind === "video"}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video
        bind:this={player}
        {src}
        controls
        class="max-h-full max-w-full"
        onloadedmetadata={restorePosition}
        ontimeupdate={rememberPosition}
        onpause={rememberPosition}
        onerror={() => (error = playbackError(player))}
      ></video>
    {:else}
      <audio
        bind:this={player}
        {src}
        controls
        class="w-full max-w-lg"
        onloadedmetadata={restorePosition}
        ontimeupdate={rememberPosition}
        onpause={rememberPosition}
        onerror={() => (error = playbackError(player))}
      >
        {$i18n.t("readables.unsupported")}
      </audio>
    {/if}
  </div>
</div>
