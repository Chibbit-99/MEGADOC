# MegaDoc: context for future contributors

## Product intent

MegaDoc is a local-first, Docs-like editor for keeping notes in **one document** organized as tabs, subtabs, and deeper descendants. Each tab has its own editable page. New documents and new tab pages start empty; screenshot examples were illustrative and must not be reintroduced as starter content. Keep the familiar document-editor feel while maintaining MegaDoc's own identity: restrained, functional UI rather than a Google Docs clone or a generic promotional SaaS interface.

## Non-negotiable: cross-version data compatibility

**Saved data must always remain cross-compatible when the app is updated.** Treat an existing user's local document and exported backups as durable data, not disposable demo state. An update must not silently hide, reset, overwrite, or discard it. In particular:

- New releases must continue to open and preserve documents and exports created by all previous releases. Keep the tab tree and ordering, IDs and relationships, HTML content, comments, history, document metadata, and user settings intact.
- Maintain compatibility in the other direction for supported older releases as well: favor additive, optional fields with safe defaults, retain unknown fields, and keep existing field meanings and representations. If a new feature cannot be represented in an older format, provide a lossless, tested compatibility/export path rather than silently dropping content. Never overwrite data that the running version cannot safely understand.
- If a schema or storage key must change, implement and test explicit, non-destructive migrations and downgrade/round-trip paths. Read the old key before writing a new one, retain the original until migration is verified, and preserve a recoverable backup. Handle legacy, missing, future-version, malformed, and storage-failure cases explicitly; do not replace an unrecognized save with an empty document.
- Cover compatibility with representative fixtures from every released schema: load old local saves and JSON exports, edit and save, reload, and export/import again. Test nested tabs, formatting, tables, comments, history, settings, unknown fields, and an older supported reader. Verify that failure leaves the original data recoverable.
- Import, reset, and restore are potentially destructive. Warn before replacement, validate before committing a new state, and preserve a backup. Do not store credentials or real secrets in examples, fixtures, or seed data.

This is a requirement for future work, **not a claim that every safeguard is already implemented**. The current format has no explicit schema version, import validation is minimal, and cross-version round-trip tests and automatic migration are not yet in the repository. Address these gaps before relying on a breaking format change. In particular, `megadoc-v1` data is currently available only through the explicit restore command; do not silently switch storage keys and strand users' data.

## Current architecture

- `index.html`: static app shell, menus, toolbar, sidebar, editor, dialogs, and status bar. It loads `css/style.css` and `js/app.js` with cache-busting query strings; update those when deploying changed assets if needed.
- `css/style.css`: layout, responsive rules, print styling, page and interface themes, and accent variables. Mobile uses a collapsible tabs panel; toolbar menus use fixed positioning to avoid scroll-container clipping.
- `js/app.js`: vanilla JavaScript for the state store, tab tree, editor, formatting and Markdown shortcuts, menus, table actions, import/export, settings, and event wiring. Rich text is saved as HTML from a `contenteditable` element; editor commands use browser editing APIs, including `document.execCommand`. Test selection, caret, undo, and mobile input whenever these paths change.
- The ruler has one handle for each page margin. Its positions and tick marks are calculated from the rendered page and scroll viewport, including zoom and sidebar changes. `state.margins` stays in document-space pixels; narrow-screen padding is display-scaled without rewriting saved margins. The old separate first-line marker was removed; previously saved HTML `text-indent` must remain intact.
- Tab emoji icons use an optional `tabEmoji` string on each tab; missing values show the original folder/document icon. Existing state and exports retain their representation, and recursive duplication copies icons. Older versions can retain this optional field when saving, but do not display or edit it.
- Inline formatting button state follows the editor selection and native keyboard shortcuts. Clear formatting resets inline styling and links; caret-only clearing defers a temporary editing marker until typing and removes it before saving. Heading/quote Enter creates a normal paragraph; Shift+Enter remains a soft break. Check browser undo and selection behavior when changing these paths.
- Image selection controls sit outside `#page` and are never serialized. Resizing stores standard inline styles on the existing image; deletion uses the editor command for undo. Exercise older image HTML, zoom, scrolling, narrow screens, selection changes, and viewing mode when changing this code.
- `assets/megadoc.svg`: favicon. The header has an inline version of the mark so its fill can follow the selected accent; keep the two in sync if the logo changes.
- `fonts/`: locally served UI and icon fonts and their licenses. The app has no build step, server-side component, or online account system.

## Data and persistence today

- The active document is JSON in browser `localStorage` under `megadoc-v2`. Storage is scoped to the browser and origin. `seedState()` supplies a blank document and `normalizeState()` backfills some missing fields. Changes are debounced through `save()`; the editor content is copied from the page by `saveCurrentContent()`.
- The document includes `docTitle`, `activeTabId`, `roots`, a `tabs` map, `expanded`, `margins`, `zoom`, `people`, `profile`, and `pageTheme`. Tabs contain an ID, title, parent ID, ordered `children`, HTML `content`, `updatedAt`, `history`, and `comments`. The roots and child ID lists define the tree. History is limited to 25 snapshots per tab.
- Appearance and Markdown shortcut preferences are stored separately under `megadoc-appearance-v1`; they are not included in a document JSON export. The **File → Restore previous local document** command reads the older `megadoc-v1` key on the same origin and replaces the active document after confirmation.
- **File → Export as JSON** serializes the document state; **Import JSON** replaces the current document. The current import path performs only basic validation and inserts saved HTML into the editor. Treat untrusted imported content as a security risk and improve validation/sanitization carefully without losing legitimate formatting or breaking compatibility.
- There is no automatic cloud backup, sync, collaboration, or actual sharing. Browser storage can be cleared or become unavailable; users should export backups. Clipboard and fullscreen operations can be restricted by the browser.

## Running and checking changes

From the repository root:

```sh
python3 -m http.server 8000
# Open http://localhost:8000
node --check js/app.js
```

`tests/editor-regression.cjs` is an optional Chromium smoke test for tab creation and icons, formatting, headings, colors, and images; see README for its dependencies. It is not a cross-version compatibility suite. There is no build system. For behavior changes, exercise the app in a real browser and check the console for errors. At minimum, check blank tab creation and deep nesting; editing, autosave and reload; tab duplication/deletion/reordering; JSON export/import; Markdown on and off; selection and toolbar formatting; right-click table edits, header restoration and undo; light/dark and accent persistence; print; and narrow-screen tabs and menus. For storage changes, follow the compatibility fixture checklist above.
