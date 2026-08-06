<script lang="ts">
  import { Badge, Button, Card } from "../components";
  import ComponentShowcase from "../sections/ComponentShowcase.svelte";
  import NotepadPage from "./NotepadPage.svelte";

  type DemoView = "components" | "notepad" | "tokens";

  let activeView: DemoView = "components";

  const views: Array<{ id: DemoView; label: string }> = [
    { id: "components", label: "Components" },
    { id: "notepad", label: "Notepad" },
    { id: "tokens", label: "Tokens" },
  ];

  const swatches = [
    { name: "Stone", className: "bg-stone-700" },
    { name: "Emerald", className: "bg-emerald-700" },
    { name: "Amber", className: "bg-amber-500" },
    { name: "Rose", className: "bg-rose-600" },
  ];
</script>

<main class="min-h-screen bg-stone-200 text-stone-950 dark:bg-stone-950 dark:text-stone-50">
  <div class="mx-auto grid min-h-screen max-w-7xl grid-rows-[auto_1fr]">
    <header class="border-b border-stone-300 px-4 py-4 dark:border-stone-800">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <Badge label="Svelte" tone="success" />
            <Badge label="Tailwind CSS" />
            <Badge label="Tauri" tone="warning" />
          </div>
          <h1 class="m-0 text-2xl font-bold tracking-normal">Tauri Notepad Component Library</h1>
          <p class="mt-1 max-w-2xl text-sm text-stone-600 dark:text-stone-300">
            A desktop-app starter with reusable Svelte components, Tailwind styling, and a functional notepad demo.
          </p>
        </div>

        <nav class="flex flex-wrap gap-2" aria-label="Demo views">
          {#each views as view}
            <Button
              label={view.label}
              variant={activeView === view.id ? "primary" : "secondary"}
              onClick={() => {
                activeView = view.id;
              }}
            />
          {/each}
        </nav>
      </div>
    </header>

    <section class="min-h-0 p-4">
      {#if activeView === "components"}
        <ComponentShowcase />
      {:else if activeView === "notepad"}
        <NotepadPage />
      {:else}
        <div class="grid gap-4 lg:grid-cols-2">
          <Card title="Design Tokens" description="Tailwind utility tokens used across the library.">
            <div class="grid gap-3 sm:grid-cols-2">
              {#each swatches as swatch}
                <div class="flex items-center gap-3 rounded-md border border-stone-300 bg-stone-50 p-3 dark:border-stone-800 dark:bg-stone-900">
                  <span class={`size-10 rounded-md ${swatch.className}`}></span>
                  <span class="font-medium">{swatch.name}</span>
                </div>
              {/each}
            </div>
          </Card>

          <Card title="Layout Rules" description="Built for dense desktop tools, not marketing pages.">
            <ul class="m-0 grid gap-2 pl-5 text-sm text-stone-700 dark:text-stone-300">
              <li>Pages compose sections and forms.</li>
              <li>Sections arrange reusable components.</li>
              <li>Forms own input layout.</li>
              <li>Components stay small and reusable.</li>
            </ul>
          </Card>
        </div>
      {/if}
    </section>
  </div>
</main>
