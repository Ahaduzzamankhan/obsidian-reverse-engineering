# Experiments: observation log

Chronological. Each entry: what was done, the exact result, and what it proves. Scripts live in `evidence/scripts/`;
raw outputs in `evidence/probes/`. Paths such as `_extract/a2/…` refer to the extracted installer payloads; those
bulky trees were pruned after analysis and can be regenerated with `evidence/extract-manifest.txt`.

---

## E0 — Workspace and environment discovery

* `ls -la` in `C:\Users\Fluxenite\Downloads\reverse` → `.freebuff/`, `Obsidian-1.15.0.exe` (339,587,200 B),
  `craft-anything-cli.exe` (35,690,368 B). Nothing else; no source tree to preserve.
* Both files are PE (`MZ`). `craft-anything-cli.exe` is a Rust-based investigation CLI (commands: `mcp`, `triage`,
  `report`, `chat`, `rebuild`, `capabilities`; 315 tools; engines probe lists Ghidra/Frida as *not installed* — and
  Ghidra was deliberately **not** installed or used).
* Host is **x64** (`PROCESSOR_ARCHITECTURE=AMD64`, Intel64 Family 6), so an ARM64 payload cannot run.
* Obsidian is **not installed** (`%APPDATA%\obsidian` absent, no Program Files entry) → everything observed comes from
  the extracted installer.

**Proves:** clean-room conditions; no pre-existing user data influenced findings.

---

## E1 — Extraction and payload identification

| Step | Result |
| --- | --- |
| `7za x Obsidian-1.15.0.exe` | 82 files, "Everything is Ok" + warning "data after the end of archive" |
| `head -c64 Obsidian.exe \| xxd` + PE parse | `MZ`, PE at `0x78`, **Machine `0xAA64` (ARM64)** |
| Run extracted `Obsidian.exe` | `cannot execute binary file: Exec format error` → wrong architecture, not a corrupt file |
| 7z signature scan | three members at `0x3527A`, `0x6D111E5`, `0xDEB0D27` |
| Carve + extract each | machine `0xAA64` / `0x8664` / `0x14C`; `Obsidian.exe` 222/239/205 MB |
| MD5 of `resources/obsidian.asar` in all three | `6938b28c42f9d0d6a79e4d1d87a9b6e0` (identical) |

Section table of the ARM64 payload checked for truncation: 13 sections, last `.reloc` ends at 222,662,144 vs file size
222,677,776 (15,632 B overlay) — file intact.

**Proves:** the installer is a multi-arch distribution with a shared, architecture-independent app bundle.

---

## E2 — First launch, vault registry bootstrap, filesystem footprint

Command: `Obsidian.exe --user-data-dir=…\_runtime\userdata --remote-debugging-port=9222`.

Hand-written `obsidian.json` (see methodology) was accepted. Log (`evidence/logs/app-stdout.log`):

```
Loaded main app package …\_extract\a2\resources\obsidian.asar
Ignored: Error: ENOENT: no such file or directory, open '…\userdata\a1b2c3d4e5f60718.json'
DevTools listening on ws://127.0.0.1:9222/devtools/browser/…
Checking for update using Github
Success.
Latest version is 1.15.0
App is up to date.
```

Vault after first open: `.obsidian/{app.json, appearance.json, core-plugins.json, workspace.json}`.
`app.json` → `{"alwaysUpdateLinks": true}`; `appearance.json` → `{}`; `core-plugins.json` → 30 keys.

**Proves:** registry schema; per-vault window-state filename; startup sequence; that a fresh vault writes exactly four
config files.

---

## E3 — Vault inventory through the running app

```
appId: a1b2c3d4e5f60718          ← the vault id, not a device id
files: Welcome.md, Projects/Beta.md, Projects/Alpha.md, Daily/2026-11-03.md, attachments/projects.png
resolved: Welcome.md, Projects/Alpha.md, Projects/Beta.md, Daily/2026-11-03.md
tags: #research/obsidian #research #demo #project #tag/inline #tag
```

External files created by the shell while the app was running were picked up and indexed within ~300 ms (watcher).

**Proves:** `app.appId` = vault id; nested tags register their parents; watcher latency.

---

## E4 — File creation through the vault API (`Vault.create`)

