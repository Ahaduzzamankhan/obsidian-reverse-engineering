# Investigation progress

Final status. `done` = evidence captured and documented; `partial` = captured with a stated limitation; `blocked` =
requires credentials/another platform.

## Phase 0 — Environment and artefacts

| Step | Status | Evidence |
| --- | --- | --- |
| Inventory workspace (`Obsidian-1.15.0.exe`, `craft-anything-cli.exe`, `.freebuff/`) | done | `experiments/observations.md#E0` |
| Identify host (Windows 11 x64, Node 24.19, npm 11.17, Python 3.14, MSYS bash, no 7-Zip) | done | `experiments/methodology.md` |
| Confirm Obsidian not installed locally | done | `observations.md#E0` |
| Extract NSIS, carve three 7z payloads, identify CPU targets (ARM64/x64/x86) | done | `architecture/desktop-architecture.md#packaging` |
| Unpack `app.asar` + `obsidian.asar` | done | `_extract/asar-app`, `_extract/asar-obsidian` |
| Hash-verify payload identity (MD5 `6938b28c42f9d0d6a79e4d1d87a9b6e0`) | done | `observations.md#E1` |

## Phase 1 — Static analysis

| Area | Status | Document |
| --- | --- | --- |
| Main process: windows, IPC map, protocols, menus, updater, CLI server, policy, web sessions | done | `architecture/desktop-architecture.md` |
| Renderer: API export map, view/command registries, workspace model, editor stack, metadata cache | done | `architecture/frontend-architecture.md` |
| Storage: vault + userData schemas, workspace.json, IndexedDB, canvas, base | done | `architecture/storage-architecture.md` |
| CSS: 1027 tokens, typography, spacing, theme diff | done | `ui-analysis/themes.md`, `ui-analysis/layout.md` |
| Bundled libraries inventory | done | `architecture/frontend-architecture.md#17` |
| i18n string surface (51 locales) | done | `architecture/frontend-architecture.md#15` |

## Phase 2 — Runtime and behavioural experiments

| Experiment | Status | Result |
| --- | --- | --- |
| E0 discovery | done | clean host, no Obsidian install |
| E1 extraction | done | three payloads, identical asar |
| E2 first launch / registry bootstrap | done | registry schema confirmed |
| E3 vault inventory + watcher | done | index within ~300 ms |
| E4 file creation | done | no sidecar metadata |
| E5 rename rewrites links | done | heading + block subpaths included |
| E6 move normalises link text | done | shortest unique path |
| E7 frontmatter → properties + inference | done | 11 widget types |
| E8 theme toggle + token diff | done | accent derived arithmetically |
| E9 canvas + bases formats | done | both hand-written files accepted |
| E10 search operators | done | 8-query matrix |
| E11 graph view | done | graph.json 22 keys, unresolved nodes |
| E12 editor modes / DOM | done | Live Preview vs Reading view |
| E13 plugin lifecycle + Node access | done | full Node, clean unregister |
| E14 CLI over named pipe | done | 968-line help + 8 commands |
| E15 hard kill + restore | done | deferred views |
| E16 HTML sanitisation probes | done | `on*`/`javascript:` stripped, https iframe kept |
| E17 security surface | done | see `security/assessment.md` |
| E18 workspace tree | done | split/tabs/leaf + widths |
| E19 file recovery / history storage | partial | IDB schema captured; restore path not exercised |
| E20 settings window | done | separate page target, sections enumerated |
| E21 metrics/typography | done | layout table in `ui-analysis/layout.md` |
| E22 Sync / Publish | blocked | account required |
| E23 PDF export dialog | blocked | native dialog not driven; IPC path documented |
| E24 Mobile | not applicable | desktop mission |

## Phase 3 — Documentation (all written, all verified readable)

| File | Status |
| --- | --- |
| `README.md` | done |
| `executive-summary.md` | done |
| `progress.md`, `sources.md`, `unresolved-questions.md` | done |
| `architecture/overview.md`, `desktop-architecture.md`, `frontend-architecture.md`, `storage-architecture.md` | done |
| `features/markdown-editor.md`, `file-management.md`, `navigation.md`, `search.md`, `backlinks.md`, `graph-view.md`, `canvas.md`, `properties.md`, `plugins.md` | done |
| `features/bases.md`, `cli.md`, `sync-publish.md`, `attachments.md` (extras) | done |
| `ui-analysis/layout.md`, `components.md`, `interactions.md`, `themes.md` | done |
| `experiments/methodology.md`, `observations.md` | done |
| `security/assessment.md` | done |
| `diagrams/architecture.mmd`, `data-flow.mmd`, `feature-dependencies.mmd` | done |
| `implementation/feature-parity.md`, `architecture-recommendation.md`, `development-roadmap.md` | done |
| `evidence/` (10 screenshots, 15 probe JSON, CLI help, logs) | done |

## Open items carried forward

See `unresolved-questions.md` (16 questions, each with a resolution method). Highest priority: Q1 (web viewer
privileges), Q2 (update signature verification), Q7 (link-shortening tie-break).
