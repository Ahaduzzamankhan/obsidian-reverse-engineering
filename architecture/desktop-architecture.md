# Desktop architecture (Electron main process)

Source of evidence: `_extract/asar-obsidian/main.js` (73 lines, minified, readable strings), `_extract/asar-app/main.js`
(hand-written bootstrap), live runtime probes, `evidence/logs/app-stdout.log`.

## 1. Packaging

<a id="packaging"></a>

`Obsidian-1.15.0.exe` is a **Nullsoft installer carrying three complete application payloads**, one per CPU
architecture. Carving the file at each `7z` signature yields:

| Payload | Offset | 7z physical size | `Obsidian.exe` machine | File size |
| --- | --- | --- | --- | --- |
| ARM64 | `0x3527A` | 114,147,175 | `0xAA64` | 222,677,776 |
| x86-64 | `0x6D111E5` | 119,143,230 | `0x8664` | 239,209,744 |
| x86 | `0xDEB0D27` | 105,592,996 | `0x14C` | 205,323,024 |

Every payload contains the **same** `resources/obsidian.asar` (MD5 `6938b28c42f9d0d6a79e4d1d87a9b6e0`), so all
application logic is architecture-independent; only the Electron runtime differs. Each payload also contains
`Obsidian.com`, a 22,800-byte console shim used for CLI/PATH registration on Windows.

Consequence for testing: running the ARM64 payload on an x64 host fails at the OS loader ("Exec format error"),
which is how the three-payload structure was discovered.

## 2. Bootstrap vs. application

| Layer | File | Responsibility |
| --- | --- | --- |
| Shim | `app.asar/main.js` (~5 KB) | scheme privileges, `@electron/remote` init (`remote.initialize()`), updater event bus, hand-off to `obsidian.asar` |
| Application | `obsidian.asar/main.js` | everything else |

Privileged scheme registration (bootstrap, verbatim):

```js
protocol.registerSchemesAsPrivileged([
  {scheme:'app', privileges:{standard:true, secure:true, supportFetchAPI:true,
                             stream:true, codeCache:true, corsEnabled:true}}
]);
```

`stream: true` + `codeCache: true` matter: they allow range requests for media/PDF and let V8 cache compiled
bytecode for the 3.3 MB renderer bundle.

## 3. Window creation

Main vault window (`he(id)`), verbatim options with policy-driven fields:

```js
{
  width: 800, height: 600, minWidth: 200, minHeight: 150,
  backgroundColor: "#00000000",
  trafficLightPosition: {x:19, y:12},
  show: false, frame: <native?>, titleBarStyle: <hidden unless native>,
  webPreferences: {
    contextIsolation: false, nodeIntegration: true, nodeIntegrationInWorker: true,
    spellcheck: true, webviewTag: true, devTools: <policy.devTools>
  },
  ...restoredWindowState   // x, y, width, height, isMaximized, zoom
}
```

Observed behaviour that follows from this:

* **Frameless by default**: `F.frame === "native"` is the only way to get an OS frame (`obsidian.json` key `frame`);
  otherwise `titleBarStyle: "hidden"` and Obsidian draws its own title bar (CSS `--titlebar-height: 30px`,
  traffic-light padding 19/12 on macOS).
* `show: false` until `ready-to-show`, then `maximize()` if the saved state said so, `openDevTools()` if the saved
  state had devtools open, then `setFrameZoomLevel(zoom)`.
* Per-window zoom is clamped to **-2.5 … 3** and applied by executing
  `require('electron').webFrame.setZoomLevel(...)` in the renderer (because there is no `setZoomLevel` on
  `BrowserWindow`).
* Geometry is written on `resize`/`move` (debounced 100 ms) and on `close` into `<userData>/<vaultId>.json` as
  `{x,y,width,height,isMaximized,devTools,zoom}` (**VERIFIED**: `evidence/logs/window-state.json`).
