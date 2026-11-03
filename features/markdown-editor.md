# Feature: Markdown editor

**Priority P0.** Evidence: `evidence/screenshots/01-main-layout.png`, `10-reading-view.png`; live DOM probes
`experiments/observations.md#E12`, `#E17`; CodeMirror 6 presence in `app.js`.

## 1. User-facing behaviour

A note opens in a tab as a Markdown document with three presentational modes selected per tab:

| Mode | `workspace.json` state | What the user sees |
| --- | --- | --- |
| **Live Preview** (default editing) | `mode:"source", source:false` | Source text with inline rendering: headings styled, emphasis bold, links clickable, images/math/embeds rendered as widgets; markup characters dimmed and revealed at the caret |
| **Source** | `mode:"source", source:true` (legacy, per-tab) | Raw Markdown, syntax highlighted, no widgets |
| **Reading view** | `mode:"preview"` | Fully rendered document, no caret; toggled with `Mod+E` |

Observed surface: inline title (editable, same as filename), a properties block above the body, a right-hand
outline/backlink/tag stack, status bar with live word/character counts, and a "…" menu with mode, fold, export,
copy-path, open-in-new-window etc.

## 2. Supported Markdown (all verified rendering)

CommonMark + GFM plus Obsidian extensions:

* ATX/setext headings, bold/italic/strikethrough, `==highlight==`, inline code, fenced code with language
  (Prism highlighting), tables, ordered/unordered lists, task lists (`- [ ]` / `- [x]`), blockquotes, horizontal rules.
* **Callouts**: `> [!note] Title` → `<div class="callout" data-callout="note">`; the metadata cache records a section of
  `type: "callout"`.
