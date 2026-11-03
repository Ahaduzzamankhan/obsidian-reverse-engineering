# Unresolved technical questions

Questions this investigation could not answer, with the cheapest way to answer each. They are ordered by how much they
affect a reimplementation.

| # | Question | Why it matters | How to resolve |
| --- | --- | --- | --- |
| Q1 | Do **web viewer** windows/popouts inherit the privileged `webPreferences` (`nodeIntegration:true`)? The session factory suggests partitions, but the window-open handler reuses the app defaults. | If yes, rendering an arbitrary page with Node enabled would be a critical RCE vector, not just a design smell. | Create a link card / open a URL in the web viewer, then run `typeof require` from that page's devtools target. |
| Q2 | Does the updater **verify a signature** on the staged `obsidian.asar` in userData before loading it? | Determines whether a local write to `%APPDATA%\obsidian` can persist code across updates. | Read the updater module's verification branch (source, not disassembly) or observe a staged update's file set. |
| Q3 | Is the metadata cache **shared** between concurrent windows of the same vault, or duplicated per renderer with IndexedDB as the meeting point? | Affects write contention and cache invalidation design in a clone. | Open two windows on one vault, edit in one, inspect `metadataCache` in the other and the IDB transaction log. |
| Q4 | What exactly does `plugin-scripts/` hold, and when is `_plugin/` used instead of bundling? | Needed to reproduce plugin resource loading (wasm, workers, extra scripts). | Install a plugin that loads a second file at runtime; watch network requests on `_plugin/`. |
| Q5 | Are **Sync** blobs content-addressed and encrypted client-side? What is the conflict algorithm? | Decides whether a compatible sync is feasible at all. | Requires an account; could be answered by official docs in the future. |
| Q6 | Does **Publish** build static HTML client-side or server-side, and how are access rules enforced? | Same as above. | Requires an account/published site. |
| Q7 | How does Obsidian decide to **shorten** vs **keep** a link path on move when two files share a basename? (Observed: shortest *unique* path; the tie-break rule when both are unique was not isolated.) | Link rewriting correctness in edge-case vaults. | Construct a vault with three `Note.md` files, move one, diff every rewritten link. |
| Q8 | Is the search index rebuilt on every start or persisted? (First-search latency suggested no persistence, but IDB contents were not decoded.) | Startup time and memory on 100k-note vaults. | Decode `IndexedDB/app_obsidian.md_0` leveldb (`file`/`metadata` stores contained no FTS rows in the observed dump). |
| Q9 | What is the exact **fuzzy scoring** used by the palette/switcher (`prepareFuzzySearch`)? | Perceived quality of navigation. | Black-box probes: run candidate strings through the exported `prepareFuzzySearch` and fit the scoring function. |
| Q10 | Does Obsidian **write** `types.json` automatically after inference, or only on user edit? (No `types.json` appeared after inference + edits.) | Migration/format compatibility. | Change a property type in the UI, then inspect `.obsidian/types.json`. |
| Q11 | Are `.base` formula/summary **unknown keys** preserved on save (forward compatibility)? The parser stores `unrecognizedData`. | Round-tripping third-party base files. | Add an unknown key, edit a cell, diff the file. |
| Q12 | How are **canvas link cards** previewed (server-side fetch, main-process fetch with cache, or the web viewer)? | Privacy/caching design. | Watch network traffic while adding a link card. |
| Q13 | Exact retention policy and size caps for **File recovery** snapshots (interval, history length, storage quota). | User expectations about deleted data. | Inspect `file-recovery` settings defaults in the UI and the IDB `backups` growth over time. |
| Q14 | Does the **managed policy** file work from a per-user install location (`%LOCALAPPDATA%\Programs\Obsidian`), i.e. is it a privilege boundary? | Enterprise security. | Install per-user, place a `policy.json` next to the exe, check the `policy` IPC status. |
| Q15 | Are **Electron fuses** hardened in the shipped binary (`RunAsNode`, `EnableNodeCliInspectArguments`, `OnlyLoadAppFromAsar`, `EnableEmbeddedAsarIntegrityValidation`)? | Determines how easy it is to run/inject code against the app. | `@electron/fuses` read on `Obsidian.exe` (no disassembly needed) — deliberately not modified during this study. |
| Q16 | Does the renderer's CSP affect the **web viewer** partitions at all (separate origins, own CSP)? | XSS containment inside embedded pages. | Load a CSP-probing page in the web viewer and read `document.securityPolicy`. |

## Already answered by this investigation (for reference)

* Renderer privilege model, CSP content, plugin Node access, `@electron/remote` availability, sanitizer behaviour,
  `app://` traversal containment, vault/registry/window-state schemas, workspace serialization + deferred restore,
  canvas/base formats, search operator set, CLI protocol and command table, policy reader paths and schema, updater
  channels, settings window as popout, plugin registration lifecycle.