```
path: Experiments/Created by API.md   size: 33   mtime/ctime set
elapsedMs: 300 (incl. deliberate wait)   indexed: true
.obsidian files after: app.json, appearance.json, core-plugins.json, workspace.json
```

Creating a file did **not** create or modify any `.obsidian` file.
Edge case found: `Vault.create("Experiments/x.md")` throws `ENOENT` if the parent folder does not exist — there is no
implicit `mkdir -p`.

**Proves:** no sidecar metadata; folder creation is explicit.

---

## E5 — Rename a linked file (`FileManager.renameFile`)

Renamed `Projects/Alpha.md` → `Projects/Alpha Renamed.md`. Then:

```
Welcome.md now contains:
  - Wikilink to a note: [[Alpha Renamed]]
  - Heading link: [[Alpha Renamed#Section One]]
  - Block link: [[Alpha Renamed#^block-abc123]]
Projects/Beta.md now contains:
  Beta has a link to [[Alpha Renamed]] and a bare reference [[Welcome]].
old path gone: true
resolvedLinks["Welcome.md"] = { "Projects/Alpha Renamed.md": 3, "Projects/Beta.md": 2, "attachments/projects.png": 1 }
```

`getBacklinksForFile(newFile)` returned a `Map` with keys `Welcome.md`, `Projects/Beta.md`, `Daily/2026-11-03.md` and
per-link `{position, link:"Alpha Renamed#Section One", original:"[[Alpha Renamed#Section One]]", displayText:"Alpha Renamed > Section One"}`.

**Proves:** rename rewrites every inbound link including heading/block subpaths; backlinks are derived and immediate.

---

## E6 — Move a linked file to another folder

`Projects/Beta.md` → `Archive/Beta.md`:

```
Welcome.md now:  - Wikilink with alias: [[Beta|the beta project]]
                 ![[Beta]]
resolvedLinks["Welcome.md"] = { "Projects/Alpha Renamed.md":3, "Archive/Beta.md":2, "attachments/projects.png":1 }
unresolvedLinks["Welcome.md"] = { "This note does not exist": 1 }
```

**Proves:** link text is normalised to the **shortest uniquely-resolving path** on move; unresolved links are tracked
separately and are not "fixed".

---

## E7 — Frontmatter editing and property type inference

Inserted `progress: 42`, changed `priority: 3 → 8` via `Vault.process` (read-modify-write):

```
frontmatter: {title:"Welcome", tags:["research/obsidian","demo"], aliases:["Home"], status:"active",
              priority:8, progress:42, reviewed:"2026-10-01", publish:false, cssclasses:["wide"]}
metadataTypeManager.properties:
  aliases→aliases  cssclasses→multitext  tags→tags  title→text  status→text
  priority→number  reviewed→date  publish→checkbox  progress→number
registeredTypeWidgets: aliases, checkbox, date, datetime, file, folder, multitext, property, number, tags, text
```

No `types.json` was created by inference — the inferred map lives in memory and is persisted only when a user changes a
type.

**Proves:** automatic, global (per property name) type inference; 11 widget types.

---

## E8 — Theme toggle and token diff

`theme:toggle-light-dark` → body class `theme-dark` → `theme-light`; `--background-primary #1C1C1C → #ffffff`,
`--text-normal #dadada → #222222`, accent `hsl(258, 88%, 66%)` in dark and `hsl(calc(258 - 1), calc(88% * 1.01),
calc(66% * 1.075))` in light. Full table in `ui-analysis/themes.md`.

**Proves:** theme switch is purely a body class + token override; accent states are derived arithmetically.

---

## E9 — Canvas and Bases: accept hand-written files

`canvas:new-file` and `bases:new-file` create empty files (`Untitled.canvas`, `Untitled.base`) that stay empty until
first save/dialog completion.

Hand-written `Research.canvas` (4 nodes, 1 edge, all four node types) → `leaf.setViewState({type:"canvas",
state:{file}})` produced `viewType:"canvas"`, `nodes.size 4`, `edges.size 1`, positions/sizes preserved, file not
rewritten. Opening the same file with `leaf.openFile()` instead produced an **empty "New tab"** view — a quirk to
reproduce deliberately or avoid.

