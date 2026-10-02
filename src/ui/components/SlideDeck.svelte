<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import { listSlideThemes } from "../../lib/tauri/files";
  import "./slideTheme.css";
  import {
    ChevronLeft,
    ChevronRight,
    Maximize,
    Minimize,
    NotebookText,
    X,
  } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import {
    NOTE_MARKER,
    splitNotes,
    splitSlides,
    type Slide,
  } from "../../lib/utils/slides";

  /** The live editor frame; its blocks are cloned so slides show exactly what is on screen. */
  export let source: HTMLElement | undefined;
  export let onClose: () => void;
  /** Space root; its `.slides/*.css` files are the themes to pick from. */
  export let root: string | null = null;

  const THEME_KEY = "memosmith.slidesTheme";

  let themes: { name: string; text: string }[] = [];
  let theme = "";
  try {
    theme = localStorage.getItem(THEME_KEY) ?? "";
  } catch {
    // Storage can be blocked; the default theme still works.
  }

  // Re-read on every open, so editing a theme file shows on the next run.
  onMount(() => {
    if (root) {
      void listSlideThemes(root)
        .then((found) => (themes = found))
        .catch(() => (themes = []));
    }
  });

  // A theme is plain CSS, injected unlayered so it beats the default layer.
  const themeStyle = document.head.appendChild(
    document.createElement("style"),
  );
  $: themeStyle.textContent =
    themes.find((candidate) => candidate.name === theme)?.text ?? "";
  $: try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Not remembered, nothing lost.
  }
  onDestroy(() => themeStyle.remove());

  /** Plays the theme's `--slide-leave` animation, however long it runs. */
  function leave(node: HTMLElement) {
    node.classList.add("is-leaving");
    const seconds = getComputedStyle(node)
      .animationDuration.split(",")
      .map(parseFloat);
    return { duration: Math.max(0, ...seconds) * 1000 };
  }

  let slides: Slide<Element>[] = [];
  let notesOpen = false;
  let index = 0;
  let direction = 1;

  onMount(() => {
    // ponytail: database portals float outside the block flow, so they are left out of slides.
    const container = source?.querySelector(".md-h1")?.parentElement;
    const blocks = Array.from(container?.children ?? []).filter(
      (block) =>
        !block.matches(
          ".md-block-toolbar, .md-block-drop-indicator, .md-tail-add, .md-database-portal",
        ),
    );

    slides = splitSlides(
      blocks,
      (block) => block.classList.contains("md-h1"),
      (block) => !block.textContent?.trim() && !block.querySelector("img, svg, canvas, iframe"),
    ).map((slide) =>
      splitNotes(slide, (block) => NOTE_MARKER.test(block.textContent ?? "")),
    );
  });

  let fullscreen = false;
  /** Whether the window was fullscreen before the deck, so closing restores it. */
  let wasFullscreen = false;

  onMount(() => {
    void getCurrentWindow()
      .isFullscreen()
      .then((value) => (fullscreen = wasFullscreen = value));
  });

  onDestroy(() => {
    if (fullscreen !== wasFullscreen) {
      void getCurrentWindow().setFullscreen(wasFullscreen);
    }
  });

  async function toggleFullscreen() {
    await getCurrentWindow().setFullscreen(!fullscreen);
    fullscreen = !fullscreen;
  }

  function go(next: number) {
    if (next < 0 || next >= slides.length || next === index) {
      return;
    }
    direction = next > index ? 1 : -1;
    index = next;
  }

  function handleKey(event: KeyboardEvent) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowDown: index + 1,
      PageDown: index + 1,
      " ": index + 1,
      ArrowLeft: index - 1,
      ArrowUp: index - 1,
      PageUp: index - 1,
      Home: 0,
      End: slides.length - 1,
    };

    if (event.key === "Escape") {
      onClose();
    } else if (event.key === "n" || event.key === "N") {
      notesOpen = !notesOpen;
    } else if (event.key === "f" || event.key === "F") {
      void toggleFullscreen();
    } else if (event.key in moves) {
      go(moves[event.key]);
    } else {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  /** Clones so the editor keeps its own nodes, and staggers each block's entrance. */
  function mount(node: HTMLElement, blocks: Element[]) {
    blocks.forEach((block, order) => {
      const copy = block.cloneNode(true) as HTMLElement;
      copy.removeAttribute("data-active");
      for (const editable of Array.from(copy.querySelectorAll("[contenteditable]"))) {
        (editable as HTMLElement).contentEditable = "false";
      }
      copy.contentEditable = "false";
      copy.classList.add("ms-slide-block");
      copy.style.setProperty("--slide-order", String(Math.min(order, 12)));
      node.append(copy);
    });
  }
</script>

<svelte:window onkeydown={handleKey} />

<div
  class="ms-slides"
  role="dialog"
  aria-modal="true"
  aria-label={$i18n.t("slides.title")}
  data-theme={theme || "default"}
  data-slide={index + 1}
  data-slides={slides.length}
  data-first={index === 0 || undefined}
  data-last={index === slides.length - 1 || undefined}
  data-direction={direction > 0 ? "forward" : "backward"}
  data-fullscreen={fullscreen || undefined}
  data-notes={notesOpen || undefined}
  style:--slide-direction={direction}
  transition:fade={{ duration: 180 }}
>
  <div class="ms-slides-backdrop" aria-hidden="true"></div>

  <div class="ms-slides-viewport">
    {#if !slides.length}
      <p class="ms-slides-empty">{$i18n.t("slides.empty")}</p>
    {/if}
    {#key index}
      {#if slides[index]}
        <div class="ms-slides-stage" out:leave>
          <article
            class="ms-slide"
            data-slide={index + 1}
            data-has-notes={slides[index].notes.length > 0 || undefined}
            use:mount={slides[index].content}
          ></article>
        </div>
      {/if}
    {/key}
  </div>

  {#if notesOpen}
    <aside
      class="ms-slides-notes"
      aria-label={$i18n.t("slides.notes")}
      transition:fly={{ y: 16, duration: 200, easing: cubicOut }}
    >
      {#key index}
        {#if slides[index]?.notes.length}
          <div use:mount={slides[index].notes}></div>
        {:else}
          <p>{$i18n.t("slides.noNotes")}</p>
        {/if}
      {/key}
    </aside>
  {/if}

  <footer class="ms-slides-bar">
    <button
      type="button"
      class="ms-slides-button"
      aria-label={$i18n.t("slides.previous")}
      disabled={index === 0}
      onclick={() => go(index - 1)}
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
    </button>
    <div class="ms-slides-track">
      <div
        class="ms-slides-progress"
        style:width="{slides.length ? ((index + 1) / slides.length) * 100 : 0}%"
      ></div>
    </div>
    <span class="ms-slides-counter">
      {slides.length ? index + 1 : 0} / {slides.length}
    </span>
    {#if themes.length}
      <select
        class="ms-slides-theme"
        aria-label={$i18n.t("slides.theme")}
        bind:value={theme}
      >
        <option value="">{$i18n.t("slides.defaultTheme")}</option>
        {#each themes as option (option.name)}
          <option value={option.name}>{option.name}</option>
        {/each}
      </select>
    {/if}
    <button
      type="button"
      class="ms-slides-button"
      aria-label={$i18n.t("slides.next")}
      disabled={index >= slides.length - 1}
      onclick={() => go(index + 1)}
    >
      <ChevronRight class="size-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="ms-slides-button"
      aria-label={$i18n.t("slides.toggleNotes")}
      title={$i18n.t("slides.toggleNotes")}
      aria-pressed={notesOpen}
      onclick={() => (notesOpen = !notesOpen)}
    >
      <NotebookText class="size-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="ms-slides-button"
      aria-label={$i18n.t("slides.fullscreen")}
      title={$i18n.t("slides.fullscreen")}
      aria-pressed={fullscreen}
      onclick={() => void toggleFullscreen()}
    >
      <svelte:component
        this={fullscreen ? Minimize : Maximize}
        class="size-4"
        aria-hidden="true"
      />
    </button>
    <button
      type="button"
      class="ms-slides-button"
      aria-label={$i18n.t("slides.close")}
      onclick={onClose}
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </footer>
</div>
