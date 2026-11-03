# Frontend architecture (renderer)

Evidence: `_extract/asar-obsidian/app.js` (3,372,270 bytes, 625 lines, identifier-mangled but string-rich),
`index.html`, `app.css` (598,237 bytes), live `App` object probes (`evidence/probes/*.json`).

## 1. Bundle shape

* One **esbuild-style IIFE** (`(()=>{ … })()`), no webpack runtime, **no source maps**, no dynamic `import()` of app
  code — the whole application is a single script evaluated after the DOM is parsed.
* No React/Vue/Svelte: UI is hand-written DOM with a prototype/class hierarchy and CSS classes
  (`createDiv`, `createEl`, `addClass`, `toggleClass` helpers in the API).
* Vendor code is *inside* `app.js` (CodeMirror 6, Lezer markdown, PIXI consumer, moment, i18next, pdf.js glue,
  Turndown, DOMPurify) **and** also shipped as classic scripts in `lib/` for the auxiliary windows.

`index.html` loads, in order, all `defer`:

```
lib/codemirror/codemirror.js  lib/codemirror/overlay.js  lib/codemirror/markdown.js
lib/codemirror/cm-addons.js   lib/codemirror/vim.js      lib/codemirror/meta.min.js
lib/moment.min.js  lib/i18next.min.js  lib/scrypt.js  lib/turndown.js
enhance.js   i18n.js   app.js
```

`enhance.js` is a polyfill layer (e.g. `Object.isEmpty`, `Array.combine`, `URL.parse`, `ResizeObserver` fallback,
`matchMedia().addEventListener` shim) — evidence that the same bundle also targets older/mobile WebViews.

## 2. The `App` object (VERIFIED by `Object.keys(app)`)

```
appMenuBarManager  embedRegistry  viewRegistry  nextFrameEvents  nextFrameTimer  isMobile
mobileToolbar  mobileNavbar  mobileTabSwitcher  mobileQuickActions  lastEvent  title  appId
keymap  scope  commands  hotkeyManager  dragManager  dom  customCss  shareReceiver  renderContext
secretStorage  cli  vault  workspace  fileManager  statusBar  metadataCache  metadataTypeManager
foldManager  internalPlugins  plugins  setting
```

`window.app` is the single service locator — the public API's `App` class is this object. Notable services:

| Service | Role |
| --- | --- |
| `vault` | `Vault` facade over a `DataAdapter` (`FileSystemAdapter`, `CapacitorAdapter`) |
| `workspace` | window/split/tab/leaf tree, active leaf, events |
| `metadataCache` | derived index: links, backlinks, headings, blocks, tags, frontmatter |
| `metadataTypeManager` | property types/widgets (`text`, `number`, `date`, `datetime`, `checkbox`, `tags`, `aliases`, `file`, `folder`, `multitext`, `property`) |
| `commands` | command registry + hotkey binding |
| `plugins` / `internalPlugins` | community and core plugin hosts |
| `viewRegistry` | extension → view type, 20 registered views |
| `setting` | settings tabs/sections and the settings window |
| `customCss` | themes + CSS snippets |
| `secretStorage` | OS keychain (1.11+) |
| `foldManager`, `statusBar`, `dragManager`, `embedRegistry`, `renderContext` | editor folding, status bar items, drag & drop, embeds, render context |

## 3. Public API export map (the `obsidian` module)

The plugin API is a single object literal mapping ~150 names to internal classes (`abstract`, alphabetical). This is the
compatibility contract a clone must reproduce. Full list as shipped in 1.15.0:

**Core**: `App`, `Plugin`, `PluginSettingTab`, `SettingTab`, `Setting`, `SettingGroup`, `SettingPage`, `Component`,
`BaseComponent`, `Events`, `Keymap`, `Scope`, `Platform`, `Vault`, `FileManager`, `FileSystemAdapter`,
`CapacitorAdapter`, `TAbstractFile`, `TFile`, `TFolder`, `TExternalFile`, `Workspace`, `WorkspaceLeaf`,
`WorkspaceItem`, `WorkspaceParent`, `WorkspaceRoot`, `WorkspaceSplit`, `WorkspaceTabs`, `WorkspaceSidedock`,
`WorkspaceRibbon`, `WorkspaceContainer`, `WorkspaceFloating`, `WorkspaceWindow`, `View`, `ItemView`, `FileView`,
`EditableFileView`, `TextFileView`, `MarkdownView`, `MarkdownPreviewView`, `MarkdownPreviewRenderer`,
`MarkdownPreviewSection`, `MarkdownRenderer`, `MarkdownRenderChild`, `Editor`, `EditorSuggest`, `MetadataCache`,
`ViewRegistry`.

**UI components**: `Modal`, `SuggestModal`, `FuzzySuggestModal`, `PopoverSuggest`, `AbstractInputSuggest`,
`HoverPopover`, `Notice`, `Menu`, `MenuItem`, `MenuSeparator`, `ButtonComponent`, `ExtraButtonComponent`,
`ToggleComponent`, `TextComponent`, `TextAreaComponent`, `SearchComponent`, `DropdownComponent`, `SliderComponent`,
`ColorComponent`, `MomentFormatComponent`, `ProgressBarComponent`, `SecretComponent`, `ValueComponent`,
`AbstractTextComponent`, `ConfirmationButton`, `ConfirmationModal`.

**Bases (1.9–1.10 API)**: `BasesView`, `BasesViewConfig`, `BasesQueryResult`, `BasesEntry`, `BasesEntryGroup`,
`QueryController`, `Value`, `PrimitiveValue`, `StringValue`, `NumberValue`, `BooleanValue`, `DateValue`,
`RelativeDateValue`, `DurationValue`, `FileValue`, `LinkValue`, `ListValue`, `ObjectValue`, `HTMLValue`, `ImageValue`,
`UrlValue`, `TagValue`, `RegExpValue`, `NullValue`, `NotNullValue`.

**Helpers/functions**: `addIcon`, `removeIcon`, `getIcon`, `getIconIds`, `setIcon`, `setTooltip`, `displayTooltip`,
`apiVersion`, `requireApiVersion`, `debounce`, `normalizePath`, `getLinkpath`, `parseLinktext`, `stripHeading`,
`stripHeadingForLink`, `getFrontMatterInfo`, `parseFrontMatterEntry`, `parseFrontMatterTags`,
`parseFrontMatterAliases`, `parseFrontMatterStringArray`, `parsePropertyId`, `parseYaml`, `stringifyYaml`,
`getAllTags`, `iterateRefs`, `iterateCacheRefs`, `prepareFuzzySearch`, `prepareSimpleSearch`, `prepareQuery`,
`fuzzySearch`, `sortSearchResults`, `renderMatches`, `renderResults`, `renderMath`, `finishRenderMath`, `loadMathJax`,
`loadMermaid`, `loadPdfJs`, `loadPixi`, `loadPrism`, `request`, `requestUrl`, `sanitizeHTMLToDom`, `htmlToMarkdown`,
`arrayBufferToBase64`, `base64ToArrayBuffer`, `arrayBufferToHex`, `hexToArrayBuffer`, `getBlobArrayBuffer`,
`getLanguage`, `moment`, `resolveSubpath`, `editorEditorField`, `editorInfoField`, `editorLivePreviewField`,
`editorViewField`, `livePreviewState`.

**Notable shapes**: `CachedMetadata` (documented) matches the runtime object exactly —
`{links, embeds, tags, headings, sections, blocks, frontmatter, frontmatterPosition, frontmatterLinks,
referenceLinks, listItems, footnotes, footnoteRefs}` (all optional). `BasesViewConfig`/`BasesQueryResult` are the
plugin-facing wrapper over the `.base` query engine.

## 4. View registry (VERIFIED, 20 types)

