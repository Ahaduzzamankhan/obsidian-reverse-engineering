# Storage architecture

Everything in this chapter was read from a vault the application itself created, or from source. Example values come
from the disposable vault `_runtime/vaults/ResearchVault` (see `experiments/observations.md`).

## 1. Two roots

```
<vault>/                       ← user-chosen folder, portable, syncable, git-friendly
  <notes>.md
  attachments/…                ← any binary, referenced by link or embed
  .obsidian/                   ← per-vault configuration (name overridable in Settings → Files and links)
<userData>/                    ← per-installation state, OS-specific
  Windows  %APPDATA%\obsidian  (unless --user-data-dir overrides it)
  macOS    ~/Library/Application Support/obsidian
  Linux    $XDG_CONFIG_HOME/obsidian | ~/.config/obsidian
```

`userData` holds nothing that cannot be regenerated **except** `obsidian.json` (vault registry, global settings,
language, CLI/insider flags) and `<vaultId>.json` (window geometry).

## 2. Vault configuration files (observed)

| File | Created when | Observed content (verbatim) |
| --- | --- | --- |
| `app.json` | first open | `{"alwaysUpdateLinks": true}` (set on first link-rewriting edit) |
| `appearance.json` | first open | `{}` — keys appear on change (`theme`, `cssTheme`, `enabledCssSnippets`, accent color, font size…) |
| `core-plugins.json` | first open | flat `{pluginId: boolean}` for all 30 core plugins |
| `community-plugins.json` | after Restricted Mode enabled | `[]` — array of enabled community plugin ids |
| `workspace.json` | first open | layout tree, see §3 |
| `workspace-mobile.json` | mobile only (referenced in code, not exercised) | separate layout for touch UI |
| `graph.json` | first graph open | 22 keys: `search`, `showTags`, `showAttachments`, `hideUnresolved`, `showOrphans`, `colorGroups`, `showArrow`, `textFadeMultiplier`, `nodeSizeMultiplier`, `lineSizeMultiplier`, `centerStrength`, `repelStrength`, `linkStrength`, `linkDistance`, `scale`, `close`, plus `collapse-*` UI flags |
| `hotkeys.json` | on first custom hotkey | `{commandId: [{modifiers:[…], key:"…"}]}` |
| `types.json` | on first manual property type change | `{propertyName: "text"|"number"|"date"|…}` (not created in a fresh vault: types are inferred) |
| `plugins/<id>/{manifest.json,main.js,styles.css,data.json}` | plugin install | `data.json` is written by `saveData()` |
| `themes/<name>/{manifest.json,theme.css}` | theme install | folder name must equal manifest `name` (documented) |
| `snippets/*.css` | user drops a file | enabled set lives in `appearance.json.enabledCssSnippets` |

No database, no index files inside the vault: the metadata index lives in **IndexedDB in userData** and is rebuilt if
missing. That is why deleting `.obsidian` never loses notes.

## 3. `workspace.json`

Structure (verified; screenshot `evidence/screenshots/11-restored-session.png`):

```json
{
  "main": { "id":"09a826302782015a", "type":"split", "direction":"vertical",
    "children":[ { "id":"8d187884c885475a", "type":"tabs", "children":[
      { "id":"f10e67ea111d998b", "type":"leaf",
        "state": { "type":"markdown",
                   "state": {"file":"Welcome.md","mode":"source","source":false},
                   "icon":"lucide-file", "title":"Welcome" } },
      { "id":"…", "type":"leaf", "state": {"type":"graph", "state":{}, "icon":"lucide-git-fork", "title":"Graph view"} },
      { "id":"…", "type":"leaf", "state": {"type":"canvas", "state":{"file":"Research.canvas"}, "icon":"lucide-layout-dashboard", "title":"Research"} }
    ]} ]},
  "left": { "id":"…", "type":"split", "direction":"horizontal", "width":300,
            "children":[{ "type":"tabs", "children":[
              {"type":"leaf","state":{"type":"file-explorer","state":{"sortOrder":"alphabetical","autoReveal":false,"showSearch":false,"searchQuery":""},…}},
              {"type":"leaf","state":{"type":"search","state":{"query":"","matchingCase":false,"explainSearch":false,"collapseAll":false,"extraContext":false,"sortOrder":"alphabetical"},…}},
              {"type":"leaf","state":{"type":"bookmarks","state":{…},…}} ]} ]},
  "right": { …backlink, outgoing-link, tag, all-properties, outline… },
  "active": "f10e67ea111d998b",
  "lastOpenFiles": ["Research.canvas","Welcome.md","Projects.base","Daily/2026-11-03.md", …]
}
```

Notes and edge cases:

* IDs are 16 hex chars, generated per node; they are stable across restarts (used by `activeLeaf` and panel focus).
* Sidebar width is persisted on the split (`"width": 300`); collapsed sidebars are represented by a CSS class
  (`is-sidedock-collapsed`) and the `right` subtree still exists.
* **Deferred restore**: after restart, `iterateAllLeaves` reported only the active markdown leaf plus one leaf per
  sidebar, while `workspace.json` still listed all nine leaves. Views materialise when activated.
* `lastOpenFiles` feeds the quick switcher's "recent" ordering.

## 4. Per-window state (`<userData>/<vaultId>.json`)

```json
{"x":448,"y":116,"width":1024,"height":800,"isMaximized":false,"devTools":false,"zoom":0}
```

Written on resize/move (debounced 100 ms) and on close; missing files are logged as
`Ignored: ENOENT … <vaultId>.json` (observed).

## 5. Vault registry and global config (`<userData>/obsidian.json`)

