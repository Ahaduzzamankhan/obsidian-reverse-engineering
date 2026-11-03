# Glossary

Plain-language definitions for every term this report leans on. Terms are grouped so you can skim.

## Obsidian concepts

| Term | Meaning |
| --- | --- |
| **Vault** | A folder on disk that Obsidian opens. There is no database: the folder *is* the vault. Its settings live in a hidden `.obsidian/` subfolder. |
| **Workspace** | The current arrangement of panes and tabs, persisted per window in `.obsidian/workspace.json`. |
| **Leaf** | Internal name for one tab-holding container. A split is two leaves; a tab is a view inside a leaf. |
| **Ribbon** | The narrow left-hand icon strip (open graph, search, settings…). |
| **Command palette** | The `Ctrl/Cmd+P` searchable list of everything the app can do. |
| **Quick switcher** | `Ctrl/Cmd+O` fuzzy file jump. |
| **Wikilink** | `[[Note]]` — a link by note name rather than path. |
| **Block reference** | `[[Note#^id]]` — a link to one paragraph, marked in the target with `^id`. |
| **Backlink** | An incoming link, computed from the metadata cache (not stored in the file). |
| **Unlinked mention** | A plain-text occurrence of a note's name that is not a link. |
| **Frontmatter** | The `---` YAML block at the top of a note. |
| **Property** | A frontmatter key/value pair presented in the UI. Types are inferred, not declared. |
| **Canvas** | A `.canvas` file: a JSON graph of text cards, files and edges, rendered as an infinite board. |
| **Base** | A `.base` file: a saved database-style view (filters, columns, formulas) over note properties. |
| **Daily note** | A note auto-created for today's date from a template and a filename pattern. |
| **Core plugin** | A first-party feature that can be switched on/off (graph, canvas, backlinks, …). 30 ship by default. |
| **Community plugin** | Third-party JavaScript loaded into the app at runtime. 100% trusted; no sandbox. |
| **Theme / snippet** | CSS that overrides the 1,027 design tokens; themes replace variables, snippets add rules. |
| **Live Preview** | The default editing mode: Markdown that renders in place around the cursor. |

## Desktop / Electron concepts

| Term | Meaning |
| --- | --- |
| **Electron** | Framework bundling Chromium (rendering) with Node.js (system access) into one desktop app. |
| **Main process** | The Node.js side: windows, menus, filesystem, protocols, updates, IPC. Cannot be reached by page code except through declared channels. |
| **Renderer** | The Chromium side that draws the UI and runs page JavaScript. |
| **IPC** | Inter-process communication: the message channel between renderer and main. |
| **`contextIsolation` / `nodeIntegration`** | Electron security switches. Obsidian sets the *insecure* combination (isolation off, Node on), which is why plugins get filesystem access. |
| **`webviewTag`** | Electron switch enabling embedded browsing contexts (used by the web viewer). |
| **`@electron/remote`** | Legacy package that hands renderer code direct references to main-process objects. Obsidian still ships it. |
| **ASAR** | "Atom Shell Archive" — a tar-like bundle Electron mounts as a read-only folder. Not compression, not encryption. |
| **Custom protocol** | A URL scheme the app registers, e.g. `app://obsidian.md/` for its own UI, `app://<random>/` for vault files. |
| **`obsidian://` URI** | The public external entry point (`obsidian://open?vault=…&file=…`) launched from browsers and shortcuts. |
| **Named pipe / Unix socket** | Local-only channel the CLI server listens on. |
| **Fuse** | Electron build-time flags baked into the binary (e.g. whether `--inspect` is allowed). Read from source here, never patched. |
| **NSIS** | The Windows installer format wrapping Obsidian's three architecture payloads. |

## Investigation and tooling terms

| Term | Meaning |
| --- | --- |
| **CDP (Chrome DevTools Protocol)** | The debugging protocol Chromium exposes on `--remote-debugging-port`. Used here to evaluate JS in the live renderer and take screenshots — the same channel DevTools itself uses. |
| **Probe** | A short script that asks the running app a question (which commands exist? what CSS tokens?) and dumps JSON. |
| **Metadata cache** | Obsidian's in-memory map of links, headings, blocks, tags and frontmatter per file; the engine behind backlinks, graph and search. |
| **Lazy / virtualised rendering** | Building DOM only for visible content. This is why a background tab shows an empty preview until activated. |
| **Disposable vault** | The throwaway vault used for experiments, whose final state is kept in `_runtime/vaults/ResearchVault/`. |
| **Sanitisation** | Stripping dangerous HTML (`<script>`, `on*=` handlers, `javascript:` URLs) from rendered notes. |
| **Reverse engineering, non-invasive** | Reading shipped assets, observing behaviour and inspecting on-disk artefacts — as opposed to decompiling machine code. |
