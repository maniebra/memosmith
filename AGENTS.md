# 🚀 AGENTS.md

Welcome to MemoSmith! This document is your source of truth for navigating, developing, and contributing to the codebase.

## 🎯 Project Overview

MemoSmith is a Tauri 2 desktop application built with:
- **Frontend**: Svelte, Vite, Tailwind CSS, and TypeScript.
- **Backend**: Rust (via Tauri).
- **Core Concept**: A Notion-like markdown editor. Users open a folder (a "space") and manage notes in a sidebar tree.

## 🛠️ Getting Started

### Prerequisites
- **Node.js & pnpm**: Used for all frontend and orchestration tasks.
- **Rust & Cargo**: Required for Tauri/backend tasks.

### Initial Setup
```sh
# Install dependencies
pnpm install

# Run the app in development mode (with hot reload)
pnpm tauri dev
```

### Validation (Crucial!)
Before submitting any work, you **must** verify it works and doesn't break the build:
```sh
# Frontend & Build check
pnpm build

# Rust/Tauri backend check
cd src-tauri
cargo check
```

## 📂 Codebase Structure

### Frontend (`src/`)
- `src/App.svelte`: The root component.
- `src/main.ts`: Application entry point.
- `src/ui/`: **All UI code lives here.**
    - `src/ui/pages/`: Route-level components.
    - `src/ui/components/`: Reusable UI components (use these instead of raw elements!).
    - `src/ui/sections/`: Layout chunks.
    - `src/ui/forms/`: Editor and form components.
- `src/lib/`: Business logic and utilities.
    - `src/lib/utils/`: Small, pure utility functions.
    - `src/lib/tauri/`: Frontend wrappers for Tauri/Rust commands (keep logic out of components).
    - `src/lib/storage/`: Browser storage management.
- `src/app.css`: Global styles (Tailwind).

### Backend (`src-tauri/`)
- `src-tauri/src/main.rs`: Entry point.
- `src-tauri/src/lib.rs`: Tauri plugins and Rust commands.
- `src-tauri/tauri.conf.json`: App configuration.
- `src-tauri/capabilities/default.json`: Permission configuration.

### Testing & Utils (`src/lib/utils/`)
- `src/lib/utils/markdown.ts`: Markdown styling rules (`markdown.test.ts`).
- `src/lib/utils/image.ts`: Image processing (webp re-encoding).
- `src/lib/utils/assets.ts`: Media classification (`assets.test.ts`).
- `src/lib/utils/tree.ts`: Sidebar tree building (`tree.test.ts`).

## 📜 Development Rules

### 🏗️ Implementation
- **Keep it small**: Avoid over-engineering.
- **Don't repeat yourself**: Use reusable components from `src/ui/components` before writing raw HTML/Tailwind.
- **Component Exporting**: Always export new components from `src/ui/components/index.ts`.
- **Encapsulation**: Keep Tauri API calls wrapped in `src/lib/tauri`.
- **Clean Code**: Do not add comments that just restate what the code is doing.
- **Tauri Plugins**: When adding a plugin, you must:
  1. Add the npm package.
  2. Initialize the Rust plugin.
  3. Update `src-tauri/capabilities/default.json`.

### 📂 Media Handling
- **Storage**: Files are copied to `assets/{images|videos|audio|misc}` relative to the note.
- **Embed Syntax**: Obsidian-style: `![alt|center|400](src)`.
- **Optimization**: Images > 1920px or > 512KB are downscaled and re-encoded to `.webp`.
- **Pruning**: Deleting a note triggers `prune_assets` to remove unused media.

### 🗃️ Databases
- **Storage**: One SQLite file per database at `<space>/.databases/<id>.db` (`src-tauri/src/databases.rs`).
- **Schema**: `meta(key, value)` holds `name`, `columns`, and `views` as JSON; `rows(id, position, data)` stores each row's cells as a JSON object keyed by column id, so adding a column needs no migration.
- **Views**: Table and kanban board, per database, each with its own filter and sorts. Boards group by a select, multi-select, or relation column; dragging a card rewrites that cell.
- **Relations**: A `relation` column stores linked row ids and names a target database; the target's rows are loaded to label links and to form the board columns.
- **Access**: Databases open from the toolbar's Databases modal (`DatabaseManager.svelte`), not the note sidebar.
- **Filtering**: Nested and/or condition groups, evaluated in the frontend (`src/lib/utils/database.ts`, tested by `database.test.ts`).

### 🤖 LLM (BYOLLM)
- **Config**: Base URL, API key, model, and system prompt live in settings (`Settings > AI`), stored with the rest of `AppSettings` in localStorage.
- **Protocol**: OpenAI-compatible `POST {baseUrl}/chat/completions` (`src/lib/tauri/llm.ts`), sent through `@tauri-apps/plugin-http` so provider CORS rules do not apply.
- **Request options**: Reasoning effort, temperature, top P, max tokens, presence/frequency penalty, seed, stop sequences, plus a raw JSON "extra body" for provider-specific knobs. All are stored as strings; empty means the parameter is left out of the request (`src/lib/utils/llmOptions.ts`, tested by `llmOptions.test.ts`).
- **Usage**: Select text in the editor and pick "Generate with AI" from the context menu; the selection is the prompt and the reply is inserted after it.

### 🚔 Grammar Police
- **What**: Grammarly-style proofreading of the open note through the same BYOLLM endpoint (`checkGrammar` in `src/lib/tauri/llm.ts`).
- **Report**: A 0-100 writing score, a summary, and issues tagged `mistake` or `suggestion`, each with an excerpt, a replacement, and a reason.
- **Parsing**: The model answers with JSON; `src/lib/utils/grammar.ts` unwraps fences, validates, and clamps (`grammar.test.ts`).
- **Applying**: Fixes match the excerpt literally in the note text, so an excerpt that no longer matches is skipped and dropped.
- **UI**: Right-hand panel (`GrammarPolice.svelte`), toggled from the toolbar shield button; opening it runs the first check.
- **Underlines**: `MarkdownEditor` takes a `decorations` prop of source ranges and paints them as absolutely positioned boxes measured with `Range.getClientRects()`. The editable DOM is never touched, so caret offsets stay correct.
- **Re-checking**: While the panel is open, typing schedules a re-check 2.5s after the last keystroke, skipped when the text has not changed since the last run.
- **Explain**: Each issue has an "Explain" button that asks the model for a short rationale (`explainIssue`); answers are cached per issue in the panel.

## 🐛 Debugging & Platform Notes

- **KDE/KWin**: The `tauri` script forces `GDK_BACKEND=x11` to ensure standard window decorations.
- **Diagnostics**: If you encounter errors, check the IDE diagnostics and run `pnpm build` to catch type errors.
- **Schema Files**: Do not edit generated Tauri schema files. They are ignored.

## 🔄 Workflow Summary

1. **Understand**: Read the relevant files.
2. **Implement**: Make your changes following the rules.
3. **Verify**: Run `pnpm build` and `cargo check`.
4. **Deliver**: Once verified, you are good to go!
