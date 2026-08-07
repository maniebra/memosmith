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

## 🐛 Debugging & Platform Notes

- **KDE/KWin**: The `tauri` script forces `GDK_BACKEND=x11` to ensure standard window decorations.
- **Diagnostics**: If you encounter errors, check the IDE diagnostics and run `pnpm build` to catch type errors.
- **Schema Files**: Do not edit generated Tauri schema files. They are ignored.

## 🔄 Workflow Summary

1. **Understand**: Read the relevant files.
2. **Implement**: Make your changes following the rules.
3. **Verify**: Run `pnpm build` and `cargo check`.
4. **Deliver**: Once verified, you are good to go!