* Windows smaller than 300×200 are clamped; smaller saved windows are enlarged.

Secondary windows: `Ut(opts)` builds fixed-size modal windows — the **starter/vault chooser** (800×650) and the
**help window** (600×680) — and the settings window (≈900×700, `is-popout-modal`). Popouts requested by web content go
through `setWindowOpenHandler`, which returns `overrideBrowserWindowOptions` with `affinity: "main-window"` so all
windows of a vault share a renderer process affinity.

## 4. IPC surface (VERIFIED, complete list)

44 `ipcMain.on` channels + 1 `ipcMain.handle`:

```
adblock-frequency   adblock-lists      check-update        cli                 context-menu
copy-asar           create-browser-session  desktop-dir    disable-gpu         disable-update
documents-dir       file-url           frame               get-default-vault-path
get-documents-path  get-icon           get-sandbox-vault-path  help            insider-build
is-closing          is-quitting        latest-public-version   open-file       open-url
plugin-script-root  policy             print-to-pdf        relaunch            render-menu
request-url         resources          sandbox             set-icon            set-language
set-menu            starter            terms               trash               update
update-menu-items   vault              vault-list          vault-message       vault-move
vault-open          version            + ipcMain.handle("register-cli")
```

Almost all are **synchronous** (`sendSync` + `returnValue`), which is why the renderer can call
`require('electron').ipcRenderer.sendSync('file-url')` during boot before any async plumbing exists. Selected
semantics:

| Channel | Returns / effect |
| --- | --- |
| `file-url` | `app://<36 hex>/` — the per-session vault origin token |
| `plugin-script-root` | `app://obsidian.md/_plugin/` or `null` if plugins are blocked by policy |
| `resources` | absolute path of `obsidian.asar` |
| `vault` | `{id, path}` for the calling window, or `{}` |
| `vault-list` | the whole registry map (all vaults, all paths) |
| `vault-open` | `b(path)` — register & open; `"Vault already exists"` if `create` was requested for an existing folder |
| `vault-move` | `""` on success, `"EVAULTOPEN"` if the vault has a live window, else the error string |
| `print-to-pdf` | writes `filepath` via `webContents.printToPDF(opts)` |
| `request-url` | main-process `net.request` proxy (`redirect: "follow"`), returns status/headers/body to the renderer — a deliberate CORS bypass |
| `trash` | moves a path to the OS trash (used by file deletion) |
| `policy` | full policy object + status/diagnostics |
| `terms` | the redistribution notice string |
| `register-cli` | installs the CLI launcher on `PATH` (writes `obsidian-cli` next to the binary; on Windows appends to the user PATH) |

## 5. `app://` protocol handler

Two implementations exist because Electron ≥ 29 replaced `registerFileProtocol` with `protocol.handle`:

```js
protocol.registerFileProtocol("app", (req, cb) => {
  if (req.url.startsWith(pluginRoot)) { …serve plugin script… return }
  const {url, noframe} = resolve(req.url);       // internal resources or vault path
  const target = guarded(url);                    // vault path must stay inside vault root
  cb({path: target, headers: noframe ? {"X-Frame-Options":"DENY"} : {}});
});
```

Resolver rules (**VERIFIED** from source):

1. URL starts with `app://obsidian.md/` → resolve against the resources directory; traversal outside is blanked.
2. URL starts with the session token host → strip token, URI-decode, resolve on disk, then require
   `path.indexOf(resolve(resourceRoot)) !== 0` style containment (paths outside are rejected → `Forbidden`).
3. Anything else → empty path (404).
4. `_plugin/` URLs are served with `Cache-Control: no-cache` and are additionally gated by the policy
   (`plugin-script-root` returns `null` when plugins are locked).

`protocol.handle` variant adds HTTP range support (`bytes=` → `206`/`416`), which is what makes video seeking and PDF.js
paging work.