Hand-written `Projects.base` (YAML filter + table view + cards view) → `viewType:"bases"`, header
`Projects ▾ | 1 result | Display | Sort | Group | Filter | Properties | Search | +`, one row `Alpha Renamed`, empty
`status`/`priority` cells.

**Proves:** both documented file formats are correct as documented; canvas accepts JSON Canvas 1.0 verbatim.

---

## E10 — Search operator matrix (see `features/search.md` for the table)

`Alpha` 4/10 · `tag:#project` 1/1 · `path:Daily` 1/0 · `file:Beta` 1/0 · `Alpha OR Beta` 5/14 ·
`-Beta research` 1/0 · `/Alph[a-z]/` 4/10 · `[status:active]` 1/1.

Result DOM: `.search-result-container.mod-global-search` → `.tree-item.search-result` →
`.search-result-file-title` + `.tree-result-file-matches` → `.search-result-file-match` with
`.search-result-file-matched-text` spans.

**Proves:** operator families work; results are grouped per file with counts; highlighting is per-range.

---

## E11 — Graph view

`graph:open` → `viewType:"graph"`, renderer instance, control groups Filters / Groups / Display / Forces.
`.obsidian/graph.json` written with 22 keys (see `features/graph-view.md`). Unresolved link rendered as a node
("This note does not exist"), confirming unresolved links are graph citizens.

**Proves:** graph data includes unresolved links; settings shape.

---

## E12 — Editor modes and DOM

`leaf.view.setState({mode:"preview"})` → `getMode() === "preview"`, `.markdown-preview-view` present, section blocks
`mod-header`, `el-pre mod-frontmatter`, `el-h1`, `el-p`, `el-ul`.
Live Preview (`mode:"source"`): `.cm-content` with `HyperMD-header HyperMD-header-1`, `cm-header-1`, `cm-tag`,
`cm-attribute`, `cm-string`, plus `cm-widgetBuffer` and `cm-html-embed` wrappers around rendered HTML.

**Proves:** two distinct render paths over one markdown AST; atomic widget wrappers.

---

## E13 — Community plugin lifecycle (purpose-written plugin)

Fresh vault state: `app.plugins.isEnabled() === false` (Restricted Mode). `enablePluginAndSave("probe-plugin")` did
**nothing** (no instance, no command). After `setEnable(true)`:

```
manifest: {id:"probe-plugin", name:"Probe Plugin", version:"1.0.0", minAppVersion:"1.4.0",
           isDesktopOnly:false, dir:".obsidian/plugins/probe-plugin"}
observations: nodeAvailable:true  fsRequire:true  childProcess:true
              processVersion:"v24.22.1"  ipcRenderer:"object"
              vaultPath:"C:\\…\\ResearchVault"  layoutReadyFired:true  postProcessor:true
command registered: probe-plugin:probe-hello
ribbon: [… , "Probe ribbon"]     status bar: [… , "probe"]
after disable: instance gone, command gone, ribbon/status bar restored, onunload ran
```

Also observed: `setEnable(true)` created `.obsidian/community-plugins.json` containing `[]`.

**Proves:** the security model (full Node), the registration lifecycle, and the Restricted Mode gate.

---

## E14 — CLI over its named pipe

`ipcRenderer.sendSync('cli', true)` → `true`, persisted as `"cli":true`. `node cli_client.js help` returned the full
968-line command reference (saved). Executed:

```
search query=Alpha            → 4 paths
backlinks file=Welcome.md     → 3 paths (incl. Research.canvas)
properties total              → 9
tasks todo                    → 2 checklist lines
base:query file=Projects.base format=json → [{path, file name, status, priority}]
file file=Welcome.md          → TSV: path/name/extension/size/created/modified
outline file=Welcome.md       → box-drawing heading tree
tags total                    → 6
```

**Proves:** the CLI protocol and its execution path through the renderer.

---

## E15 — Hard kill and restore

`taskkill /PID <parent> /T /F` then relaunch with the same `--user-data-dir`:

* window geometry restored from `<vaultId>.json` (`{x:448,y:116,width:1024,height:800,isMaximized:false,devTools:false,zoom:0}`);
* `workspace.json` still listed 9 leaves (main: Welcome + Graph + Canvas; left: Files/Search/Bookmarks; right:
  Backlinks/Outgoing/Tags/Properties/Outline) but at runtime only 1 markdown leaf + 2 sidebar leaves were instantiated;
