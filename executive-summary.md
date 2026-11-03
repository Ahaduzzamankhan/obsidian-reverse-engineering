# Executive summary

## Scope and confidence

Subject: **Obsidian Desktop 1.15.0** for Windows x64, built on **Electron 43.8.4 / Chromium 150.0.7871.250 /
Node 24.22.1**. Everything below is either observed at runtime, read from the shipped JavaScript/CSS, or quoted from
official documentation (see `sources.md`). Labels: **VERIFIED**, **DOCUMENTED**, **INFERRED**, **UNKNOWN**.

---

## 1. What Obsidian actually is, technically (VERIFIED)

Obsidian is a **local-first Electron shell around a single-page Markdown knowledge base**. There is no server in the
loop for editing: a "vault" is a plain folder of `.md` files plus attachments, and an `.obsidian/` configuration
folder inside it. The whole application logic — editor, search, link graph, canvas, database-like Bases views,
plugin host — runs in **one renderer bundle** (`app.js`, 3.3 MB minified) that has **full Node.js access**.

Two ASARs ship:

| ASAR | Size | Role |
| --- | --- | --- |
| `resources/app.asar` | 73,446 B | Bootstrap: `main.js`, `@electron/remote`, `btime` (file birth-time), `get-fonts` |
| `resources/obsidian.asar` | 24,553,884 B | The application: `main.js` (main process), `app.js` (renderer), `app.css`, `lib/`, `i18n/` |

The renderer is served from a privileged custom scheme, **not** `file://`:

```
app://obsidian.md/index.html          ← application code
app://obsidian.md/_plugin/…           ← plugin script root
app://<36 random hex chars>/<abs path> ← vault files (token regenerated per session)
```

The random per-session host is the boundary that keeps web content from addressing arbitrary disk paths through the
scheme (VERIFIED: `ipcRenderer.sendSync('file-url')` returns `app://af3d7cb1…/`, and traversal attempts through both
hosts fail).

## 2. Scale of the product surface (VERIFIED by probe)

| Metric | Value | Source |
| --- | --- | --- |
| Registered commands at startup | **204** | `evidence/probes/commands.json` |
| Core plugins | **30** (24 enabled by default) | live `internalPlugins` probe |
| Registered view types | **20** | `evidence/probes/viewtypes.json` |
| Property (frontmatter) widget types | **11** | `evidence/probes/propertytypes.json` |
| Embeddable extensions | **10** (`md png jpg jpeg gif svg webp avif mp3 wav m4a 3gp flac ogg oga opus mp4 webm ogv mov mkv pdf canvas base` — 25 total, 10 families) | live `embedRegistry` |
| CSS custom properties on `body` | **1027** | `evidence/probes/cssvars.json` |
| UI locales shipped | **51** | `app.asar/i18n` |
| CLI commands (built-in, 1.12+) | **100+** | `evidence/probes/cli-help.txt` |
| Exported plugin-API symbols | **~150** | `app.js` export map (`architecture/frontend-architecture.md`) |

## 3. The five architecture decisions worth copying

1. **Files are the database.** No proprietary store for notes; `metadataCache` is a derived index that can always be
   rebuilt from disk. This is why third-party tools (git, Dropbox, ripgrep) work on a vault.
2. **One origin per vault, with a rotating token.** Solves "how does the renderer load local images" without
   `file://` and without opening the whole filesystem.
3. **Workspace as a serializable tree.** `workspace.json` is a nested `split → tabs → leaf{state}` structure with
   stable random IDs; restoration is lazy ("deferred views").
4. **Plugin host = the renderer itself.** Plugins are plain JS modules with the full Obsidian API on `require("obsidian")`
   — maximum power, zero isolation. The security model is *user consent*, not sandboxing.
5. **Everything is a command.** 204 commands back the palette, hotkeys, ribbon, context menus and the CLI's
   `command` verb; features are usually just commands plus a view.

## 4. What is genuinely new or undocumented in this build

