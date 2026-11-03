# Feature: Attachments, PDF, media, import and export

**Priority P1–P2.** Evidence: `embedRegistry` probe, `lib/` inventory, `evidence/screenshots/04-canvas.png`
(image + link cards), source strings for `print-to-pdf`, documented help pages.

## 1. What counts as an attachment

Any non-markdown file inside the vault. Obsidian treats these as first-class: they appear in the file explorer, are
linkable, embeddable, searchable (by name), and are rendered by dedicated views.

**Embeddable extensions (VERIFIED from `app.embedRegistry.embedByExtension`)**:
`md, bmp, png, jpg, jpeg, gif, svg, webp, avif, mp3, wav, m4a, 3gp, flac, ogg, oga, opus, mp4, webm, ogv, mov, mkv,
pdf, canvas, base`.

**View types**: `image`, `audio`, `video`, `pdf`, `canvas`, `bases`, plus `markdown` and `release-notes`.

## 2. Images

* Embedding: `![[image.png]]`, `![[image.png|300]]` (width), `![[image.png|300x200]]`, `![[image.png#alt]]`.
* Rendering: `<img src="app://<token>/<abs path>?<mtime>">` (cache-busting query verified in the DOM); the resource is
  served by the `app://` handler with range support.
* Click to zoom (1.13 added a full-screen viewer with pan/zoom and keyboard resizing); "Open in default app" exists as a
  command (`open-with-default-app:*`).
* Canvas file/link cards show image previews; Bases `cards` view uses a cover property.
* Formats: PNG/JPEG/GIF/WebP/AVIF/BMP/SVG (SVG is rendered as an image, not inlined — relevant to sanitisation).

## 3. PDF

* Full viewer via **PDF.js** (`lib/pdfjs`, 5.2 MB): page navigation, zoom, text layer, outline, thumbnails, and
  *annotation/highlighting* support (1.9+ added markup tools).
* Deep links: `![[file.pdf#page=3]]`, and `[[file.pdf#page=3]]` opens the viewer at that page.
* Embedding a PDF in a note shows the viewer inline (iframe-like host); canvas file cards embed it too.
* Selection from a PDF can be dragged into a note as a quote with a page link (documented behaviour).

## 4. Audio and video

* Native `<audio>`/`<video>` players as embeds; formats above.
* **Audio recorder** core plugin (disabled by default) records to the attachment folder and inserts an embed.

## 5. Attachment placement and cleanup

* Settings → Files and links → "Default location for new attachments": vault root / same folder as note / specific
  folder (`attachmentFolderPath`), with a subfolder option per note.
* Paste/drag inserts an attachment *and* the embed/link in one action ("Insert link here"/"Insert links here" drop
  targets exist in the i18n bundle).
* 1.12 added a prompt to delete orphaned attachments when deleting a note; the metadata cache makes this possible
  because every embed is indexed.
* `editor:download-attachments` exists in 1.13+ ("Download attachments for current file") — for notes that reference
  remote images, the images are downloaded into the vault and the links rewritten (documented 1.8/1.13).

## 6. Import / export

| Direction | Mechanism |
| --- | --- |
| Export PDF | `workspace:export-pdf` → IPC `print-to-pdf` → `webContents.printToPDF(opts)` written to a chosen path (dialog). **Observed in code; the dialog was not driven.** |
| Export canvas image | `canvas:export-as-image` |
| Export Bases | "Export CSV" for any view (documented 1.9.4) |
| Import | community "Importer" plugin (`obsidian://show-plugin?id=obsidian-importer`): Notion, Evernote, Bear, Roam, HTML, Markdown folders |
| Clipboard | `htmlToMarkdown` (Turndown) on paste; internal canvas MIME; copy-path/URL commands |
| Slides | Reveal.js bundle for presenting a note (`slides` core plugin) |

## 7. Technical requirements

* An embed registry: extension → constructor; each embed is a `MarkdownRenderChild` with load/unload lifecycle so that
  scrolling a long note doesn't leak players.
* Resource URL scheme with cache busting + range requests (needed for video seek and PDF paging).
* Lazy loading of heavy renderers (PDF.js, PIXI, Pele) — Obsidian lazily loads PIXI in 1.15 and exposes `loadPdfJs`,
  `loadMermaid`, `loadPixi`, `loadPrism` to plugins.
* Attachment writer that respects the folder settings and collision-safe names (`image 1.png`).
* Orphan detection fed by the index (embeds + links).

## 8. Edge cases

* Missing attachment → embed shows a broken state, file card shows "not found", no crash.
* Huge files (500 MB video, 2 000-page PDF) → stream, don't buffer.
* SVG with scripts → rendered via `<img>` so scripts don't execute (verify in your implementation).
* Windows path limits / illegal characters when naming dropped files.
* Same-name attachments from different sources; case-insensitive collisions.
* Audio autoplay policies; multiple embeds of the same large PDF (share one viewer instance or unload aggressively).
* Deleting an attachment that is still embedded (must leave the embed but mark unresolved).

## 9. Testing strategy

* Embed matrix: every embeddable extension, in reading view and live preview, at several widths.
* Range-request tests for video/PDF (seek/paging) against the `app://` handler.
* Attachment settings tests (all three location modes) + rename/move of notes with attachments.
* Orphan detection accuracy against a fixture vault.
* Sanitisation tests for SVG/HTML attachments.

## 10. Priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Image embeds + attachment folder settings + paste/drag insert | M | **P0** |
| PDF viewer embed (PDF.js) | M | P1 |
| Audio/video embeds | S | P1 |
| Orphan attachment cleanup | S | P2 |
| Canvas image export, CSV export | S | P2 |
| Download remote attachments | M | P3 |
| Presenting/slides | S | P3 |
