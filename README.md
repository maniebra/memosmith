# MemoSmith

A calm, local-first notes app for people who think in Markdown.

Point MemoSmith at a folder and it becomes your space: every note is a plain
Markdown file on your disk, organized in a sidebar you can drag and drop. No
accounts, no lock-in, nothing leaves your machine unless you want it to.

## What it does

- **Write without markup in the way.** Markdown styles itself as you type, and
  blocks can be rearranged by dragging.
- **Go beyond text.** Callouts, tables, math, drawings, and Mermaid or PlantUML
  diagrams, all stored in the note itself.
- **Organize with databases.** Turn notes into tables, boards, or calendars.
- **Study with quizzes.** Write multiple-choice or fill-in-the-blank questions
  right inside your notes and check your answers.
- **Run your code.** Execute code blocks and see the output in place.
- **Polish your writing.** Built-in grammar checking helps clean up drafts.
- **Make it yours.** Themes, accent colors, fonts, custom keybindings, Vim mode,
  and right-to-left language support.

## Install

Download MemoSmith from the [latest GitHub release](https://github.com/maniebra/memosmith/releases/latest), then choose the asset for your operating system and processor architecture.

- **Windows:** download the `.exe` installer (or `.msi` on x64 systems) and run it.
- **macOS:** download the `.dmg` for either Apple silicon (`aarch64`) or Intel (`x64`), open it, then drag MemoSmith into Applications.
- **Linux:** download the `.AppImage`, `.deb`, or `.rpm` that matches your architecture. Use the native package for Debian/Ubuntu (`.deb`) or Fedora/openSUSE (`.rpm`); an AppImage can run on most distributions after it is made executable.

Each release includes builds for x64 and ARM64 where the platform supports them. Check the release notes for changes and known issues.

## Development

```sh
pnpm install
pnpm tauri dev
```

MemoSmith runs on Windows, macOS, and Linux.

## License

MIT, see [LICENSE](LICENSE).
