<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { cubicOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
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
      copy.style.setProperty("--ms-slide-order", String(Math.min(order, 12)));
      node.append(copy);
    });
  }
</script>

<svelte:window onkeydown={handleKey} />

<div
  class="ms-slides fixed inset-0 z-[60] grid grid-rows-[1fr_auto_auto] overflow-hidden bg-canvas text-stone-800 dark:text-stone-100"
  role="dialog"
  aria-modal="true"
  aria-label={$i18n.t("slides.title")}
  transition:fade={{ duration: 180 }}
>
  <div
    class="ms-slides-glow pointer-events-none absolute inset-0"
    aria-hidden="true"
  ></div>

  <div class="relative grid min-h-0 place-items-center overflow-hidden">
    {#if !slides.length}
      <p class="text-sm text-stone-500">{$i18n.t("slides.empty")}</p>
    {/if}
    {#key index}
      {#if slides[index]}
        <div
          class="col-start-1 row-start-1 flex max-h-full w-full justify-center overflow-y-auto px-10 py-16"
          in:fly={{ x: 80 * direction, duration: 420, easing: cubicOut }}
          out:fly={{ x: -80 * direction, duration: 260, easing: cubicOut }}
        >
          <article
            class="ms-slide my-auto w-full max-w-4xl"
            use:mount={slides[index].content}
          ></article>
        </div>
      {/if}
    {/key}
  </div>

  {#if notesOpen}
    <aside
      class="relative mx-6 mb-3 max-h-[30vh] overflow-y-auto rounded-lg border border-stone-500/15 bg-stone-500/5 px-5 py-3 text-sm"
      aria-label={$i18n.t("slides.notes")}
      transition:fly={{ y: 16, duration: 200, easing: cubicOut }}
    >
      {#key index}
        {#if slides[index]?.notes.length}
          <div class="ms-slide-notes" use:mount={slides[index].notes}></div>
        {:else}
          <p class="text-stone-500">{$i18n.t("slides.noNotes")}</p>
        {/if}
      {/key}
    </aside>
  {/if}

  <footer
    class="relative flex items-center gap-3 px-6 pb-5 text-xs text-stone-500"
  >
    <button
      type="button"
      class="grid size-8 place-items-center rounded-md transition-colors hover:bg-stone-500/10 disabled:opacity-30"
      aria-label={$i18n.t("slides.previous")}
      disabled={index === 0}
      onclick={() => go(index - 1)}
    >
      <ChevronLeft class="size-4" aria-hidden="true" />
    </button>
    <div class="h-1 flex-1 overflow-hidden rounded-full bg-stone-500/15">
      <div
        class="h-full rounded-full bg-[var(--ms-accent-color)] transition-[width] duration-500 ease-out"
        style:width="{slides.length ? ((index + 1) / slides.length) * 100 : 0}%"
      ></div>
    </div>
    <span class="w-12 text-center tabular-nums">
      {slides.length ? index + 1 : 0} / {slides.length}
    </span>
    <button
      type="button"
      class="grid size-8 place-items-center rounded-md transition-colors hover:bg-stone-500/10 disabled:opacity-30"
      aria-label={$i18n.t("slides.next")}
      disabled={index >= slides.length - 1}
      onclick={() => go(index + 1)}
    >
      <ChevronRight class="size-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="grid size-8 place-items-center rounded-md transition-colors hover:bg-stone-500/10"
      aria-label={$i18n.t("slides.toggleNotes")}
      title={$i18n.t("slides.toggleNotes")}
      aria-pressed={notesOpen}
      onclick={() => (notesOpen = !notesOpen)}
    >
      <NotebookText class="size-4" aria-hidden="true" />
    </button>
    <button
      type="button"
      class="grid size-8 place-items-center rounded-md transition-colors hover:bg-stone-500/10"
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
      class="grid size-8 place-items-center rounded-md transition-colors hover:bg-stone-500/10"
      aria-label={$i18n.t("slides.close")}
      onclick={onClose}
    >
      <X class="size-4" aria-hidden="true" />
    </button>
  </footer>
</div>

<style>
  .ms-slides-glow {
    background:
      radial-gradient(
        60rem 40rem at 85% -10%,
        rgb(var(--ms-accent-soft-rgb) / 0.14),
        transparent 60%
      ),
      radial-gradient(
        50rem 30rem at -10% 110%,
        rgb(var(--ms-accent-rgb) / 0.1),
        transparent 60%
      );
  }

  /* The editor's type is sized in rem, so zoom scales a whole slide up. */
  .ms-slide {
    zoom: 1.35;
    font-family: var(--ms-editor-font);
    line-height: var(--ms-editor-line-height);
  }

  .ms-slide :global(.ms-slide-block) {
    animation: ms-slide-rise 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(120ms + var(--ms-slide-order) * 45ms);
  }

  /* Notes are read, not presented: no entrance, no slide-sized headings. */
  .ms-slide-notes :global(.md-block) {
    margin: 0;
    font-size: inherit;
  }

  .ms-slide :global(.md-h1) {
    margin-top: 0;
    margin-bottom: 1.25rem;
    font-size: 2.75rem;
  }

  .ms-slide :global(.md-h1)::after {
    content: "";
    display: block;
    width: 3.5rem;
    height: 0.25rem;
    margin-top: 0.75rem;
    border-radius: 999px;
    background: linear-gradient(
      90deg,
      var(--ms-accent-color),
      var(--ms-accent-soft)
    );
    animation: ms-slide-bar 700ms 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
    transform-origin: left;
  }

  :global([dir="rtl"]) .ms-slide :global(.md-h1)::after {
    transform-origin: right;
  }

  @keyframes ms-slide-rise {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  @keyframes ms-slide-bar {
    from {
      transform: scaleX(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ms-slide :global(.ms-slide-block),
    .ms-slide :global(.md-h1)::after {
      animation: none;
    }
  }
</style>
