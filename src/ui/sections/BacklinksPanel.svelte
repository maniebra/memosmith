<script lang="ts">
  import { ChevronDown, Link2, X } from "@lucide/svelte";
  import { i18n } from "../../lib/i18n";
  import { cn } from "../../lib/utils/cn";
  import type { Backlink } from "../../lib/utils/wikilinks";

  export let backlinks: Backlink[] = [];
  export let onSelect: (relativePath: string) => void | Promise<void>;
  export let onClose: (() => void) | null = null;
  export let className = "";

  let open = false;
</script>

<section class={cn("relative text-stone-700 dark:text-stone-200", className)}>
  <button
    type="button"
    class="mb-3 flex w-full items-center gap-2 rounded-md py-1 pr-8 text-left text-xs font-semibold tracking-wide text-stone-500 uppercase transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-400 dark:hover:text-stone-200"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <ChevronDown
      class={cn("size-3.5 transition-transform", !open && "-rotate-90")}
      strokeWidth={1.8}
      aria-hidden="true"
    />
    <Link2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
    <span>{$i18n.t("backlinks.title")}</span>
    <span class="ml-auto rounded bg-stone-500/10 px-1.5 py-0.5 text-[0.65rem] leading-none">
      {backlinks.length}
    </span>
  </button>

  {#if onClose}
    <button
      type="button"
      class="absolute top-5 right-4 grid size-7 place-items-center rounded text-stone-400 transition-colors hover:bg-stone-200/70 hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:text-stone-500 dark:hover:bg-stone-800 dark:hover:text-stone-100"
      title={$i18n.t("toolbar.hideBacklinks")}
      aria-label={$i18n.t("toolbar.hideBacklinks")}
      onclick={onClose}
    >
      <X class="size-4" strokeWidth={1.8} aria-hidden="true" />
    </button>
  {/if}

  {#if open}
    <ul class="grid gap-2">
      {#each backlinks as backlink (backlink.path)}
        <li>
          <button
            type="button"
            class="w-full rounded-md border border-stone-200 bg-white/70 px-3 py-2 text-left transition-colors hover:border-emerald-600/30 hover:bg-emerald-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/25 dark:border-stone-800 dark:bg-stone-900/45 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-950/20"
            onclick={() => onSelect(backlink.path)}
          >
            <span class="block truncate text-sm font-medium text-stone-800 dark:text-stone-200">
              {backlink.title}
            </span>
            <span class="mt-1 grid gap-1">
              {#each backlink.matches.slice(0, 2) as match}
                <span class="block truncate text-xs text-stone-500 dark:text-stone-400">
                  {match.line}: {match.snippet}
                </span>
              {/each}
              {#if backlink.matches.length > 2}
                <span class="text-xs text-stone-400">
                  +{backlink.matches.length - 2} {$i18n.t("common.more")}
                </span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
