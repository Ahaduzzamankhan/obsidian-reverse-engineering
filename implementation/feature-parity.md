# Feature parity matrix

Legend — **Priority**: P0 essential, P1 important, P2 advanced, P3 optional. **Complexity**: S (<1 week), M (1–3 weeks),
L (3–8 weeks), XL (8+ weeks) for one experienced engineer. **Obsidian / 1.15** column states the observed or documented
behaviour; the last column is how an independent implementation should approach it.

## A. Vault and files

| # | Feature | Obsidian / 1.15 (verified unless marked) | Pri | Cx | Reimplementation note |
| --- | --- | --- | --- | --- | --- |
| A1 | Vault = folder | Plain `.md` + `.obsidian/`; no database in the vault | P0 | S | Keep it; treat the folder as the source of truth |
| A2 | Multi-vault registry | `<userData>/obsidian.json` `{vaults:{id:{path,ts,open}}}`; 16-char id; per-vault window | P0 | S | Copy schema for migration friendliness |
| A3 | Create/open/rename/remove vault | IPC `vault-*`; refuses move while open | P1 | S | Same guards; add a real "compact/move" flow |
| A4 | File CRUD + watcher | events create/modify/delete/rename; external changes indexed <300 ms | P0 | M | Atomic write + watcher + debounce |
| A5 | Rename rewrites links | all inbound links incl. `#heading`, `#^block`; verified | P0 | L | Pure `formatLink()` function + transactional rename |
| A6 | Move normalises links | shortest unique path (`[[Projects/Beta]]`→`[[Beta]]`) | P0 | M | Same algorithm, configurable per settings |
| A7 | Trash vs permanent delete | OS trash by default; 1.12 unused-attachment prompt | P1 | S | Use OS trash APIs; keep an undo log for non-trash |
| A8 | File recovery | IndexedDB `backups` (path, ts), interval + retention settings, diff/restore | P1 | M | Local snapshots + diff; encrypt optional |
| A9 | Attachment placement | root / same folder / fixed folder, per-note subfolder | P0 | S | Settings mirror; collision-safe names |
| A10 | External file support (1.14) | Open `.md` outside a vault (Open-with) | P3 | M | Skip initially |
| A11 | File explorer | tree, sort, drag&drop, inline rename, badges | P0 | M | Virtualised tree |
| A12 | Unused attachment cleanup | prompt on delete (1.12) | P2 | S | Derived from embed index |

## B. Editor and Markdown

| # | Feature | Obsidian / 1.15 | Pri | Cx | Reimplementation note |
| --- | --- | --- | --- | --- | --- |
| B1 | Source editing | CodeMirror 6, vim mode, folding, spellcheck | P0 | L | CM6 + Lezer; do not write an editor |
| B2 | Live Preview | inline decorations + atomic embeds | P0 | L | Decoration plugin with widget ranges |
| B3 | Reading view | separate DOM renderer, virtualised sections | P0 | M | Same AST, second renderer |
| B4 | Wikilinks | `[[a]]`, aliases, headings, blocks | P0 | M | Parse in the link extension |
| B5 | Embeds | notes, images, PDF page, canvas, base | P1 | M | Embed registry by extension |
| B6 | Block references | `^id`, embed block | P1 | S | Index blocks while parsing |
| B7 | Callouts | `> [!type]`, 25 `--callout-*` tokens | P1 | S | Map types to colors |
| B8 | Math | MathJax inline/block | P1 | S | KaTeX is lighter; MathJax for parity |
| B9 | Mermaid | Pele (Mermaid 12.1) since 1.15 | P1 | S | Bundle mermaid + lazy load |
| B10 | Code highlighting | Prism, 200+ languages | P1 | S | Shiki or Prism |
| B11 | Tables | GFM, resize, alignment | P1 | M | CM table extension |
| B12 | Task lists | checkboxes, `task:` search, CLI `tasks` | P1 | S | Toggle writes back to the file |
| B13 | Frontmatter/properties | typed widgets, see C | P1 | M | Position-aware YAML |
| B14 | Footnotes | `[^1]`, footnotes sidebar plugin | P2 | S | |
| B15 | Comments `%%…%%` | hidden in render, kept in source | P2 | S | |
| B16 | Highlights `==x==` | plus 1.14 highlight colors | P2 | S | |
| B17 | Slides | Reveal.js core plugin | P3 | S | |
| B18 | Vim mode | first-class setting | P3 | M | `@replit/codemirror-vim` |

