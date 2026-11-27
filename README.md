# MegaDoc

MegaDoc is a local-first document editor for keeping notes in one place. Instead of managing a collection of separate documents, organize your writing into tabs, subtabs, and deeper nested tabs—each with its own page.

> *“A software for putting all your notes in one document when you are too lazy to manage 15 billion of them.”*

## Get started

MegaDoc is a static HTML, CSS, and JavaScript app. There is no installation or build step. From this directory, start a static server:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000** in a modern browser. Create your first tab, give it a name, and start writing. Use the **+** on a tab to add a sibling at the same level, or choose **Add subtab** from its **⋮** menu to nest tabs as deeply as you need. Double-click a tab to rename it (or use its menu). On small screens, close the tabs panel to return to the page. New tabs have blank pages.

## What you can do

- **Organize notes:** add, rename, duplicate, delete, reorder, expand, collapse, and search tabs. In a tab’s **⋮** menu, choose **Change emoji icon** to pick an icon or type or paste your own; remove it from the same dialog. The tab menu and drag-and-drop help manage the tree; breadcrumbs and the outline help you navigate it. The outline also lists headings in the current tab.
- **Write and format:** use headings, fonts, sizes, colors, links, images, lists, checklists, alignment, tables, and other rich-text tools. Active inline formatting is highlighted in the toolbar; Clear formatting removes inline styling and links from selected text, or resets formatting for the next text at the caret. It also resets a heading or quote when the selection is within that single block; multi-block structures such as tables and lists are preserved. Enter after or within a heading or quote starts a normal paragraph; Shift+Enter inserts a line break instead. Find and replace within the current tab with **Ctrl+F** (or **Cmd+F**), including match-case and regular-expression search. Replace all applies individually undoable replacements; regex replacement text is literal.
- **Spelling suggestions:** With spellcheck enabled, right-click a word in editable text to see local English (US and Australian) suggestions. Pick one to replace the word; the edit can be undone. Choose **Add to personal dictionary** to accept a word in MegaDoc, or right-click it again to remove it. Personal words are case-insensitive, saved only in this browser and site origin (up to 5,000), and are not included in document JSON backups. On supported browsers MegaDoc draws its own temporary red underlines using the same local dictionaries and personal words, without changing document text. If highlighting is unsupported, the dictionary cannot load, or the tab exceeds the checker’s limits, it falls back to browser spellcheck for the rest of the session (reload to retry); those browser underlines use a separate dictionary and may remain after adding a word. MegaDoc does not check grammar. Suggestions currently cover English-letter words up to 32 characters, not code or words split across formatting; no text is sent to an external spelling service.
- **Copy and paste formatting:** Copy or cut selected text with your browser shortcuts (or the Edit menu) to put formatted HTML and plain text on the clipboard. Paste retains common formatting, links, lists, tables and supported images; unsafe markup and unsupported styles are removed. Pasted external images may contact their hosts, and MegaDoc-specific links, footnotes and other interactive objects may not remain editable. Use your browser’s paste-without-formatting shortcut for plain text. Menu paste may require clipboard permission; if it is blocked, use the keyboard shortcut.
- **Transform text:** select text and choose **Format → Capitalization & letter spacing** for uppercase, lowercase, title case, or custom spacing. The operation is undoable and preserves surrounding content; pages with protected objects such as equations, or ending in a table, are rejected to avoid damaging them.
- **Link within your document:** Insert → Bookmark places a named marker at the caret; click it to rename or remove it. Insert → Link to tab, bookmark or heading navigates across tabs. Headings with existing IDs remain linked after renaming; links to other headings use a title snapshot and must be recreated if renamed. Ambiguous duplicate headings are not followed; give them distinct titles. Link insertion replaces the selected text with the link text. These links work inside MegaDoc and are not portable cross-tab links in HTML exports.
- **Footnote references:** Insert → Footnote adds a numbered reference; activate it to read, edit, or remove its note. Notes are scoped to the current tab and appear at the bottom of the reference page in the paginated preview and its print output. Very long notes that cannot fit may prevent preview; shorten them before printing. JSON keeps their editable relationships; HTML and plain text exports use end-of-tab notes.
- **Table of contents:** Insert → Insert table of contents creates a linked heading list for the current tab. Place the caret in its title cell and use Insert → Update table of contents after editing headings, or Remove table of contents to delete it. Updating replaces the generated table. Links without existing heading IDs rely on a title snapshot, so update after renaming.
- **Insert symbols:** choose Insert → Emoji & special characters to browse categories, search by name, or enter a Unicode value such as `U+2192`.
- **Write equations:** Insert → Equation accepts TeX-style expressions and previews them locally. Click an equation to edit or remove it. Equations are saved as MathML with their source.
- **Choose colors:** use the text and highlight palettes, or enter a six-digit hex value or select a custom color.
- **Edit images:** click an image to show its delete button and resize handle. Drag the handle, or focus it and use the left/right arrow keys (Shift for larger steps). Resize keeps the current aspect ratio; each completed drag or keyboard adjustment can be undone or redone along with other edits. Image sizes are saved in the tab. Use paragraph alignment to position images, including by clicking an image and choosing an alignment. Select an image and use its adjustments button to crop non-destructively (in browsers supporting CSS object-view-box), rotate in 90-degree increments, or set a border. Rotation does not rearrange surrounding text and may overlap it. The original source is retained; browsers without crop support show the uncropped image. Use the image button to edit its accessible description and optional title; the layout button offers inline, wrap left/right, and break-text modes with adjustable spacing.
- **Insert print breaks:** Insert → Page break adds a visible marker; activate it to remove it. Printing and HTML export start a new page at the marker. The editor is continuous; **View → Paginated preview** shows a separate read-only snapshot with automatic page boundaries. Breaks cannot be inserted inside tables, lists, or links.
- **Pageless editing:** Choose **View → Page view / pageless** for the current tab. Pageless removes the paper frame and ruler, reflows text (including long words and preformatted text) to the available screen width, and hides existing page-break markers. Very wide tables or other embedded objects may still require horizontal scrolling. The choice is saved with that tab and copied when duplicating it; new tabs default to page view. To insert or remove page breaks, switch back to page view. Pageless changes the editor view only: print preview still uses saved page settings, breaks, headers and footers; support in file exports varies.
- **Set up pages:** choose Letter, A4, or Legal paper and portrait or landscape in **File → Page setup**. The editor stays continuous; paper settings apply to printing and may be overridden by the printer.
- **Print pages:** **File → Headers, footers & page numbers** sets plain-text repeating elements for the current tab; numbering starts over in each tab. Use the dialog’s Undo/Redo for settings changes (session only). **View → Paginated preview** or **Ctrl/Cmd+P** prepares the current tab; use its **Print / Save as PDF** button for browser printing and selectable PDF text. The snapshot is not editable, and complex tables, images, equations or very long notes can paginate imperfectly. Inspect the preview; printer settings may alter output. Printing directly from the browser menu instead bypasses this preview and uses end-of-tab notes. **Download PDF** creates a separate image-based PDF of up to 20 pages; text is not selectable and complex formatting may differ.
- **Adjust page margins:** drag the two ruler handles, or focus a handle and use the arrow keys (Shift for a larger step). The ruler follows the page when the tabs panel, zoom, or window size changes.
- **Set document paragraph styles:** **Format → Document paragraph styles** sets the default font, size, color, and weight for normal text and headings across tabs, including new content. Existing direct formatting takes priority. Use the dialog’s Undo/Redo controls for style changes; text undo is separate. Older MegaDoc versions retain these settings but do not display them.
- **Paragraph spacing and indents:** use **Format → Paragraph spacing & indents** on the current paragraph or selected paragraphs. Set before/after spacing and first-line or hanging indentation in pixels.
- **Customize lists:** place the caret in a list and use **Format → List options** to change its markers or restart/continue numbering. Continue looks for the previous numbered list in the same section.
- **Use Markdown shortcuts:** type one to six `#` characters followed by a space for a heading; `-`, `*`, `1.`, `>`, and `---` followed by a space make lists, a quote, or a divider. Three backticks followed by Enter or space start a code block; enter three backticks on their own line and press Enter to finish it. Inline `**bold**`, `*italic*`, `~~strikethrough~~`, backtick code, and `[text](https://example.com)` convert after a space or Enter. Turn shortcuts on or off in **Settings → Writing preferences**. These are typing shortcuts, not a full Markdown importer; existing text and pasted Markdown are not automatically converted.
- **Work with tables:** choose dimensions and an optional header under **Insert → Table**. Right-click a cell to add, remove, or move rows and columns, sort body rows by that column, delete the table, or add a new blank header row. Tab and Shift+Tab navigate between cells. Use **Table size & cell style** in the same menu for row/column sizing, even distribution, and cell fill/border. Merge a rectangular area from its top-left cell and split MegaDoc-created merged cells using the cell menu or Insert menu. Cell contents and attributes are retained; imported merged cells, nested tables, protected objects, and cross-section merges are rejected safely. Row and column editing is unavailable for merged or uneven tables; moving columns with column-group styling is also unavailable. Row moves and sorting stay within the current table section, preserving headers.
- **Personalize the workspace:** choose a light or dark interface and an accent color under **Settings → Appearance**. Appearance and Markdown preferences are stored on this device separately from document exports.
- **Use local files:** File imports `.txt`, `.html`, `.docx`, or `.odt` into a new root tab without replacing existing tabs, and exports the current tab to those formats. Text loses formatting; HTML import sanitizes unsupported markup. Office conversions keep basic text, headings, lists and tables, but can change or omit formatting, page breaks, images, equations, links and notes. Other tabs, comments and history are not included. Remote images are not downloaded during Office export; external image URLs in imported HTML can contact their hosts. Import only trusted files; ZIP size checks and worker timeouts reduce but do not eliminate archive risks. Use JSON for a complete MegaDoc backup.
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
| Ctrl/Cmd + . or , | Superscript or subscript |
| Ctrl/Cmd + Alt + 0–6 | Normal text or heading style |
| Ctrl/Cmd + Shift + L/E/R/J | Align left / center / right / justify |
| Ctrl/Cmd + Shift + 7/8 | Numbered / bulleted list |
| Ctrl/Cmd + Alt + Shift + ↑/↓ | Previous / next heading |
| Ctrl/Cmd + / | Search menus and commands |
| Ctrl/Cmd + Alt + N | Add a subtab to the active tab |
| Ctrl/Cmd + P | Print |

