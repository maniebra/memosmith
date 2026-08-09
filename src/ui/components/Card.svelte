<script lang="ts">
  import { cn } from "../../lib/utils/cn";

  export let title = "";
  export let description = "";
  export let className = "";
</script>

<section
  class={cn(
    "rounded-lg border border-stone-300 bg-stone-50 p-4 shadow-sm dark:border-stone-800 dark:bg-stone-900",
    className,
  )}
>
  {#if title || description}
    <header class="mb-4">
      {#if title}
        <h2
          class="m-0 text-base font-semibold text-stone-950 dark:text-stone-50"
        >
          {title}
        </h2>
      {/if}

      {#if description}
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {description}
        </p>
      {/if}
    </header>
  {/if}

  <slot />
</section>