```
markdown  image  audio  video  pdf  release-notes            ← file views
file-explorer  search  graph  localgraph  backlink  canvas
outgoing-link  tag  all-properties  file-properties
bookmarks  outline  sync  bases                              ← workspace views
```

Extension mapping (from `viewRegistry.getTypeByExtension`): `.md→markdown`, `.canvas→canvas`, `.base→bases`,
images/audio/video per extension, `.pdf→pdf`. Plugins can add types with `registerView(type, creator)` and
`registerExtensions(exts, type)`.

## 5. Command registry (VERIFIED, 204 commands)

Prefix distribution at startup:

```
editor:85  workspace:31  app:20  file-explorer:8  bookmarks:7  bases:6  canvas:4  window:4
markdown:4  sync:4  graph:3  backlink:3  daily-notes:3  note-composer:3  theme:2
open-with-default-app:2  outgoing-links:2  properties:2  outline:2  + 11 singles
```

Commands are objects `{id, name, hotkeys[], checkCallback|callback, editorCallback, icon?}`; the palette shows
category-prefixed names ("Canvas: Create new canvas"), and `hotkeyManager.defaultKeys` holds **41 default**
bindings (e.g. `Mod+S` save, `Mod+E` toggle reading view, `Mod+P` palette, `Mod+O` quick switcher, `Mod+1..8`/`Mod+9`
tab switching, `Ctrl+Tab` next tab, `Mod+Alt+Arrow` back/forward, `Mod+,` settings, `Mod+;` add property).

## 6. Workspace model

Class hierarchy (from the export map and runtime `constructor.name`): `WorkspaceItem → WorkspaceParent
{WorkspaceRoot, WorkspaceSplit, WorkspaceTabs, WorkspaceSidedock, WorkspaceContainer, WorkspaceFloating,
WorkspaceWindow} → WorkspaceLeaf`. DOM classes follow the same names:

```html
<div class="workspace">
  <div class="workspace-ribbon side-dock-ribbon mod-primary">…</div>
  <div class="workspace-split mod-horizontal mod-sidedock mod-primary-split mod-left-split">…</div>
  <div class="workspace-split mod-vertical mod-root">…</div>
  <div class="workspace-split mod-horizontal mod-sidedock mod-secondary-split mod-right-split is-sidedock-collapsed">…</div>
  <div class="workspace-ribbon side-dock-ribbon mod-secondary is-collapsed">…</div>
</div>
```

* The root split is **vertical** (`mod-vertical mod-root`); sidebars are horizontal splits with `mod-sidedock`.
* Each pane is a `tabs` container; each tab is a `leaf` holding a view. Splits can be nested arbitrarily
  (`mod-vertical` = children stacked, `mod-horizontal` = side by side).
* Serialized form is `{main, left, right, active, lastOpenFiles}` (see `architecture/storage-architecture.md`).
* **Deferred views (1.7.2+)**: on restore only visible leaves are instantiated; the rest stay as serialized state until
  activated. The code keeps `{views, deferredViews}` counters in its startup telemetry.
* Every view carries `getViewState()/setViewState()`, `getEphemeralState()/setEphemeralState()` (scroll, cursor,
  search state) and `getDisplayText()/getIcon()`.

## 7. Editor stack

* **CodeMirror 6** (`EditorView`, `StateField`, `ViewPlugin`, `Decoration`, Lezer `syntaxTree` are all present), plus
  a legacy `lib/codemirror/*` bundle for the auxiliary pages and a `vim.js` mode.
* Two rendering modes per markdown leaf: **`source`** (Live Preview: source with inline decorations/embeds) and
  **`preview`** (Reading view). `workspace.json` records `{mode:"source", source:false}`; `Mod+E` toggles.
* Live Preview is implemented with `Decoration` ranges and **atomic ranges** for rendered embeds (`cm-html-embed`,
  `isImageEmbed`), so the caret steps over rendered images; HTML is tokenized (`cm-tag`, `cm-attribute`) when it is not
  rendered by a widget.