## C. Metadata, links, knowledge

| # | Feature | Obsidian / 1.15 | Pri | Cx | Reimplementation note |
| --- | --- | --- | --- | --- | --- |
| C1 | Metadata cache | positions for links/headings/blocks/sections/tags/frontmatter | P0 | L | Single parse pass; persist in SQLite/IndexedDB |
| C2 | Link resolution | path → unique basename → alias; unresolved tracked | P0 | M | Deterministic, unit-tested |
| C3 | Backlinks pane | grouped by file, counts, context | P0 | M | Reverse index |
| C4 | Outgoing links | incl. unresolved with create action | P1 | S | |
| C5 | Unlinked mentions | filename matches outside link syntax | P1 | S | Search minus linked |
| C6 | Property types | 11 widgets, global per property name | P1 | M | `types.json` + inference |
| C7 | All properties view | vault-wide property list | P2 | S | |
| C8 | Tags | nested tags, tag pane, inline + frontmatter | P1 | S | Parent tags derived |
| C9 | Templates | `{{date}}`, `{{title}}`, folder templates | P1 | S | Variable resolver |
| C10 | Daily notes | format, template, previous/next | P1 | S | |
| C11 | Unique notes (Zettelkasten) | `zk-prefixer` (off by default) | P3 | S | |
| C12 | Random note | `random-note` (off) | P3 | S | |
| C13 | Bookmarks | files/folders/searches/headings/blocks, tree view | P1 | M | |
| C14 | Outline | headings, click to jump | P1 | S | |
| C15 | Hover preview | `page-preview`, `Mod+hover` | P1 | M | |
| C16 | Graph view | PIXI + worker + 4 control groups | P1 | L | See `features/graph-view.md` |
| C17 | Local graph | depth/direction filters | P1 | M | Reuse engine |
| C18 | Canvas | JSON Canvas 1.0, 4 node types, edges | P2 | L | |
| C19 | Bases | YAML query, table/cards/list/kanban | P1 | L | See `features/bases.md` |
| C20 | Note composer | extract/merge note content | P2 | M | |
| C21 | Workspaces plugin | named layouts | P2 | S | |

## D. Navigation and shell

| # | Feature | Obsidian / 1.15 | Pri | Cx | Reimplementation note |
| --- | --- | --- | --- | --- | --- |
| D1 | Tabs | strip, stacked tabs, pin, groups | P0 | M | |
| D2 | Splits | nested split/tabs/leaf, resize, direction | P0 | M | Tree model + CSS grid |
| D3 | Session persistence | `workspace.json`, deferred restore | P0 | M | |
| D4 | Back/forward | per leaf | P0 | S | |
| D5 | Command palette | fuzzy, hotkey chips, categories | P0 | M | |
| D6 | Quick switcher | files/aliases/headings + create | P0 | M | |
| D7 | Hotkey editor | per command, conflict detection | P1 | S | |
| D8 | Context menus | native on desktop | P1 | S | |
| D9 | Multi-window | popouts, move tab to window | P1 | M | |
| D10 | Ribbon | plugin action strip | P1 | S | |
| D11 | Status bar | plugin items + counters | P1 | S | |
| D12 | Settings window | separate window since 1.13, search + keyboard nav | P1 | M | |
| D13 | RTL support (1.14) | flips workspace | P3 | M | |

## E. Search

| # | Feature | Obsidian / 1.15 | Pri | Cx | Reimplementation note |
| --- | --- | --- | --- | --- | --- |
| E1 | Full-text search | grouped by file, per-match highlight | P0 | M | In-memory index |
| E2 | Operators | `file: path: tag: line: section: block: task: [prop:value] OR - /re/` | P0 | M | Parser + AST |
| E3 | Sort / extra context / explain | UI toggles | P2 | S | |
| E4 | In-file find & replace | CM search panel | P1 | S | |
| E5 | Search bookmarks | saved queries | P2 | S | |
| E6 | CLI `search`, `search:context` | TSV / JSON | P2 | S | |

## F. Extensibility

