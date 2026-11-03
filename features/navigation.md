# Feature: Navigation and workspace

**Priority P0.** Evidence: `evidence/screenshots/01-main-layout.png`, `08-command-palette.png`,
`11-restored-session.png`; `workspace.json`; `evidence/probes/commands.json`.

## 1. Layout model

```
┌ ribbon ┬──── left sidebar (split) ────┬────── root split (vertical) ──────┬── right sidebar ──┬ ribbon ┐
│ icons  │ tabs: Files | Search |       │ tab bar: Welcome | Graph | Canvas │ tabs: Backlinks | │       │
│        │       Bookmarks …            │ breadcrumb / view header          │ Outgoing | Tags  │       │
│        │                              │ view body                          │ Properties |     │       │
│        │                              │                                    │ Outline          │       │
└────────┴──────────────────────────────┴────────────────────────────────────┴───────────────────┴───────┘
                                          status bar (word count, backlinks, sync, …)
```

* Ribbon: vertical icon strip, one action per core plugin/community plugin (`addRibbonIcon`), tooltip = command title.
* Both sidebars are collapsible (`is-sidedock-collapsed`) and resizable (`width` persisted).
* Root split direction is vertical; users can split right (`workspace:split-vertical`) or down
  (`workspace:split-horizontal`), producing nested `split → tabs → leaf` nodes.
* Tab bar affordances: stacked-tabs toggle, new tab, split menu, "…" view menu, drag to reorder/move between panes,
  close (`Mod+W`), undo close (`Mod+Shift+T`), pin, groups.
* Multi-window: any tab can be moved to a new window (`workspace:move-to-new-window`) or opened in one
  (`workspace:open-in-new-window`); popouts share the vault and renderer affinity.

## 2. Navigation controls

| Affordance | Behaviour |
| --- | --- |
| Back / forward arrows in the view header | per-leaf history of files (and headings); `Mod+Alt+←/→` (`app:go-back`, `app:go-forward`) |
| Breadcrumb | path segments of the active file; click a folder to reveal in explorer |
| Quick switcher (`Mod+O`) | fuzzy file search, `#` to include headings? (Obsidian: prefix `#` searches headings), `:` commands? — the switcher offers "Create new note" for non-matching input |
| Command palette (`Mod+P`) | fuzzy over command names with category prefix and hotkey badges (verified screenshot) |
| Bookmarks (`bookmarks` plugin) | bookmark files, folders, searches, headings, blocks; flat list or tree; drag to reorder |
| Recent files | `lastOpenFiles` in `workspace.json` + OS recent-documents registration (`app.addRecentDocument`) |
| Outline | headings of the active note (`outline` plugin), click to jump |
| Random note / daily note / previous-next daily | commands in `random-note`, `daily-notes` plugins |
| Workspaces (core plugin, off by default) | named saved layouts, "Save current layout", "Load workspace" |

## 3. Commands that implement this area (from the 204, VERIFIED ids)

```
workspace:toggle-pin            workspace:split-vertical        workspace:split-horizontal
workspace:toggle-stacked-tabs   workspace:edit-file-title       workspace:copy-path
workspace:copy-full-path        workspace:copy-url              workspace:undo-close-pane
workspace:export-pdf            workspace:open-in-new-window    workspace:move-to-new-window
workspace:next-tab              workspace:previous-tab          workspace:goto-tab-1..8
workspace:goto-last-tab         workspace:close                 workspace:close-window
workspace:close-others          app:go-back  app:go-forward  app:open-settings  app:open-help
switcher:open  command-palette:open  graph:open  graph:open-local  outline:open  bookmarks:*
```

Default hotkeys (41 total): `Mod+T` new tab, `Mod+W` close, `Mod+Shift+W` close window, `Mod+1…8` tab N, `Mod+9` last
tab, `Ctrl+Tab`/`Ctrl+Shift+Tab` cycle, `Mod+Alt+←/→` history, `Mod+,` settings, `F1` help, `Mod+O` switcher,
`Mod+P` palette, `Mod+N` new note, `Mod+Shift+N` new note in new pane.

