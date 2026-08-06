<script lang="ts">
  import {
    Badge,
    Button,
    Card,
    Checkbox,
    Field,
    Input,
    Progress,
    Select,
    Slider,
    Switch,
    TextArea,
  } from "../components";

  let projectName = "Desktop Notes";
  let search = "";
  let mode = "desktop";
  let autosave = true;
  let telemetry = false;
  let compactMode = false;
  let completion = 68;
  let preview = "Reusable Svelte components, styled with Tailwind.";
  const usageExample = 'import { Button, Card, Input } from "../components";';

  const modeOptions = [
    { label: "Desktop", value: "desktop" },
    { label: "Tablet", value: "tablet" },
    { label: "Mobile", value: "mobile" },
  ];
</script>

<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
  <div class="grid gap-4">
    <Card title="Buttons" description="Variants and sizes for common actions.">
      <div class="flex flex-wrap gap-2">
        <Button label="Primary" variant="primary" onClick={() => {}} />
        <Button label="Secondary" onClick={() => {}} />
        <Button label="Ghost" variant="ghost" onClick={() => {}} />
        <Button label="Small" size="sm" onClick={() => {}} />
        <Button label="Large" size="lg" onClick={() => {}} />
        <Button label="Disabled" disabled onClick={() => {}} />
      </div>
    </Card>

    <Card title="Forms" description="Composable fields for app settings and data entry.">
      <div class="grid gap-4 md:grid-cols-2">
        <Field label="Project name">
          <Input bind:value={projectName} placeholder="Name your project" />
        </Field>

        <Field label="Search">
          <Input type="search" bind:value={search} placeholder="Find components" />
        </Field>

        <Field label="Preview mode">
          <Select bind:value={mode} options={modeOptions} />
        </Field>

        <Field label="Completion">
          <Slider bind:value={completion} label="Build progress" />
        </Field>
      </div>

      <div class="mt-4 grid gap-3 md:grid-cols-3">
        <Checkbox bind:checked={autosave} label="Autosave" />
        <Switch bind:checked={telemetry} label="Telemetry" />
        <Switch bind:checked={compactMode} label="Compact mode" />
      </div>
    </Card>

    <Card title="Text Areas" description="Ready for editors, prompts, descriptions, and notes.">
      <TextArea bind:value={preview} size="sm" />
    </Card>
  </div>

  <aside class="grid gap-4 content-start">
    <Card title="Badges" description="Small status indicators.">
      <div class="flex flex-wrap gap-2">
        <Badge label="Neutral" />
        <Badge label="Ready" tone="success" />
        <Badge label="Review" tone="warning" />
        <Badge label="Blocked" tone="danger" />
      </div>
    </Card>

    <Card title="Live State" description="Bound controls update this summary.">
      <dl class="grid gap-3 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500 dark:text-stone-400">Project</dt>
          <dd class="truncate font-medium text-stone-900 dark:text-stone-100">{projectName || "Untitled"}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500 dark:text-stone-400">Mode</dt>
          <dd class="font-medium text-stone-900 dark:text-stone-100">{mode}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500 dark:text-stone-400">Autosave</dt>
          <dd class="font-medium text-stone-900 dark:text-stone-100">{autosave ? "On" : "Off"}</dd>
        </div>
      </dl>

      <div class="mt-4">
        <Progress value={completion} label="Template readiness" />
      </div>
    </Card>

    <Card title="Usage" description="Import components from a single barrel file.">
      <pre class="overflow-auto rounded-md bg-stone-950 p-3 text-xs text-stone-100"><code>{usageExample}</code></pre>
    </Card>
  </aside>
</div>
