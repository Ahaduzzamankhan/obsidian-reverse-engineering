# Feature: Command line interface (1.12+)

**Priority P2 (high leverage for testing/automation).** Evidence: live execution against the running app
(`experiments/observations.md#E16`), `evidence/probes/cli-help.txt` (968 lines, produced by the app itself),
main-process server code, https://obsidian.md/help/cli.

## 1. Transport (VERIFIED)

```
Windows: \\.\pipe\obsidian-cli-<username>
Other:   ${XDG_RUNTIME_DIR:-$HOME}/.obsidian-cli.sock   (deleted on quit)
```

Handshake: one **newline-terminated JSON header**, then plain-text output, then the socket closes:

```json
{"argv":["backlinks","file=Welcome.md"],"tty":false,"cwd":"C:\\work"}
```

`tty:true` puts the server into an interactive TUI mode (alt-screen, prompt, autocomplete via `__completions`,
history with ↑/↓, search with Ctrl+F, Ctrl+C to quit) — implemented in the **main process**, so it works even while the
UI is busy.

Execution path: main → resolve vault (`vault=<name>`, `session=<id>` for second instances) →
`webContents.executeJavaScript` → `window.handleCli(argv)` in the renderer, queued until the app is ready
(`window.cliQueue`). Errors come back as `Error: …` strings.

## 2. Enabling

Settings → General → **Advanced → Command line interface**, or programmatically
`ipcRenderer.sendSync('cli', true)`; the flag persists as `"cli": true` in `obsidian.json`. The launcher is installed on
`PATH` via the `register-cli` IPC (Windows: writes/updates `obsidian-cli`; Unix: symlink in `~/.local/bin`; shell
profile updated on macOS). Installers older than 1.11.7 lack the launcher and the app warns about it.

## 3. Command surface (verified names; 100+)

| Category | Commands |
| --- | --- |
| Files | `files`, `folders`, `file`, `folder`, `read`, `create`, `append`, `prepend`, `delete`, `move`, `rename`, `open`, `reload`, `recents` |
| Search | `search`, `search:context`, `search:open` |
| Links/graph | `backlinks`, `links`, `orphans`, `deadends` |
| Properties | `properties`, `property:read`, `property:set`, `property:remove`, `aliases`, `tags`, `tag` |
| Notes | `daily`, `daily:read`, `daily:path`, `daily:append`, `daily:prepend`, `template:insert`, `random`, `random:read`, `tasks`, `task`, `outline` |
| Bases | `bases`, `base:views`, `base:query`, `base:create` |
| Workspace | `tabs`, `tab:open`, `workspace`-ish (`command`, `commands`, `hotkey`, `hotkeys`) |
| Plugins | `plugins`, `plugins:enabled`, `plugin`, `plugin:enable`, `plugin:disable`, `plugin:install`, `plugin:uninstall`, `plugin:reload`, `plugins:restrict` |
| History | `history`, `history:list`, `history:read`, `history:restore`, `history:open` |
| Sync | `sync`, `sync:status`, `sync:history`, `sync:read`, `sync:restore`, `sync:deleted`, `diff` |
| Themes | `snippets`, `snippets:enabled`, `snippet:enable`, `snippet:disable` |
| App | `help`, `restart`, `version`-ish (`app` info), developer commands (`eval`, `devtools`, `dev:screenshot`, `dev:cdp`) |
| Internal | `__completions`, `__files`, `__commands` (used by the TUI) |

Every command takes `key=value` options (`file=`, `path=`, `content=`, `heading=`, `format=json|tsv|csv|md`,
`total`, `verbose`, `active`, `inline`, …). `\n`/`\t` escapes are interpreted inside values.

## 4. Verified outputs

```
$ search query=Alpha          → Archive/Beta.md / Welcome.md / Projects/Alpha Renamed.md / Daily/2026-11-03.md
$ backlinks file=Welcome.md   → Archive/Beta.md / Projects/Alpha Renamed.md / Research.canvas
$ properties total            → 9
$ tasks todo                  → - [ ] write the report / - [ ] unchecked task
$ file file=Welcome.md        → path, name, extension, size, created, modified   (TSV)
$ outline file=Welcome.md     → tree with box-drawing characters
$ base:query file=Projects.base format=json → [{path, file name, status, priority}]
```

Formats: default TSV for tabular commands, plain lines for lists, JSON/CSV/MD when requested; `total` switches to a
single number.

## 5. Why this matters for a clone

The CLI is effectively a **public, scriptable API over the same command/metadata layer** the GUI uses. It is the cheapest
way to:

* test parity automatically (create note → set property → query base → diff output),
* support automation (daily notes from a scheduler, batch imports),
* expose an "API mode" without writing an HTTP server.

## 6. Technical requirements

* A command table with per-command flags, descriptions and examples (the TUI is generated from it — `__completions`
  returns `{name:{description,flags:{flag:{description,value?}}}}`).
* A resolver for `file=` (wikilink-like resolution) vs `path=` (exact vault-relative path).
* Output formatting layer (tsv/csv/json/md) plus a `total` convention.
* Socket server with per-connection state (cwd, current vault), timeouts and a single-writer queue on the renderer side.
* Permission model: the CLI is local-only (pipe/socket permissions) but **equivalent to full vault access** — document it.

## 7. Edge cases

* App not running → connection refused; app starting → the renderer queue must hold commands.
* Multiple windows/vaults → `vault=` selection; ambiguous names must error clearly.
* Binary/attachment content (`read` on a PNG) — must not stream garbage.
* Very large outputs (list 100k files) → stream, don't buffer indefinitely.
* Command that opens UI (e.g. `open`) with `tty:false` — must not hang.
* Concurrent CLI + GUI edits to the same file.

## 8. Testing strategy

* Golden CLI tests: the §4 table, executed against a fixture vault.
* Protocol tests: malformed JSON header, oversized header, slow client, client disconnect mid-command.
* Fuzz `argv` values (empty, unicode, quotes, `=` in values, path traversal).

## 9. Implementation sketch

* Implement the command table as data; generate `help`, completions and the TUI from it.
* Run commands on the same service layer as the UI, never through UI automation.
* Serve over a Unix socket/named pipe; print TSV by default for shell friendliness.

## 10. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Socket server + protocol + 15 core commands | M | P2 |
| Full command table with flags/help/completions | M | P2 |
| TUI mode (autocomplete, history, search) | M | P3 |
| PATH launcher installation | S | P3 |
