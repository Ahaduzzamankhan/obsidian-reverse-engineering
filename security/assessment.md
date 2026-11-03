# Security assessment

Scope: Obsidian Desktop 1.15.0 as observed on Windows. Labels: **VERIFIED** (tested/seen in source),
**DOCUMENTED** (official statement), **INFERRED**.

---

## 1. Trust model in one picture

```
┌─────────────── trusted ────────────────┐   ┌──────── semi-trusted ────────┐   ┌──── untrusted ────┐
│ Obsidian main process (Node, full OS)  │   │ Vault content (.md, .canvas) │   │ Web pages in the  │
│ Renderer with nodeIntegration: true    │   │ Community plugins (full Node)│   │ web viewer        │
│ Installed themes / CSS snippets        │   │ HTML in notes (sanitised)    │   │ Link-card previews│
└────────────────────────────────────────┘   └──────────────────────────────┘   └───────────────────┘
```

The **renderer is not a security boundary** in Obsidian: it has the same privileges as the main process for practical
purposes. The real boundary is *what code you install* (plugins/themes) and *what content you render* (notes, remote
pages). Any reimplementation that keeps this architecture inherits the same model.

## 2. Renderer privilege (VERIFIED)

| Property | Value | Consequence |
| --- | --- | --- |
| `nodeIntegration` | `true` | `require`, `process`, `module` available in page context |
| `contextIsolation` | `false` | page JS shares the context with Electron's preload world |
| `nodeIntegrationInWorker` | `true` | workers also get Node |
| `webviewTag` | `true` | `<webview>` (WebViewElement with `loadURL`) is constructible by any page code |
| `@electron/remote` | loaded (`remote.initialize()`) | `require("@electron/remote").BrowserWindow` returns a real constructor |
| CSP | `style-src 'unsafe-inline' 'self' https://fonts.googleapis.com` only | no `default-src`/`script-src`; inline and remote scripts are allowed by CSP |
| `process.env` | 79 variables visible to page code | secrets in env (if any) leak to any plugin |

Source excerpt that establishes the policy (main.js, window creation):

```js
webPreferences: { contextIsolation: false, nodeIntegration: true, nodeIntegrationInWorker: true,
                  spellcheck: true, webviewTag: true, devTools: policy.devTools }
```

