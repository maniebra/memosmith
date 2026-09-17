<script lang="ts">
  import { i18n } from "../../lib/i18n";
  import { confirmRequest, settleConfirm } from "../../lib/utils/confirm";
  import Button from "./Button.svelte";

  let dialog: HTMLDivElement | undefined;

  function handleKey(event: KeyboardEvent) {
    if (!$confirmRequest) {
      return;
    }

    if (event.key === "Escape") {
      settleConfirm(false);
    } else if (event.key === "Enter") {
      settleConfirm(true);
    }
  }

  // The dialog is the only thing the keyboard should reach while it is open.
  $: if ($confirmRequest && dialog) {
    dialog.focus();
  }
</script>

<svelte:window on:keydown={handleKey} />

{#if $confirmRequest}
  <div
    class="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/50 p-4"
    role="presentation"
    onclick={(event) => {
      if (event.target === event.currentTarget) {
        settleConfirm(false);
      }
    }}
  >
    <div
      bind:this={dialog}
      class="w-full max-w-sm rounded-xl border border-stone-200 bg-surface p-4 shadow-xl outline-none dark:border-stone-700 dark:bg-stone-900"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ms-confirm-title"
      aria-describedby="ms-confirm-message"
      tabindex="-1"
    >
      <h2
        id="ms-confirm-title"
        class="text-sm font-semibold text-stone-800 dark:text-stone-100"
      >
        {$confirmRequest.title}
      </h2>
      <p
        id="ms-confirm-message"
        class="mt-2 text-sm break-words text-stone-600 dark:text-stone-300"
      >
        {$confirmRequest.message}
      </p>
      <div class="mt-4 flex justify-end gap-2">
        <Button
          label={$i18n.t("common.cancel")}
          onClick={() => settleConfirm(false)}
          size="sm"
        />
        <Button
          label={$confirmRequest.confirmLabel ?? $i18n.t("common.confirm")}
          onClick={() => settleConfirm(true)}
          variant="primary"
          size="sm"
          className={$confirmRequest.danger
            ? "border-rose-600 bg-rose-600 hover:bg-rose-700 dark:border-rose-600 dark:bg-rose-600 dark:hover:bg-rose-500"
            : ""}
        />
      </div>
    </div>
  </div>
{/if}