| # | Feature | Obsidian / 1.15 | Pri | Cx | Reimplementation note |
| --- | --- | --- | --- | --- | --- |
| F1 | Plugin host | `manifest.json` + `main.js`, full Node | P0 | L | See security: decide isolation policy |
| F2 | Plugin API surface | ~150 symbols, `require("obsidian")` | P0 | XL | Implement incrementally; contract tests |
| F3 | Core plugins | 30, same interface, toggles in `core-plugins.json` | P1 | M | Dogfood the public API |
| F4 | Settings tabs | `PluginSettingTab`, `SettingGroup` | P1 | S | |
| F5 | Editor extensions | `registerEditorExtension` (CM6) | P1 | M | |
| F6 | Post-processors | markdown + code blocks | P1 | M | |
| F7 | Custom views | `registerView` + `registerExtensions` | P1 | M | |
| F8 | Protocol handlers | `obsidian://` plugins | P2 | S | |
| F9 | Bases views | `registerBasesView` | P3 | M | |
| F10 | CLI handlers | `registerCliHandler` | P2 | S | |
| F11 | Themes | `theme.css` + `manifest.json` | P1 | S | Token contract |
| F12 | CSS snippets | toggle + hot reload | P1 | S | |
| F13 | Secret storage | OS keychain, `SecretComponent` | P2 | M | OS APIs per platform |
| F14 | Restricted mode | blocks all community plugins | P0 | S | |
| F15 | Plugin/theme browser | in-app install/update | P2 | M | Registry API required |

## G. Services and platform

| # | Feature | Obsidian / 1.15 | Pri | Cx | Reimplementation note |
| --- | --- | --- | --- | --- | --- |
| G1 | Sync | proprietary, account required | P3 | XL | Start with filesystem sync + local history |
| G2 | Publish | proprietary, account required | P3 | XL | Static export is the cheap 80 % |
| G3 | CLI | named pipe/unix socket, 100+ commands, TUI | P2 | M | High value for testing |
| G4 | Web viewer | per-vault session, EasyList, clipboard-only permissions | P2 | M | Must be sandboxed |
| G5 | Managed policy | `policy.json`, off/manual/default/forced | P3 | M | Enterprise feature |
| G6 | Updater | GitHub public + insider, staged asar | P1 | M | Signed updates |
| G7 | Deep links | `obsidian://open|new|daily|search|…` | P2 | S | |
| G8 | Import (Importer plugin) | Notion/Evernote/Roam/HTML/MD | P3 | L | Community scope |
| G9 | Export PDF | `printToPDF` via IPC | P2 | S | |
| G10 | Mobile | Capacitor adapter, separate shell | P3 | XL | Out of scope |

## H. UI/UX

| # | Feature | Obsidian / 1.15 | Pri | Cx | Reimplementation note |
| --- | --- | --- | --- | --- | --- |
| H1 | Dark/light themes | body class + tokens | P0 | S | |
| H2 | Token system | 1027 custom properties, per-feature namespaces | P0 | M | Document the contract |
| H3 | Lucide icons | 234 ids, `addIcon` API | P1 | S | |
| H4 | Component library | buttons/inputs/modals/palette/etc. | P0 | L | See `ui-analysis/components.md` |
| H5 | Keyboard model | scope stack, 41 defaults | P0 | M | |
| H6 | Drag & drop semantics | link vs embed vs move | P1 | M | |
| H7 | Accessibility | ARIA on modals, weak on tree/keys | P1 | M | Do better than parity here |
| H8 | Responsive/mobile layout | separate mobile shell | P3 | L | |

## I. Coverage summary

| Priority | Items | Notes |
| --- | --- | --- |
| **P0** | A1,A2,A4,A5,A6,A9,A11,B1,B2,B3,B4,C1,C2,C3,D1,D2,D3,D4,D5,D6,E1,E2,F1,F2,F14,H1,H2,H4,H5 | ~29 items; this is "a usable Obsidian" |
| **P1** | A3,A7,A8,A12,B5–B13,C4–C7,C8–C9,C10,C13–C17,C19,D7–D12,E4,F3–F7,F11,F12,G6,H3,H6,H7 | ~30 items; this is "a delightful Obsidian" |
| **P2** | B14–B16,C18,C20,C21,D13,E3,E5,E6,F8,F10,F13,F15,G3,G4,G7,G9 | advanced/power features |
| **P3** | A10,B17,C11,C12,F9,G1,G2,G5,G8,G10,H8 | optional, proprietary, or platform work |

**Deliberate non-goals for v1**: Sync/Publish protocols, mobile clients, managed policy, plugin marketplace, web viewer
(until the sandbox story is settled), and the enterprise account/licence surface.
