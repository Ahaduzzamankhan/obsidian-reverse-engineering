# Feature: Bases (database views over notes)

**Priority P1 (product differentiator).** Evidence: `evidence/screenshots/05-bases.png`; hand-written `.base` accepted and
queried (`experiments/observations.md#E9`, CLI `base:query`); documented syntax (help.obsidian.md/bases).

## 1. What a base is

A `.base` file is **YAML that describes a query over the vault** plus one or more views. There is no separate store: rows
are markdown files (later: any file), columns are note properties, file properties or formulas. It behaves like a
lightweight, git-friendly Airtable/Notion database that never hides the notes.

Shipped in 1.9 (public 2025-08), the plugin API for custom views landed in 1.10, and Kanban in 1.14.

## 2. Verified behaviour

Hand-written file:

```yaml
filters:
  and:
    - file.hasTag("project")
views:
  - type: table
    name: Projects
    order:
      - file.name
      - status
      - priority
  - type: cards
    name: Cards
```

Result (screenshot): view type `bases`; header row = `Projects ▾ | 1 result | Display | Sort | Group | Filter |
Properties | Search | +`; the table shows columns `file name` (with a file icon), `status`, `priority`; one row
`Alpha Renamed` (the only note with `tags: [project]`); empty cells for missing properties.

CLI query of the same file:

```json
[{"path":"Projects/Alpha Renamed.md","file name":"Alpha Renamed","status":null,"priority":null}]
```

Note the CLI uses **display names** as JSON keys and returns `null` for missing values.

## 3. Syntax (documented, cross-checked with the parser in `app.js`)

Top level:

```yaml
filters: <filter|{and|or|not: [...]}>
formulas: { name: "expression" }
properties: { name: { displayName: "…" } }
summaries: { name: "expression over values" }
views: [ { type, name, filters?, limit?, groupBy?, groupOrder?, order?, summaries? } ]
newItemFolder: "Inbox"          # 1.9.3+ "New item" target
newItemTemplate: "Templates/Row"
```

Filter/expression language: object-oriented, chainable — `file.hasTag("book")`, `file.inFolder("x")`,
`file.hasLink("Note")`, comparisons `== != > < >= <=`, arithmetic `+ - * / %`, booleans `&& || !`, lists `[a,b]`,
`contains`, `startsWith`, `isEmpty`, `isTruthy`, date arithmetic (`now()`, `today()`, durations `"1 day"`, unit
`y/M/d/w/h/m/s` where `m`=minutes, `M`=months), and functions like `if()`, `number()`, `date()`, `link()`, `image()`,
`icon()`, `html()`, `duration()`, `list()`, `max/min/mean/median/sum/round`, `format()`.

Properties come in three kinds: **note properties** (frontmatter), **file properties** (`file.name`, `file.path`,
`file.folder`, `file.ext`, `file.size`, `file.ctime`, `file.mtime`, `file.tags`, `file.links`, `file.embeds`,
`file.backlinks`, `file.properties`, `file.file`), and **formula properties**.

Views in 1.15: `table`, `cards`, `list` (1.10), `kanban` (1.14), `map` (1.10, Maps plugin). The first view is the
default; `![[File.base#View]]` embeds a named view; a fenced ```base``` block embeds an inline base.

## 4. Internal model (observed)

```ts
class Base {
  views: BaseViewConfig[];              // each with its own filters/order/limit/grouping
  properties: Map<string, PropertyConfig>;
  formulas: Map<string, Formula>;
  summaries: Map<string, Summary>;
  unrecognizedData: object;             // forward-compatible unknown keys are preserved
  static fromString(yaml): Base | Error;
  getViewConfig(name): BaseViewConfig | undefined;
}
class QueryController {                 // per leaf
  update(): void;                       // re-evaluate against the vault
  getPropertyConfig(name); setEphemeralState(); promptForAddView(); selectView(name);
}
class BasesEntry { file: TFile; values: Map<string, Value>; }   // row
class BasesQueryResult { entries: BasesEntry[]; groups; columns; summaries }
```

Evaluation: `filters = and(globalFilters, viewFilters)`; every markdown file becomes an entry unless
`metadataCache.isUserIgnored(path)`; the filter's `test(entry)` runs lazily per column/value; results are sorted by the
view's `order` and sliced by `limit` ("Showing 10 of 40" in 1.15).

## 5. UI

* Toolbar: view switcher (`Projects ▾`), result count, **Display/Sort/Group/Filter/Properties** menus, search box,
  "New" (creates a note from the template), "+" (add view / add property / add item).
* Table: sticky header, resizable columns, row height, keyboard navigation, multi-cell copy/paste, undo/redo,
  inline editing of property cells (writes back to frontmatter), summaries row.
* Cards: cover image, title, chosen properties; card-size slider.
* Kanban: columns by a group property, drag cards → property value changes.
* Errors render in-place (`.bases-error`) instead of blanking the view.

## 6. Technical requirements

* YAML parse with error messages that point at the offending key.
* Expression parser + evaluator with a **typed value system** (`Value` subclasses exist in the public API —
  String/Number/Boolean/Date/RelativeDate/Duration/File/Link/List/Object/HTML/Image/Url/Tag/RegExp/Null) so that
  comparisons and formatting behave predictably.
* A row materialiser that joins `metadataCache` per file with formulas, computed lazily and cached per update cycle.
* Write-back path for cell edits (property set → frontmatter edit → cache update → view refresh), with undo.
* View plugin API (`registerBasesView`) for custom renderers.

## 7. Edge cases

* Missing properties vs `null` vs empty string — the observed CLI emits `null`.
* Type mismatches (`priority: "8"`), dates as strings, links as values, lists of links.
* Formula cycles; division by zero; invalid regex; unknown functions.
* 100k files: filtering must not materialise every property (lazy, column-projected).
* Editing a cell whose file is read-only / open dirty elsewhere.
* Unknown view type or unknown keys → preserve them (forward compatibility) and show a graceful error.
* `this` context inside embeds (points at the embedding file, documented).

## 8. Testing strategy

* Syntax matrix: every documented function/operator with expected values (table-driven).
* Query engine tests against a fixture vault (tags, folders, links, dates, formulas, summaries, grouping).
* Round-trip: parse → serialize preserving unknown keys and comments where possible.
* Write-back: cell edit → file content diff contains only the intended property change.
* Performance: 10k notes × 20 properties; first render < 300 ms with column projection.

## 9. Implementation sketch

* Represent values as a small tagged union with `compare`, `format`, `coerce`; implement `file.*` as derived values.
* Compile filters to a closure tree once per update; cache per-file derived values for the duration of a render.
* Views are pure functions of `BasesQueryResult`; the built-in views are registered through the same API plugins use —
  this keeps the core small and makes the plugin API real rather than decorative.

## 10. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| `.base` parse + table view + filters (file.* + note props) | L | P1 |
| Expression language (operators, functions, dates, links) | L | P1 |
| Cell editing with write-back + undo | M | P2 |
| Cards/List views, grouping, summaries, sort/limit | M | P2 |
| Kanban view (group + drag) | M | P2 |
| Custom view plugin API | M | P3 |
| Inline fenced ```base``` embeds | S | P3 |