## Contributing

See [CONTEXT.md](CONTEXT.md) for the architecture, current data format, and the **cross-version data compatibility requirement**. There is no build step. For a syntax check, run `node --check js/app.js`. A small optional Chromium regression test covers the tab, formatting, color, and image controls; it uses a separate browser context. With a local HTTP server running and a Chromium executable installed, run:

```sh
# Install playwright-core in a separate directory if it is not already available
npm install --prefix /tmp/megadoc-tests playwright-core pngjs jpeg-js jsdom
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/editor-regression.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/image-editing.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/local-features.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/table-organization.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/table-style.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/page-setup.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/equations.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/text-transform.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/list-options.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/paragraph-options.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/local-formats.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/paragraph-styles.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/internal-links.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/internal-headings.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/page-break.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/transform-safety.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/table-merge.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/table-of-contents.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/image-adjustments.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/docx-import.cjs
NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/document-roundtrip.cjs
# PDF inspection tests also need pypdf.
python3 -m pip install --target /tmp/megadoc-tests/python pypdf
PYTHONPATH=/tmp/megadoc-tests/python NODE_PATH=/tmp/megadoc-tests/node_modules CHROMIUM_PATH=/path/to/chromium node tests/footnotes.cjs
# Other suites include office-formats.cjs, office-zip-guard.cjs, pageless-view.cjs, pageless-wrapping.cjs, clipboard.cjs, clipboard-race.cjs, spelling.cjs, spelling-race.cjs, site-size.cjs,
# paginated-preview.cjs, pagination-edge.cjs, pagination-guard.cjs, and direct-pdf.cjs.
# To run every suite, export the same environment variables, then:
for test in tests/*.cjs; do node "$test" || break; done
```

