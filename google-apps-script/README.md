# Google Apps Script export prototype

A **separate standalone web app**, not yet integrated with MegaDoc. Paste one tab's plain text or structured JSON and create a Google Doc. An experimental, conservative existing-document overwrite is also provided. Nothing here deploys itself or changes MegaDoc. The code has local mock tests but has **not been deployed or tested against a real Google account/API**.

## Setup and deployment

1. At [script.google.com](https://script.google.com/), create a standalone Apps Script project. Paste `Code.gs` into `Code.gs` and create an HTML file named `Index` with the contents of `Index.html`.
2. Under Project Settings, show the `appsscript.json` manifest and replace its contents with this directory's manifest. It enables the Docs advanced service and the broad `documents` OAuth scope. If using a standard Google Cloud project, also enable the Google Docs API there. Save the project.
3. Deploy > New deployment > Web app. Choose **Execute as: User accessing the web app**, and select the narrowest access appropriate for your use. Open the `/exec` URL and authorize as the user who will create/edit documents. Google may show an unverified-app warning; organization policies may prevent authorization. Deploy a new version when changing source; the test `/dev` URL is restricted to project editors.
4. Paste a tab's text and choose Create. For an existing document, paste its URL or ID, inspect, review the displayed target and type its exact title to confirm. Back up anything important first.

The app requests `https://www.googleapis.com/auth/documents`, which can access **all Google Docs available to the authorizing user**, not just the selected one. Inspect the code and only authorize a deployment you trust; do not execute a public deployment as the owner. You can revoke access in your Google Account security settings. Apps Script and Google's services process the exported content; this code intentionally does not log document content. Consult Google's retention and privacy policies and your deployment's access controls. No credentials or access tokens should be placed in source, URLs, or MegaDoc configuration.

## Format and limits

Plain text is split into paragraphs. A structured JSON input can specify headings and inline styles:

```json
{"version":1,"title":"Notes","blocks":[{"kind":"HEADING_1","runs":[{"text":"Heading"}]},{"kind":"NORMAL_TEXT","runs":[{"text":"Hello ","style":{"bold":true}},{"text":"world","style":{"link":"https://example.com"}}]}]}
```

Each block is `NORMAL_TEXT` or `HEADING_1` through `HEADING_6`; runs accept `bold`, `italic`, `underline`, `strikethrough` booleans and HTTP(S) `link`. Positions use UTF-16 units, as required by Docs. Maximum 80 paragraphs, 200 runs and 4,000 UTF-16 units including paragraph breaks. Titles are 1–120 characters. Control characters, embedded newlines in runs and invalid surrogate pairs are rejected. Empty paragraphs have an empty `runs` array. The editor must explicitly convert its HTML to this schema; no HTML parser or converter is implemented here. Images, tables, lists, comments, footnotes, colors, fonts and other rich features are not exported. Text/paragraph styling beyond this subset may be inherited from the target. Do not use this as a lossless backup; keep the MegaDoc JSON backup.

## Overwrite safety and limitations

Overwrite first reads the complete tab tree with inline suggestions and included comments, and rejects multi-tab documents, comments, suggestions, named ranges, headers, footers, footnotes, inline/positioned objects, lists and non-text body structures. Unsupported or inaccessible inspection fails closed. The Docs API's comment-inclusion support may require enrollment in Google's Workspace Developer Preview or may not yet be available to the Apps Script advanced service; if so, **overwrite will refuse to proceed**, not fall back to an unsafe inspection. Creating a new Doc does not depend on this feature.

A user-scoped, five-minute, one-use confirmation binds the target revision and content. On confirmation the app re-inspects the document, then sends deletion, insertion and styling in a single batch with `requiredRevisionId`; concurrent changes cause failure. A timeout or other API error can leave the result unknown, so inspect the document before retrying. Creating a document and filling it requires two calls; if the second fails, the app links the possibly empty/partially updated document. Google Docs version history may allow recovery, but is not a substitute for a backup. This is a prototype, not a guarantee against all Google Docs features or API behavior changes; the overwrite path needs real-account verification before production use.

## MegaDoc integration deliberately deferred

The root `GOOGLE_DOCS_EXPORT_PLAN.md` describes a potential iframe/URL flow. This implementation **does not** accept content in URLs, enable `ALLOWALL`, implement `postMessage`, store a deployment URL in MegaDoc, or modify the editor. URLs can leak content through history and logs, and Apps Script's redirected sandbox origin complicates secure parent verification and clickjacking protection. Verify the real deployed origin chain, trustworthy parent handshake, browser support and payload transport before enabling embedding. Do not remove the default frame restriction as a shortcut.

## Local checks

Run `node google-apps-script/tests/server.cjs` and `node --check < google-apps-script/Code.gs`. The tests mock Apps Script and Docs; they do not verify authorization, deployment, Google API compatibility or actual rendered Docs.
