# Local editor feature TODOs

Google Docs features that MegaDoc does not yet have, or supports only in a more limited form. This is a backlog of possibilities, not a commitment to copy Google Docs exactly. All items should work without a cloud backend; collaboration, sharing, sync, hosted services, and other cloud-dependent features are intentionally excluded.

MegaDoc is organized as a tree of tabs, each with its own page. New document features should make their scope clear (current tab versus all tabs), work on mobile where practical, support undo/redo, and preserve existing documents and exports as required by [CONTEXT.md](CONTEXT.md).

## Editing and navigation

- [x] **Find and replace:** Extend the existing current-tab Find bar with Replace and Replace all, match-case and regular-expression options. Preserve surrounding formatting and make replacements undoable. Consider an explicit all-tabs scope without changing the default current-tab behavior. Implemented for the current tab; replacements are individually undoable, and regex replacement text is literal. [1](https://support.google.com/docs/answer/62754)
- [x] **Heading outline:** Add navigation to headings within a tab. The current outline navigates the tab tree, not headings in tab content; keep both forms of navigation useful together. [5](https://support.google.com/docs/answer/6367684?hl=en&co=GENIE.Platform%3DAndroid)
- [x] **Bookmarks and internal links:** Insert, navigate to, edit, and remove bookmarks; let links target a bookmark or heading, including a clear way to navigate between tabs. Links can target tabs, bookmarks, or headings. Headings with existing IDs stay linked when renamed; other heading links use a title snapshot and must be recreated if renamed. [1](https://support.google.com/docs/answer/45893?hl=en&co=GENIE.Platform%3DDesktop)
- [x] **Special characters:** Add a searchable, categorized symbol picker with Unicode lookup. MegaDoc already has a small emoji picker, so this should extend it rather than duplicate it. [2](https://support.google.com/docs/answer/3371015?hl=en&co=GENIE.Platform%3DDesktop)
- [x] **Equation editing:** Insert and edit mathematical expressions, including fractions, superscripts, subscripts, and common symbols, using a locally available renderer. [1](https://support.google.com/docs/answer/160749?hl=en&ref_topic=1361462)
- [x] **Additional keyboard navigation and formatting shortcuts:** Add and document shortcuts for heading styles, alignment, lists, and navigating between headings, without overriding existing MegaDoc shortcuts or platform/browser behavior unnecessarily. [1](https://support.google.com/docs/answer/179738?hl=en&co=GENIE.Platform%3DDesktop)

## Text, paragraphs, and lists

- [x] **Superscript and subscript:** Add controls and shortcuts for applying and removing these text styles. [2](https://support.google.com/docs/answer/179738?amp=&co=GENIE.Platform%3DDesktop&hl=en)
- [x] **Text capitalization and letter spacing:** Provide uppercase, lowercase, and title-case transformations, plus configurable letter spacing for selected text. [1](https://support.google.com/docs/answer/1663349?hl=en&co=GENIE.Platform%3DDesktop)
- [x] **Custom paragraph styles:** Let users update normal text and heading styles and choose defaults for new content. Document-wide font, size, weight, and color defaults apply to normal text and headings; style settings have their own undo/redo controls. Inline formatting takes priority. [5](https://support.google.com/docs/answer/116338?hl=en&co=GENIE.Platform%3DDesktop)
- [x] **Paragraph spacing and indents:** Add spacing before/after paragraphs and first-line or hanging indents, with controls beyond the current preset line spacing and page-margin ruler. [1](https://support.google.com/docs/answer/1663349?hl=en&co=GENIE.Platform%3DDesktop)
- [x] **List options:** Support changing bullet and numbering styles, restarting numbering at a chosen value, and continuing a previous list. Basic bullets, numbering, and checklists already exist. [1](https://support.google.com/docs/answer/3300615?hl=en&co=GENIE.Platform%3DDesktop)

## Images and tables

- [x] **Image alt text:** Add an accessible control to write and edit an image description and optional title, preserving existing image attributes. [1](https://support.google.com/docs/answer/6199477?hl=en)
- [x] **Image adjustments:** Add crop, rotation, and border controls. Non-destructive percentage crop uses browser object-view-box support, rotation uses 90-degree increments, and borders use a width and color. Rotation does not rearrange surrounding text. Image insertion, proportional resizing, deletion, and paragraph alignment already exist. [3](https://support.google.com/docs/answer/4600160?hl=en-GB&co=GENIE.Platform%3DiOS)
- [x] **Image text layout:** Offer inline, wrap-text, and break-text layouts, with spacing and positioning controls where supported. Preserve the existing default inline behavior. [2](https://support.google.com/docs/answer/97447?hl=en-IN&co=GENIE.Platform%3DDesktop)
- [x] **Merge and split table cells:** Allow selecting cells, merging them, and unmerging or splitting them without losing content. A rectangular area can be selected from the top-left cell; MegaDoc-created merges can be split while retaining their cell contents and attributes. Imported merges, protected/nested objects, and cross-section merges are rejected safely. Other row/column operations remain unavailable while cells are merged. [1](https://support.google.com/docs/answer/1696711?hl=en&co=GENIE.Platform%3DDesktop)
- [x] **Table sizing and styling:** Resize rows and columns, distribute them evenly, and edit cell background and border styles. MegaDoc already inserts tables and edits rows and columns in regular grids. Sizing and styling use numeric controls; merged/uneven cells and column-group width changes are rejected safely. [1](https://support.google.com/docs/answer/1696711?hl=en&co=GENIE.Platform%3DDesktop)
- [x] **Table organization:** Move rows and columns and sort rows, while keeping cell content and existing table structure intact. Regular grids are supported; header rows stay in place, and merged/uneven cells and moving styled column groups are rejected rather than altered. [1](https://support.google.com/docs/answer/1696711?hl=en&co=GENIE.Platform%3DDesktop)

## Page layout and printing

- [x] **Page setup:** Add paper size and portrait/landscape controls alongside existing left/right margins. Clearly distinguish the editable page view from printed output. [2](https://support.google.com/docs/answer/11528737?hl=en)
- [ ] **Page breaks and paginated layout:** Explicit breaks and a read-only paginated snapshot now show print boundaries for the current tab; the editable surface is still continuous and does not show automatic boundaries while editing. Complex content may paginate differently or fail; preview before printing. [2](https://support.google.com/docs/answer/11528737?hl=en)
- [x] **Headers, footers, and page numbers:** Plain-text repeating headers and footers and optional page numbers are configured per tab, with numbering restarting at one. They appear in paginated preview and its print output. Settings have separate session-only undo/redo. [1](https://support.google.com/docs/answer/86629?hl=en&co=GENIE.Platform%3DAndroid)
- [x] **Footnotes:** Numbered, editable current-tab notes appear at the bottom of the reference page in paginated preview and its print output. Oversized notes may be rejected rather than clipped; HTML/text exports retain end-of-tab notes. [1](https://support.google.com/docs/answer/86629?hl=en&co=GENIE.Platform%3DAndroid)
- [x] **Table of contents:** Insert an updatable, linked table of contents generated from headings. Generates a linked snapshot of headings in the current tab; update or remove it from the Insert menu with the caret in the contents table. [5](https://support.google.com/docs/answer/116338?hl=en&co=GENIE.Platform%3DDesktop)

## Local file interoperability

- [x] **More local import/export formats:** Import TXT, HTML, DOCX and ODT into new tabs; export the current tab to those formats or an image-based PDF. Office conversions and direct PDF are limited-fidelity; browser Print / Save as PDF is recommended for selectable text. JSON is the full MegaDoc backup. [1](https://support.google.com/docs/answer/7068618?hl=en&co=GENIE.Platform%3DAndroid)

## Implementation guardrails

- Keep processing on the device; do not introduce a required account, server, or external API for these features.
- Preserve nested tabs, content, comments, history, unknown fields, and older saves/exports. Follow the cross-version compatibility and non-destructive migration requirements in [CONTEXT.md](CONTEXT.md).
- Test selection and caret behavior, undo/redo, persistence and reload, accessible keyboard operation, narrow screens, print output, and import/export round trips as appropriate for each feature.