* activating code that read hidden leaves returned empty content until the leaf was activated.

**Proves:** deferred view restoration; window state is separate from layout.

---

## E16 — HTML sanitisation probes

Note containing `<img src=x onerror=…>`, `<script>`, `<iframe src="https://example.com">`,
`<iframe src="javascript:…">`, `<a href="javascript:…">`, `<b onclick=…>`, `<svg onload=…>`,
`<math><mtext><script>…</script></mtext></math>`, `<object data="data:text/html,…">`.

Reading view DOM after activation:

```
dangerous attributes (on*, javascript:): none
<script> elements: 0
iframes: ["https://example.com"]        ← https kept
img: src rewritten to app://af3d7cb1…/C:/…/attachments/projects.png?1793684021198
window flags set by payloads: none
```

Live Preview rendered the same HTML as a widget (`<img src="x">` with `onerror` removed); `<script>` and `<iframe>`
remained literal text tokens.

**Proves:** allow-list sanitisation with `https` iframe exception; resource URLs are token-hosted with cache busting.

---

## E17 — Security surface (see `security/assessment.md`)

```
require:function  process:object  module:object  process.env keys:79
electron 43.8.4  chrome 150.0.7871.250  node 24.22.1
CSP meta: "style-src 'unsafe-inline' 'self' https://fonts.googleapis.com"   (no default-src, no script-src)
inline script executed: true
webview element: WebViewElement (loadURL available)
require("@electron/remote").BrowserWindow: function
policy: {"plugins":true,"corePlugins":{},"communityPlugins":[],"privatePlugins":[],"themes":true,
         "snippets":true,"devTools":true,"insider":true} status:"not managed"
file-url: app://af3d7cb10857d48f66dc85280ec52e11583c/
plugin-script-root: app://obsidian.md/_plugin/
app://obsidian.md/index.html → 200; app.css → 200
app://obsidian.md/../resources/obsidian.asar → fetch failed
app://obsidian.md/../../../../Windows/win.ini → fetch failed
app://<token>/../../../../Windows/win.ini → fetch failed
```

**Proves:** the renderer trusts local content completely; the protocol handler confines path traversal; policy default
is "not managed".

---

## E18 — Workspace tree inspection and deferred views

`app.workspace.rootSplit` walk: `split(vertical) → tabs → leaf ×3`; `activeLeaf` = Daily note at the time;
`markdownLeaves` listed only live ones. `.obsidian/workspace.json` contained the full tree including `width:300` on the
left split and per-leaf `state.state` objects for every pane type.

**Proves:** serialization schema and lazy instantiation.

---

## E19 — File recovery / history storage

File recovery plugin instance uses an **IndexedDB** database with a `backups` store (`autoIncrement`, indexes `path`,
`ts`), cleanup scheduled 60 s after start; metadata cache uses the same database with stores `file` and `metadata`,
written in one transaction. CLI handlers `history`, `history:list`, `history:read`, `history:restore`, `history:open`
are registered by the plugin.

**Proves:** history and index live outside the vault; the CLI is extended by core plugins through the same handler API.

---

## E20 — Settings as a separate window

`app.setting.open()` created a **new page target** whose body carried `is-popout-window is-popout-modal`, title
"Settings - ResearchVault - Obsidian 1.15.0", size ≈900×700. Sidebar sections: General, Appearance, Interface, Editor,
Files and links, Hotkeys, Keychain, Core plugins, Community plugins + a second list of core plugins (Backlinks, Canvas,
Command palette, Daily notes, File recovery, Note composer, Page preview, Quick switcher, Sync, Templates, …).
General tab: Version 1.15.0 / Installer version 1.15.0 / "Check for updates", Automatic updates toggle, Language,
Help, Account (Log in / Sign up), Commercial license (Activate / Purchase), Advanced.

**Proves:** 1.13+ settings window model; the account/licence surface without credentials.

---

## E21 — Not tested (explicit)

* PDF export dialog, Sync, Publish, mobile, commercial licence activation, theme installation from the community
  browser, plugin marketplace install (network + account).
* Enabling a CSS snippet through the API (the file was listed: `app.customCss.snippets === ["probe"]`).

Each is recorded as a limitation rather than a finding.
