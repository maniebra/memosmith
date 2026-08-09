<script lang="ts">
  import { i18n } from "../../../lib/i18n";
  import type { AppSettings } from "../../../lib/storage/settings";
  import { REASONING_LEVELS } from "../../../lib/utils/llmOptions";
  import Input from "../../components/Input.svelte";
  import Select, { type SelectOption } from "../../components/Select.svelte";
  import TextArea from "../../components/TextArea.svelte";
  import { updateSettings } from "./settingsHelpers";

  export let settings: AppSettings;
  export let onChange: (settings: AppSettings) => void;

  const compactSelectRoot = "w-full sm:w-56";
  const samplingFields: {
    key: keyof AppSettings["llm"];
    label: string;
    placeholder: string;
  }[] = [
    { key: "temperature", label: "Temperature", placeholder: "1" },
    { key: "topP", label: "Top P", placeholder: "1" },
    { key: "maxTokens", label: "Max tokens", placeholder: "unlimited" },
    { key: "presencePenalty", label: "Presence penalty", placeholder: "0" },
    { key: "frequencyPenalty", label: "Frequency penalty", placeholder: "0" },
    { key: "seed", label: "Seed", placeholder: "random" },
  ];

  $: activeLlm = settings.llm;
  $: reasoningOptions = REASONING_LEVELS.map((level) => ({
    label: level
      ? level[0].toUpperCase() + level.slice(1)
      : $i18n.t("settings.providerDefault"),
    value: level,
  })) as SelectOption[];

  function updateLlm(nextLlm: Partial<AppSettings["llm"]>) {
    updateSettings(settings, onChange, {
      llm: { ...settings.llm, ...nextLlm },
    });
  }

  function hint(key: keyof AppSettings["llm"], fallback: string) {
    return settings.llm[key] || fallback;
  }
</script>

<div class="grid max-w-2xl gap-6">
  <section class="grid gap-2">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.baseUrl")}
    </span>
    <Input
      value={activeLlm.baseUrl}
      placeholder={hint("baseUrl", "https://api.openai.com/v1")}
      oninput={(event) =>
        updateLlm({ baseUrl: (event.target as HTMLInputElement).value })}
    />
    <span class="text-xs text-stone-500">{$i18n.t("settings.apiHelp")}</span>
  </section>
  <section class="grid gap-2">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.apiKey")}
    </span>
    <Input
      value={activeLlm.apiKey}
      type="password"
      placeholder="sk-..."
      oninput={(event) =>
        updateLlm({ apiKey: (event.target as HTMLInputElement).value })}
    />
  </section>
  <section class="grid gap-2">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.model")}
    </span>
    <Input
      value={activeLlm.model}
      placeholder={hint("model", "gpt-4o-mini")}
      oninput={(event) =>
        updateLlm({ model: (event.target as HTMLInputElement).value })}
    />
  </section>
  <section class="grid gap-2">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.systemPrompt")}
    </span>
    <TextArea
      value={activeLlm.systemPrompt}
      size="sm"
      className="text-sm"
      placeholder=""
      onInput={(event) =>
        updateLlm({
          systemPrompt: (event.target as HTMLTextAreaElement).value,
        })}
    />
  </section>
  <section
    class="grid gap-2 border-t border-stone-200/50 pt-5 sm:grid-cols-[8rem_auto] sm:items-start dark:border-stone-800/80"
  >
    <span
      class="text-sm font-medium text-stone-800 sm:pt-2 dark:text-stone-200"
    >
      {$i18n.t("settings.reasoningEffort")}
    </span>
    <Select
      value={activeLlm.reasoningEffort}
      options={reasoningOptions}
      className="h-9"
      rootClassName={compactSelectRoot}
      onChange={(reasoningEffort) => updateLlm({ reasoningEffort })}
    />
    <span class="text-xs text-stone-500 sm:col-start-2">
      {$i18n.t("settings.reasoningHelp")}
    </span>
  </section>
  <section class="grid gap-3">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.sampling")}
    </span>
    <div class="grid grid-cols-2 gap-3">
      {#each samplingFields as field (field.key)}
        <label class="grid gap-1.5 text-xs text-stone-500">
          {field.label}
          <Input
            value={activeLlm[field.key]}
            placeholder={hint(field.key, field.placeholder)}
            oninput={(event) =>
              updateLlm({
                [field.key]: (event.target as HTMLInputElement).value,
              })}
          />
        </label>
      {/each}
    </div>
    <span class="text-xs text-stone-500">
      {$i18n.t("settings.emptyFields")}
    </span>
  </section>
  <section class="grid gap-2">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.stopSequences")}
    </span>
    <Input
      value={activeLlm.stop}
      placeholder="END, ###"
      oninput={(event) =>
        updateLlm({ stop: (event.target as HTMLInputElement).value })}
    />
    <span class="text-xs text-stone-500">
      {$i18n.t("settings.commaSeparated")}
    </span>
  </section>
  <section class="grid gap-2">
    <span class="text-sm font-medium text-stone-800 dark:text-stone-200">
      {$i18n.t("settings.extraBody")}
    </span>
    <TextArea
      value={activeLlm.extraBody}
      size="sm"
      className="text-sm"
      placeholder={'{"top_k": 40}'}
      onInput={(event) =>
        updateLlm({
          extraBody: (event.target as HTMLTextAreaElement).value,
        })}
    />
    <span class="text-xs text-stone-500">
      {$i18n.t("settings.extraBodyHelp")}
    </span>
  </section>
</div>
