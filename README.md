# MemoSmith

Notion-like markdown editor on Tauri 2 + Svelte + Tailwind. Markdown is styled
live as you type (headings, lists, quotes, bold/italic/code/links), with list
continuation, open/save, and local autosave.

## Use

```sh
pnpm install
pnpm tauri dev
```

## Build

```sh
pnpm check
pnpm build
pnpm tauri build
```

## Source Layout

- `src/App.svelte`: top-level app composition
- `src/ui/pages`: page-level Svelte components
- `src/ui/components`: reusable Tailwind UI components
- `src/ui/sections`: page sections and layout chunks
- `src/ui/forms`: form/editor components
- `src/lib/tauri`: frontend Tauri wrappers
- `src/lib/storage`: browser storage helpers
- `src/lib/utils`: shared helpers
- `src/app.css`: global styles

## UI Components

Ready-to-use components live in `src/ui/components`.

- `Badge.svelte`
- `Button.svelte`
- `Card.svelte`
- `Checkbox.svelte`
- `Field.svelte`
- `Input.svelte`
- `Progress.svelte`
- `Select.svelte`
- `Slider.svelte`
- `Switch.svelte`
- `MarkdownEditor.svelte`
- `TextArea.svelte`

## KDE

The `tauri` script runs with `GDK_BACKEND=x11` so KWin gets normal window
decorations on KDE.