* **Wikilinks**: `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, `[[Note#^block]]`, `[[#Heading]]` (same file);
  display text defaults to `Note > Heading`.
* **Embeds**: `![[Note]]`, `![[image.png]]`, `![[#Heading]]`, `![[file.pdf#page=3]]`; embeddable extensions are
  `md, bmp, png, jpg, jpeg, gif, svg, webp, avif, mp3, wav, m4a, 3gp, flac, ogg, oga, opus, mp4, webm, ogv, mov, mkv,
  pdf, canvas, base`.
* **Block references**: `^block-id` at the end of a paragraph creates `blocks["block-id"]` with its position.
* **Footnotes**: `[^1]` + `[^1]: text`, plus a Footnotes sidebar core plugin.
* **Math**: `$inline$` and `$$block$$` rendered by MathJax (`loadMathJax`, `renderMath`, `finishRenderMath`).
* **Mermaid**: fenced ` ```mermaid ` rendered by **Pele** in 1.15 (`loadMermaid`), 24 `--pele-*` CSS variables.
* **Frontmatter/properties**: see `properties.md`.
* **Tags**: `#tag` and `#nested/tag` inline and in frontmatter (`tags:`, `tag:` legacy).
* **Comments**: `%% hidden %%` (not rendered, retained in source).
* **HTML**: raw HTML is permitted but sanitised (`security/assessment.md#html`).

## 3. Interaction details observed

* `Mod+E` toggles reading view; the mode is stored per tab and survives restart.
* `Mod+S` saves (writes are also debounced after edits; "Save current file" exists for paranoia).
* Link following: `Alt+Enter`/`Mod+Enter` (`editor:follow-link`, `editor:open-link-in-new-leaf`), `Mod+Alt+Enter`
  (split), `Mod+Alt+Shift+Enter` (new window).
* `Mod+;` adds a metadata property (`markdown:add-metadata-property`).
* Formatting commands exist per construct (`editor:toggle-bold`, `…-italic`, `…-highlight`, … — 85 `editor:*`
  commands in total).
* Folding: headings and lists fold via gutter indicators (`allow-fold-headings`, `allow-fold-lists` classes on the
  preview container; `collapse-indicator` in the editor gutter).
* Indentation guides, readable line length, inline title and spellcheck are all settings-driven body classes
  (`show-indentation-guide`, `is-readable-line-width`, `show-inline-title`).
* Vim mode is a first-class option (`lib/codemirror/vim.js` in the editor bundle, `:image` command added in 1.13).
* Undo/redo is CodeMirror history; "Undo close tab" is a workspace command, not an editor one.

## 4. Technical requirements

| Requirement | Detail |
| --- | --- |
| Editor core | CodeMirror 6 (`EditorView`, `StateField`, `ViewPlugin`, `Decoration`, Lezer syntax tree) |
| Markdown parser | Lezer markdown + custom extensions for wikilinks, embeds, tags, callouts, block ids |
| Two renderers | Live Preview decorations over source; Reading view builds DOM from the same AST |
| Position fidelity | Every cached element carries `{line, col, offset}` start/end so backlinks, properties and search can jump precisely |
| Widget system | Rendered embeds/images as atomic ranges so the caret treats them as one unit |
| Performance | Only visible sections/rows rendered; debounced parse; incremental re-parse on edit |
| Sanitisation | Allow-list HTML filter applied to any note-supplied HTML |
| Save path | Debounced atomic write through the vault adapter, with an external-change watcher |

## 5. Data structures

```ts
interface CachedMetadata {
  links?: LinkCache[]; embeds?: EmbedCache[]; tags?: TagCache[];
  headings?: HeadingCache[]; sections?: SectionCache[]; blocks?: Record<string, BlockCache>;
  frontmatter?: FrontMatterCache; frontmatterPosition?: Pos; frontmatterLinks?: FrontmatterLinkCache[];
  listItems?: ListItemCache[]; footnotes?: FootnoteCache[]; footnoteRefs?: FootnoteRefCache[];
  referenceLinks?: ReferenceLinkCache[];
}
interface Pos { start: Loc; end: Loc }
interface Loc { line: number; col: number; offset: number }
interface LinkCache { position: Pos; link: string; original: string; displayText?: string }
interface HeadingCache { position: Pos; heading: string; level: number }
interface SectionCache { position: Pos; type: string; id?: string }   // yaml|heading|paragraph|list|callout|table|code…
```

## 6. Edge cases to test

* Caret behaviour inside atomic widgets (arrow stepping, Backspace deleting the whole embed).
* Link with alias + heading + block in one target (`[[A#H|alias]]`).
* Unclosed code fence / callout at EOF; nested callouts; callout inside a list item.
* Tables with escaped pipes, alignment row, and no leading/trailing pipe.
* CRLF files, BOM, mixed line endings, very long lines (10k+ chars), very large files (1 MB+).
* Math delimiters inside code spans; `$$` in a table cell; Mermaid with syntax errors (must show an error, not crash).
* Sanitisation: `on*`, `javascript:`, `data:` URLs, `<iframe https>`, `<svg onload>`, `<math><script>` (all verified).
* IME composition and RTL text; vim mode key conflicts with hotkeys.
* Concurrent external edit while typing (conflict policy: reload/keep).

## 7. Testing strategy

1. Golden-file corpus: one note per syntax feature; assert Reading-view DOM snapshot (normalise ids/svg) and
   `metadataCache` output.
2. Property-based parser tests: random markdown → parse → must never throw, positions must be monotonic.
3. Editor interaction tests in a real browser (Playwright) against the CodeMirror instance: typing, widget stepping,
   fold/unfold, undo.
4. Cross-check cached positions against source text (`source.slice(offset)` matches the cached text) — this catches
   off-by-one bugs that break backlinks.
5. Performance budget: 10k-line document must open < 300 ms and edit at 60 fps; memory < 150 MB for the editor alone.

## 8. Implementation sketch (independent)

* Parse with `remark`/`micromark` or Lezer; emit a **single AST walk** producing both `CachedMetadata` and a render
  plan.
* Live Preview: implement as a `ViewPlugin` that, for each block whose caret is not inside, replaces ranges with widgets
  (`Decoration.replace`); keep a `StateField` of folds/widgets; use atomic ranges for embeds.
* Reading view: render into a virtualised list of block containers keyed by section offset; make each block a
  `content-visibility: auto` element.
* Keep interactive elements (`input[type=checkbox]`, links, embeds) as real DOM inside widgets so clicks work without a
  second rendering path.

## 9. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Source editing + save + reading view | M | **P0** |
| Wikilink/embed parsing and rendering | M | **P0** |
| Live Preview decorations (headings, emphasis, links, images) | L | **P0** |
| Callouts, math, Mermaid, footnotes, tables | M each | P1 |
| Block references, block embeds, heading embeds | M | P1 |
| Vim mode, slides, folding richness, IME/RTL polish | L | P2 |
| Full HTML allow-list parity with theme CSS variables | S | P2 |