**Assessment.** This is a deliberate design for an app whose UI *is* the plugin host. It means:
* any XSS that reaches code execution is immediately full remote code execution on the user's account;
* the CSP is effectively decorative for the privileged origin (it still matters for the web viewer's partitions);
* sanitisation of note HTML is the only thing standing between a malicious note and code execution — hence §4.

## 3. Origin and protocol design (VERIFIED)

* The app origin is `app://obsidian.md` (registered as privileged/standard/secure/CORS-enabled/streaming).
* Vault files are served from a **per-session random host**: `app://<36 hex chars>/<absolute path>`; the token is
  obtainable by page code (`ipcRenderer.sendSync('file-url')`), so it protects against *remote* pages and embedded
  content, not against local code.
* Path resolution rejects traversal: resource URLs outside the resources directory and vault URLs outside the vault are
  refused (`Forbidden`/failed fetch). Tested: `../resources/obsidian.asar`, `../../../../Windows/win.ini` on both hosts.
* `_plugin/` paths are served with `Cache-Control: no-cache` and are gated by policy
  (`plugin-script-root` returns `null` when plugins are disabled).
* Iframes served from the scheme get `X-Frame-Options: DENY` where the code marks them as non-frameable.

**Assessment.** Sound design: avoids `file://` (which historically leaks privileges) and gives a per-vault origin so
embeds from vault A cannot read vault B's resources. Residual risk: the token is not a secret from local code, and the
origin is shared by all notes in a vault (a malicious note's HTML runs in the same origin as the app shell once
sanitisation fails).

## 4. HTML / Markdown sanitisation (VERIFIED)

Test payloads in a note rendered in Reading view:

| Payload | Result |
| --- | --- |
| `<img src=x onerror=…>` | `onerror` removed; img kept (src rewritten if it resolves to a vault file) |
| `<script>…</script>` | not created; remains literal text in Live Preview |
| `<iframe src="https://example.com">` | **kept** (https iframes are allowed) |
| `<iframe src="javascript:…">` | not kept |
| `<a href="javascript:…">` | `javascript:` URL stripped |
| `<b onclick=…>` | handler attribute removed, element kept |
| `<svg onload=…>` | handler removed |
| `<math><mtext><script>…</script></mtext></math>` | no script element |
| `<object data="data:text/html,…">` | not executed |

The bundle contains a DOMPurify-derived sanitizer (`sanitizeHTMLToDom` in the public API; DOMPurify strings present in
`app.js`).

**Assessment.** Good allow-list behaviour, with one deliberate hole: **https iframes are allowed**, which permits
third-party tracking/clickjacking-style content inside a note and, if the framed page is same-origin-esque or exploits a
browser bug, is the widest door. A clone should make iframes opt-in per note (or require a plugin/consent).

## 5. External content and navigation (VERIFIED in source)

* All external navigation is funnelled through the main process: renderer `window.open`/link clicks → IPC →
  `shell.openExternal` after a check; `setWindowOpenHandler` is overridden for popouts.
* Clicks on a local file that is **remote** (UNC/network path) or **executable** raise a modal warning with
  "Open"/"Cancel" (distinct strings for remote-file vs executable-file).
* 1.13 added a **confirmation dialog with an allow-list for `obsidian://` URIs** that would execute something (e.g.
  `obsidian://show-plugin?id=…`), closing a known social-engineering vector.
* Session-wide `setPermissionRequestHandler`: only `clipboard-read` and `clipboard-sanitized-write` are granted (and only
  for `about:blank` main frames); `openExternal` is denied for web content; `fullscreen` allowed.

## 6. Web viewer (VERIFIED in source, not exercised live)

* One Electron **partition per vault** (`Partitions/vault-<id>`) → cookies/storage isolated between vaults.
* User agent stripped of `obsidian`/`electron` tokens (privacy/anti-fingerprinting and site compatibility), with a
  special case for `accounts.google.com`.
* EasyList + EasyPrivacy matching cancels matching requests; list refresh interval configurable (default 4 days,
  capped at 24).
* Permissions: only clipboard read/sanitized-write; everything else denied.
* 1.11+ installer enables Chromium **cookie encryption** for web viewer users (documented).

**Assessment.** Reasonable; the main residual risk is rendering arbitrary remote pages in a session that has
`nodeIntegration` inherited from the app-wide default — **INFERRED**: the browser-session windows should be created with
their own `webPreferences`, and the observed code path passes the same privileged defaults for popouts. If a web viewer
window ever loads remote content with Node enabled, that is a critical issue; the `create-browser-session` handler
suggests partitions are used with webviews, which inherit the embedder's privileges unless explicitly restricted.
**This deserves a follow-up test** (see `progress.md` open questions).

## 7. Plugins and themes

* **No permission model**: installing a plugin = granting full Node, filesystem, network and IPC access (VERIFIED:
  `require('fs')`, `require('child_process')`, `ipcRenderer`, `process.env` in a plugin).
* Guards: Restricted Mode (off by default for existing users, on for new vaults), community review, managed policy
  (block/pin/force), 1.13 warning when syncing plugins, plugin-script root gated by policy.
* Themes are CSS only but can exfiltrate via `url()` requests and can spoof UI (a "Login" overlay); snippets likewise.
* Plugin data (`data.json`) is plaintext; plugins that store tokens should use `app.secretStorage` (OS-encrypted since
  1.11.5).

## 8. Data at rest

| Data | Protection |
| --- | --- |
| Notes/attachments | none (plain files, by design) |
| `.obsidian` config, workspace, plugin data | none |
| Keychain secrets | OS credential store, encrypted at rest (1.11.5); Linux needs kwallet/gnome-libsecret (documented) |
| Metadata cache / file recovery | IndexedDB in userData, **unencrypted** |
| Web viewer cookies | Chromium cookie encryption (new installers) |

**Assessment.** Correct for a local-first tool, but users should know that `File recovery` snapshots are plaintext copies
of deleted content living in `%APPDATA%` — relevant for "secure delete" expectations.

## 9. Updater and supply chain

* Update check hits GitHub (release channel) and an "insider" channel; the log lines are the only observable surface.
* `copy-asar` stages the new `obsidian.asar` inside userData before swapping — meaning **the update payload is written
  to a user-writable directory** before being loaded. Integrity depends on the updater's own verification (not
  observable here). **INFERRED risk**: if the staged asar is loaded without signature verification, a local attacker who
  can write to `%APPDATA%\obsidian` could persist code — but such an attacker already has the user's privileges, so the
  practical impact is limited to *privilege retention* (userData survives app reinstall).