The spelling worker and personal dictionary also have DOM-only regression tests: `NODE_PATH=/tmp/megadoc-tests/node_modules node tests/spell-highlights.cjs` and `NODE_PATH=/tmp/megadoc-tests/node_modules node tests/personal-dictionary.cjs`.

Set `MEGADOC_URL` if the server is not on port 8000. Also test editing, persistence, and responsive behavior manually before submitting changes; this smoke test is not a complete compatibility suite.

Equations use the locally bundled [KaTeX](https://katex.org/) renderer; its license is in `vendor/katex/LICENSE`.

HTML import and export use the locally bundled [DOMPurify](https://github.com/cure53/DOMPurify); its license is in `vendor/dompurify/LICENSE`.

Word import uses a locally bundled [Mammoth](https://github.com/mwilliamson/mammoth.js) converter in a worker. Its license and bundled dependency licenses are in `vendor/mammoth/`.

Paginated preview uses the locally bundled [Paged.js](https://github.com/pagedjs/pagedjs). Direct image-based PDF download uses [html2canvas](https://github.com/niklasvh/html2canvas) and [jsPDF](https://github.com/parallax/jsPDF). Word export uses [docx](https://github.com/dolanmiu/docx); OpenDocument conversion uses [odf-kit](https://github.com/GitHubNewbie0/odf-kit). Their licenses and bundled dependency notices are in the corresponding `vendor/` folders.

Spelling suggestions use locally bundled [nspell](https://github.com/wooorm/nspell) and English dictionaries; build instructions and licenses are in `vendor/spelling/`.

### Google Docs export prototype

Deploy the separate [`google-apps-script/`](google-apps-script/README.md) project and enter its web-app URL in **File → Export current tab to Google Docs**. This experimental iframe flow transfers text, supported formatting and rectangular tables (new Docs only) using a guarded browser message, not a content-bearing URL; it remembers the deployment link locally and has not been tested with a real Google deployment. See the setup, authorization, clickjacking and privacy limitations before use.
