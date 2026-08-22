<script lang="ts">
  import EditorPage from "./ui/pages/EditorPage.svelte";
  import ConfirmDialog from "./ui/components/ConfirmDialog.svelte";
  import { handleGlobalKeydown } from "./lib/utils/keybindings";

  function isEditable(node: EventTarget | null): boolean {
    const el = node as HTMLElement | null;
    return !!el?.closest?.(
      "input, textarea, [contenteditable]:not([contenteditable='false'])",
    );
  }

  // Ctrl/Cmd+A outside a text field would select the whole app chrome.
  function onKeydown(event: KeyboardEvent) {
    handleGlobalKeydown(event);

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "a" &&
      !isEditable(event.target)
    ) {
      event.preventDefault();
    }
  }
</script>

<svelte:window
  on:keydown|capture={onKeydown}
  on:contextmenu={(e) => e.preventDefault()}
/>

<EditorPage />
<ConfirmDialog />