* Electron/Chromium are bundled; security updates require a full app update (no independent Chromium patch channel).
* Electron **fuses** were not modified by us and were not tested for state; `RunAsNode` etc. should be checked before
  shipping a clone (see `implementation/architecture-recommendation.md`).

## 10. Managed policy (VERIFIED, undocumented)

A `policy.json` in an admin-writable location (`C:\Program Files\Obsidian\policy.json`, `/etc/obsidian/policy.json`,
`/Library/Application Support/Obsidian/policy.json`) can:

* disable all plugins or force core-plugin states (`off | manual | default | forced`),
* allow-list community/private plugin ids with versions and blocked versions,
* disable themes, snippets, devtools, insider builds,
* set minimum app/installer versions.

Parser behaviour: strict schema validation with per-field diagnostics, `locked fallback` when unreadable, and the
renderer receives the whole policy over IPC. This is a legitimate enterprise control **and** a potential local
privilege-escalation target if the file location is user-writable on some installs (e.g. a per-user install of Obsidian
into a user directory).

## 11. CLI surface (VERIFIED)

The CLI socket is local-only, but it is **equivalent to full vault access** (read/write/delete/execute commands,
`eval`, `devtools`, `dev:cdp`). Windows named pipes are per-user by default ACL; Unix sockets rely on directory
permissions (`$XDG_RUNTIME_DIR` or `~`). Any process running as the same user can drive the app. The `eval`/`dev:cdp`
commands in particular should be treated as privileged debug features.

## 12. Risk register

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| R1 | Renderer runs with `nodeIntegration` + no `contextIsolation`; CSP does not restrict scripts | High (by design) | VERIFIED |
| R2 | Any plugin = arbitrary code execution with full user privileges | High (by design) | VERIFIED |
| R3 | Sanitizer allows `https` iframes inside notes | Medium | VERIFIED |
| R4 | Web viewer may inherit privileged `webPreferences` for popouts/sessions | **Unknown — needs test** | INFERRED |
| R5 | `@electron/remote` enabled (renderer can create BrowserWindows, access main-process objects) | Medium | VERIFIED |
| R6 | File recovery keeps plaintext snapshots in userData | Low/Medium | VERIFIED |
| R7 | CLI `eval`/`dev:*` commands exposed to any same-user process | Medium | VERIFIED |
| R8 | Managed policy file could be writable in per-user installs | Medium (depends on install) | INFERRED |
| R9 | Staged update asar in user-writable userData | Low | INFERRED |
| R10 | Markdown HTML sanitisation depends on one library; bypass = RCE | High if bypassed | VERIFIED design |

## 13. Hardening recommendations for the independent implementation

1. **Sandbox by default**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a narrow preload
   bridge with explicit channels. Accept that Obsidian plugins then need a compatibility shim.
2. **Two hosts**: app shell on a privileged origin; note content rendered in a sandboxed iframe with no Node, no
   `allow-same-origin`, CSP `default-src 'none'; img-src app: data: https:; style-src 'self' 'unsafe-inline'`.
3. **No `@electron/remote`**, no `webviewTag`; use `WebContentsView` with per-view `webPreferences` and a
   permission handler that denies by default.
4. **Sanitise with a maintained library** (DOMPurify) and make iframes/HTML embeds opt-in per note or per plugin.
5. **Plugin capability manifest** (`fs:read`, `fs:write:vault`, `net:https://api.x`, `clipboard`) enforced by the host;
   show a consent screen on install/update, and sign plugin bundles if you run a registry.
6. **Verify updates**: signed manifests + code signing; never load a staged archive without a signature check.
7. **Encrypt local history** or let users opt out; document what File recovery keeps.
8. **Fuse hardening** in the packaged Electron app (`RunAsNode` off, `EnableNodeCliInspectArguments` off,
   `OnlyLoadAppFromAsar` on, `EnableEmbeddedAsarIntegrityValidation` on).
9. **CLI**: default off; separate debug commands behind a flag; per-user socket ACLs; audit log of CLI mutations.
10. **Policy file**: validate, but also require an admin-owned path and refuse to read it from user-writable locations.

## 14. What was *not* done (ethics/scope)

No exploit development, no fuzzing of the parser for memory corruption, no attempt to bypass licence checks, no probing
of Obsidian's servers, no execution of third-party plugin code, no modification of the app bundle for distribution.
