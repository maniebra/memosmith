<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { i18n } from "../../lib/i18n";
  import Button from "./Button.svelte";

  /** Excalidraw scene as JSON; an empty string starts a blank canvas. */
  export let scene: string;
  export let onSave: (scene: string) => void;
  export let onClose: () => void;

  let host: HTMLDivElement | undefined;
  let root: any;
  let api: any = null;
  let error = "";

  function parseScene() {
    try {
      const parsed = JSON.parse(scene || "{}");

      return Array.isArray(parsed.elements) ? parsed : { elements: [] };
    } catch {
      return { elements: [] };
    }
  }

  onMount(async () => {
    // Fonts are copied into public/fonts by the `fonts` script; without this they load from a CDN,
    // which a desktop app cannot count on.
    (window as any).EXCALIDRAW_ASSET_PATH = "/";

    // Excalidraw is React, and heavy: only pulled in once a drawing is actually opened.
    const [{ createElement }, { createRoot }, excalidraw] = await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("@excalidraw/excalidraw"),
      import("@excalidraw/excalidraw/index.css"),
    ]);

    if (!host) {
      return;
    }

    const initial = parseScene();

    root = createRoot(host);
    root.render(
      createElement(excalidraw.Excalidraw, {
        theme: document.documentElement.classList.contains("dark")
          ? "dark"
          : "light",
        initialData: {
          elements: initial.elements,
          files: initial.files ?? null,
          appState: initial.appState ?? {},
        },
        excalidrawAPI: (instance: any) => (api = instance),
      }),
    );
  });

  onDestroy(() => root?.unmount());

  function save() {
    if (!api) {
      error = $i18n.t("modal.drawingLoading");
      return;
    }

    const elements = api.getSceneElements();
    const { viewBackgroundColor, gridSize } = api.getAppState();
    // Only the files the scene still references, so deleted images do not bloat the note.
    const used = new Set(
      elements.map((element: any) => element.fileId).filter(Boolean),
    );
    const files = Object.fromEntries(
      Object.entries(api.getFiles() ?? {}).filter(([id]) => used.has(id)),
    );

    onSave(
      JSON.stringify({
        elements,
        files,
        appState: { viewBackgroundColor, gridSize },
      }),
    );
  }
</script>

<svelte:window
  on:keydown={(event) => {
    if (event.key === "Escape") {
      onClose();
    }
  }}
/>

<div class="fixed inset-0 z-50 flex flex-col bg-stone-900/60 p-6">
  <div
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900"
  >
    <div
      class="flex items-center justify-between gap-3 border-b border-stone-200 px-4 py-2 dark:border-stone-700"
    >
      <span class="text-sm font-medium text-stone-700 dark:text-stone-200"
        >{$i18n.t("modal.drawing")}</span
      >
      {#if error}
        <span class="text-sm text-rose-500">{error}</span>
      {/if}
      <div class="flex gap-2">
        <Button
          label={$i18n.t("common.cancel")}
          variant="ghost"
          onClick={onClose}
        />
        <Button
          label={$i18n.t("common.save")}
          variant="primary"
          onClick={save}
        />
      </div>
    </div>
    <div class="min-h-0 flex-1" bind:this={host}></div>
  </div>
</div>
