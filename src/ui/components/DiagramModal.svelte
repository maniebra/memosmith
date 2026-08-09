<script lang="ts">
  import { onDestroy } from "svelte";
  import { i18n } from "../../lib/i18n";
  import Button from "./Button.svelte";

  /** draw.io diagram as JSON: `xml` is the source of truth, `svg` is the cached thumbnail. */
  export let diagram: string;
  export let onSave: (diagram: string) => void;
  export let onClose: () => void;

  let frame: HTMLIFrameElement | undefined;
  let xml = "";
  let error = "";

  const dark = document.documentElement.classList.contains("dark");
  const source = `https://embed.diagrams.net/?embed=1&proto=json&spin=1&libraries=1&noSaveBtn=1&noExitBtn=1&dark=${dark ? 1 : 0}`;

  try {
    xml = (JSON.parse(diagram || "{}") as { xml?: string }).xml ?? "";
  } catch {
    xml = "";
  }

  function post(message: unknown) {
    frame?.contentWindow?.postMessage(JSON.stringify(message), "*");
  }

  function handleMessage(event: MessageEvent) {
    if (event.source !== frame?.contentWindow || typeof event.data !== "string") {
      return;
    }

    let message: any;

    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.event === "init") {
      // Autosave keeps the latest XML in hand, so saving only has to wait on the SVG export.
      post({ action: "load", xml, autosave: 1 });
      return;
    }

    if (message.event === "autosave" || message.event === "save") {
      xml = message.xml ?? xml;
      return;
    }

    if (message.event === "export") {
      const svg = message.data?.startsWith("data:image/svg+xml;base64,")
        ? atob(message.data.slice("data:image/svg+xml;base64,".length))
        : "";

      onSave(JSON.stringify({ xml, svg }));
      return;
    }

    if (message.event === "exit") {
      onClose();
    }
  }

  onDestroy(() => window.removeEventListener("message", handleMessage));
  window.addEventListener("message", handleMessage);

  function save() {
    if (!frame?.contentWindow) {
      error = $i18n.t("modal.diagramLoading");
      return;
    }

    post({ action: "export", format: "xmlsvg", background: "none" });
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
      <span class="text-sm font-medium text-stone-700 dark:text-stone-200">{$i18n.t("modal.diagram")}</span>
      {#if error}
        <span class="text-sm text-rose-500">{error}</span>
      {/if}
      <div class="flex gap-2">
        <Button label={$i18n.t("common.cancel")} variant="ghost" onClick={onClose} />
        <Button label={$i18n.t("common.save")} variant="primary" onClick={save} />
      </div>
    </div>
    <iframe class="min-h-0 flex-1 border-0" title={$i18n.t("modal.diagramEditor")} src={source} bind:this={frame}
    ></iframe>
  </div>
</div>
