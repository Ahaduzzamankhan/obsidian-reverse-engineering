# UI analysis: layout

Screenshots: `evidence/screenshots/` (01 main layout, 04 canvas, 05 bases, 06 search, 07 graph, 08 command palette,
09 settings, 10 reading view, 11 restored session, 12 reading view after restart).

## 1. Regions (measured live at 1024×800, DPR 1)

| Region | Size | Notes |
| --- | --- | --- |
| Window content | 1024 × 800 | frameless; custom title bar 30 px (`--titlebar-height`) |
| Left ribbon | **44 px** wide, full height below title bar | `padding: 8px 4px 12px`; icon button ≈ 28×24, `padding: 4px 6px` |
| Left sidebar | **300 px** default (persisted per vault) | header 40 px + tab strip 40 px + pane body |
| Root split | remainder | vertical split (`mod-vertical mod-root`) |
| Right sidebar | 300 px, collapsed by default on a fresh vault | `is-sidedock-collapsed` |
| Tab bar | **40 px** high | `padding: 0 8px`; active tab pill 25 px high, radius 4 px; tab text 13 px |
| View header (breadcrumb) | 40 px (`--header-height`) | back/forward arrows, crumb, right-side mode + "…" |
| Status bar | **27 px** high, right-aligned island | radius `8px 0 0`; item 18 px, text 12 px |
| Readable line width | **700 px** (`--file-line-width`) | centred column with padding |
| Inputs | 30 px (`--input-height`), radius 5 px, border `1px solid rgb(51,51,51)` | search box, palette input |

Editor typography: body **16 px / 24 px** (1.5), h1 **25.888 px** (= 16 × 1.618, weight 700, line-height 1.2),
metadata rows 16/24 in muted color (`#b3b3b3`), explorer rows 13 px with `padding: 4px 62px 4px 30px`.
UI text: 13 px small, 15 px medium, 20 px large.

## 2. Structure of the shell

```html
<div class="app-container">
  <div class="horizontal-main-container">
    <div class="workspace">
      <div class="workspace-ribbon side-dock-ribbon mod-primary">…</div>
      <div class="workspace-split mod-horizontal mod-sidedock mod-primary-split mod-left-split">
        <div class="workspace-tabs mod-top">
          <div class="workspace-tab-header-container">
            <div class="workspace-tab-header is-active">…</div>
          </div>
          <div class="workspace-tab-container"> <div class="workspace-leaf">…</div> </div>
        </div>
      </div>
      <div class="workspace-split mod-vertical mod-root"> … </div>
      <div class="workspace-split mod-horizontal mod-sidedock mod-secondary-split mod-right-split is-sidedock-collapsed">…</div>
      <div class="workspace-ribbon side-dock-ribbon mod-secondary is-collapsed">…</div>
    </div>
    <div class="status-bar">…</div>
  </div>
</div>
```

Notes:

* Sidebars are on **both sides of the root split** in DOM order; the right ribbon is a second `workspace-ribbon` with
  `mod-secondary`, so panels can also be opened on the right.
* `mod-left-split` / `mod-right-split` / `mod-root` identify the three logical containers; `mod-sidedock` marks
  collapsible panels.
* Each sidebar tab strip holds *panes as tabs* (Files, Search, Bookmarks on the left; Backlinks, Outgoing, Tags,
  Properties, Outline on the right) — a fresh vault opened with exactly those five right tabs.

## 3. Visual rhythm

* **Spacing**: 4 px base unit (4/8/12/16), 8 px inside list rows, 12 px side padding in headers, 16 px above headings.
* **Elevation**: sidebars are `#282828` (secondary) against the editor's `#1C1C1C` (primary); floating islands
  (status bar, palette, menus) add a 1 px border `#333333` and radius 8 px.
* **Density**: a note at 1024 px shows ~30 lines of body text; the file explorer fits ~22 rows at 800 px height.
* **Tab strip**: file name + icon + close affordance; modified files show a dot instead of the close button;
  non-markdown views show a type icon; `BASE`/`CANVAS` badges appear in the explorer, not the tab.

## 4. Responsive behaviour

| Condition | Behaviour |
| --- | --- |
| Sidebar collapse | width animates to 0, ribbon stays; state persisted in `workspace.json` |
| Window < ~700 px | root split keeps a single pane; tab strips scroll horizontally |
| Stacked tabs (`workspace:toggle-stacked-tabs`) | tab strip becomes a vertical list in the pane header |
| Mobile (`Platform.isMobile`) | different shell (`mobileNavbar`, `mobileToolbar`, `mobileTabSwitcher`, drawer sidebars) and a separate `workspace-mobile.json`; **not exercised** in this study |
| Popout windows | settings, help, vault chooser and any moved tab render the same shell minus the ribbon by default; body class `is-popout-window is-popout-modal` |
| RTL | workspace can be flipped (1.14); icons and external-link glyph have RTL variants (`external-link-rtl.svg`) |
| Zoom | per-window frame zoom −2.5…3 (persisted) |
| Multi-monitor | geometry restored as saved; no re-clamping observed |

## 5. Screenshot map (what each image proves)

| File | Proves |
| --- | --- |
| `01-main-layout.png` | shell regions, properties block, status bar counters, tab strip, explorer tree |
| `04-canvas.png` | canvas group node, text node with wikilinks, file node preview, link node with remote page, bottom toolbar |
| `05-bases.png` | base view header, view switcher, result count, table columns, empty cells |
| `06-search.png` | search controls, grouped results, match highlighting, per-file counts |
| `07-graph.png` | graph canvas, four control panels, unresolved node, labels |
| `08-command-palette.png` | palette list, category prefix, hotkey chips, dimmed backdrop |
| `09-settings.png` | settings **window**, sidebar sections, General tab content, account block |
| `10-reading-view.png` | reading view with properties, styled links, external-link glyph |
| `11-restored-session.png` | restored tabs/sidebar after hard kill |
| `12-reading-restore.png` | second restore, reading view render after activation |

## 6. Reimplementation checklist

1. Three-column grid: ribbon (44) · sidebar (`var`, 300) · content · optional right sidebar.
2. Fixed 40 px tab strip and 40 px view header; 27 px status island.
3. Editor column max-width 700 px, 16/24 body text; heading scale from a 1.618 ratio.
4. Everything themed through custom properties (see `themes.md`), including the sidebar/editor contrast step.
5. Persist sidebar widths and collapse state with the workspace, not separately.
