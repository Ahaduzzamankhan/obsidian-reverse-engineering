# Evidence

Everything in this folder is raw material for the report — no interpretation, just what the app produced.

| Folder | Contents | How it was captured |
| --- | --- | --- |
| [`screenshots/`](screenshots/) | 10 PNG captures: main layout, canvas, bases, search, graph, command palette, settings, reading view, and two post-restart sessions | `Page.captureScreenshot` over CDP on a live instance |
| [`probes/`](probes/) | 14 JSON dumps (commands, view types, CSS variables, settings tabs, properties, hotkeys, ribbon, status bar, workspace tree, vault info, extras) plus `cli-help.txt` | `evidence/scripts/probe.sh` → CDP `Runtime.evaluate`, and the shipped CLI over its named pipe |
| [`logs/`](logs/) | Main-process stdout, the app's own `obsidian.log`, a window-state file, and the vault registry | Written by the app itself into an isolated `userData` directory |
| [`scripts/`](scripts/) | 23 reproducible helpers and experiment scripts (`e1-e5.js` … `e20-tokens.js`) | Authored during the investigation |
| [`extract-manifest.txt`](extract-manifest.txt) | SHA-256 of the installer, all three `Obsidian.exe` builds, `obsidian.asar` and the unpacked sources, plus the exact extraction recipe | Generated before bulky intermediates were pruned |

## Running the scripts

The CDP client has no dependencies; experiment scripts expect a live instance:

```bash
./Obsidian.exe --user-data-dir=./_runtime/userdata --remote-debugging-port=9222 &
node evidence/scripts/cdp.js list          # find the app://obsidian.md target
node evidence/scripts/cdp.js run evidence/scripts/e12-search-graph.js
```

Python helpers (`win.py`, `ctx.py`, `slice.py`, `ipc_extract.py`) operate on the extracted files and need only the
standard library.

## What is not here

* Portable-executable payload trees — 1.7 GB of duplicate Electron builds, regenerable from the recipe in
  `extract-manifest.txt`.
* Extracted application JavaScript and CSS — proprietary; present in the local analysis workspace only.
* The disposable Chromium `userData` profile — 29 MB of cache; the parts that were analysed are in `logs/`.
