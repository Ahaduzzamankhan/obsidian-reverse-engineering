# Feature: Plugins and extensibility

**Priority P0 (host) / P1 (API parity).** Evidence: live plugin lifecycle test
(`experiments/observations.md#E13`), `app.js` plugin host code, `internalPlugins` probe, documented API pages.

## 1. Two tiers

| Tier | Location | Enable state | Count (1.15.0) |
| --- | --- | --- | --- |
| **Core plugins** | built into `obsidian.asar` (`app.js`) | `.obsidian/core-plugins.json` (flat map) | 30 |
| **Community plugins** | `.obsidian/plugins/<id>/` | `.obsidian/community-plugins.json` (array) + Restricted Mode gate | user-installed |
| **Private plugins** (policy-gated) | referenced by `policy.json` with a URL | policy | enterprise |

Core plugin ids (VERIFIED): `file-explorer, global-search, switcher, graph, backlink, canvas, outgoing-link, tag-pane,
footnotes, properties, page-preview, daily-notes, templates, note-composer, command-palette, slash-command,
editor-status, bookmarks, zk-prefixer, random-note, outline, word-count, slides, audio-recorder, workspaces,
file-recovery, publish, sync, bases, webviewer`. Defaults on a fresh vault: 24 enabled, disabled = `footnotes,
slash-command, zk-prefixer, random-note, slides, audio-recorder, workspaces, publish, webviewer`.

## 2. Community plugin layout (documented + verified)

```
.obsidian/plugins/<plugin-id>/
  manifest.json      required: {id, name, version, minAppVersion, description, author, isDesktopOnly, authorUrl?, fundingUrl?}
  main.js            required: CommonJS bundle, default export = class extends Plugin
  styles.css         optional, auto-injected
  data.json          written by plugin.saveData(); read by loadData()
```

The observed `manifest` object at runtime gains `dir: ".obsidian/plugins/probe-plugin"`. `id` must match the folder name
(else `onExternalSettingsChange` never fires — documented).

## 3. Lifecycle (VERIFIED end-to-end with a hand-written plugin)

```
loadManifests()                    → scans plugins dir into app.plugins.manifests
enablePlugin(id) / enablePluginAndSave(id)
  → require(main.js)               → resolve `require("obsidian")` to the API object
  → new PluginClass(app, manifest)
  → plugin.onload()                (register everything here)
  → plugin.load()                  (loads children registered via addChild)
  → manager triggers "change"
disablePlugin(id) / disablePluginAndSave(id)
  → plugin.onunload()
  → all registrations removed: commands, ribbon, status bar, setting tab, views, post-processors, intervals
```

Verified observations from the test plugin:

| Capability | Result |
| --- | --- |
| `require("fs")`, `require("child_process")`, `process.version` (v24.22.1) | works |
| `require("electron").ipcRenderer` | works |
| `this.app.vault.adapter.basePath` | works |
| `addCommand({id, name, callback})` | appears in `app.commands.commands` as `probe-plugin:probe-hello` |
| `addRibbonIcon("flask-conical", …)` | new ribbon button with that aria-label |
| `addStatusBarItem()` | new status bar item |
| `addSettingTab(new Tab(...))` | tab registered in `app.setting` |
| `registerMarkdownPostProcessor` | works |
| `registerDomEvent`, `registerInterval` | cleaned up on unload |
| `onLayoutReady` callback | fired |
| After disable | command gone, ribbon entry gone, status bar entry gone, instance dropped, `onunload` ran |

**Restricted Mode gate**: on a fresh vault `app.plugins.isEnabled() === false`, and `enablePluginAndSave` silently does
nothing. `setEnable(true)` flips it and creates `community-plugins.json` (`[]`). This is the "Restricted mode" security
setting users must turn off.

## 4. Plugin-facing API (the `obsidian` module)

Full symbol list: `architecture/frontend-architecture.md#3`. Registration methods on `Plugin` (per docs):
`addCommand`, `removeCommand` (1.7.2), `addRibbonIcon`, `addStatusBarItem`, `addSettingTab`, `registerView`,
`registerExtensions`, `registerMarkdownPostProcessor`, `registerMarkdownCodeBlockProcessor`, `registerEditorExtension`
(CodeMirror 6), `registerEditorSuggest`, `registerHoverLinkSource` (1.1), `registerObsidianProtocolHandler`,
`registerBasesView` (1.10), `registerCliHandler` (1.12), `loadData`/`saveData`, `register`/`registerEvent`/
`registerDomEvent`/`registerInterval`/`addChild` (from `Component`).

Lifecycle hooks: `onload`, `onunload`, `onExternalSettingsChange` (1.5.7), `onUserEnable` (1.7.2).

## 5. Permissions and security model

* **There is no permission system.** A plugin is arbitrary code in the renderer with Node access. Documented guidance:
  `isDesktopOnly: true` if it uses Node/Electron APIs.
