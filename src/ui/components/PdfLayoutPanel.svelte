<script lang="ts">
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import Select from "./Select.svelte";
  import Switch from "./Switch.svelte";
  import {
    headlessPdf,
    margins,
    papers,
    type MarginName,
    type PaperName,
    type PdfLayout,
  } from "../../lib/tauri/pdf";

  export let layout: PdfLayout;

  const segment =
    "rounded-md text-[0.8125rem] font-medium transition-colors active:scale-[0.98]";
  const selected =
    "bg-surface text-stone-900 shadow-sm dark:bg-stone-700 dark:text-stone-100";
  const idle =
    "text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100";
  const heading = "text-sm font-medium text-stone-900 dark:text-stone-100";
  const track = "grid gap-1 rounded-lg bg-stone-100 p-1 dark:bg-stone-800";
  const divider =
    "grid gap-3 border-t border-stone-200 pt-5 dark:border-stone-800";

  function size(paper: PaperName) {
    return `${papers[paper].width} x ${papers[paper].height}`;
  }

  function set(patch: Partial<PdfLayout>) {
    layout = { ...layout, ...patch };
  }

  $: paperOptions = (Object.keys(papers) as PaperName[]).map((value) => ({
    value,
    label: `${$i18n.t(`pdf.paper.${value}`)} (${size(value)} mm)`,
  }));
  $: marginOptions = (Object.keys(margins) as MarginName[]).map((value) => ({
    value,
    label: $i18n.t(`pdf.margin.${value}`),
  }));
</script>

<section class="grid gap-3">
  <h3 class={heading}>{$i18n.t("pdf.page")}</h3>
  <Select
    value={layout.paper}
    options={paperOptions}
    ariaLabel={$i18n.t("pdf.paperSize")}
    onChange={(value) => set({ paper: value as PaperName })}
  />
  <div
    class={cn(track, "grid-cols-2")}
    role="group"
    aria-label={$i18n.t("pdf.orientation")}
  >
    {#each [false, true] as landscape (landscape)}
      <button
        type="button"
        class={cn(
          segment,
          "flex h-8 items-center justify-center gap-2",
          layout.landscape === landscape ? selected : idle,
        )}
        aria-pressed={layout.landscape === landscape}
        onclick={() => set({ landscape })}
      >
        <!-- A tiny sheet in the chosen orientation. -->
        <span
          class={cn(
            "rounded-[2px] border-[1.5px] border-current",
            landscape ? "h-2.5 w-3.5" : "h-3.5 w-2.5",
          )}
          aria-hidden="true"
        ></span>
        {$i18n.t(landscape ? "pdf.landscape" : "pdf.portrait")}
      </button>
    {/each}
  </div>
</section>

<section class={divider}>
  <h3 class={heading}>{$i18n.t("pdf.margins")}</h3>
  <div
    class={cn(track, "grid-cols-4")}
    role="group"
    aria-label={$i18n.t("pdf.margins")}
  >
    {#each marginOptions as option (option.value)}
      <button
        type="button"
        class={cn(
          segment,
          "h-8",
          layout.margin === option.value ? selected : idle,
        )}
        aria-pressed={layout.margin === option.value}
        onclick={() => set({ margin: option.value })}
      >
        {option.label}
      </button>
    {/each}
  </div>
</section>

<section class={divider}>
  <h3 class={heading}>{$i18n.t("pdf.headerFooter")}</h3>
  {#if headlessPdf}
    <Switch
      label={$i18n.t("pdf.titleHeader")}
      checked={layout.header}
      onChange={(header) => set({ header })}
    />
    <Switch
      label={$i18n.t("pdf.pageNumbers")}
      checked={layout.pageNumbers}
      onChange={(pageNumbers) => set({ pageNumbers })}
    />
  {:else}
    <p
      class="text-[0.8125rem] leading-relaxed text-stone-500 dark:text-stone-400"
    >
      {$i18n.t("pdf.headerFooterDialog")}
    </p>
  {/if}
</section>