* Reading view mounts `.markdown-preview-view > .markdown-preview-sizer` and renders section-by-section with a
  `markdown-preview-pusher` spacer; sections have classes like `mod-header`, `el-h1`, `el-p`, `el-ul`,
  `mod-frontmatter`, and virtualisation keeps offscreen sections out of the DOM.
* The editor exposes `Editor` (`getValue/setValue/getLine/replaceRange/…`), `editorInfoField`,
  `editorLivePreviewField`, `editorViewField`, and `livePreviewState` to plugins.

## 8. Markdown pipeline

1. **Parse** (main thread, per file, debounced): produce `CachedMetadata` with exact `{line, col, offset}` positions for
   headings, links, embeds, blocks (`^id`), sections, list items, footnotes and frontmatter, plus YAML parsing with
   type inference.
2. **Index**: fold into `metadataCache.resolvedLinks` / `unresolvedLinks` / tag map; emit `changed`/`resolved` events.
3. **Render**:
   * Reading view: markdown → HTML AST → DOM, with post-processors (`registerMarkdownPostProcessor`) and code-block
     processors (`registerMarkdownCodeBlockProcessor`).
   * Live Preview: source stays literal; decorations add styling, folding, list indentation, callouts, embeds and
     inline widgets.
4. **Sanitize**: HTML coming from notes passes an allow-list filter (DOMPurify-derived); `on*` attributes and
   `javascript:` URLs are stripped, `https` iframes survive (verified `experiments/observations.md#E17`).
