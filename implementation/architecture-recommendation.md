# Recommended architecture for an independent Obsidian alternative

Goal: reproduce the observed behaviour and data formats **without** copying proprietary source, while fixing the two
things Obsidian cannot easily change: renderer privilege and plugin isolation. Everything here is a recommendation
derived from the findings, not a description of Obsidian.

---

## 1. Stack choice

| Layer | Recommendation | Why |
| --- | --- | --- |
| Shell | **Electron** (latest LTS-ish) or **Tauri 2** if you accept a Rust core | Electron gives exact DOM/CodeMirror parity and Node for plugins; Tauri gives a smaller, sandboxed core but complicates the plugin API |
| UI | **TypeScript + vanilla DOM components** (no React) | Obsidian's UI is class + CSS-token based; a component library mirrors it best and keeps the plugin API DOM-shaped |
| Editor | **CodeMirror 6** + Lezer markdown | Matches Live Preview feasibility; CM6 is what the observed editor uses |
| Index store | **SQLite (WAL)** in userData | Fast, transactional, easy to rebuild; avoids IndexedDB quirks and gives a query surface for Bases |
| Index format | on-disk: `files(path, mtime, size, hash)`, `meta(path, json)`, `links(src, dst, count, json)`, `tags`, `props(path,key,value,type)`, FTS5 table for search | one place for search, backlinks, Bases, graph |
| Markdown | `micromark`/`mdast` **or** Lezer with a unified AST | one parse → cache + render |
| Math / diagrams / code | KaTeX (or MathJax for parity), Mermaid, Shiki/Prism | lazy-loaded |
| Graph | 2D canvas or WebGL (PixiJS optional) + worker simulation | same shape as observed |
| Plugins | Worker/iframe host with capability manifest **or** in-renderer Node host for compatibility | explicit decision, see §6 |
| Packaging | electron-builder / Tauri bundler, signed, auto-update with signature verification | |
| i18n | `i18next` with JSON catalogues | same approach as observed |
| Tests | Vitest (units), Playwright (UI), fixture vault corpus, golden CLI outputs | |

## 2. Module map

```
apps/desktop/            Electron main: windows, protocol, IPC, menus, updater, CLI server
apps/renderer/           shell: workspace, tabs, panes, palette, settings
packages/core-vault/     Vault, DataAdapter, watcher, atomic writes, link rewriting
packages/core-markdown/  parser, AST, CachedMetadata, sanitizer, renderer (reading view)
packages/core-index/     SQLite index, link resolution, backlinks, tags, properties, search
packages/core-workspace/ workspace tree, serialization, deferred views, history
packages/core-commands/  command registry, hotkeys, scopes
packages/editor/         CodeMirror 6 setup, Live Preview extensions, widgets
packages/features/       explorer, search, backlinks, outline, bookmarks, daily, templates, canvas, bases, graph
packages/ui/             component library + design tokens (CSS custom properties)
packages/plugin-api/     the public API surface + registration registry
packages/plugin-host/    loader, sandbox bridge, capability checks
packages/cli/            command table, socket server, formatter, TUI
```

Rule: **features never touch the filesystem directly**; they go through `core-vault` and `core-index`. That single rule
is what keeps rename/link correctness and index consistency sane.

## 3. Core services and contracts

```ts
interface VaultService {
  list(): TAbstractFile[];
  read(path: string): Promise<string>;
  process(path: string, fn: (old: string) => string): Promise<string>;   // atomic read-modify-write
  write(path: string, data: string | Uint8Array): Promise<void>;
  create(path: string, data?: string): Promise<TFile>;
  mkdir(path: string): Promise<TFolder>;
  rename(file: TAbstractFile, newPath: string, opts?: { rewriteLinks?: boolean }): Promise<void>;
  remove(file: TAbstractFile, opts?: { trash?: boolean }): Promise<void>;
  on(evt: "create" | "modify" | "delete" | "rename", cb: (f: TAbstractFile, oldPath?: string) => void): () => void;
}

interface IndexService {
  upsert(path: string, meta: CachedMetadata, text: string): void;
  remove(path: string): void;
  backlinks(path: string): Map<string, LinkCache[]>;
  resolve(linkpath: string, from: string): string | null;
  search(query: string, opts?: SearchOptions): SearchResult;
  queryBases(base: BaseDefinition): BasesQueryResult;
}

interface CommandRegistry {
  add(cmd: Command, owner?: string): void;
  remove(id: string): void;
  execute(id: string, ctx?: unknown): boolean;
  all(): Command[];
}
```

