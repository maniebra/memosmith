<script lang="ts">
  import {
    Maximize,
    Minimize,
    Pause,
    Play,
    RotateCcw,
    RotateCw,
    Volume2,
    VolumeX,
  } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";

  export let src: string;
  export let kind: "video" | "audio";
  export let label = "";
  /** The media element itself, so the owner can restore and save its position. */
  export let element: HTMLMediaElement | undefined = undefined;
  export let onready: () => void = () => {};
  export let onprogress: () => void = () => {};
  export let onfail: () => void = () => {};

  const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  const SKIP = 10;

  const button =
    "grid size-8 shrink-0 place-items-center rounded-full text-stone-200" +
    " transition hover:bg-white/15 focus-visible:outline-none" +
    " focus-visible:ring-2 focus-visible:ring-emerald-400/60";

  let shell: HTMLElement | undefined;
  let paused = true;
  let currentTime = 0;
  let duration = 0;
  let volume = 1;
  let muted = false;
  let speed = 1;
  let fullscreen = false;
  let scrubbing = false;

  $: progress = duration ? (currentTime / duration) * 100 : 0;
  // A video hides its controls while it plays and the pointer rests; audio
  // has nothing else to show, so its bar always stays.
  $: visible = kind === "audio" || paused || scrubbing || hovering;

  let hovering = false;

  function clock(seconds: number) {
    if (!Number.isFinite(seconds)) {
      return "0:00";
    }

    const whole = Math.max(0, Math.floor(seconds));
    const parts = [Math.floor(whole / 60) % 60, whole % 60];

    if (whole >= 3600) {
      parts.unshift(Math.floor(whole / 3600));
    }

    return parts
      .map((part, index) => (index ? String(part).padStart(2, "0") : part))
      .join(":");
  }

  function toggle() {
    paused = !paused;
  }

  function seekBy(delta: number) {
    currentTime = Math.min(duration || 0, Math.max(0, currentTime + delta));
  }

  function cycleSpeed() {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await shell?.requestFullscreen();
    }
  }

  /** Shortcuts match every other player, so nothing has to be learnt. */
  function onKey(event: KeyboardEvent) {
    const keys: Record<string, () => void> = {
      " ": toggle,
      k: toggle,
      ArrowRight: () => seekBy(SKIP),
      ArrowLeft: () => seekBy(-SKIP),
      m: () => (muted = !muted),
      f: () => void toggleFullscreen(),
    };
    const action = kind === "video" || event.key !== "f" ? keys[event.key] : undefined;

    if (action) {
      event.preventDefault();
      action();
    }
  }
</script>

<svelte:document on:fullscreenchange={() => (fullscreen = Boolean(document.fullscreenElement))} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<section
  bind:this={shell}
  class="group relative flex max-h-full min-h-0 w-full flex-col
    justify-center {kind === 'video'
    ? 'max-w-full'
    : 'max-w-lg rounded-xl bg-stone-900/90 p-3 shadow-lg'}"
  aria-label={label}
  tabindex="-1"
  onkeydown={onKey}
  onpointerenter={() => (hovering = true)}
  onpointerleave={() => (hovering = false)}
