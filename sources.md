# Sources

All web URLs were read on **2026-11-03**. Local sources are files extracted from `Obsidian-1.15.0.exe` in this
workspace; they are cited by path in the extract tree.

## Local artefacts (primary evidence)

> The installer itself is **not** part of this repository, and the extracted trees it produced were pruned after
> analysis (they were 1.7 GB of byte-identical Electron builds). Every hash below is recorded in
> `evidence/extract-manifest.txt`, together with the exact commands that regenerate each tree. Paths are given as they
> existed during the investigation.

| Source | Path in workspace | Notes |
| --- | --- | --- |
| Obsidian installer (Windows, multi-arch NSIS) | `Obsidian-1.15.0.exe` | 339,587,200 bytes, Nullsoft; three 7z payloads; SHA-256 `b0f60c75…6555e1da0` |
| ARM64 payload | `_extract/nsis/` (7z at 0x3527A) | `Obsidian.exe` machine 0xAA64, 222,677,776 bytes — pruned |
| x86-64 payload (used for all runtime tests) | `_extract/a2/` (7z at 0x6D111E5) | `Obsidian.exe` machine 0x8664, 239,209,744 bytes — pruned |
| x86 payload | `_extract/a3/` (7z at 0xDEB0D27) | `Obsidian.exe` machine 0x14C, 205,323,024 bytes — pruned |
| Unpacked bootstrap ASAR | `_extract/asar-app/` | 73,446 bytes; `@electron/remote`, `btime`, `get-fonts` |
| Unpacked application ASAR | `_extract/asar-obsidian/` | 24,553,884 bytes; `app.js`, `main.js`, `app.css`, `lib/`, `i18n/` |
| ASAR checksum (identical in all three payloads) | — | `obsidian.asar` MD5 `6938b28c42f9d0d6a79e4d1d87a9b6e0` |
| Instrumented runtime | `_runtime/vaults/ResearchVault/` | resulting vault state; the disposable `userData` was pruned |
| Extracted-artefact manifest | `evidence/extract-manifest.txt` | SHA-256 of installer, per-arch `Obsidian.exe` and `obsidian.asar`; regeneration recipe |
| Live probe outputs | `evidence/probes/*.json` | commands, view types, CSS vars, settings tabs, properties |
| CLI reference dump | `evidence/probes/cli-help.txt` | 968 lines, produced by the shipped CLI over its named pipe |
| Screenshots | `evidence/screenshots/*.png` | 10 captures listed in `ui-analysis/layout.md` |
| Main-process log | `evidence/logs/app-stdout.log` | startup, update check, window-state load |
| Window state + app config | `evidence/logs/window-state.json`, `evidence/logs/userdata-obsidian.json` | geometry and vault registry |

## Official documentation (DOCUMENTED facts)

Plugin API and manifests

- https://docs.obsidian.md/Plugins/Getting+started/Anatomy+of+a+plugin
- https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- https://docs.obsidian.md/Plugins/Getting+started/Development+workflow
- https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin
- https://docs.obsidian.md/Reference/Manifest
- https://docs.obsidian.md/Reference/TypeScript+API/Plugin
- https://docs.obsidian.md/Reference/TypeScript+API/Plugin/onUserEnable
- https://docs.obsidian.md/Reference/TypeScript+API/App
- https://docs.obsidian.md/Reference/TypeScript+API/Vault
- https://docs.obsidian.md/Reference/TypeScript+API/MetadataCache
- https://docs.obsidian.md/Reference/TypeScript+API/Workspace
- https://docs.obsidian.md/Reference/TypeScript+API/WorkspaceLeaf
- https://docs.obsidian.md/Reference/TypeScript+API/CachedMetadata
- https://docs.obsidian.md/Reference/TypeScript+API/MarkdownRenderer
- https://docs.obsidian.md/Plugins/Events
- https://github.com/obsidianmd/obsidian-api
- https://github.com/obsidianmd/obsidian-sample-plugin
- https://docs.obsidian.md/Themes/App+themes/Build+a+theme

Vault configuration, storage and formats

- https://obsidian.md/help/data-storage
- https://obsidian.md/help/configuration-folder
- https://obsidian.md/help/community-plugins
- https://obsidian.md/help/Plugin+security
- https://obsidian.md/help/themes
- https://obsidian.md/help/snippets
- https://obsidian.md/help/hotkeys
- https://obsidian.md/help/appearance
- https://obsidian.md/help/uri
- https://obsidian.md/help/cli
- https://jsoncanvas.org/spec/1.0/
- https://obsidian.md/blog/json-canvas/

Bases

- https://obsidian.md/help/bases
- https://obsidian.md/help/bases/syntax
- https://obsidian.md/help/bases/views
- https://obsidian.md/help/bases/create-base

Release history (used to date features and to separate documented from undocumented behaviour)

- https://obsidian.md/changelog/
- https://obsidian.md/changelog/page/4/
- https://obsidian.md/changelog/page/7/
- https://obsidian.md/changelog/2024-12-18-desktop-v1.8.0/
- https://obsidian.md/changelog/2025-05-21-desktop-v1.9.0/
- https://obsidian.md/changelog/2025-08-18-desktop-v1.9.10/
- https://obsidian.md/changelog/2025-10-01-desktop-v1.10.0/
- https://obsidian.md/changelog/2025-11-11-desktop-v1.10.3/
- https://obsidian.md/changelog/2025-12-10-desktop-v1.11.0/
- https://obsidian.md/changelog/2026-01-12-desktop-v1.11.4/
- https://obsidian.md/changelog/2026-02-10-desktop-v1.12.0/
- https://obsidian.md/changelog/2026-02-18-desktop-v1.12.2/
- https://obsidian.md/changelog/2026-02-27-desktop-v1.12.4/
- https://obsidian.md/changelog/2026-07-30-desktop-v1.13.4/
- https://obsidian.md/changelog/2026-10-05-desktop-v1.14.4/
- https://obsidian.md/roadmap/

Third-party specifications referenced for the reimplementation plan

- https://github.com/electron/electron/blob/main/docs/api/fuses.md (Electron fuse wire)
- https://commonmark.org/ (CommonMark)
- https://github.github.com/gfm/ (GFM tables/task lists/strikethrough)
- https://mermaid.js.org/ (diagrams, quoted in Obsidian via the Pele bundle in 1.15)
- https://www.sqlite.org/fileformat2.html (only relevant to the alternative design, not to Obsidian)

## Not consulted / deliberately excluded

- No disassembler output (Ghidra/IDA/Rizin/objdump) was produced or read.
- `LICENSES.chromium.html` was listed but not analysed in detail (Chromium attribution file, 20 MB).
- Obsidian Sync, Publish and account/licensing servers were **not** probed beyond observing that the client refuses
  to proceed without a login. Their protocols are outside the observed surface.
