# AGENTS.md

## Project

MemoSmith is a Tauri 2 desktop app built with Svelte, Vite, Tailwind CSS, and TypeScript.
The app is a Notion-like markdown editor: a contenteditable surface that styles
markdown live, plus open/save/autosave. A folder can be opened as a "space"
(Obsidian-style root) whose notes are browsed and managed in a sidebar tree.

## Commands

Use `pnpm`.

```sh
pnpm install
pnpm build
pnpm tauri dev
```

For Rust-only checks:

```sh
cd src-tauri
cargo check
```

## Structure

- `src/App.svelte`: top-level Svelte composition
- `src/main.ts`: Svelte mount point
- `src/app.css`: global browser styles
- `src/ui/pages/`: route-level page components
- `src/lib/utils/markdown.ts`: block/inline styling rules and list continuation (`markdown.test.ts` is the check)
- `src/lib/utils/tree.ts`: builds the space sidebar tree from flat relative paths (`tree.test.ts` is the check)
- `src/ui/components/`: reusable Tailwind UI components
- `src/ui/sections/`: page sections and layout chunks
- `src/ui/forms/`: form/editor components
- `src/lib/storage/`: browser storage helpers
- `src/lib/tauri/`: frontend wrappers for Tauri commands/plugins
- `src/lib/utils/`: small shared utilities
- `svelte.config.js`: Svelte config
- `index.html`: app shell markup
- `src-tauri/src/lib.rs`: Tauri plugins and Rust commands
- `src-tauri/src/main.rs`: process entry point
- `src-tauri/tauri.conf.json`: app metadata, window config, build config
- `src-tauri/capabilities/default.json`: frontend permissions

## Rules

- Keep the app small.
- Do not add comments that restate obvious code.
- Keep UI code under `src/ui`.
- Prefer reusable components from `src/ui/components` before styling raw elements.
- Export reusable components from `src/ui/components/index.ts`.
- Keep Tauri API calls out of components when a small wrapper in `src/lib/tauri` is clearer.
- Keep platform quirks documented in README or AGENTS, not scattered through code.
- Do not edit generated Tauri schema files. They are ignored.
- If you add a Tauri plugin, add the package, Rust plugin init, and capability permission together.
- Verify with `pnpm build` and `cargo check` before handing off.

## KDE Note

The `tauri` package script forces `GDK_BACKEND=x11` so KDE/KWin can draw normal
window decorations instead of GTK Wayland client-side decorations.
