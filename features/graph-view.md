# Feature: Graph view

**Priority P1.** Evidence: `evidence/screenshots/07-graph.png`, `.obsidian/graph.json` captured,
renderer/worker code paths in `app.js`.

## 1. User-facing behaviour

Two views, same engine:

* **Global graph** (`graph`, `graph:open`) — every note (and optionally tags, attachments, unresolved links) with edges
  for every resolved link.
* **Local graph** (`localgraph`, `graph:open-local` / command in the note's "…" menu) — only the active note's
  neighbourhood up to a configurable depth, embedded in the note's own view.

Controls (screenshot): four collapsible panels —

| Panel | Controls |
| --- | --- |
| **Filters** | search filter (query syntax), `Tags`, `Attachments`, `Existing files only` (hide unresolved), `Orphans` |
| **Groups** | colour groups: query + colour, adds a colour per matching set |
| **Display** | arrows, text fade threshold, node size, link thickness, "Animate" (timelapse) |
| **Forces** | center force, repel force, link force, link distance, plus a "reset" |

Other interactions: pan (drag), zoom (wheel), drag a node (pins it while held), click to open, `Mod+click` to open in a
new pane, hover highlights neighbours, `Canvas`-style timelapse animation (`graph:animate`).

## 2. Verified rendering details

* Canvas-based renderer via **PIXI** (lazily loaded in 1.15), drawing inside an iframe host element.
* Force simulation in a **Web Worker**: `worker.postMessage({nodes, links, alpha:0.3, run:true})`; the worker returns a
  `Float32Array` of positions plus a version counter; the renderer reads `nodeLookup[id]` and applies `x/y`
  (also honouring pinned `fx/fy`).
* Node/link classes carry `weight` (degree by default, or from a colour group), `color`, `type`, and the renderer tracks
  hover state (`highlightNode`) and idle frames (`idleFrames > 60` → skip redraw).
* Persistence: `.obsidian/graph.json` (22 keys) — same file serves global and local graphs? *Observed:* one `graph.json`
  written when the graph opened; local graph keeps its own settings in `workspace.json` view state (**INFERRED**).

`graph.json` as written by a fresh vault (verbatim, abridged):

```json
{"collapse-filter":true,"search":"","showTags":false,"showAttachments":false,"hideUnresolved":false,
 "showOrphans":true,"collapse-color-groups":true,"colorGroups":[],
 "collapse-display":true,"showArrow":false,"textFadeMultiplier":0,
 "nodeSizeMultiplier":1,"lineSizeMultiplier":1,"collapse-forces":true,
 "centerStrength":0.518713248970312,"repelStrength":10,"linkStrength":1,"linkDistance":250,
 "scale":1,"close":false}
```

## 3. Data model

```ts
interface GraphNode { id: string;          // file path, or "#tag", or unresolved link text
                      type: "file"|"tag"|"unresolved"|"attachment";
                      x: number; y: number; fx?: number; fy?: number;
                      weight: number; color?: string }
interface GraphLink { source: GraphNode; target: GraphNode }
interface GraphSettings { search:string; showTags:boolean; showAttachments:boolean; hideUnresolved:boolean;
                          showOrphans:boolean; colorGroups:{query:string,color:string}[];
                          showArrow:boolean; textFadeMultiplier:number; nodeSizeMultiplier:number;
                          lineSizeMultiplier:number; centerStrength:number; repelStrength:number;
                          linkStrength:number; linkDistance:number; scale:number }
```

## 4. Behaviour and edge cases

* Unresolved links appear as nodes labelled with the link text (verified: "This note does not exist" node in the test
  graph). Hiding them is a filter, not a data change.
* Orphan notes still render (isolated dots) unless filtered out.
* Tag nodes appear only when `showTags` is on; attachments only when `showAttachments` is on.
* Large vaults: the worker keeps the simulation off the main thread; rendering skips when idle; text fades out below a
  zoom threshold (`textFadeMultiplier`).
* Cycles, self-links (ignored for layout), and duplicate edges (a link counted once per direction) need explicit rules.
* Local graph depth and "incoming/outgoing only" toggles exist in the local graph's controls (documented behaviour).

## 5. Technical requirements

* Graph data build: nodes from `vault.getFiles()` (+ tags/unresolved), edges from `resolvedLinks`.
* Force simulation: d3-force-like (charge, link, center) in a Worker, transferable `Float32Array` positions.
* Renderer: WebGL/WebGPU via PIXI, or 2D canvas for a smaller clone; must handle 10k nodes at interactive rates.
* Interaction hit-testing: spatial index (the `sim.js` quadtree bundle) for hover/click.
* Settings persistence per view type.

## 6. Testing strategy

* Deterministic simulation: seed the RNG, run N ticks, snapshot coordinates (tolerance-based).
* Graph build tests against the fixture vault (node/edge counts, unresolved handling, tag nodes).
* Performance: 1k / 10k / 50k nodes; assert frame time and that the main thread never blocks > 50 ms.
* Visual regression of the four control panels.

## 7. Implementation sketch (independent)

* Build the graph in the main thread, hand structure to a worker; worker owns positions and replies with transferable
  buffers.
* Use PIXI or a 2D canvas with pre-rendered node sprites; draw text only for nodes above a size threshold.
* Keep filters as predicates over node/edge lists and rebuild on change (cheap) rather than mutating the simulation.

## 8. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Graph data build + static SVG/canvas rendering | M | P1 |
| Force layout worker + pan/zoom/drag | L | P1 |
| Filters/Groups/Display/Forces panels + persistence | M | P1 |
| Local graph with depth and direction filters | M | P1 |
| Timelapse animation, text fading, pinned nodes | S | P2 |
| 50k-node performance parity | L | P3 |
