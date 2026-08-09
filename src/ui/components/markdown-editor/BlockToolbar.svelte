<script lang="ts">
  import { GripVertical, Plus } from "@lucide/svelte";
  import { i18n } from "../../../lib/i18n";

  export let top = 0;
  export let onAdd: () => void = () => {};
  export let onMenu: (event: MouseEvent) => void = () => {};
  export let onDragStart: (event: PointerEvent) => void = () => {};
  export let onHover: () => void = () => {};
</script>

<div
  class="md-block-toolbar"
  style={`top: ${top}px;`}
  contenteditable="false"
  role="toolbar"
  tabindex="-1"
  aria-label={$i18n.t("editor.blockControls")}
  onpointerenter={onHover}
  onpointermove={(event) => {
    event.stopPropagation();
    onHover();
  }}
>
  <button
    type="button"
    class="md-block-button"
    title={$i18n.t("editor.addBlockBelow")}
    aria-label={$i18n.t("editor.addBlockBelow")}
    onmousedown={(event) => event.preventDefault()}
    onclick={(event) => {
      event.stopPropagation();
      onAdd();
    }}
  >
    <Plus class="size-4" strokeWidth={1.8} aria-hidden="true" />
  </button>
  <button
    type="button"
    class="md-block-button md-block-grip"
    title={$i18n.t("editor.blockMenuDrag")}
    aria-label={$i18n.t("editor.blockMenuDrag")}
    onmousedown={(event) => event.preventDefault()}
    onclick={onMenu}
    onpointerdown={onDragStart}
  >
    <GripVertical class="size-4" strokeWidth={1.8} aria-hidden="true" />
  </button>
</div>
