# MEGADOC

**Core Philosophy**
> *MegaDoc* is a software for putting all your notes in one document when you are too lazy to manage 15 billion of them.

## Using MegaDoc

Serve this directory with a static web server, for example:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`, create a tab, and use the **+** on a tab to add nested subtabs. Changes save in this browser's local storage. Use **File → Export as JSON** to back up or transfer your document and **File → Import JSON** to restore it. New documents start empty; if you used an earlier version, **File → Restore previous local document** can recover its browser data (including any old example tabs). Export your current work first, as restoring replaces it.

MegaDoc runs locally; it does not provide online accounts, live collaboration, or hosted sharing. Comments and version history are local to this browser. The suggesting mode makes edits directly rather than implementing a review/approval workflow. Browser permissions may restrict clipboard and fullscreen actions; use keyboard shortcuts for clipboard operations when needed.

Use **Settings → Appearance** to choose a light or dark interface and an accent color. Appearance preferences are saved separately on this device; they are not part of the document export and do not change the document's text formatting. The separate **Extensions → Dark page** setting remains available for the light interface.
