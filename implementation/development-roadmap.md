# Development roadmap

Assumes a small team (2–4 engineers) building the independent alternative described in
`architecture-recommendation.md`. Estimates are engineering effort, not calendar promises. Exit criteria are testable.

---

## Phase 0 — Foundations (≈2 weeks)

**Build**: repo, Electron/Tauri shell with the sandboxed window model, `app://` scheme (standard+secure), vault
open/create, `.obsidian` read/write, watcher, atomic writes, design tokens + component library skeleton, CI with unit +
Playwright.

**Exit criteria**
- Open an existing Obsidian vault unchanged; `workspace.json` is read but not yet honoured.
- Create a note from the UI; it appears on disk with the exact bytes typed.
- Kill -9 mid-write test leaves a valid file.
- Token snapshot test for ~60 design tokens passes in both themes.

## Phase 1 — Editor and index (≈5 weeks)

**Build**: CodeMirror 6 editor with wikilinks/embeds emphasis, reading view renderer, markdown AST → `CachedMetadata`,
SQLite index (files/meta/links/tags/props), link resolution, backlinks pane, file explorer, workspace tree with tabs and
splits, command registry + palette + default hotkeys, settings window with general/appearance/editor/files panes.

**Exit criteria**
- Fixture vault: `resolvedLinks`/`unresolvedLinks` match the golden JSON exactly.
- Rename/move matrix (bare, alias, heading, block, embed) rewrites links correctly in 100 % of cases and keeps the edge
  set identical.
- Workspace round-trips: serialize → reload → same visible tabs/files/sidebar widths.
- Palette finds and executes all registered commands; every default hotkey works.
- 10k-note vault index rebuild < 20 s; single edit re-index < 30 ms.

## Phase 2 — Search, properties, navigation polish (≈4 weeks)

**Build**: search parser/executor with operators + grouped UI, in-file find/replace, quick switcher, properties UI with
type inference and `types.json`, outline/tags/properties panes, bookmarks, back/forward history, hover preview, daily
notes + templates, attachments (images, drag & drop, attachment folder settings).

**Exit criteria**
- Search operator matrix (features/search.md §2) reproduces expected (files, matches) on the fixture vault.
- Property type inference table matches; invalid YAML never loses data.
- Attachments: paste/drag inserts file + embed; all three folder modes work.

## Phase 3 — Plugin host and API (≈6 weeks)

**Build**: plugin discovery, manifest validation, restricted mode, registration registry (commands, ribbon, status bar,
settings tabs, views, post-processors, editor extensions), `require("obsidian")` shim over your API, capability manifest
+ sandboxed host (or trusted-mode fallback), theme + snippet loading (`customCss`), plugin settings persistence.

**Exit criteria**
- Official sample plugin runs unmodified against the API.
- Enable/disable 100× leaves command/ribbon/status-bar/DOM counts at baseline.
- A plugin with `fs:write` not granted cannot write; a plugin that throws in `onload` is disabled with a notice.
- A community theme and a CSS snippet visually apply and hot-reload.

## Phase 4 — Knowledge features (≈6 weeks)

**Build**: graph view (worker simulation, filters/groups/display/forces, local graph), canvas (JSON Canvas 1.0, text/file/
group/link nodes, edges, selection, undo/redo, export image), Bases (YAML parse, expression engine, table view, filters,
sort/group/limit, cell editing), note composer, workspaces.

**Exit criteria**
- Canvas round-trip byte-stable on JSON Canvas spec examples; 500-node canvas interactive.
- Base file from the docs renders correct rows/columns; cell edit writes only the intended frontmatter line.
- Graph 5k nodes ≥ 30 fps pan/zoom; unresolved links toggle works.

## Phase 5 — Automation and services (≈4 weeks, parallelisable)

**Build**: CLI (socket + command table + TSV/JSON output + completions; optional TUI), `obsidian://` deep links, PDF
export, local file history (snapshots + diff + restore), multi-window/popouts, updater with signed manifests.

**Exit criteria**
- CLI reproduces the verified command outputs on the fixture vault.
- `history` restores a deleted note; diff view shows only intended lines.
- Deep links open/create/daily/search behave as documented.
- Update flow verifies a signature and refuses an unsigned payload.

## Phase 6 — Optional / later (ongoing)

Web viewer in a properly sandboxed view; static publish/export; sync via generic file sync + conflict files; mobile
companion; managed-policy equivalent; plugin marketplace with signing.

---

## Sequencing rationale

1. **Index before features.** Backlinks, search, graph, Bases and properties are all projections of the same cache; doing
   it once avoids five divergent implementations.
2. **Workspace before plugins.** Plugin views need a stable leaf/state model.
3. **Plugin host after the API is real.** Dogfooding core plugins (file explorer, search, backlinks) through the public
   API is the cheapest way to find gaps.
4. **CLI late but before 1.0.** It doubles as the parity test harness.
5. **Never start with Sync/Publish.** They are the only parts that require servers; the filesystem already gives users
   alternatives.

## Risk register (project-level)

| Risk | Mitigation |
| --- | --- |
| Plugin API compatibility spirals (150 symbols) | Contract tests + implement only what real plugins use; publish a compatibility table |
| Live Preview complexity | Timebox; ship source + reading view first, Live Preview as progressive enhancement |
| Link-rewrite bugs corrupt user data | Pure function + fuzz tests + journaled renames + dry-run mode |
| Sanitizer bypass = RCE | Sandbox the renderer from day one (do not repeat RQ1) |
| Performance regressions as index grows | Benchmarks in CI on 1k/10k/100k fixture vaults |
| Scope creep into mobile/sync | Explicit non-goals in the roadmap; keep the file format clean so others can build those |

## Definition of done for v1.0

* A user can point the app at an existing Obsidian vault, edit notes with Live Preview and reading view, navigate with
  tabs/splits/palette/switcher, search with operators, follow links and inspect backlinks, use properties and Bases,
  install a plugin and a theme, and export a PDF — with **no data loss** and **no silent format drift**.
* All P0/P1 items in `feature-parity.md` implemented or explicitly waived with a note.
* Security posture better than the baseline: sandboxed renderer, capability-checked plugins, signed updates.
