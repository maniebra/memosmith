<script lang="ts">
  import { cn } from "../../../lib/utils/cn";
  import type { DecorationBox } from "./types";

  export let boxes: DecorationBox[] = [];
</script>

{#if boxes.length}
  <div class="pointer-events-none absolute inset-0" aria-hidden="true">
    {#each boxes as box}
      <span
        class={cn(
          "absolute border-b-2",
          box.tone === "mistake"
            ? "border-rose-500/80 bg-rose-500/5"
            : "border-amber-500/80 bg-amber-500/5",
        )}
        style={`left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px;`}
      ></span>
    {/each}
  </div>
{/if}
