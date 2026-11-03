# UI analysis: component inventory

Class names below were read from the live DOM unless marked. Sizes from `layout.md` measurements. This is the
inventory a component library must cover to reproduce Obsidian's look and feel.

## 1. Shell components

| Component | Classes / anatomy | States |
| --- | --- | --- |
| App container | `.app-container > .horizontal-main-container > .workspace` | `is-focused`, `is-popout-window`, `is-hidden-frameless` |
| Title bar | `.titlebar`, `.titlebar-button`, window controls | `mod-windows`, `mod-macos`, `is-flashing` |
| Ribbon | `.workspace-ribbon.side-dock-ribbon.mod-primary` > `.side-dock-ribbon-action` | hover (background), active view highlight, tooltip |
| Sidebar split | `.workspace-split.mod-sidedock` | `is-sidedock-collapsed`, resize handle (`workspace-leaf-resize-handle`) |
| Tab strip | `.workspace-tab-header-container`, `.workspace-tab-header` | `is-active`, `is-active mod-active`, `has-focus`, `is-pinned`, `mod-cta` |
| Tab | `.workspace-tab-header-inner` > `.workspace-tab-header-inner-icon`, `-title`, `-close-button` | modified dot, hover close |
| View header | `.view-header` > `.view-header-nav-buttons`, `.view-header-breadcrumb`, `.view-actions` | disabled arrows |
| Status bar | `.status-bar` > `.status-bar-item` | hover, `mod-clickable`, plugin items |
| Splitter | `.workspace-leaf-resize-handle` | hover highlight |

## 2. Panes / views

| Pane | Root class | Notable children |
| --- | --- | --- |
| File explorer | `.nav-files-container` | `.nav-header`, `.nav-file`, `.nav-folder`, `.nav-file-title`, `.nav-folder-title`, `.nav-file-tag`, `.collapse-icon` |
| Search | `.search-view` | `.search-input-container`, `.search-results-children`, `.search-result`, `.search-result-file-title`, `.search-result-file-match`, `.search-result-file-matched-text`, `.tree-item-flair` |
| Backlinks | `.backlink-pane` | `.tree-item`, `.search-result-file-match`, `.backlink-pane-header` |
| Outline | `.outline` | `.tree-item`, indent guides |
| Tags | `.tag-container` | `.tag-pane-tag`, counts |
| Properties (all) | `.all-properties` | `.property-row` |
| Graph | `.graph-view` | `.graph-controls`, `.graph-control-section`, canvas |
| Canvas | `.canvas-wrapper` | `.canvas-node`, `.canvas-node-content`, `.canvas-node-label`, `.canvas-edge`, `.canvas-controls`, `.canvas-menu` |
| Bases | `.bases-view` | `.bases-header`, `.bases-search-row`, `.bases-error`, `.bases-table`, `.bases-cards` |

## 3. Core widgets (public API classes)

`ButtonComponent`, `ExtraButtonComponent`, `ToggleComponent`, `TextComponent`, `TextAreaComponent`, `SearchComponent`,
`DropdownComponent`, `SliderComponent`, `ColorComponent`, `MomentFormatComponent`, `ProgressBarComponent`,
`SecretComponent`, `Setting`, `SettingGroup`, `ConfirmationButton`, `Menu/MenuItem/MenuSeparator`, `Modal`,
`SuggestModal`, `FuzzySuggestModal`, `AbstractInputSuggest`, `Notice`, `HoverPopover`, `Tooltip`.

Anatomy of a settings row (used everywhere):

```html
<div class="setting-item">
  <div class="setting-item-info">
    <div class="setting-item-name">Spellcheck</div>
    <div class="setting-item-description">Turn on the spellchecker.</div>
  </div>
  <div class="setting-item-control"><div class="checkbox-container is-enabled"><input type="checkbox"></div></div>
</div>
```

## 4. Editor components