5. **Enhance**: math via **MathJax** (`loadMathJax`, `renderMath`, `finishRenderMath`), Mermaid via **Pele**
   (1.15; `loadMermaid`), syntax highlighting via **Prism** (`loadPrism`), PDF via **PDF.js** (`loadPdfJs`),
   graph via **PIXI** (`loadPixi`), HTML→Markdown via **Turndown** (`htmlToMarkdown`), web-page extraction via
   **Defuddle**/**Readability** (web viewer reader mode).

Supported syntax observed rendering correctly in the test vault: ATX headings, emphasis/strong/strikethrough,
`==highlight==`, inline code, fenced code with language, tables, task lists, ordered/unordered lists, blockquotes,
callouts (`> [!note]` — section type `callout`), footnotes, `$…$$` math, wikilinks with alias/heading/block subpaths,
embeds (`![[file]]`, `![[note]]`), frontmatter properties, comments `%%…%%`, block IDs, tags (nested).

## 9. Metadata cache internals (VERIFIED)

Live object for a note with frontmatter, links, embeds, headings and a block id:

```json
{ "headings":[{"position":{"start":{"line":15,"col":0,"offset":163},"end":{…}},"heading":"Welcome to the vault","level":1}, …],
  "links":[{"position":{…},"link":"Projects/Alpha","original":"[[Projects/Alpha]]","displayText":"Projects/Alpha"}, …],
  "embeds":[{"position":{…},"link":"projects.png","original":"![[projects.png]]","displayText":"projects.png"}, …],
  "frontmatter":{"title":"Welcome","tags":["research/obsidian","demo"],"aliases":["Home"],"status":"active","priority":8,"reviewed":"2026-10-01","publish":false,"cssclasses":["wide"]},
  "frontmatterPosition":{"start":{"line":0,"col":0,"offset":0},"end":{"line":13,"col":3,"offset":161}},
  "sections":[{"type":"yaml",…},{"type":"heading",…},{"type":"paragraph",…},{"type":"list",…},{"type":"callout",…}],
  "blocks":{"block-abc123":{"position":{…},"id":"block-abc123"}},
  "tags":[{"tag":"#research/obsidian",…},{"tag":"#demo",…}] }
```

Backlinks are not stored per file: `metadataCache.getBacklinksForFile(file)` returns a `Map<sourcePath, LinkCache[]>`
computed from `resolvedLinks` (verified: `Map` with `Welcome.md`, `Projects/Beta.md`, `Daily/2026-11-03.md`).
`getTags()` returns parent tags too (`#research` from `#research/obsidian`).

## 10. Graph view

* Renderer: PIXI (`lib/pixi.min.js`, lazily loaded in 1.15) drawing on a canvas inside a sandboxed iframe host.
* Layout: force simulation in a **Web Worker** (`worker.postMessage({nodes, links, alpha, run})`, results returned as a
  `Float32Array` of x/y pairs plus a version counter); `sim.js` (17 KB) is a d3-quadtree bundle used for hit-testing.
* Data: nodes = files + unresolved links + tags (when enabled) + attachments (when enabled); links from
  `resolvedLinks`; `graph.json` persists 22 options (`showTags`, `showAttachments`, `hideUnresolved`, `showOrphans`,
  `colorGroups`, `nodeSizeMultiplier`, `centerStrength`, `repelStrength`, `linkStrength`, `linkDistance`, `scale`, …).
* Controls UI: four collapsible groups — **Filters**, **Groups**, **Display**, **Forces** (screenshot
  `evidence/screenshots/07-graph.png`).
* `localgraph` is the same renderer with depth-limited neighbourhood.

## 11. Search

`global-search` core plugin; query language parsed into filters (see `features/search.md`). Results DOM:

```html
<div class="search-result-container mod-global-search">
  <div class="search-results-children">
    <div class="tree-item search-result">
      <div class="tree-item-self search-result-file-title">
        <div class="tree-item-inner">2026-11-03</div>
        <div class="tree-item-flair-outer"><span class="tree-item-flair">1</span></div>
      </div>
      <div class="search-result-file-matches">
        <div class="search-result-file-match"><span>- Morning: [[</span><span class="search-result-file-matched-text">Alpha</span><span> Renamed]]</span></div>
```

Per-file groups are virtualised; each match has "Show more context" buttons; the pane header carries result count,
sort order, explain-search, collapse-all and extra-context toggles.

## 12. Canvas

`canvas` core plugin. Nodes are DOM-based cards on a zoomable/pannable surface (`canvasEl`, `wrapperEl`, viewport
`{tx,ty,zoom}`), four node classes (`file`, `text`, `group`, `link`), one edge class. Clipboard MIME
`application/obsidian/canvas` plus `obsidian/canvas`. Data model = JSON Canvas 1.0 (`features/canvas.md`).

## 13. Bases

`bases` core plugin. `.base` YAML → `Base` object (`views`, `filters`, `properties`, `formulas`, `summaries`,
`newItemFolder`, `newItemTemplate`) → `QueryController` evaluates a filter AST over every markdown file using
`BasesEntry` wrappers, producing `BasesQueryResult`s rendered by a view (`table`, `cards`, `list`, `kanban`, `map`).
Display name resolution, formatting, summaries and grouping all live in the view config. CLI exposes the same engine
(`base:query format=json|csv|tsv|md`).

## 14. Plugin host

* Discovery: `.obsidian/plugins/<id>/manifest.json` (+ `main.js`, optional `styles.css`, `data.json`).
* Enabling is gated by **Restricted Mode** (`app.plugins.isEnabled()`; false on a fresh vault). Verified sequence:
  `setEnable(true)` → `enablePlugin(id)` loads the module, calls `onload`, registers commands/ribbon/status bar/settings
  tab/views/post-processors; `disablePlugin` calls `onunload` and *removes* every registration (verified: command gone,
  ribbon entry gone, status bar entry gone).
* Module loading resolves `require("obsidian")` to the API object; the plugin's own folder is the resolution root.
* Core plugins are the same interface (`PluginManifest`-shaped objects) with ids in `internalPlugins.plugins`
  (`file-explorer … webviewer`, 30 entries) and per-vault enable state in `.obsidian/core-plugins.json`.
* Plugins can additionally register **CLI handlers** (`plugin.registerCliHandler(command, description, flags, handler)`)
  and **Bases views** (`registerBasesView`).

## 15. Internationalisation

`i18n.js` embeds the English dictionary (≈134 KB of nested objects: `setting.*`, `plugins.*`, `editor.*`, `app.*` …);
`i18n/<locale>.txt` ships 51 translations plus `mapping.txt`. `i18next` is the runtime; the language is stored in the
global `obsidian.json` (`language`) and pushed through the `set-language` IPC. The help window and vault chooser have
their own bundles (`help.js`, `starter.js`).

## 16. Styling system

* One stylesheet, `app.css` (598 KB, minified), driving **1027 CSS custom properties** on `body` — see
  `ui-analysis/themes.md`. Families: `--bases-*` (70), `--tab-*` (46), `--metadata-*` (45), `--table-*` (38),
  `--color-*` (37), `--nav-*` (35), `--font-*` (33), `--callout-*` (25), `--pele-*`/`--mermaid-*` (46),
  `--slider-*`, `--background-*`, `--icon-*`, `--code-*`, `--embed-*`, `--pill-*`, `--link-*`, `--tag-*`,
  `--setting-*`, `--footnote-*`, `--canvas-*`, `--modal-*`, `--list-*`, `--dropdown-*`.
* Theme switching only flips `body.theme-dark` / `body.theme-light`; every component reads tokens.
* Icons: **Lucide** icon set, referenced by `lucide-*` ids (234 distinct ids in `app.js`); `addIcon/getIcon/setIcon`
  are part of the public API, and icons are inlined as SVG with `currentColor`.
* `body` classes observed: `theme-dark mod-windows is-frameless is-hidden-frameless obsidian-app styled-scrollbars
  show-inline-title is-floating-nav auto-full-screen show-ribbon show-view-header is-focused`; popout windows add
  `is-popout-window is-popout-modal`.

## 17. Bundled libraries

| Library | File | Used for |
| --- | --- | --- |
| CodeMirror 6 (+ legacy CM5 shim) | `app.js`, `lib/codemirror/*` (1.3 MB) | editor, vim mode, markdown mode |
| MathJax | `lib/mathjax/*` (1.5 MB) | `$…$` math |
| PDF.js | `lib/pdfjs/*` (5.2 MB) | PDF viewer/annotations base |
| PIXI | `lib/pixi.min.js` (476 KB) | graph rendering |
| Prism | `lib/prism.min.js` (564 KB) | code highlighting |
| Pele | `lib/pele.min.js` (684 KB) | Mermaid 12.1 rendering (1.15) |
| Defuddle + Readability | `lib/defuddle.full.js` (736 KB), `lib/readability.js` | web viewer reader mode |
| moment | `lib/moment.min.js` (368 KB) | dates, `MomentFormatComponent` |
| i18next | `lib/i18next.min.js` (44 KB) | translations |
| Turndown | `lib/turndown.js` | `htmlToMarkdown` (paste, import) |
| scrypt | `lib/scrypt.js` | password-based key derivation (sync/encryption) |
| Reveal | `lib/reveal/` (152 KB) | slides core plugin |

## 18. Reimplementation guidance

* Use **CodeMirror 6 + Lezer markdown**; it is what makes Live Preview tractable. Keep a *separate* reading-view
  renderer (the same markdown AST, different output) — trying to unify them costs more than it saves.
* Keep a **single service-locator object** (like `App`) plus event emitters; the plugin API is essentially that object
  exposed with a curated surface.
* Model the workspace as a serializable tree and instantiate lazily; do not fight virtualisation.
* Keep the command registry first-class: palette, hotkeys, menus and CLI all read from it.
* Put all design decisions in **CSS custom properties**; it is the cheapest way to make user themes and snippets work.
* For a safer sandbox story, the extension host is the only place you must diverge (see
  `implementation/architecture-recommendation.md`).