Live checks (`experiments/observations.md#E18`): `/index.html` and `/app.css` return 200 through the scheme;
`../resources/obsidian.asar`, `../../../../Windows/win.ini` and token-host traversal all fail.

## 6. Native menu system

* The menu bar is hidden (`menuBarVisible = false`); a renderer-side title bar renders the application menu.
* The renderer builds the menu template (including plugin-provided items) and sends `set-menu {template}`; main
  translates it via `Menu.buildFromTemplate`, stores it as `window.appMenu`, and either sets it as the application
  menu (macOS) or as the window menu.
* `update-menu-items` patches individual items by `itemId` + `eState` (checked/enabled) without rebuilding.
* `render-menu` pops the menu at the cursor (used by the "hamburger" button).
* The Windows/Linux template (`Alt`-less, mnemonic `&File`, `&Edit`, …) includes role-based items
  (`undo/redo/cut/copy/paste`, `front`, `zoom`, `toggleDevTools` when allowed) and an `Always on Top` checkbox kept in
  sync through the `always-on-top-changed` event.
* Context menus are native `Menu.popup()`; the spellcheck menu is assembled from
  `webContents.on("context-menu")` (`editFlags`, `misspelledWord`, `dictionarySuggestions`, "Add to Dictionary").

## 7. Updater

* Two channels: **public** and **insider** (`insider-build` IPC toggles a config flag, gated by policy).
* The main process emits `check-start`, `check-end`, `update-available`, `update-downloaded`, `insider`, `disable`,
  `silence` on an internal `EventEmitter`; the log strings "Checking for update using Github", "Latest version is
  …", "App is up to date" are produced here (**VERIFIED** in `evidence/logs/app-stdout.log`).
* `copy-asar` copies the running `obsidian.asar` into `userData` under its version name — used to stage an update
  without touching a read-only install directory (typical Windows `Program Files` install).
* Installers older than 18 are refused outright (`if (Fo < 18) { showErrorBox("Manual update required"); quit(); }`),
  and a separate minimum-installer check gates CLI support (`1.11.7`).

## 8. Local CLI server (1.12+)

**VERIFIED live.** Main process:

```
Windows: \\.\pipe\obsidian-cli-<username>
Other:   ${XDG_RUNTIME_DIR:-~}/.obsidian-cli.sock     (unlinked on quit)
```

Protocol: client connects, sends **one line** of JSON, then the reply is plain text:

```json
{"argv":["search","query=Alpha"],"tty":false,"cwd":"C:\\work"}
```

Server-side flow: parse header (5 s timeout) → resolve target vault (`argv[0]` may be `vault=<name>` or a
`session=<id>`; second instances are bridged through a per-session pipe) → execute in the renderer:

```js
webContents.executeJavaScript(`new Promise((resolve,reject)=>{
  if (window.handleCli) Promise.resolve(window.handleCli(argv)).then(resolve,reject);
  else (window.cliQueue = window.cliQueue || []).push({argv,resolve,reject});
})`)
```

`window.handleCli` is implemented in `app.js` and dispatches to a command registry (core plugins register handlers with
`plugin.registerCliHandler(...)`). `tty: true` switches the server into an interactive TUI mode (alternate screen,
autocomplete, history, ↑/↓, Ctrl+C) implemented in the main process with raw ANSI output — evidence: main.js contains
`writeWelcome`, `writeDivider`, `writePrompt`, `\x1B[2J\x1B[H`, and the box-drawing divider.

The `cli` IPC channel toggles the feature and persists it in `obsidian.json` (`"cli": true`), which is exactly the
"Settings → General → Advanced → Command line interface" switch.

## 9. Managed policy (undocumented in public docs)

Read once at startup from:

| Platform | Path |
| --- | --- |
| Windows | `C:\Program Files\Obsidian\policy.json` (or `ObsidianWork\policy.json` when the executable is named `obsidian-work`) |
| macOS | `/Library/Application Support/Obsidian/policy.json` |
| Linux | `/etc/obsidian/policy.json` |

