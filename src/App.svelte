<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import EditorPage from "./ui/pages/EditorPage.svelte";
  import ConfirmDialog from "./ui/components/ConfirmDialog.svelte";
  import {
    handleGlobalKeydown,
    registerKeybindings,
    type Keybinding,
  } from "./lib/utils/keybindings";

  const ZOOM_KEY = "app.zoom";
  const ZOOM_STEPS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

  let zoom = Number(localStorage.getItem(ZOOM_KEY)) || 1;

  function applyZoom(next: number) {
    zoom = next;
    localStorage.setItem(ZOOM_KEY, String(next));
    void getCurrentWebview().setZoom(next);
  }

  function stepZoom(direction: -1 | 1) {
    // A zoom off the ladder (an old stored value) snaps to the nearest step.
    const nearest = ZOOM_STEPS.reduce((best, step) =>
      Math.abs(step - zoom) < Math.abs(best - zoom) ? step : best,
    );
    const next = ZOOM_STEPS.indexOf(nearest) + direction;
    applyZoom(ZOOM_STEPS[Math.min(Math.max(next, 0), ZOOM_STEPS.length - 1)]);
  }

  async function toggleFullscreen() {
    const appWindow = getCurrentWindow();
    await appWindow.setFullscreen(!(await appWindow.isFullscreen()));
  }

  const appKeybindings: Keybinding[] = [
    {
      combination: "mod+=",
      type: "combinational",
      name: "app.zoomIn",
      description: "Scale the whole app up one step.",
      action: (event) => {
        event.preventDefault();
        stepZoom(1);
      },
    },
    {
      combination: "mod+-",
      type: "combinational",
      name: "app.zoomOut",
      description: "Scale the whole app down one step.",
      action: (event) => {
        event.preventDefault();
        stepZoom(-1);
      },
    },
    {
      combination: "mod+0",
      type: "combinational",
      name: "app.zoomReset",
      description: "Reset the app scale to 100%.",
      action: (event) => {
        event.preventDefault();
        applyZoom(1);
      },
    },
    {
      combination: "ctrl+f11",
      type: "combinational",
      name: "app.fullscreen",
      description: "Toggle the window between full screen and windowed.",
      action: (event) => {
        event.preventDefault();
        void toggleFullscreen();
      },
    },
  ];

  onMount(() => {
    if (zoom !== 1) {
      applyZoom(zoom);
    }

    return registerKeybindings(appKeybindings);
  });

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