**Write pipeline** (per path, serialised): acquire lock → write `.tmp` in the same directory → fsync → rename →
update index → emit `modify`. Rename/move wraps the filesystem rename and the link-rewrite pass in one operation with a
journal entry so a crash can be recovered on next start.

## 4. Data formats (compatibility as a feature)

| Format | Decision |
| --- | --- |
| Vault layout | identical: `.md`, attachments, `.obsidian/` |
| `.obsidian/*.json` | read the observed schemas (`architecture/storage-architecture.md`); write the same keys you read, keep unknown keys |
| `workspace.json` | same `split/tabs/leaf` shape with 16-hex ids |
| `.canvas` | **JSON Canvas 1.0** exactly |
| `.base` | read/write YAML as documented |
| `obsidian://` | support the documented actions |
| Plugin manifests | same `manifest.json` fields |
| Theme/snippet dirs | same layout |

Being format-compatible means a user can point the app at an existing vault, and third-party tooling keeps working. It
does **not** require copying code.

## 5. Renderer security design (the main divergence)

```
main process
 ├─ BrowserWindow (app shell)            webPreferences: contextIsolation:true, nodeIntegration:false, sandbox:true
 │    └─ preload exposing a narrow, typed bridge (invoke-only channels)
 └─ WebContentsView for note content?    (optional) OR render markdown in-app with a strict sanitizer
```

* **App shell origin**: custom scheme (`app://app`) registered standard+secure; no remote content ever loaded there.
* **Note HTML**: render in-app but sanitise with DOMPurify and disallow iframes by default; if you need true isolation,
  render notes in a sandboxed `<iframe sandbox="allow-scripts">` with a `postMessage` bridge and **no** same-origin
  access.
* **Web viewer** (if built): separate `WebContentsView` with `nodeIntegration:false, contextIsolation:true,
  sandbox:true`, one session partition per vault, permission handler denying everything except clipboard, and no
  preload.
* **No `@electron/remote`**, no `webviewTag`.
* CSP on the shell: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:
  blob:; connect-src 'self'; frame-src 'none'`.

## 6. Plugin hosting decision

| Option | Compatibility | Security | Effort |
| --- | --- | --- | --- |
| **A. In-renderer, Node enabled** (what Obsidian does) | 100 % | none (plugin = RCE) | lowest |
| **B. Sandboxed worker/iframe + RPC of the API** | partial (Node-using plugins break) | strong (capabilities) | high |
| **C. Hybrid**: sandbox by default, "trusted plugin" escape hatch | high | medium | medium |

**Recommendation: C.** Ship option B for everything, with a per-plugin "grant full access" toggle stored in settings and
surfaced with a clear warning; that keeps the ecosystem viable while making the default safe. Whatever you choose,
implement a **capability manifest** (`vault:read`, `vault:write`, `net:https://api.x`, `clipboard`, `shell:open`) and
enforce it in the host, because that is the one area where Obsidian's model cannot be fixed after the fact.

## 7. Performance targets (derived from the observed app, not from marketing)

| Metric | Target |
| --- | --- |
| App cold start → usable window | < 1.5 s (Obsidian showed ~1 s to first paint on this machine) |
| 10k-note vault: index rebuild | < 20 s; incremental single-file update < 30 ms |
| Open 1 MB note | < 300 ms to first paint |
| Search p95 (warm, 10k notes) | < 150 ms |
| Graph 5k nodes | ≥ 30 fps pan/zoom |
| Memory (idle, 10k notes) | < 600 MB RSS total |
| Editor keystroke → paint | < 16 ms at 10k lines |

## 8. Divergences worth making deliberately

1. **Real plugin sandbox** (see §6) — the single biggest improvement.
2. **SQLite index** instead of IndexedDB — better tooling, easier backup/migration, FTS5 for search.
3. **Encrypted local history** and an explicit retention policy.
4. **Accessibility**: proper `role="tree"` with arrow-key navigation, visible focus rings, reduced motion.
5. **CLI on by default? No** — same default as Obsidian (off), but expose a documented JSON-RPC mode.
6. **Crash safety**: journaled renames with link rewrite, plus an index-rebuild command.
7. **No hidden "settings mutation"**: write config only when the user changes a value (Obsidian writes `app.json`
   lazily, which surprised the tests).

## 9. Non-goals

* Bit-for-bit UI pixel parity; aim for behavioural and token parity.
* Copying Obsidian's internal class names into your public API (only the documented public API names matter).
* Reimplementing Sync/Publish server protocols without documentation.
* Mobile in v1.
