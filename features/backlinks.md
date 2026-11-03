# Feature: Links, backlinks and unlinked mentions

**Priority P0.** Evidence: live `metadataCache` probes (`experiments/observations.md#E3`, `#E6`),
`evidence/screenshots/01-main-layout.png` (right sidebar), `06-search.png`.

## 1. What exists

| Surface | Content |
| --- | --- |
| **Backlinks pane** (`backlink` core plugin, view type `backlink`) | "Linked mentions" — for each source file, the link occurrences with surrounding context; collapse/expand per file; search within backlinks; sort; "extra context"; toggle to show the whole note |
| **Outgoing links pane** (`outgoing-link`) | links *from* the active note, grouped by target, including unresolved ones (with a "create" affordance) |
| **Unlinked mentions** | same note's name appearing in other notes as plain text; expandable, with a one-click "Link" action |
| **Graph / local graph** | the same relation visualised |
| **Hover preview** (`page-preview`) | `Mod+hover` shows the target note inline |
| **Status bar** | "N backlinks" for the active note |

## 2. Link syntax and resolution (VERIFIED)

* Forms: `[[path/Note]]`, `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, `[[Note#^block]]`, `[[#Heading]]`,
  `[[Note#Heading|alias]]`, `![[Note]]` (embed), `[[Note.canvas]]`, `[[Note.base]]`.
* Cache shape per link: `{position:{start:{line,col,offset}, end:{…}}, link:"Projects/Alpha#Section One",
  original:"[[Projects/Alpha#Section One]]", displayText:"Projects/Alpha > Section One"}`.
* Resolution is by **basename or path**, case-insensitive on Windows, preferring exact path, then unique basename;
  unresolved links are tracked separately:

```json
"resolvedLinks": {
  "Welcome.md": { "Projects/Alpha Renamed.md": 3, "Archive/Beta.md": 2, "attachments/projects.png": 1 }
},
"unresolvedLinks": { "Welcome.md": { "This note does not exist": 1 } }
```

* Backlinks are **derived**, not stored: `metadataCache.getBacklinksForFile(file)` returned a
  `Map<sourcePath, LinkCache[]>`, computed on demand from `resolvedLinks` and the source caches.
* After a rename, the backlink map immediately reflected the new link text (`[[Alpha Renamed]]`,
  `[[Alpha Renamed#Section One]]`, `[[Alpha Renamed#^block-abc123]]`).

## 3. Behaviour details

* **Aliases** participate in resolution: `aliases: [Home]` in frontmatter makes `[[Home]]` resolve to `Welcome.md`
  (documented; the cache exposes `frontmatterLinks` for aliases-as-links).
* **Heading and block subpaths** are validated for display, but the link resolves at file level; a missing heading
  still produces a working link that opens the file (and shows the "no such heading" state in the pane).
* **Embeds** are both links and embeds: an embed contributes to `embeds[]` *and* to `resolvedLinks`.
* **Counts**: the status bar and pane show backlink **counts per file** (3 for Welcome in the test vault, which
  matched 3 distinct source files).
* **Context lines**: the pane shows the line containing the link, trimmed; "extra context" expands ±N lines.
* **Unlinked mentions** are found by scanning other files for the target's basename/alias outside link syntax; the
  result is computed lazily when the pane opens (it was collapsed by default in the fresh vault).

## 4. Data structures

```ts
interface LinkCache { position: Pos; link: string; original: string; displayText?: string }
interface EmbedCache extends LinkCache {}
interface FrontmatterLinkCache extends LinkCache { key: string }
interface ResolvedLinks { [source: string]: { [target: string]: number } }
interface BacklinkEntry { file: TFile; links: LinkCache[] }
```

## 5. Technical requirements

* A resolution service that, for a given `linkpath` and source path, returns `TFile | null`:
  1. exact path match (`path` normalized, `./`/`../` resolved for relative links),
  2. unique basename match anywhere in the vault,
  3. alias match (frontmatter `aliases`),
  4. otherwise unresolved.
* A reverse index `target → Set<source>` maintained on `modify`/`rename`/`delete` so the pane is O(backlinks), not
  O(vault).
* Context extraction: given a link position, slice the source line(s) with offsets — the cache stores offsets so this
  is cheap.
* Unlinked mentions: for the target's name/aliases, run a plain-text search and subtract linked occurrences; must be
  debounced and cancellable.

## 6. Edge cases

* Self-links (`[[#Heading]]` inside the same file) — count as links but must not create a self-backlink group.
* Two notes with the same basename in different folders: short links must resolve deterministically (Obsidian prefers
  the closest to the source path); renaming must not silently re-point links.
* Links to renamed/deleted files become unresolved and must appear in the outgoing pane with a create action.
* Case-only differences on case-insensitive filesystems; URL-encoded characters (`%20`) in `[[links]]`.
* Canvas and base files contain links too (canvas text nodes and file nodes), which is why the graph/search include
  them.
* Block ids duplicated in one file; block ids with spaces (illegal).

## 7. Testing strategy

* Fixture vault with a known link graph; assert `resolvedLinks`/`unresolvedLinks` exactly (JSON comparison).
* Rename/move matrix: for each link form (bare, aliased, heading, block, embed), renaming the target must produce the
  expected text rewrite and keep the edge set identical.
* Backlink pane: assert per-file grouping, counts and context lines against the fixture.
* Performance: 50k links across 10k notes; opening the pane must be < 100 ms.

## 8. Implementation sketch

* Build the link index during parse: each file's parse result yields `outgoing: [{target, subpath, alias, pos}]`.
  Resolve once per parse and store both directions.
* Keep `unresolved` as a first-class set — it drives creating notes from links, which is a core Obsidian workflow.
* Recompute only the affected file's edges on edit; recompute affected sources on rename (the rename already rewrites
  their text, so re-parse them anyway).

## 9. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Parse links/embeds with positions | M | **P0** |
| Resolution (path, basename, alias, subpaths) | M | **P0** |
| Backlinks + outgoing panes | M | **P0** |
| Unlinked mentions | S | P1 |
| Hover preview | M | P1 |
| Heading/block jump + "missing heading" states | S | P1 |
| Performance for very large link graphs | M | P2 |