| Finding | Status | Notes |
| --- | --- | --- |
| **Managed policy** read from `C:\Program Files\Obsidian\policy.json` | **VERIFIED in code**, undocumented publicly | Schema validated (`schemaVersion: 1`), can lock plugins/community plugins/themes/snippets/devTools/insider; app name switches to `obsidian-work` (`obsidian.json` `isWork`). Roadmap still lists "Obsidian for Work" as *active*, so this is a latent capability |
| **Local CLI server** on `\\.\pipe\obsidian-cli-<user>` (Windows) / `~/.obsidian-cli.sock` | VERIFIED live, documented from 1.12 | Newline-delimited JSON `{argv, tty, cwd}`; executes in the renderer via `window.handleCli` |
| **Built-in web viewer** with EasyList ad blocking, per-vault session partitions, permission allow-list | VERIFIED in code | `create-browser-session`, `adblock-lists`, `adblock-frequency` (default 4 days), `Partitions/vault-<id>` |
| **Keychain / SecretStorage** exposed to plugins | documented 1.11.4/1.11.5, VERIFIED present | OS-backed encryption; `app.secretStorage` |
| **Print-to-PDF and `request-url` IPC** | VERIFIED in code | `print-to-pdf` writes a PDF through Chromium; `request-url` is a main-process HTTP proxy that bypasses renderer CORS |
| **Settings as its own window** | documented 1.13, VERIFIED | Window class `is-popout-window is-popout-modal`; title "Settings – <vault> – Obsidian 1.15.0" |
| **Pele** Mermaid renderer (`lib/pele.min.js`, 684 KB) | documented 1.15, VERIFIED present | 24 `--pele-*` CSS properties exposed |

## 5. Security posture in one paragraph (VERIFIED, details in `security/assessment.md`)

The renderer runs with `nodeIntegration: true`, `contextIsolation: false`, `webviewTag: true` and a Content-Security
Policy that only restricts `style-src`. Inline scripts execute; `require('fs')`, `require('child_process')`,
`process.env` and `@electron/remote` are all reachable from any installed plugin — which is documented behaviour for
Obsidian (plugins are trusted, `isDesktopOnly` flags Node use). Markdown HTML *is* sanitized: `on*` handlers,
`javascript:` URLs and `<script>` do not survive into the DOM, while `https` iframes are allowed. External navigation
is funnelled through the main process (`shell.openExternal`), remote/UNC paths and executables raise confirmation
dialogs, and `app://` path resolution confines application resources to the resources directory and vault files to the
session token. The practical security boundary is therefore **the vault content you open and the plugins you install**,
not a sandbox. Any reimplementation that wants a stronger story must add the sandbox Electron now offers
(`contextIsolation: true` + a capability-scoped preload) and accept breaking plugin compatibility.

## 6. Verified behaviours that shape a reimplementation

- **Rename rewrites links**: renaming `Projects/Alpha.md` to `Projects/Alpha Renamed.md` rewrote *all* inbound links,
  including `[[Alpha#Section One]]` and `[[Alpha#^block-abc123]]`, across every file, and updated the index
  (`experiments/observations.md#E4`).
- **Move normalises link text**: moving `Projects/Beta.md` to `Archive/Beta.md` collapsed `[[Projects/Beta|alias]]` to
  `[[Beta|alias]]` — the shortest uniquely-resolving path.
- **Tags are hierarchical**: `#research/obsidian` registers both `#research/obsidian` and the parent `#research`.
- **Type inference is automatic**: `priority: 8` → number widget, `reviewed: 2026-10-01` → date widget,
  `publish: false` → checkbox, with no schema file required.
- **Session restore is lazy**: `workspace.json` keeps every tab, but only visible leaves are instantiated on start.
- **Reading view rendering is visibility-dependent**: DOM content only materialises for a visible leaf (the tests had
  to activate the leaf first). Any automated parity harness must account for this.

## 7. Where the limits of this investigation are

- **Sync and Publish**: no account was used. Client-side references (`sync:*` commands, `diff`, `sync:history`) were
  documented from the CLI surface, but the transport, conflict resolution and encryption are **UNKNOWN**.
- **PDF export**: the command opens a native save dialog, so only the IPC implementation (`print-to-pdf`) was verified.
- **Mobile**: out of scope; the bundle contains `CapacitorAdapter`, `Platform.isMobile` branches and
  `workspace-mobile.json` references, but no mobile runtime was exercised.
- **Obfuscation**: `main.js`/`app.js` are minified with mangled identifiers but readable strings and structure; a few
  subsystems (licence/account flows) were only skimmed because they require credentials.

## 8. Recommendation (detail in `implementation/`)

Build the alternative as **three layers**: (1) a filesystem-first *vault service* owning index + link graph + write
serialisation; (2) a *workspace/editor* layer using CodeMirror 6 with a Live-Preview decoration strategy identical in
spirit to what was observed; (3) an *extension host* that is either a Worker/iframe with a capability manifest
(safer, incompatible with Obsidian plugins) or a full-Node host (compatible, same risk). Prioritise P0 = vault I/O,
editor with wikilinks, metadata cache/backlinks, search, workspace persistence, command registry, settings
(`implementation/feature-parity.md`). Everything else in Obsidian is a plugin-shaped layer on top of those.
