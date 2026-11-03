# Architecture overview

**VERIFIED** unless marked otherwise. Diagrams: `../diagrams/architecture.mmd`, `../diagrams/data-flow.mmd`.

## Layer map

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Electron main process — obsidian.asar/main.js  (212 KB minified)           │
│  · window & popout management, per-vault window state                      │
│  · app:// protocol (resources + per-vault token)                            │
│  · 44 ipcMain channels, 1 ipcMain.handle                                    │
│  · native menus, spellcheck context menu, updater, deep links               │
│  · CLI socket server (named pipe / unix socket)                             │
│  · managed-policy reader (policy.json), ad-block list refresher              │
└───────────────▲──────────────────────────────────────────┬─────────────────┘
                │ ipcRenderer.sendSync / invoke             │ executeJavaScript
┌───────────────┴──────────────────────────────────────────▼─────────────────┐
│ Renderer — app://obsidian.md/index.html  →  app.js (3.3 MB, one bundle)     │
│  · App object (vault, workspace, metadataCache, commands, plugins, …)       │
│  · CodeMirror 6 editor + Live Preview decorations + Reading view            │
│  · Markdown parser → CachedMetadata (headings/links/blocks/sections/tags)   │
│  · Search index, graph renderer (PIXI), canvas, Bases, properties           │
│  · Plugin host: `require("obsidian")` shim, 30 core plugins, community       │
└───────────────▲──────────────────────────────────────────┬─────────────────┘
                │ DataAdapter (original-fs, atomic-ish IO)  │ IndexedDB
┌───────────────┴──────────────────────────────────────────▼─────────────────┐
│ Vault (user folder)                        │ userData (per installation)    │
│  notes.md, attachments/                    │  obsidian.json (registry+cfg)  │
│  .obsidian/{app,appearance,core-plugins,   │  <vaultId>.json (window geom)  │
│   community-plugins,workspace,graph,       │  IndexedDB (metadata + file    │
│   hotkeys,types}.json                      │   recovery backups)            │
│  .obsidian/{plugins,themes,snippets}/      │  Partitions/vault-<id>/ (web)  │
└────────────────────────────────────────────┴────────────────────────────────┘
```

## Process inventory observed at runtime

A normally running app showed **4 `Obsidian.exe` processes** (main, renderer, GPU, utility/network) and **3 CDP
targets** (1 page + 2 workers). The workers are the graph force-simulation worker and a second worker (indexing /
markdown processing); `app.js` posts `{nodes, links, alpha, run}` messages to the simulation worker
(`architecture/frontend-architecture.md#graph`).

## Startup sequence (VERIFIED from `evidence/logs/app-stdout.log` + code)

1. `app.asar/main.js` registers the privileged scheme before `app.ready`:
   `{scheme:'app', privileges:{standard:true, secure:true, supportFetchAPI:true, stream:true, codeCache:true, corsEnabled:true}}`.
2. Single-instance lock. If a second instance starts, its argv is forwarded to the primary through a per-session named
   pipe (`session=<id>` convention observed in `second-instance` handling).
3. `obsidian.asar` is loaded as the real package (`Loaded main app package …obsidian.asar`), version read from its
   `package.json` (`1.15.0`) or `app.getVersion()`.
4. `app.whenReady()` → read `<userData>/obsidian.json` (vault registry, global config) → normalise and prune vault
   entries → for every vault flagged `open`, create its window and `loadURL("app://obsidian.md/index.html")`.
5. Renderer boot (`index.html` scripts are all `defer`): CodeMirror, moment, i18next, scrypt, turndown, `enhance.js`
   (polyfills), `i18n.js` (English strings), then `app.js`, which constructs `window.app = new App(...)`.
6. Update check runs in parallel ("Checking for update using Github" → "Latest version is 1.15.0" → "App is up to
   date") and is written to both stdout and `<userData>/obsidian.log`.

## Where the "vault" concept lives

A vault has three identifiers at runtime:

| Field | Example | Where |
| --- | --- | --- |
| vault id | `a1b2c3d4e5f60718` (16 chars) | registry key, window-state filename, `app.appId`, web partition name |
| path | `C:\…\ResearchVault` | `obsidian.json`, adapter base path |
| name | `ResearchVault` | folder basename, shown in the status bar and window title |

`app.appId` is literally the vault id (**VERIFIED** live: `app.appId === "a1b2c3d4e5f60718"`), which is why the
per-window geometry file is `<userData>/<vaultId>.json`.

## Failure/edge behaviours observed

* Deleting a vault folder while it is registered prunes it from the registry at next start (code path deletes the
  entry and its per-vault files).
* Opening the app with no registry produces the vault chooser window (`starter.html`, 800×650, non-resizable).
* A vault that is already open in another window is *focused*, not duplicated (`he(id)` returns the existing window).
* `vault-move` refuses to move a vault that has an open window (`"EVAULTOPEN"`).