```json
{"vaults":{"a1b2c3d4e5f60718":{"path":"C:\\…\\ResearchVault","ts":1793683819733,"open":true}},"cli":true}
```

| Key | Meaning |
| --- | --- |
| `vaults[id] = {path, ts, open?}` | registry; `open:true` = restore this vault's window on start; `ts` = last used |
| `language` | UI locale (`set-language`) |
| `icon` | custom window icon filename (stored beside the JSON) |
| `frame` | `"native"` to use the OS title bar |
| `cli` | CLI enabled |
| `insider` | insider build channel |
| `isWork` | force managed-policy mode |
| `adblock`, `adblockFrequency` | web viewer list URLs / refresh interval (days) |

Vault ids are 16 chars (`St(16)`); the docs call this the "vault ID" and it is used by `obsidian://open?vault=<id>` and
"Copy vault ID". On startup invalid ids are re-keyed, missing folders are pruned, and the `Obsidian Help` pseudo-vault
is always excluded.

## 6. userData directory contents (observed after ~10 minutes of use)

```
Cache/  Code Cache/  GPUCache/  DawnGraphiteCache/  DawnWebGPUCache/     ← Chromium caches
Local Storage/leveldb  Session Storage  WebStorage  SharedStorage        ← web storage
IndexedDB/app_obsidian.md_0.indexeddb.leveldb                          ← metadata cache + file recovery
Network/  DIPS  DIPS-wal  Preferences  "Local State"  DevToolsActivePort
Partitions/vault-<id>/                                                  ← web viewer sessions
plugin-scripts/                                                          ← ? (plugin script root on disk)
blob_storage/  lockfile  id                                              ← single-instance lock
obsidian.json  <vaultId>.json  obsidian.log
```

**IndexedDB** (`app_obsidian.md` origin) is used for two things:

* **metadata cache**: object stores `file` (path → mtime/size) and `metadata` (path → `CachedMetadata`), written in one
  transaction (`transaction(["file","metadata"])`); a version mismatch clears and rebuilds ("Unable to delete cache, it
  is in use" is the error path when another window holds it).
* **file recovery**: object store `backups` with `autoIncrement` and indexes on `path` and `ts`; cleanup runs 60 s after
  start. This is the storage behind "File recovery: Open local history" and the CLI `history*` commands.

`plugin-scripts/` on disk corresponds to the `_plugin/` URL root served with `no-cache`; it holds scripts that plugins
may load as separate resources rather than bundling them.

## 7. Attachments and links on disk

* Attachments are ordinary files; an embed renders from `app://<token>/<absolute path>?<mtime>` (cache-busting query
  observed in the DOM).
* No sidecar files are created for links, tags or properties — everything is derived.
* A `.canvas` file is JSON; a `.base` file is YAML. Both are plain text and diffable.

## 8. Canvas format (JSON Canvas 1.0, verified against a hand-written file)

```json
{ "nodes":[
    {"id":"g1","type":"group","label":"Research group","x":-320,"y":-220,"width":900,"height":520},
    {"id":"n1","type":"text","text":"# Canvas text node\n\n- [[Welcome]]","x":-280,"y":-160,"width":360,"height":240},
    {"id":"n2","type":"file","file":"Welcome.md","x":120,"y":-160,"width":420,"height":300},
    {"id":"n3","type":"link","url":"https://obsidian.md","x":-280,"y":120,"width":300,"height":100}],
  "edges":[{"id":"e1","fromNode":"n1","fromSide":"right","toNode":"n2","toSide":"left"}] }
```

Observed/verified: load produced exactly 4 nodes and 1 edge; node types map to internal classes
`file/text/link/group`; edges carry `fromNode/fromSide/fromEnd/toNode/toSide/toEnd` and missing sides are auto-computed
(`uC(node, other)`), default `toEnd` = arrow. The internal clipboard uses MIME `application/obsidian/canvas`; z-order is
array order; group labels render as a heading on the group rectangle. Documented spec: https://jsoncanvas.org/spec/1.0/.

## 9. Bases format (YAML, verified)

Hand-written file accepted and rendered (1 result, table view):

```yaml
filters:
  and:
    - file.hasTag("project")
views:
  - type: table
    name: Projects
    order:
      - file.name
      - status
      - priority
  - type: cards
    name: Cards
```

Parser (`Base.fromString`) accepts an empty string (defaults to one table view named "Table") and the top-level keys
`views, filters, display, properties, formulas, summaries, newItemFolder, newItemTemplate`. Each view is
`{type, name, filters?, order?, limit?, groupBy?, groupOrder?, summaries?}`. Errors are surfaced as user-facing
messages ("Invalid query format", "View not found: X — Available views: …"). Documented syntax:
https://obsidian.md/help/bases/syntax.

## 10. What is *not* on disk

* No search index files (built in memory per session; likely persisted with the metadata cache — INFERRED).
* No per-note JSON, no database of properties, no thumbnail cache directory in the vault.
* No sync journal in the vault (Sync state lives in userData and the account, **UNKNOWN** beyond that).
* Plugin settings are per plugin (`data.json`), not centralised.

## 11. Reimplementation guidance

* Keep the vault **plain text + one hidden config dir**; put derived data outside the vault or in a clearly disposable
  cache dir. This is what makes Obsidian's file format an ecosystem rather than a lock-in.
* Use a key→value store with atomic commits for the index (SQLite WAL is the obvious choice) and version it so a
  crashed index can be discarded.
* Store window geometry separately from workspace layout (one file per vault id) — it avoids rewriting the layout on
  every drag.
* Give every workspace node a stable random id; it makes restore, panel focus and plugin references trivial.
* Model `.canvas` on JSON Canvas 1.0 and `.base` on YAML so files remain readable by other tools.
