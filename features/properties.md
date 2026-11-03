# Feature: Properties (frontmatter metadata)

**Priority P1.** Evidence: `evidence/screenshots/01-main-layout.png`, `10-reading-view.png`, live
`metadataTypeManager` probe (`experiments/observations.md#E6`), `evidence/probes/propertytypes.json`.

## 1. User-facing behaviour

* YAML frontmatter at the top of a note is rendered as a **typed property list** in both Live Preview and Reading view:
  a header ("Properties", collapsible) and one row per property with an icon, name, value editor, and a type menu.
* While a property is invalid YAML or has a type conflict, an error container is shown
  (`.metadata-error-container`) and the raw text stays editable.
* "+ Add property" adds a row with a **name autocomplete** over existing properties in the vault.
* Types are **inferred automatically** and can be changed per property name (globally) via the type menu; the choice is
  stored per vault (`types.json`).
* The **All properties** view (`all-properties`) lists every property in the vault with counts and types; the
  **File properties** view (`file-properties`) shows the current file's.
* Properties are first-class in **Bases** (queryable columns), **graph/tags**, **search** (`[prop:value]`), **templates**
  (variables), **canvas** cards, and the CLI (`properties`, `property:read/set/remove`).

## 2. Observed type system (VERIFIED)

`app.metadataTypeManager.registeredTypeWidgets` (11 widgets):

```
aliases | checkbox | date | datetime | file | folder | multitext | property | number | tags | text
```

Inference observed on a fresh note with no type configuration:

| Frontmatter | Inferred widget |
| --- | --- |
| `title: Welcome` | `text` |
| `tags: [research/obsidian, demo]` | `tags` (built-in; renders pill inputs) |
| `aliases: [Home]` | `aliases` (built-in) |
| `status: active` | `text` |
| `priority: 8` | `number` |
| `reviewed: 2026-10-01` | `date` (rendered with a date picker; the raw value stays `"2026-10-01"`) |
| `publish: false` | `checkbox` |
| `progress: 42` | `number` |
| `cssclasses: [wide]` | `multitext` (built-in) |

`app.metadataTypeManager.properties` after the test became:

```json
{"aliases":{"name":"aliases","widget":"aliases"},"cssclasses":{"name":"cssclasses","widget":"multitext"},
 "tags":{"name":"tags","widget":"tags"},"title":{"name":"title","widget":"text"},
 "status":{"name":"status","widget":"text"},"priority":{"name":"priority","widget":"number"},
 "reviewed":{"name":"reviewed","widget":"date"},"publish":{"name":"publish","widget":"checkbox"},
 "progress":{"name":"progress","widget":"number"}}
```

Note the type map is **global per property name**, not per file: changing `priority` to `text` affects every note.

## 3. Parsing contract

* Frontmatter must start at offset 0 with `---` and end with `---` or `...`; `frontmatterPosition` records both.
* Values are YAML 1.2-ish (Obsidian's own parser; `parseYaml`/`stringifyYaml` are public APIs).
* Supported shapes: string, number, boolean, date/datetime (ISO), list of strings (rendered as pills), nested object
  (rendered as JSON text — not editable as a tree), links (`[[…]]` become `frontmatterLinks`), null.
* Reserved keys with dedicated UI: `tags` (list), `aliases` (list), `cssclasses` (list, applies CSS classes to the
  note container), plus 1.9 renames `tag→tags`, `alias→aliases`, `cssclass→cssclasses` (breaking change documented).
* Writing back: Obsidian preserves key order and comments? — **UNVERIFIED**; the safe assumption is that editing a
  property rewrites the YAML block via `process()` and normalises formatting.

## 4. Technical requirements

* A YAML reader that also returns exact source ranges per key/value (needed to edit one property without rewriting the
  block and to support "reveal in source").
* A type store (`types.json`) merged with inference; inference must be deterministic (first non-null value's inferred
  type, unless overridden).
* Property editors per type: text, textarea, number (stepper), checkbox, date/datetime picker, tag pills
  (autocomplete over existing tags), link picker (file/folder), list editor with add/remove.
* Validation/error surface that never destroys user text.
* Vault-wide property index for autocomplete and the All-properties view.

## 5. Edge cases

* Invalid YAML (tabs, duplicate keys, unclosed quotes) → keep raw text, show error, don't lose data.
* A property that is a list in one note and a scalar in another → the editor must adapt per file.
* Numbers that look like dates (`2026`), quoted numbers (`"8"`), booleans as strings.
* Dates with timezones; `datetime` vs `date` inference.
* Multiline strings (block scalars) and comments in frontmatter.
* Very many properties; very long values; emoji/Unicode keys.
* Renaming a property across the vault (Obsidian has no built-in rename here — a clone could add it).

## 6. Testing strategy

* Round-trip: parse → edit one property → serialize; other properties byte-identical.
* Type inference table tests (the table above is the seed).
* Cross-feature tests: property filters in search, Bases columns, CLI `property:set`, and the All-properties view must
  agree on types.
* Fuzz invalid YAML to ensure no crash and no data loss.

## 7. Implementation sketch (independent)

* Use a position-aware YAML parser (e.g. `yaml` with `ranges`) or store the raw frontmatter block plus a parsed view;
  edit by replacing a single key's value range.
* Keep `PropertyTypeRegistry` (name → type + editor component) persisted in `types.json`; inference runs only for names
  without an explicit type.
* Render properties as a small table with ARIA labels and keyboard navigation (Obsidian's rows are focusable and
  type menus are keyboard accessible).

## 8. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Frontmatter parse/cache with positions | S | **P0** |
| Property UI (text/number/checkbox/date/list) | M | P1 |
| Type inference + global type store | S | P1 |
| Tag/link/file/folder pickers | M | P1 |
| All-properties view + vault property index | S | P2 |
| Nested objects, block scalars, property rename | M | P3 |
