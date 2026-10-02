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

## Slide Shells

With **Slides** turned on in Settings → Features, any note can be presented:
each `#` heading starts a slide, and a line beginning with `Note:` starts that
slide's speaker notes (`N` toggles them, `F` goes fullscreen).

The deck is built in two parts:

- **Slide core** — the structure: layout, stacking, scaling, and the hooks the
  animations run through. It is always there, and shells build on it.
- **Slide Shell** — the look: colours, type, the slide card, the controls and
  the motion. MemoSmith ships a built-in shell, and you can write your own.

A Slide Shell is a plain CSS file in your space at `.slide-shells/<name>.css`.
Choose one under Settings → Features → Slides (the arrow next to the switch).
Shells are re-read each time the deck opens, so edit, close, reopen.

The core and the built-in shell live in cascade layers (`slide-core` below
`slide-shell`), and your shell is unlayered, so **any rule you write wins** —
no `!important`, no specificity games. You have the whole of CSS: start with
the variables below, then restyle any element, or bring your own `@keyframes`.
Anything you leave out falls back to the built-in shell.

### Variables (set them on `.ms-slides`)

| Variable | What it controls |
| --- | --- |
| `--slide-bg`, `--slide-fg`, `--slide-muted` | Background, text, and footer text colours |
| `--slide-accent`, `--slide-accent-2` | Heading underline gradient and progress bar |
| `--slide-surface`, `--slide-border`, `--slide-shadow` | The slide card, notes panel and control bar |
| `--slide-backdrop` | Any `background` value layered over the slide (gradients, images) |
| `--slide-font`, `--slide-heading-font`, `--slide-line-height` | Type |
| `--slide-h1-size`, `--slide-zoom` | Heading size, and the scale of everything on the slide |
| `--slide-width`, `--slide-padding`, `--slide-align` | Slide width, inner padding, `text-align` |
| `--slide-enter`, `--slide-leave` | Full `animation` shorthand for a slide coming in and going out |
| `--slide-block-enter`, `--slide-block-delay`, `--slide-block-stagger` | Per-block entrance animation and its staggering |
| `--slide-distance` | How far the default enter/leave animations travel |
| `--slide-direction` | Read-only: `1` going forward, `-1` going back — use it in your keyframes |

### Elements

| Selector | Element |
| --- | --- |
| `.ms-slides` | The whole deck |
| `.ms-slides-backdrop` | Decorative layer behind the slide |
| `.ms-slides-stage` | Wrapper that animates in and out (`.is-leaving` while leaving) |
| `.ms-slide` | The slide itself |
| `.ms-slide-block` | Each block on a slide; `--slide-order` is its position (0–12) |
| `.md-h1` … `.md-h4`, `.md-bullet`, `.md-quote`, `.md-codeblock`, … | Note content, same classes as the editor |
| `.ms-slides-notes` | Speaker notes panel |
| `.ms-slides-bar`, `.ms-slides-button`, `.ms-slides-track`, `.ms-slides-progress`, `.ms-slides-counter` | Footer controls |

### State attributes

`.ms-slides` carries `data-shell`, `data-slide` (1-based), `data-slides` (total),
`data-first`, `data-last`, `data-direction` (`forward`/`backward`),
`data-fullscreen` and `data-notes`. `.ms-slide` carries `data-slide` and
`data-has-notes`. So `.ms-slides[data-first] .ms-slide { … }` styles a title slide,
and `.ms-slide[data-slide="3"]` targets one slide.

### Example: `.slide-shells/midnight.css`

```css
.ms-slides {
  --slide-bg: #0b1020;
  --slide-fg: #e6e9f5;
  --slide-muted: #7c86a8;
  --slide-accent: #ff5f8f;
  --slide-accent-2: #ffb86b;
  --slide-backdrop: radial-gradient(circle at 50% 120%, #2a1b4d, transparent 70%);
  --slide-heading-font: "Georgia", serif;
  --slide-align: center;
  --slide-enter: zoom-in 600ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
  --slide-leave: zoom-out 300ms ease-in both;
}

.ms-slides[data-first] .md-h1 {
  font-size: 4.5rem;
}

.ms-slide .md-h1::after {
  margin-inline: auto;
}

@keyframes zoom-in {
  from { opacity: 0; transform: scale(0.92) rotate(calc(var(--slide-direction) * 2deg)); }
}

@keyframes zoom-out {
  to { opacity: 0; transform: scale(1.06); filter: blur(6px); }
}
```

Shells are CSS only: no scripts run, so a shell from a shared space can restyle
the deck but cannot do anything else.

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
