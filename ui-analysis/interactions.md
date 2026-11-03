# UI analysis: interactions

## 1. Keyboard model

Obsidian uses a **scope stack**: global scope → modal scope → editor scope. A binding is resolved by the innermost
scope that has it; `Mod` = ⌘ on macOS, Ctrl elsewhere. Default bindings (**VERIFIED**, 41 total) include:

| Keys | Command |
| --- | --- |
| `Mod+S` | save current file |
| `Mod+E` | toggle reading view |
| `Mod+P` | command palette |
| `Mod+O` | quick switcher |
| `Mod+N` / `Mod+Shift+N` | new note / new note in new pane |
| `Mod+T` / `Mod+W` / `Mod+Shift+W` | new tab / close tab / close window |
| `Mod+1..8`, `Mod+9` | go to tab N / last tab |
| `Ctrl+Tab`, `Ctrl+Shift+Tab` | next / previous tab |
| `Mod+Shift+T` | undo close tab |
| `Mod+Alt+←/→` | back / forward |
| `Mod+,` | settings |
| `Mod+;` | add property |
| `F2` | rename file |
| `F1` | help |
| `Alt+Enter` / `Mod+Enter` / `Mod+Alt+Enter` / `Mod+Alt+Shift+Enter` | follow link / new tab / split / new window |
| `Ctrl+W` | close tab (Windows/Linux alternative shown in the palette) |

Palette behaviour: shows the binding as a chip on the right of the row; typing filters by fuzzy match on the
category-prefixed name; `Enter` runs, `Escape` closes; modifier shortcuts remain live while the palette is open.
Quick switcher additionally creates a note when nothing matches.

Settings (1.13+) support arrow-key navigation, `Enter` to open, `Ctrl/Cmd+F` to focus search, and Vim bindings.

## 2. Pointer interactions

| Interaction | Result |
| --- | --- |
| Click link (Live Preview / Reading) | open in active tab; `Mod+click` new tab; `Mod+Alt` split; `Mod+Alt+Shift` new window |
| Hover link | wait for `--hover-delay`, then hover preview (`page-preview`); `Mod+hover` forces it |
| Drag file in explorer | highlight drop targets: file → move, folder → move into, editor → insert link/embed |
| Drag tab | reorder, move between panes, drop on the "new window" target |
| Drag splitter | resize sidebar (`width` persisted) |
| Double-click tab | (no bind) — double-click explorer item opens in a new tab when configured |
| Right-click | native context menu (file, folder, editor, tab, canvas, status bar) |
| Wheel over editor | scroll; `Ctrl+wheel` = window zoom |
| Drag canvas node | move; drag selection | marquee; drag handle | create edge |
| Drag Bases card (kanban) | change the grouping property |
| Drag image resize handle (1.12+) | resize the embed and write `\|width` into the Markdown |

## 3. State styling (from live computed styles)

| State | Visual rule |
| --- | --- |
| Hover (list row) | `background: color-mix(in oklch, white 6.7%, transparent)` on dark (`--background-modifier-hover`) |
| Active/selected row | same token at higher alpha plus full-strength text (`#dadada` vs `#b3b3b3`) |
| Active tab | background `oklch(0.999994 0.0000498 none / 0.067)`, radius 4 px, title color `#666666` → active title `#dadada` |
| Focus ring | 2 px `--background-modifier-border-focus` outline on inputs; `is-focused` body class |
| Disabled | 0.5 opacity, `cursor: not-allowed`, no hover |
| Selected text | `--text-selection` tint (accent at low alpha) |
| Modified file | dot replaces the tab close button; `is-active` + unsaved dot |
| Collapsed sidebar | ribbon persists, panel width animates to 0 |

## 4. Motion and timing

* Modal/palette: fade + slight scale (≈100–150 ms); backdrop dims the app.
* Sidebar collapse: width transition ≈150–200 ms, no bounce.
* Notices: slide/fade in, auto-dismiss after ~5 s (persist on hover).
* Hover preview: delayed popover (~300 ms default; `hoverTime` is a CodeMirror tooltip option that also appears in the
  editor bundle).
* Menus (native) have OS animation; in-DOM menus on mobile animate upward.
* No page-transition animations anywhere; the UI aims for instant feedback rather than choreography.

## 5. Feedback and safety interactions

* **Notices**: "Restart required" for settings that need it (`msgRestartRequired`), plugin errors, file-recovery
  messages.
* **Confirmations**: delete file (configurable), overwrite, apply template variable defaults, 1.13 URI-execution
  confirmation with allow-list, remote/UNC file warning, executable file warning.
* **Undo beyond the editor**: undo close tab (`Mod+Shift+T`), undo file delete? — not available after OS trash
  (verified absence in the command list); canvas and Bases have their own undo.
* **Progress**: long operations (index rebuild, sync) report in the status bar, never in blocking dialogs.

## 6. Drag-and-drop semantics (important to get right)

Dropping text/files into the editor produces different results depending on the source and modifiers:

* File from the explorer → `[[link]]` (or `![](embed)` with `Shift` held / dropped into an empty line);
* Text from outside → plain text; HTML from a browser → `htmlToMarkdown` conversion;
* Image file from the OS → copied into the attachment folder and embedded;
* Canvas selection → JSON Canvas payload via the custom MIME.

## 7. Interaction test matrix for a clone

1. Every default hotkey triggers exactly one command, and the palette shows the same binding.
2. Palette/switcher fully operable by keyboard only; Escape returns focus to the previous editor.
3. Tab drag between panes preserves view state (scroll, mode, cursor).
4. Sidebar resize persists across restart; collapse persists.
5. Drop targets show the correct label ("Move into", "Insert link here", "Insert links here").
6. Context menus appear at the pointer and are dismissible with Escape; menu items disabled when inapplicable.
7. Focus never escapes a modal (focus trap) and returns to the invoking element.
8. Hover previews do not stack or leak when the pointer moves quickly.
