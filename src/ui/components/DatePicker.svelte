<script lang="ts">
  import { onMount } from "svelte";
  import { CalendarDays, ChevronLeft, ChevronRight } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import { portal } from "../../lib/utils/portal";
  import {
    addMonths,
    dateFromIso,
    isoDate,
    monthDays,
    startOfMonth,
    weekdayLabels,
  } from "../../lib/utils/calendarMonth";

  /** `YYYY-MM-DD`, or empty for no date. */
  export let value = "";
  export let placeholder = "";
  export let className = "";
  export let rootClassName = "w-full";
  export let ariaLabel = "";
  export let onChange: (value: string) => void = () => {};

  const pickerId = Math.random().toString(36).slice(2);
  const today = new Date();
  let open = false;
  let root: HTMLDivElement;
  /** Fixed placement, so a scrolling or clipping ancestor cannot cut the panel off. */
  let panel = { left: 0, top: 0 };
  /** The portalled panel, so an outside-click test still recognises it. */
  let panelElement: HTMLElement | undefined;

  /** An empty cell shows nothing and selects nothing; today only sets where browsing starts. */
  $: selected = dateFromIso(value);
  $: label = selected ? selected.toLocaleDateString() : "";
  let month = startOfMonth(today);
  $: if (!open) {
    month = startOfMonth(selected ?? today);
  }
  $: days = monthDays(month);
  const weekdays = weekdayLabels();

  onMount(() => {
    function handlePickerOpened(event: Event) {
      if ((event as CustomEvent<string>).detail !== pickerId) {
        close();
      }
    }

    function handleWindowPointerDown(event: PointerEvent) {
      if (!open) {
        return;
      }
      const target = event.target;
      const inside =
        target instanceof Node &&
        (root.contains(target) || panelElement?.contains(target));
      if (!inside) {
        close();
      }
    }

    /** The panel's own scrolling must not count as the page moving under it. */
    function handleScroll(event: Event) {
      const target = event.target;
      if (!(target instanceof Node) || !panelElement?.contains(target)) {
        close();
      }
    }

    // Capture phase: inner scroll containers do not bubble their scroll events.
    window.addEventListener("pointerdown", handleWindowPointerDown, true);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("memosmith:select-opened", handlePickerOpened);

    return () => {
      window.removeEventListener("pointerdown", handleWindowPointerDown, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("memosmith:select-opened", handlePickerOpened);
    };
  });

  function close() {
    open = false;
  }

  function place() {
    const bounds = root.getBoundingClientRect();
    const height = 300;
    const below = window.innerHeight - bounds.bottom - 8;
    panel = {
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - 264)),
      top:
        below < height && bounds.top > height
          ? bounds.top - height - 4
          : bounds.bottom + 4,
    };
  }

  function toggle() {
    if (open) {
      close();
      return;
    }
    place();
    open = true;
    // Selects and pickers share the channel, so only one popup is ever open.
    window.dispatchEvent(
      new CustomEvent("memosmith:select-opened", { detail: pickerId }),
    );
  }

  function choose(date: Date) {
    value = isoDate(date);
    onChange(value);
    close();
  }

  function clear() {
    value = "";
    onChange("");
    close();
  }
</script>

<svelte:window
  onkeydown={(event) => open && event.key === "Escape" && close()}
/>

<div bind:this={root} class={cn("relative", rootClassName)}>
  <button
    type="button"
    aria-haspopup="dialog"
    aria-expanded={open}
    aria-label={ariaLabel || undefined}
    class={cn(
      "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm",
      "text-stone-800 focus-visible:outline-none focus-visible:ring-2",
      "focus-visible:ring-emerald-700/30 dark:text-stone-100",
      className,
    )}
    onclick={(event) => {
      event.stopPropagation();
      toggle();
    }}
  >
    <CalendarDays
      class="size-3.5 shrink-0 text-stone-400"
      strokeWidth={1.8}
      aria-hidden="true"
    />
    <span class={cn("truncate", !label && "text-stone-400")}>
      {label || placeholder || $i18n.t("database.emptyCell")}
    </span>
  </button>

  {#if open}
    <div
      bind:this={panelElement}
      use:portal
      class="fixed z-50 w-64 rounded-lg border border-stone-200/70 bg-white p-2 shadow-[0_10px_38px_-10px_rgba(22,23,24,0.35),0_10px_20px_-15px_rgba(22,23,24,0.2)] dark:border-white/10 dark:bg-stone-900"
      style="left: {panel.left}px; top: {panel.top}px;"
      role="dialog"
      aria-label={ariaLabel || $i18n.t("database.columnDate")}
    >
      <div class="flex items-center justify-between px-1 pb-1">
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10"
          aria-label={$i18n.t("database.previousMonth")}
          onclick={() => (month = addMonths(month, -1))}
        >
          <ChevronLeft class="size-4" strokeWidth={1.8} aria-hidden="true" />
        </button>
        <span class="text-xs font-medium text-stone-700 dark:text-stone-200">
          {month.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          })}
        </span>
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded-md text-stone-400 hover:bg-stone-500/10"
          aria-label={$i18n.t("database.nextMonth")}
          onclick={() => (month = addMonths(month, 1))}
        >
          <ChevronRight class="size-4" strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      <div class="grid grid-cols-7 gap-0.5">
        {#each weekdays as weekday, index (index)}
          <span class="py-1 text-center text-[0.625rem] text-stone-400"
            >{weekday}</span
          >
        {/each}
        {#each days as date (date.getTime())}
          <button
            type="button"
            class={cn(
              "flex h-7 items-center justify-center rounded-md text-xs",
              date.getMonth() === month.getMonth()
                ? "text-stone-700 dark:text-stone-200"
                : "text-stone-400/70",
              isoDate(date) === isoDate(today) &&
                "font-medium text-emerald-700 dark:text-emerald-300",
              isoDate(date) === value
                ? "bg-emerald-600/20 font-medium text-emerald-800 dark:text-emerald-200"
                : "hover:bg-stone-500/10",
            )}
            aria-current={isoDate(date) === value ? "date" : undefined}
            onclick={() => choose(date)}
          >
            {date.getDate()}
          </button>
        {/each}
      </div>

      <div
        class="mt-1 flex justify-between border-t border-stone-200/70 pt-1 dark:border-stone-700/70"
      >
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10"
          onclick={() => choose(today)}>{$i18n.t("database.today")}</button
        >
        <button
          type="button"
          class="rounded-md px-2 py-1 text-xs text-stone-500 hover:bg-stone-500/10 disabled:opacity-40"
          disabled={!value}
          onclick={clear}>{$i18n.t("common.clear")}</button
        >
      </div>
    </div>
  {/if}
</div>
