<script lang="ts">
  import { i18n } from "../../../lib/i18n";
  import type { AppSettings } from "../../../lib/storage/settings";
  import Switch from "../../components/Switch.svelte";
  import { updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;
</script>

<div class="grid w-full max-w-xl gap-4">
  <Switch
    checked={settings.gpuRendering}
    label={$i18n.t("advanced.gpuRendering")}
    onChange={(gpuRendering) =>
      updateSettings(settings, onChange, { gpuRendering })}
  />
</div>
