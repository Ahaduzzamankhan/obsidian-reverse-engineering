# Feature: Search

**Priority P0.** Evidence: `evidence/screenshots/06-search.png`, live operator run
`experiments/observations.md#E10`, DOM capture in `architecture/frontend-architecture.md#11`.

## 1. User-facing behaviour

The **Search** view (a sidebar pane, also openable as a tab; `global-search:open`, hotkey `Mod+Shift+F`) has:

* a query input with case-sensitivity (`Aa`), regex (`.*`-style toggle) and "explain search" toggles,
* a result header with count ("19 results"), sort order ("File name (A to Z)" / modified time / created time), collapse
  all, extra-context toggle and a small "?" that documents operators,
* per-file result groups: filename (with highlighted substring) + match-count flair, expandable match list,
* per-match lines with the matched substring wrapped in `<span class="search-result-file-matched-text">`, and
  hover buttons to expand context up/down,
* click a match to open the file at that line; `Mod+click` opens in a new pane.

`editor:open-search` / `editor:open-search-replace` give an in-file find & replace (CodeMirror search panel).

## 2. Query language (VERIFIED against a live vault)

Vault contents at test time: 8 notes, 1 canvas, 1 base, 1 image.

| Query | Files | Matches | Interpretation |
| --- | --- | --- | --- |
| `Alpha` | 4 | 10 | full-text across notes, canvas and link text |
| `tag:#project` | 1 | 1 | tag filter (frontmatter `tags: [project]` matched) |
| `path:Daily` | 1 | 0 | path filter; the file matched, no text match inside |
| `file:Beta` | 1 | 0 | filename filter |
| `Alpha OR Beta` | 5 | 14 | boolean OR |
| `-Beta research` | 1 | 0 | negation + implicit AND |
| `/Alph[a-z]/` | 4 | 10 | regular expression |
| `[status:active]` | 1 | 1 | property filter |

Documented operator families (consistent with observed syntax): `file:`, `path:`, `content:`, `tag:`, `line:`,
`block:`, `section:`, `task:`, `task-todo:`, `task-done:`, `[property]`, `[property:value]`, quoted phrases,
`OR`, `-` negation, `/regex/`, parentheses.

Result counts also include **canvas text nodes** (a `[[Archive/Beta]]` written on a canvas was reported as a match in
`Research.canvas`), which shows search runs over the metadata/index of non-markdown files too.

## 3. Ranking and presentation

* No relevance ranking: results are **grouped by file** and sorted by the chosen key (default file name A→Z); matches
  inside a file are in document order. This is a deliberate, predictable design choice worth copying.
* Highlighting is done on the rendered line with the exact match ranges, not by re-running the query in the DOM.
* `explainSearch` renders a breakdown of how the query was interpreted (useful for debugging operator precedence).
* Extra context expands N lines around a match without changing highlighting.

## 4. Technical requirements

| Requirement | Detail |
| --- | --- |
| Index | per-file text (cached reads) + metadata (tags, properties, headings, links) + filename/path |
| Query parser | tokenizer → AST (`and`, `or`, `not`, filters, regex, phrases) with operator precedence |
| Executor | per-file predicate short-circuit; content predicates produce match ranges |
| Incremental updates | on `modify`, re-index only that file; on `rename`, update path keys; on `delete`, drop |
| Performance | first search on a 10k-file vault should be < 500 ms warm; typing must debounce ~150–250 ms |
| UI | virtualised result list; per-file groups expandable; match count badges |
| Interactions | reverse highlights in the editor when opening a match; `search:context` CLI for scripting |

**INFERRED** internals: there is no search index inside the vault (verified: no index files exist), so the index is
either rebuilt from file contents each session or persisted with the metadata cache in userData IndexedDB. The first
search after launch is noticeably slower than subsequent ones (observed), consistent with lazy indexing.

## 5. Data structures

```ts
type Query = { type:"and"|"or"; operands:Query[] } | { type:"not"; operand:Query }
           | { type:"text"; value:string; regex?:boolean; caseSensitive?:boolean }
           | { type:"file"|"path"|"content"|"tag"|"line"|"section"|"block"; value:string }
           | { type:"property"; name:string; value?:string }
           | { type:"task"; state:"todo"|"done" };

interface FileMatches { file: TFile; matches: { line:number; ranges:[start,end][]; text:string }[] }
interface SearchResult { totalFiles:number; totalMatches:number; groups: FileMatches[] }
```

The public API mirrors this: `prepareQuery`, `prepareSimpleSearch`, `prepareFuzzySearch`, `sortSearchResults`,
`renderMatches`, `renderResults`.

## 6. Edge cases

* Regex with catastrophic backtracking → must be bounded or run in a worker with a timeout.
* Queries with `"` phrases containing operators; escaped quotes; empty query.
* Files with CRLF: match offsets must not drift; very long lines (no wrapping crashes).
* Binary files must be skipped except the embeddable text types (`canvas`, `base`).
* Case-insensitive matching for non-ASCII (Turkish i, German ß, CJK, emoji); diacritic-insensitive suggestions were
  added in 1.15 for the switcher — check parity expectations.
* Renames/deletes during a running search; search while the vault is syncing.
* Search inside excluded folders (`userIgnoreFilters`) must skip them.

## 7. Testing strategy

* Operator golden tests: for a fixed vault, each operator/combination has an expected (files, matches) pair — the
  table in §2 is the seed corpus.
* Fuzz the query parser (never throw, always return a valid AST).
* Index consistency: after N random edits, a full re-index must produce identical results to the incremental index.
* Benchmark with 1k/10k/100k notes of 2 KB; assert p95 latency.

## 8. Implementation sketch

* Keep a `Map<path, {text, mtime, tags, props, headings}>` in memory; build lazily per file on first search.
* Parse queries into an AST; compile to a predicate plus an optional "extractor" that yields match ranges so the UI can
  highlight without a second pass.
* Use one worker for content scanning above a file-count threshold; stream results back in batches so the UI paints
  immediately.

## 9. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Plain text + filename search, grouped results | M | **P0** |
| Operator parser (`file/path/tag/property/OR/-`, regex) | M | **P0** |
| Incremental index maintenance | M | **P0** |
| In-file find & replace | S | P1 |
| Explain-search, extra context, sort options | S | P2 |
| Worker-based scanning + cancellation | M | P2 |
| Persisted index across sessions | M | P3 |