| Component | Anatomy | Notes |
| --- | --- | --- |
| Editor root | `.markdown-source-view.cm-s-obsidian > .cm-editor` | CM6; `HyperMD-header-1`, `cm-header-1`, `cm-link`, `cm-url`, `cm-tag`, `cm-attribute` token classes |
| Line | `.cm-line` | folding gutter `.cm-fold-indicator`, `cm-active` on the caret line |
| Widgets | `.cm-html-embed`, `cm-widgetBuffer`, `.internal-embed`, `.image-embed` | atomic ranges |
| Reading view | `.markdown-preview-view.markdown-rendered` > `.markdown-preview-sizer` | blocks: `.el-h1`, `.el-p`, `.el-ul`, `.mod-frontmatter`, `.mod-header`, `.callout` |
| Inline title | `.inline-title` (contenteditable) | 25.888 px bold, same as h1 |
| Properties | `.metadata-container` > `.metadata-properties-heading`, `.metadata-property`, `.metadata-property-key`, `.metadata-property-value`, `.metadata-error-container` | collapsible, `data-property-count` |
| Callout | `.callout` with `data-callout="note"` > `.callout-title`, `.callout-title-inner`, `.callout-content`, `.callout-icon` | type-driven color via `--callout-*` |
| Code block | `.HyperMD-codeblock`, `.cm-s-obsidian` + Prism tokens | copy button on hover |
| Table | `.markdown-rendered table` | `--table-*` tokens (38) |
| Tag pill | `.tag` | `--tag-*` tokens |
| Embed | `.internal-embed.markdown-embed` | nested scroll, "open" affordance |

## 5. Overlays

| Overlay | Anatomy | Behaviour |
| --- | --- | --- |
| Command palette | `.prompt` (modal) > `.prompt-input-container`, `.prompt-input`, `.prompt-results`, `.suggestion-item.is-selected`, `.prompt-instructions` | fuzzy list, hotkey chips, instructions footer |
| Quick switcher | same shell with file suggestions + "Create new note" | |
| Suggest popover | `.suggestion-container` > `.suggestion-item` | anchored to the editor (`AbstractInputSuggest`) |
| Modal | `.modal-container` > `.modal-bg`, `.modal`, `.modal-title`, `.modal-content`, `.modal-button-container` | Esc closes; focus trap |
| Settings window | own window: `.mod-settings > .vertical-tab-header` + `.vertical-tab-content` | searchable, keyboard nav (1.13) |
| Menu | native OS menu (`Menu.popup`) on desktop | not HTML — important for a11y parity |
| Notice | `.notice-container` > `.notice` | stacked toasts, auto-dismiss, `--notice-*` tokens |
| Tooltip | `.tooltip` with `data-tooltip-position` | delayed, positioned |
| Hover preview | `.popover.hover-popover` | rendered note preview |
| Context menus in lists | `.menu` when rendered in-DOM (mobile/fallback) | |

## 6. Iconography

* **Lucide** SVG icons, referenced by `lucide-*` ids (234 distinct ids appear in `app.js`): `lucide-file`,
  `lucide-folder-closed`, `lucide-search`, `lucide-bookmark`, `lucide-git-fork`, `lucide-layout-dashboard`,
  `lucide-chevron-up/down`, `lucide-flask-conical`, ….
* Icons are inlined `<svg>` with `stroke="currentColor"`, 16/18/24 px sizes (`--icon-s/m/l`).
* Public API: `addIcon(id, svg)`, `getIcon`, `getIconIds`, `setIcon(el, id)`, `removeIcon` — third-party plugins ship
  custom icons through this.

## 7. Accessibility observations

* Modals/palette use `role="dialog"`, `aria-modal`, `role="listbox"/"option"`, `aria-selected`; the palette input is a
  combobox with `aria-controls`.
* Settings controls are real `<input type=checkbox|text|range>` elements wrapped in styled containers
  (`.checkbox-container`), so focus and Space work natively.
* Tab strip items are `<div>` with `tabindex`; arrow-key navigation exists but is inconsistent (menus are native).
* Tooltips duplicate `aria-label` text; icon-only buttons carry `aria-label`.
* Contrast (dark theme): body text `#dadada` on `#1C1C1C` ≈ 11.9:1; muted `#b3b3b3` ≈ 8.3:1; faint `#666666` ≈ 3.1:1
  (below AA for body, used for metadata only); accent `hsl(258 88% 66%)` on dark ≈ 5.2:1.

## 8. Component build order for a clone

Buttons and inputs (button, icon button, toggle, text/search/dropdown/slider) come first; then the setting row and
`SettingGroup`; then modal, notice and tooltip; then tab strip, pane and splitter; then a single reusable tree item
(the explorer, search, backlinks and outline all use the same one); then the suggest/palette shell; then editor
chrome; then Bases table/cards; then canvas nodes; and last the graph overlay panels.