* Mitigations that do exist:
  * **Restricted Mode** (default on for new vaults) blocks all community plugins.
  * **Plugin review** for the community catalogue (human review, not a sandbox).
  * **Managed policy** can block plugins, pin versions, block specific versions, or force-disable categories
    (`architecture/desktop-architecture.md#9`).
  * 1.13+ warns before **syncing plugins** through Sync, and shows a confirmation for `obsidian://` URIs that would
    execute code.
  * Plugin script root (`_plugin/`) is served only when the policy allows plugins; otherwise `plugin-script-root`
    returns `null`.
* Attack surface a clone must decide on explicitly — see `security/assessment.md#plugin-boundary`.

## 6. Settings UI contribution

* `PluginSettingTab` (id `id`, name `name`, `display()` builds `Setting` rows) appears in the settings window's
  "Community plugins → <Plugin> options" and in the core-plugin list for internal plugins.
* 1.11 added `SettingGroup` (grouped rows with a heading/description) and 1.13 reworked settings into a searchable
  window with keyboard navigation.
* `display()` is re-run on `display()` calls; the tab can call `this.plugin.saveSettings()`.

## 7. Themes and CSS snippets (verified presence)

* Themes: `.obsidian/themes/<name>/{manifest.json, theme.css}`, selected in `appearance.json` (`cssTheme`), light/dark
  variants via `.theme-light`/`.theme-dark`.
* Snippets: `.obsidian/snippets/*.css`; `app.customCss.snippets` listed `["probe"]` after dropping a file; enabling is
  a toggle that adds the name to `appearance.json.enabledCssSnippets`. Hot-reload on save (documented).
* `cssclasses` frontmatter applies per-note classes.
* Everything is driven by the 1027 CSS custom properties, which is what makes third-party themes viable.

## 8. Data structures

```ts
interface PluginManifest { id: string; name: string; version: string; minAppVersion: string;
  description: string; author: string; authorUrl?: string; fundingUrl?: string|Record<string,string>;
  isDesktopOnly: boolean; dir?: string }

abstract class Plugin extends Component {
  app: App; manifest: PluginManifest;
  onload?(): void|Promise<void>; onunload?(): void;
  onExternalSettingsChange?(): void|Promise<void>; onUserEnable?(): void;
  loadData(): Promise<any>; saveData(data:any): Promise<void>;
  addCommand(c: Command): Command;
  addRibbonIcon(icon: string, title: string, cb: (evt: MouseEvent)=>any): HTMLElement;
  addStatusBarItem(): HTMLElement;
  addSettingTab(tab: PluginSettingTab): void;
  registerView(type: string, creator: (leaf: WorkspaceLeaf)=>View): void;
  registerExtensions(ext: string[], viewType: string): void;
  registerMarkdownPostProcessor(fn: (el: HTMLElement, ctx: MarkdownPostProcessorContext)=>any, order?: number): void;
  registerMarkdownCodeBlockProcessor(lang: string, fn: (src:string, el:HTMLElement, ctx:any)=>any, order?: number): void;
  registerEditorExtension(ext: Extension|Extension[]): void;
  registerCliHandler(cmd: string, desc: string, flags: Record<string,{value?:string,description:string}>, fn: (args:any)=>any): void;
}
```

## 9. Edge cases

* Plugin crashes in `onload` → must be isolated (Obsidian logs and leaves the plugin disabled; the app keeps running).
* Plugin loads a second copy of the API (`require("obsidian")` must be injected, not resolved from disk).
* Two plugins registering the same command id / view type / CLI command → resolution order must be defined.
* Plugin updating while enabled (files replaced on disk) → requires reload; `data.json` external change triggers
  `onExternalSettingsChange`.
* Plugins that hold references after `onunload` (leaks) — the host cannot fully prevent this (verified: registration
  cleanup works, arbitrary timers do not).
* Plugins on mobile: `isDesktopOnly` must be enforced by the installer/UI, and `Platform` flags used at runtime.

## 10. Testing strategy (for a clone)

* Contract tests: a "sample plugin" from the official template must compile and run against your API.
* Registration leak test: enable/disable 100 times; assert DOM node count, listener count and command count return to
  baseline.
* Compatibility corpus: run a set of popular open-source plugins that use only public APIs (manifest + command +
  view + post-processor), and diff behaviour.
* Failure injection: throwing `onload`, hanging `onload` (timeout), throwing event handlers.

## 11. Implementation sketch

* Host plugins in the renderer for compatibility; expose a curated `obsidian` module via a custom `require` shim.
* Track every registration in a per-plugin registry and unwind it in `unload()`.
* Give each plugin a private data directory and a settings tab helper.
* If you want safety, run plugins in a `Worker`/`iframe` with a message-passing RPC of the same API surface — this is a
  deliberate compatibility break worth documenting.

## 12. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Plugin discovery/enable/disable + registrations + data.json | M | **P0** |
| API surface for commands, ribbon, status bar, settings, views, post-processors | L | **P0** |
| Themes + CSS snippets (`customCss`) | S | P1 |
| Editor extensions (CodeMirror) exposure | M | P1 |
| CLI handler + Bases view registration | S | P2 |
| Sandboxed/out-of-process plugin host | XL | P3 (design decision) |
