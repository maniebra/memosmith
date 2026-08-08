<script lang="ts">
  import { Link2 } from "@lucide/svelte";
  import type { Backlink } from "../../lib/utils/wikilinks";

  export let backlinks: Backlink[] = [];
  export let onSelect: (relativePath: string) => void | Promise<void>;
</script>

<section class="mt-14 border-t border-stone-200/70 pt-5 dark:border-stone-800">
  <div class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">
    <Link2 class="size-3.5" strokeWidth={1.8} aria-hidden="true" />
    <span>Backlinks</span>
    <span class="rounded bg-stone-500/10 px-1.5 py-0.5 text-[0.65rem] leading-none">
      {backlinks.length}
    </span>
  </div>

  {#if backlinks.length}
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
                  +{backlink.matches.length - 2} more
                </span>
              {/if}
            </span>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="text-sm text-stone-400">No backlinks yet.</p>
  {/if}
</section>
