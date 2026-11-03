# UI analysis: themes and design tokens

Evidence: `evidence/probes/cssvars.json` (1027 computed custom properties), live dark/light diff
(`experiments/observations.md#E8`, `#E20`), `appearance.json`, `app.css` (598 KB).

## 1. Mechanism

* Exactly two built-in themes, switched by a **body class**: `theme-dark` / `theme-light`. Nothing else changes; every
  rule reads custom properties.
* Tokens are defined on `body` (so they cascade to popout windows and embeds) and are overridable by:
  1. a community theme (`theme.css` loaded after `app.css`),
  2. CSS snippets (`.obsidian/snippets/*.css`, toggled in Appearance),
  3. `cssclasses` frontmatter (per-note scope),
  4. plugins (`app.customCss`).
* Accent color, font sizes, fonts and "translucency" are user settings that rewrite a handful of tokens at runtime.

## 2. Core tokens (measured, not copied from documentation)

| Token | Dark | Light |
| --- | --- | --- |
| `--background-primary` | `#1C1C1C` | `#ffffff` |
| `--background-primary-alt` | `#232323` | `#fafafa` |
| `--background-secondary` | `#282828` | `#f6f6f6` |
| `--background-secondary-alt` | `#333333` | `#fcfcfc` |
| `--background-modifier-border` | `#333333` | `#e4e4e4` |
| `--background-modifier-hover` | `color-mix(in oklch, white 6.7%, transparent)` | `color-mix(in oklch, black 6.7%, transparent)` |
| `--background-modifier-active-hover` | accent 10 % mix | accent 10 % mix |
| `--text-normal` | `#dadada` | `#222222` |
| `--text-muted` | `#b3b3b3` | `#5c5c5c` |
| `--text-faint` | `#666666` | `#ababab` |
| `--text-accent` | `hsl(calc(258 - 3), calc(88% * 1.02), calc(66% * 1.15))` | `hsl(258, 88%, 66%)` |
| `--interactive-accent` | `hsl(258, 88%, 66%)` | `hsl(calc(258 - 1), calc(88% * 1.01), calc(66% * 1.075))` |
| `--color-red` | `#fb464c` | `#e93147` |
| `--color-orange` | `#e9973f` | `#ec7500` |
| `--color-yellow` | `#e0de71` | `#e0ac00` |
| `--color-green` | `#44cf6e` | `#08b94e` |
| `--color-cyan` | `#53dfdd` | `#00bfbc` |
| `--color-blue` | `#027aff` | `#086ddd` |
| `--color-purple` | `#a882ff` | `#7852ee` |
| `--color-pink` | `#fa99cd` | `#d53984` |
| `--color-base-00/10/20/100` | `#1C1C1C / #232323 / #282828 / #dadada` | greyscale ramp ending `#222222` |

Observations:

* The default accent is **violet, hue 258, 88 % saturation, 66 % lightness**; hover/active variants are computed with
  `hsl(calc(...))` — i.e. Obsidian derives states arithmetically from the user's accent rather than shipping separate
  hex values. This single detail explains why user accent colors look consistent.
* Opacity is expressed with **`color-mix(in oklch, …)`**, which keeps hovers perceptually even across light/dark.
* The greyscale ramp goes through `--color-base-00 … --color-base-100`, so a theme can re-tint everything by
  overriding the ramp.

## 3. Typography scale

| Token | Value | Effective |
| --- | --- | --- |
| `--font-text-size` | `16px` | body text |
| `--line-height-normal` | `1.5` | 24 px |
| `--h1-size` | `1.618em` | 25.888 px (golden ratio) |
| `--h2-size` | `1.462em` | 23.4 px |
| `--h3-size` | `1.318em` | 21.1 px |
| `--font-ui-small` | `13px` | explorer rows, tab titles, status text 12 px |
| `--font-ui-medium` | `15px` | most chrome |
| `--font-ui-large` | `20px` | headings in settings/modals |
| `--file-line-width` | `700px` | readable measure (~70–80 chars at 16 px) |

Families (in order): user override → Inter Variable (bundled `public/InterVariable.woff2`) → system stack
(`ui-sans-serif, -apple-system, "Segoe UI", Roboto, …`); monospace: user → bundled Source Code Pro → system mono.
In this environment `--font-*-theme` computed to the literal placeholder `"??"` and fell through to the system stack —
worth remembering: Obsidian treats "no custom font" as a placeholder string, not an empty value.

## 4. Shape and density tokens

`--radius-s: 4px`, `--radius-m: 8px`, `--radius-l: 12px`, `--radius-xl: 24px`; `--input-height: 30px`;
`--header-height: 40px`; `--ribbon-width: 44px`; `--titlebar-height: 30px`; `--icon-s: 16px`, `--icon-m: 16px`,
`--icon-l: 18px`; `--indentation-guide-width: 1px`; status bar positioned `fixed`, 27 px high with a rounded top-left
corner.

## 5. Token families (counts from the live set of 1027)

```
bases:70  tab:46  metadata:45  table:38  color:37  nav:35  font:33  callout:25  pele:24  mermaid:22
slider:22  background:21  icon:19  code:18  embed:18  pill:17  link:16  size:15  tag:15  setting:15
footnote:14  canvas:13  modal:13  list:13  dropdown:13  (+ graph, menu, prompt, checkbox, toggle, input, …)
```

Feature-scoped families are the notable design choice: `--bases-*` (70) shows that even a new feature ships its own
token namespace instead of hard-coding colors, which is exactly how themes keep working after feature releases.

## 6. Theme selection and persistence

* `appearance.json` holds: `theme` (`obsidian`/`moonstone` internal names or `system`), `cssTheme` (community theme
  folder name), `enabledCssSnippets` (array), `accentColor`, `baseFontSize`, `interfaceFontFamily`,
  `textFontFamily`, `monospaceFontFamily`, `translucency`, `nativeMenus`, `showViewHeader`, `showInlineTitle`.
* `theme:switch` opens a fuzzy picker of installed themes; `theme:toggle-light-dark` flips the body class.
* In the test environment `appearance.json` stayed `{}` until a theme/setting was changed — defaults are implicit, not
  written.

## 7. What a clone should copy, and what to improve

Copy: the **single-class theme switch**, the **accent-derived state colors**, the **greyscale ramp**, per-feature token
namespaces, `color-mix(in oklch)` for hovers, the 700 px measure and the 1.618 heading scale.

Improve: provide a token **manifest** (documented names/types) so themes are discoverable; add a **contrast audit** in CI
(`--text-faint` is 3.1:1 on dark, below AA for body text); support `prefers-reduced-motion` and a high-contrast mode
without a full theme; and expose tokens in the API so plugins stop hard-coding colors.

## 8. Testing strategy

* Snapshot the computed value of ~60 core tokens in both themes (this table is the baseline) — catches accidental theme
  regressions.
* Render a component gallery in light/dark at 3 zoom levels and diff screenshots with a small threshold.
* Validate every token that contains a color with a contrast check against its intended background.