## 4. Persistence

`workspace.json` (schema in `architecture/storage-architecture.md#3`) stores:

* the full `main`/`left`/`right` trees with node ids, split directions and sidebar widths,
* per-leaf `state.type` (`markdown`, `graph`, `canvas`, `file-explorer`, `search`, `backlink`, `outline`, `tag`,
  `all-properties`, …) and view-specific state (file path, mode, sort, filters, scroll via ephemeral state),
* `active` (leaf id) and `lastOpenFiles`.

**Verified restore behaviour**: after a hard kill and relaunch, the active markdown tab and one tab per sidebar were
live, while the remaining tabs stayed deferred until clicked (`workspace.json` still listed all of them). Restore is
therefore *state-complete but instantiation-lazy*.

## 5. Technical requirements

* Workspace tree classes with stable ids and `getViewState/setViewState` per view.
* A layout serializer that walks the tree and writes atomically (debounced) on any structural change.
* Deferred view instantiation: create the leaf's *state* immediately, the *view object* on first reveal.
* History stack per leaf (file path + scroll + cursor), capped, with back/forward.
* Fuzzy matcher: subsequence scoring with word-boundary and prefix bonuses (`prepareFuzzySearch`, `fuzzySearch` are
  public API), plus a "create if missing" affordance.
* Palette rendering: virtualised list, ARIA roles (`role="dialog"`, `role="option"`, `aria-selected`), hotkey chips.
* Keyboard model: a `Scope` stack (global → modal → editor) where the innermost scope with a matching binding wins;
  `Mod` maps to `Cmd` on macOS.

## 6. Edge cases

* Closing the last tab in a pane collapses the pane (and re-normalises split directions).
* Dragging a tab into a sidebar / out of the window; dropping a note onto a tab bar (opens in that pane).
* Restoring a layout that references deleted files (leaf must fall back to an empty state, not crash).
* Very deep split nesting; mixed DPI multi-monitor; window geometry off-screen after monitor removal
  (Obsidian clamps to 300×200 minimum but does not reposition — verify before copying).
* Command palette with 204+ commands and fuzzy input that matches nothing.
* Hotkey conflicts (two commands bound to the same key) — Obsidian shows a warning in Settings → Hotkeys.

## 7. Testing strategy

* Round-trip test: build a layout programmatically → serialize → reload → assert structural equality and that every
  visible leaf has the same view type/file.
* Kill -9 during editing, relaunch, assert no data loss and layout restored.
* Keyboard matrix test: every default hotkey executes exactly one command and is discoverable in the palette.
* Accessibility: palette and switcher must be operable with arrows/Enter/Escape and announce the selection.

## 8. Implementation sketch

* `WorkspaceService` with a tree of `Node {id, type, parent, children, size}` and `Leaf {viewState, ephemeral}`.
* Render panes as CSS grid with explicit `grid-template-*` derived from the tree; drag-and-drop manipulates the tree
  first, then re-renders (never mutate DOM as the source of truth).
* Defer views: keep `viewState` only; instantiate on `reveal()`.
* Persist with a 300–500 ms debounce plus a final flush on `beforeunload`/`quit`.

## 9. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Tabs + splits + close/undo-close + persistence | M | **P0** |
| Back/forward history, breadcrumb | S | **P0** |
| Command palette + fuzzy search | M | **P0** |
| Quick switcher (files + aliases + headings) | M | **P0** |
| Sidebar panes (explorer/search/backlinks/outline/tags/properties) | M | **P0** |
| Bookmarks (files/folders/searches/headings/blocks) | M | P1 |
| Multi-window and popouts | M | P1 |
| Saved workspaces (named layouts) | S | P2 |
| Stacked tabs, tab groups | M | P2 |