>
  {#if kind === "video"}
    <!-- svelte-ignore a11y_media_has_caption -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <video
      bind:this={element}
      bind:paused
      bind:currentTime
      bind:duration
      bind:volume
      bind:muted
      bind:playbackRate={speed}
      {src}
      class="max-h-full w-full bg-black object-contain
        {fullscreen ? 'h-full' : ''}"
      onloadedmetadata={onready}
      ontimeupdate={onprogress}
      onpause={onprogress}
      onerror={onfail}
      onclick={toggle}
    ></video>
  {:else}
    <audio
      bind:this={element}
      bind:paused
      bind:currentTime
      bind:duration
      bind:volume
      bind:muted
      bind:playbackRate={speed}
      {src}
      onloadedmetadata={onready}
      ontimeupdate={onprogress}
      onpause={onprogress}
      onerror={onfail}
    ></audio>
  {/if}

  <div
    class="flex items-center gap-2 px-3 py-2 text-stone-200 transition-opacity
      duration-200 {kind === 'video'
      ? 'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent pt-8'
      : ''}"
    class:opacity-0={!visible}
    class:pointer-events-none={!visible}
  >
    <button
      type="button"
      class={button}
      aria-label={$i18n.t(paused ? "player.play" : "player.pause")}
      title={$i18n.t(paused ? "player.play" : "player.pause")}
      onclick={toggle}
    >
      {#if paused}
        <Play class="size-4" strokeWidth={2} aria-hidden="true" />
      {:else}
        <Pause class="size-4" strokeWidth={2} aria-hidden="true" />
      {/if}
    </button>
    <button
      type="button"
      class="{button} hidden sm:grid"
      aria-label={$i18n.t("player.back")}
      title={$i18n.t("player.back")}
      onclick={() => seekBy(-SKIP)}
    >
      <RotateCcw class="size-4" strokeWidth={1.8} aria-hidden="true" />
    </button>
    <button
      type="button"
      class="{button} hidden sm:grid"
      aria-label={$i18n.t("player.forward")}
      title={$i18n.t("player.forward")}
      onclick={() => seekBy(SKIP)}
    >
      <RotateCw class="size-4" strokeWidth={1.8} aria-hidden="true" />
    </button>

    <span class="w-12 shrink-0 text-right text-xs tabular-nums">
      {clock(currentTime)}
    </span>
    <input
      type="range"
      class="seek min-w-0 flex-1"
      style="--fill: {progress}%"
      min="0"
      max={duration || 0}
      step="0.1"
      value={currentTime}
      aria-label={$i18n.t("player.seek")}
      oninput={(event) =>
        (currentTime = Number(event.currentTarget.value))}
      onpointerdown={() => (scrubbing = true)}
      onpointerup={() => (scrubbing = false)}
    />
    <span class="w-12 shrink-0 text-xs tabular-nums text-stone-400">
      {clock(duration)}
    </span>

    <button
      type="button"
      class="{button} w-10 text-xs tabular-nums"
      aria-label={$i18n.t("player.speed")}
      title={$i18n.t("player.speed")}
      onclick={cycleSpeed}
    >
      {speed}×
    </button>
    <div class="group/volume flex items-center gap-1">
      <button
        type="button"
        class={button}
        aria-label={$i18n.t(muted ? "player.unmute" : "player.mute")}
        title={$i18n.t(muted ? "player.unmute" : "player.mute")}
        onclick={() => (muted = !muted)}
      >
        {#if muted || volume === 0}
          <VolumeX class="size-4" strokeWidth={1.8} aria-hidden="true" />
        {:else}
          <Volume2 class="size-4" strokeWidth={1.8} aria-hidden="true" />
        {/if}
      </button>
      <input
        type="range"
        class="seek w-0 opacity-0 transition-all duration-200
          group-hover/volume:w-16 group-hover/volume:opacity-100
          focus:w-16 focus:opacity-100"
        style="--fill: {(muted ? 0 : volume) * 100}%"
        min="0"
        max="1"
        step="0.05"
        value={muted ? 0 : volume}
        aria-label={$i18n.t("player.volume")}
        oninput={(event) => {
          volume = Number(event.currentTarget.value);
          muted = volume === 0;
        }}
      />
    </div>
    {#if kind === "video"}
      <button
        type="button"
        class={button}
        aria-label={$i18n.t(fullscreen ? "player.exitFullscreen" : "player.fullscreen")}
        title={$i18n.t(fullscreen ? "player.exitFullscreen" : "player.fullscreen")}
        onclick={toggleFullscreen}
      >
        {#if fullscreen}
          <Minimize class="size-4" strokeWidth={1.8} aria-hidden="true" />
        {:else}
          <Maximize class="size-4" strokeWidth={1.8} aria-hidden="true" />
        {/if}
      </button>
    {/if}
  </div>
</section>

<style>
  /* One flat track filled to --fill; no theme has a native range worth keeping. */
  .seek {
    appearance: none;
    height: 1rem;
    background: transparent;
    cursor: pointer;
  }

  .seek::-webkit-slider-runnable-track {
    height: 0.25rem;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      rgb(16 185 129) var(--fill),
      rgb(255 255 255 / 0.25) var(--fill)
    );
  }

  .seek::-moz-range-track {
    height: 0.25rem;
    border-radius: 9999px;
    background: linear-gradient(
      to right,
      rgb(16 185 129) var(--fill),
      rgb(255 255 255 / 0.25) var(--fill)
    );
  }

  .seek::-webkit-slider-thumb {
    appearance: none;
    width: 0.75rem;
    height: 0.75rem;
    margin-top: -0.25rem;
    border-radius: 9999px;
    background: rgb(255 255 255);
    opacity: 0;
    transition: opacity 150ms;
  }

  .seek::-moz-range-thumb {
    width: 0.75rem;
    height: 0.75rem;
    border: 0;
    border-radius: 9999px;
    background: rgb(255 255 255);
  }

  .seek:hover::-webkit-slider-thumb,
  .seek:focus-visible::-webkit-slider-thumb {
    opacity: 1;
  }

  .seek:focus-visible {
    outline: none;
  }
</style>
