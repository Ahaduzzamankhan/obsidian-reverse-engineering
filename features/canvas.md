# Feature: Canvas

**Priority P2.** Evidence: `evidence/screenshots/04-canvas.png`; hand-written `.canvas` accepted by the app
(`experiments/observations.md#E9`); https://jsoncanvas.org/spec/1.0/.

## 1. User-facing behaviour

A canvas is a tab (`.canvas` file) holding an infinite, zoomable/pannable board of cards and connections:

* **Add** (bottom toolbar in the empty canvas): card, note/file, link, group; `canvas:new-file` creates one.
* **Node types**
  * **text card** — Markdown content, editable in place, renders wikilinks/embeds.
  * **file card** — embeds a vault file (note in read-only preview, image, PDF, canvas, base); a header shows the file
    name; clicking opens it.
  * **link card** — a URL with a preview (title/favicon/thumbnail), rendered inside a `webview` (1.15 opened a live
    `https://obsidian.md` page in a webview during the test).
  * **group** — a labelled/resizable background rectangle that moves its children.
* **Edges** — drag from a node's side handles; sides and arrowheads are configurable; labels supported.
* **Selection/edit**: marquee select, multi-drag, align, z-order (`canvas:jump-to-group`), copy/paste (internal MIME
  `application/obsidian/canvas`), delete, undo/redo, zoom to fit, export as image (`canvas:export-as-image`),
  convert to file (`canvas:convert-to-file`).
* Canvas content participates in **search** and **backlinks** (1.12 added canvas backlink detection): a `[[link]]` in a
  canvas card creates a real link in `metadataCache`.
* A base can be pinned into a canvas ("Pin view…"), and bases can embed canvases and vice versa.

## 2. File format (JSON Canvas 1.0 — VERIFIED round-trip)

```json
{
  "nodes": [
    {"id":"g1","type":"group","label":"Research group","x":-320,"y":-220,"width":900,"height":520},
    {"id":"n1","type":"text","text":"# Canvas text node\n\n- [[Welcome]]","x":-280,"y":-160,"width":360,"height":240},
    {"id":"n2","type":"file","file":"Welcome.md","x":120,"y":-160,"width":420,"height":300},
    {"id":"n3","type":"link","url":"https://obsidian.md","x":-280,"y":120,"width":300,"height":100}
  ],
  "edges": [
    {"id":"e1","fromNode":"n1","fromSide":"right","toNode":"n2","toSide":"left"}
  ]
}
```

Observed load result: `viewType:"canvas"`, `nodes.size === 4`, `edges.size === 1`, positions/sizes preserved exactly;
the file was not rewritten on open (no canonicalisation of a valid file).

Spec notes that matter: node order = z-order (ascending); colours are `"1".."6"` presets or hex; `file` nodes may carry
a `subpath` (`#Heading` / `#^block`); `group` may carry `background` + `backgroundStyle` (`cover|ratio|repeat`);
edges default `toEnd` to `arrow` and accept `label`/`color`. IDs are 16 hex chars in Obsidian's own output.

## 3. Internal model (observed via runtime objects)

| Concept | Behaviour |
| --- | --- |
| `canvasEl` | the view; holds `nodes: Map<id,Node>`, `edges: Map<id,Edge>`, `selection: Set`, viewport `{tx,ty,zoom}` |
| `setData({nodes,edges})` | diffing update: creates `Bc` (file), `Wf` (text), `hC` (link), `Ao` (group) nodes; `La` edges; removes missing ones; preserves z-order |
| Edges | if `fromSide`/`toSide` missing, computed from relative node positions (`sideFor(node,other)`) |
| Clipboard | `setData("obsidian/canvas", JSON.stringify(selection))`; paste remaps ids and offsets positions |
| Persistence | `requestSave()` debounced → serialized JSON written through the vault adapter |

## 4. Technical requirements

* A transform layer: screen ↔ world coordinates (`x*zoom + tx`), pointer capture, wheel zoom anchored at the cursor.
* Node rendering as absolutely positioned DOM cards inside a transformed wrapper (Obsidian uses DOM, not canvas:
  cards contain real inputs/iframes), plus `will-change: transform`.
* Connection geometry per side with bezier paths; hit-testing on the path for selection.
* Undo/redo as commands over the node/edge model (not DOM diffs).
* File-card embedding reuses the markdown reader; link cards need a secure webview/iframe with its own session.
* Export to image: render the current viewport (or fit-all) to a canvas via SVG foreignObject or an offscreen render.

## 5. Edge cases

* Cycles, self-edges, edges to deleted nodes (must be dropped on load).
* Node overlap/z-order changes on drag; groups must move children and resize edges.
* Very large canvases (5k nodes) — rendering must degrade gracefully.
* Invalid JSON / unknown node type → the view must show an error and never destroy the file.
* Missing embedded file → show a "file not found" card, keep the node.
* Link card URLs: privacy (a link card fetches a remote page on open); must be blocked when offline/with the web viewer
  disabled.
* Concurrent edit of the same canvas in two windows (last-write-wins observed behaviour would lose data — needs care).

## 6. Testing strategy

* Round-trip: parse spec examples → serialize → byte-identical (or semantically equal) output.
* Geometry tests for side computation and edge routing.
* Interaction tests: create/drag/connect/group/undo via synthetic pointer events.
* Cross-tool test: open a canvas produced by another JSON Canvas app; open an Obsidian canvas in another app.

## 7. Implementation sketch

* Model: plain arrays of nodes/edges with stable ids; a `CanvasStore` exposing commands (`addNode`, `moveNodes`,
  `connect`, `delete`, `setGroup`) that are undoable.
* Rendering: one `div.canvas-wrapper` with `transform: translate(tx,ty) scale(z)`; children positioned in world units.
* Use `pointerdown` on handles to start an edge drag; draw a temporary path until drop.
* Serialize with sorted keys and integer rounding to keep diffs small.

## 8. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Format parse/serialize + static rendering + pan/zoom | M | P1 |
| Text/file/group nodes, edges, connect by drag | L | P2 |
| Selection, multi-drag, undo/redo, clipboard | M | P2 |
| Link cards (webview + preview), export image | M | P2 |
| Canvas links in backlinks/search, pin base views | M | P3 |
