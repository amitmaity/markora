# Markora

A distraction-free markdown editor for macOS, Windows, and Linux. Write in a live WYSIWYG view (Typora-style) or switch to raw source, with folders, outline navigation, and export to PDF or HTML.

Built with Electron, React, and TipTap.

## Features

- **Live markdown** — headings, lists, tables, task lists, code blocks, images, and links as you type
- **Source mode** — CodeMirror editor for the raw `.md` file
- **Workspace** — open a folder, browse the file tree, jump headings in the outline, search files by name
- **Math** — KaTeX blocks via **Format → Insert Math**
- **Diagrams** — Mermaid diagrams rendered in the editor
- **Code snippets** — insert highlighted code blocks from presets
- **Export** — PDF and standalone HTML
- **Themes** — GitHub, Academic, Night, Newsprint, Gothic, Whitey
- **Focus / typewriter** — hide chrome, or keep the current line centered

## Install

Download a build from [Releases](https://github.com/amitmaity/markora/releases):

| Platform | File |
| --- | --- |
| macOS | `.dmg` (Intel and Apple Silicon) |
| Windows | `.exe` (NSIS installer) |
| Linux | `.AppImage` or `.deb` |

Installer assets are attached when a GitHub Release is published (drafts are only visible if you have write access to the repo).

## Develop

Requires [Node.js 22](https://nodejs.org/).

```bash
git clone https://github.com/amitmaity/markora.git
cd markora
npm ci
npm run dev
```

Other scripts:

```bash
npm run typecheck
npm run lint
npm run build          # renderer + main bundles
npm run package        # local electron-builder installers
npm run package:mac
npm run package:win
npm run package:linux
```

Pushing a `v*` tag (for example `v1.0.3`) runs `.github/workflows/release.yml`, which builds installers on macOS, Windows, and Ubuntu and publishes them with electron-builder.

## Shortcuts

`⌘` is Command on macOS and Control on Windows/Linux.

| Action | Shortcut |
| --- | --- |
| New / Open / Save / Save As | `⌘N` / `⌘O` / `⌘S` / `⌘⇧S` |
| Find / Find and replace | `⌘F` / `⌘H` |
| Toggle sidebar | `⌘\`` |
| Source mode | `⌘/` |
| Focus mode | `F8` |
| Typewriter mode | `F9` |
| Bold / Italic / Underline | `⌘B` / `⌘I` / `⌘U` |
| Strikethrough / Highlight | `⌘⇧X` / `⌘⇧H` |
| Inline code | `⌘E` |
| Headings 1–6 / paragraph | `⌘1`–`⌘6` / `⌘0` |
| Insert table | `⌘⇧T` |
| Insert code snippet | `⌘⌥C` or `⌘⇧K` |
| Insert math | `⌘⇧M` |
| Insert Mermaid diagram | `⌘⌥M` |
| Insert link | `⌘K` |

Menus under **File**, **Edit**, **View**, **Format**, and **Paragraph** cover the same actions.

---

[github.com/amitmaity/markora](https://github.com/amitmaity/markora)
