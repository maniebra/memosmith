<script lang="ts">
  import { i18n } from "../../lib/i18n";
  import Self from "./TilePane.svelte";
  import type { TileNode, TileSplit } from "../../lib/utils/tiling";

  export let node: TileNode;
  /** Renders one pane; `id` is null for the main (active tab) pane. */
  export let pane: any;
  export let onRatio: (split: TileSplit, ratio: number) => void;
  export let onDrop: (
    target: string | null,
    zone: { axis: "row" | "column"; side: "start" | "end" } | null,
    id: string,
  ) => void;

  const tabDragType = "application/x-memosmith-tab";
  /** Drag snaps to these once it is within 3% of one. */
  const stops = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];

  let element: HTMLElement | undefined;
  let dropZone: { axis: "row" | "column"; side: "start" | "end" } | null =
    null;
  let dropCenter = false;

  const clamp = (ratio: number) => Math.min(0.8, Math.max(0.2, ratio));

  const snap = (ratio: number) =>
    stops.find((stop) => Math.abs(stop - ratio) < 0.03) ?? ratio;

  const offsetIn = (rect: DOMRect, event: PointerEvent, axis: string) =>
    axis === "column"
      ? (event.clientY - rect.top) / rect.height
      : ($i18n.dir === "rtl"
          ? rect.right - event.clientX
          : event.clientX - rect.left) / rect.width;

  function startDrag(event: PointerEvent, split: TileSplit) {
    event.preventDefault();
    const rect = element?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const move = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      onRatio(split, snap(clamp(offsetIn(rect, moveEvent, split.axis))));
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  }

  /** Shift + arrow jumps to the neighbouring snap stop. */
  function nextStop(ratio: number, direction: number) {
    const found = stops.findIndex((stop) => stop >= ratio - 0.001);
    const current = found === -1 ? stops.length : found;
    return stops[
      Math.min(
        stops.length - 1,
        Math.max(0, current + (direction > 0 ? 1 : -1)),
      )
    ];
  }

  function keyResize(event: KeyboardEvent, split: TileSplit) {
    const forward = split.axis === "column" ? "ArrowDown" : "ArrowRight";
    const back = split.axis === "column" ? "ArrowUp" : "ArrowLeft";
    if (event.key !== forward && event.key !== back) {
      return;
    }
    event.preventDefault();
    const direction =
      (event.key === forward ? 1 : -1) *
      (split.axis === "row" && $i18n.dir === "rtl" ? -1 : 1);
    onRatio(
      split,
      event.shiftKey
        ? nextStop(split.ratio, direction)
        : clamp(split.ratio + direction * 0.02),
    );
  }

  /** The edge the pointer is nearest wins; the middle drops into the pane. */
  function zoneAt(event: DragEvent) {
    if (!element) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    const across =
      $i18n.dir === "rtl"
        ? (rect.right - event.clientX) / rect.width
        : (event.clientX - rect.left) / rect.width;
    const down = (event.clientY - rect.top) / rect.height;
    const edges = [
      { axis: "row" as const, side: "start" as const, distance: across },
      { axis: "row" as const, side: "end" as const, distance: 1 - across },
      { axis: "column" as const, side: "start" as const, distance: down },
      { axis: "column" as const, side: "end" as const, distance: 1 - down },
    ].sort((a, b) => a.distance - b.distance);
    return edges[0].distance < 0.25
      ? { axis: edges[0].axis, side: edges[0].side }
      : null;
  }

  function leafDragOver(event: DragEvent) {
    if (!event.dataTransfer?.types.includes(tabDragType)) {
      return;
    }
    event.preventDefault();
    dropZone = zoneAt(event);
    dropCenter = !dropZone;
  }

  function leafDrop(event: DragEvent) {
    const zone = dropZone;
    const center = dropCenter;
    dropZone = null;
    dropCenter = false;
    if (!event.dataTransfer?.types.includes(tabDragType)) {
      return;
    }
    const id = event.dataTransfer.getData(tabDragType);
    if (!id || (!zone && !center)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onDrop(node.kind === "leaf" ? node.id : null, zone, id);
  }
</script>

{#if node.kind === "leaf"}
  <div
    class="relative flex min-h-0 min-w-0 flex-1"
    bind:this={element}
    role="presentation"
    ondragover={leafDragOver}
    ondragleave={(event) => {
      if (!element?.contains(event.relatedTarget as Node | null)) {
        dropZone = null;
        dropCenter = false;
      }
    }}
    ondrop={leafDrop}
  >
    {@render pane(node.id)}
    {#if dropZone || dropCenter}
      <div
        class="pointer-events-none absolute z-20 bg-emerald-500/20 ring-2 ring-emerald-500/50 ring-inset"
        style={dropCenter
          ? "inset: 0"
          : dropZone?.axis === "row"
            ? `inset-block: 0; inset-inline-${dropZone.side}: 0; width: 50%`
            : `inset-inline: 0; ${
                dropZone?.side === "start" ? "top" : "bottom"
              }: 0; height: 50%`}
      ></div>
    {/if}
  </div>
{:else}
  <div
    class="flex min-h-0 min-w-0 flex-1"
    class:flex-col={node.axis === "column"}
    bind:this={element}
  >
    <div
      class="flex min-h-0 min-w-0"
      style={`flex: ${node.ratio} 1 0%`}
    >
      <Self node={node.start} {pane} {onRatio} {onDrop} />
    </div>
    <button
      type="button"
      class="z-10 shrink-0 border-0 bg-transparent p-0 transition-colors hover:bg-emerald-600/20 focus-visible:bg-emerald-600/20 focus-visible:outline-none"
      class:w-1.5={node.axis === "row"}
      class:cursor-col-resize={node.axis === "row"}
      class:h-1.5={node.axis === "column"}
      class:cursor-row-resize={node.axis === "column"}
      aria-label={$i18n.t("tabs.splitResize")}
      title={$i18n.t("tabs.splitResize")}
      onpointerdown={(event) => startDrag(event, node)}
      onkeydown={(event) => keyResize(event, node)}
      ondblclick={() => onRatio(node, 0.5)}
    ></button>
    <div
      class="flex min-h-0 min-w-0 border-stone-200/70 dark:border-stone-800"
      class:border-s={node.axis === "row"}
      class:border-t={node.axis === "column"}
      style={`flex: ${1 - node.ratio} 1 0%`}
    >
      <Self node={node.end} {pane} {onRatio} {onDrop} />
    </div>
  </div>
{/if}
