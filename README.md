# MegaDoc

MegaDoc is a local-first document editor for keeping notes in one place. Instead of managing a collection of separate documents, organize your writing into tabs, subtabs, and deeper nested tabs—each with its own page.

> *“A software for putting all your notes in one document when you are too lazy to manage 15 billion of them.”*

## Get started

MegaDoc is a static HTML, CSS, and JavaScript app. There is no installation or build step. From this directory, start a static server:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000** in a modern browser. Create your first tab, give it a name, and start writing. Use the **+** on a tab to add a subtab; nesting can continue as deep as you need. New tabs have blank pages.

## What you can do

- **Organize notes:** add, rename, duplicate, delete, reorder, expand, collapse, and search tabs. The tab menu and drag-and-drop help manage the tree; breadcrumbs and the outline help you navigate it.
- **Write and format:** use headings, fonts, sizes, colors, links, images, lists, checklists, alignment, tables, and other rich-text tools. Find text within the current tab with **Ctrl+F** (or **Cmd+F**).
- **Use Markdown shortcuts:** type one to six `#` characters followed by a space for a heading; `-`, `*`, `1.`, `>`, and `---` followed by a space make lists, a quote, or a divider. Three backticks followed by Enter or space start a code block; enter three backticks on their own line and press Enter to finish it. Inline `**bold**`, `*italic*`, `~~strikethrough~~`, backtick code, and `[text](https://example.com)` convert after a space or Enter. Turn shortcuts on or off in **Settings → Writing preferences**. These are typing shortcuts, not a full Markdown importer; existing text and pasted Markdown are not automatically converted.
- **Work with tables:** choose dimensions and an optional header under **Insert → Table**. Right-click a cell to add or remove rows or columns, delete the table, or add a new blank header row. Tab and Shift+Tab navigate between cells. Row and column editing is unavailable for merged or uneven imported tables.
- **Personalize the workspace:** choose a light or dark interface and an accent color under **Settings → Appearance**. Appearance and Markdown preferences are stored on this device separately from document exports.
- **Keep local notes about your work:** comments and per-tab version history are stored in the browser. Print the current page or use **File → Export as JSON** to make a backup.

## Saving, backups, and privacy

Changes save automatically in the current browser's local storage. **Your notes do not sync between browsers, devices, or different site origins**, and clearing browser data can remove them. Export JSON regularly, and use **File → Import JSON** to move or restore a backup. Import replaces the current document, so export it first if you need to keep it. Only import files you trust.

If you used an earlier version on the same browser and site origin, **File → Restore previous local document** can recover the old local save. This replaces the current document and may bring back old example tabs; export your current work first.

MegaDoc currently has no online accounts, hosted sharing, live collaboration, or cloud backup. The Share control explains how to export a copy. Suggesting mode makes edits directly; it is not a review/approval workflow. Browser permissions can limit clipboard and fullscreen actions, so keyboard shortcuts may be needed.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| Ctrl/Cmd + S | Save now |
| Ctrl/Cmd + F | Find in the current tab |
| Ctrl/Cmd + K | Insert a link |
| Ctrl/Cmd + / | Search menus and commands |
| Ctrl/Cmd + Alt + N | Add a subtab to the active tab |
| Ctrl/Cmd + P | Print |

## Contributing

See [CONTEXT.md](CONTEXT.md) for the architecture, current data format, and the **cross-version data compatibility requirement**. There is no build step or checked-in automated test suite yet. For a syntax check, run `node --check js/app.js`; test editing, persistence, and responsive behavior in a browser before submitting changes.