Parsed into a policy object with `schemaVersion: 1` and validated field-by-field, reporting `diagnostics`
(`unknown field`, type errors) rather than failing silently. Supported knobs (**VERIFIED** from the validator):

```json
{ "schemaVersion": 1,
  "plugins": false,
  "corePlugins": { "sync": "forced", "publish": "off", "webviewer": "off" },
  "communityPlugins": [ {"id":"…","version":"…","blockedVersions":["…"],"enable":true} ],
  "privatePlugins":  [ {"id":"…","version":"…","url":"…","enable":true} ],
  "themes": true, "snippets": true, "devTools": false, "insider": false,
  "minAppVersion": "1.15.0", "minInstallerVersion": "1.15.0" }
```

Each switch takes `off | manual | default | forced`. Status is reported as `not managed`, `loaded`, `locked fallback`
or `invalid`, with `source` and per-field diagnostics. The `policy` channel exposes it to the renderer, which greys out
settings and hides the ribbon/devtools accordingly. A `isWork: true` flag in `obsidian.json` (or an executable named
`obsidian-work`) forces policy mode on even without a file.

## 10. Deep links (`obsidian://`)

`app.setAsDefaultProtocolClient("obsidian")` on Windows/Linux; macOS uses `open-url`. Parsed actions (**VERIFIED**
from source; documented in https://obsidian.md/help/uri): `open`, `new`, `daily`, `unique`, `search`,
`choose-vault`, `sync-setup`, `show-plugin`, `hook-get-address`, `vault/<name>/<file>`, and the shorthand
`obsidian:///<absolute path>`. Unknown actions are ignored. 1.13 added a confirmation dialog with an allow-list for
URIs that would execute something (`security/assessment.md`).

## 11. Vault lifecycle operations (main-process side)

| Operation | Behaviour |
| --- | --- |
| Create | `vault-open {path, create:true}` → `mkdir -p` then register |
| Open | `vault-open` → register (16-char random id), mark `open` |
| Remove | `vault-remove` → refuses while a window exists; deletes registry entry, window state file, web partition |
| Move | `vault-move` → `fs.renameSync` + registry update (refuses while open) |
| Sandbox | `sandbox` → recreates `<userData>/Obsidian Sandbox` from bundled `sandbox/` content and opens it |
| Help vault | `help` → opens `<userData>/Obsidian Help` (regenerated from `help.js`) |
| Trash | `trash` → OS trash, then the renderer removes the file from the index |

## 12. Web viewer session factory (core plugin `webviewer`)

`create-browser-session {partition, adblock}`:

* one Electron session per partition (`Partitions/vault-<id>` on disk),
* user-agent rewritten to strip `obsidian` and `electron` tokens (spoofing a plain Chrome UA), with the
  `accounts.google.com` special case reset to `Chrome`,
* `onBeforeRequest` cancels URLs matched by an EasyList matcher (bundled lists
  `easylist.txt` + `easyprivacy.txt`, refresh interval configurable in days, default 4),
* `setPermissionCheckHandler` / `setPermissionRequestHandler` allow only `clipboard-read` and
  `clipboard-sanitized-write` (everything else denied, including `openExternal` from web content).

## 13. Reimplementation notes (main process)

* Keep all privileged operations in main: file writes, trash, externals, PDF, protocol serving.
* Prefer `protocol.handle` (modern) with range support; use one random hostname per vault session.
* Model windows as `vaultId → BrowserWindow` and persist geometry separately from workspace layout.
* Implement the CLI as an **optional** local socket service: it turned out to be the most automatable surface in the
  product and is cheap to build (`node:net` + newline JSON + a command table).
* If you add a policy file, validate strictly and report diagnostics — Obsidian's approach (per-field diagnostics,
  `locked fallback` state) is a good template for enterprise deployment.
