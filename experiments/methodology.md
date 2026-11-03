# Experiments: methodology

## 1. Environment (as found)

| Item | Value |
| --- | --- |
| Host | Windows 11 (build 26300), x64, 1024×800 test window at DPR 1 |
| Shell | Git Bash (MSYS2) on Windows; commands run from `C:\Users\Fluxenite\Downloads\reverse` |
| Node / npm | v24.19.0 / 11.17.0 |
| Python | 3.14.4 |
| Tooling present | `git`, `curl`, `tar`; **no** 7-Zip, no `asar` CLI, no Ghidra/IDA/Rizin/objdump |
| Obsidian installed? | **No** — no `%APPDATA%\obsidian`, no `C:\Program Files\Obsidian`; only the installer in the workspace |
| Existing project files | `.freebuff/` only (project marker); nothing to preserve or overwrite |

Tooling installed **inside the report directory** (never system-wide): `7zip-bin` (7za binary used to unpack NSIS) and
`@electron/asar` (ASAR extractor), both as local npm dev dependencies. They were removed after the investigation as
part of the artefact cleanup; reinstall with `npm i -D 7zip-bin @electron/asar` to repeat any extraction step.

## 2. Constraints honoured

* **No disassembly.** No Ghidra, IDA, Binary Ninja, Rizin, objdump, or raw machine-code reading. The only binary
  inspection performed was parsing **PE headers** (machine type, section table) to decide which payload architecture to
  run, and the Electron **fuse** question was answered from source, not by patching.
* **No protection bypass.** No licence, authentication or DRM was circumvented. Sync/Publish were not probed because
  they require an account.
* **No redistribution.** Application files are extracted for analysis inside `_extract/`; no app code is reproduced
  verbatim in the report beyond short factual excerpts.
* **No untrusted code execution.** The only plugin executed was written for this study; no third-party plugin or
  malicious payload was loaded.

## 3. Extraction pipeline

1. `7za x Obsidian-1.15.0.exe` → NSIS content (produced an **ARM64** app tree, and "data after end of archive" warning).
2. Signature scan for `37 7A BC AF 27 1C` → three 7z members at `0x3527A`, `0x6D111E5`, `0xDEB0D27`.
3. Carve each member to a file, `7za x` each → ARM64, x86-64, x86 trees; PE `Machine` field checked per tree.
4. MD5-compare `resources/obsidian.asar` across trees → identical; **only the Electron runtime differs**.
5. `asar extract resources/app.asar` and `…/obsidian.asar` → readable source tree.

Helper scripts written for this are preserved in `evidence/scripts/`: `ctx.py` (literal-substring window dump for
minified files), `win.py` (regex variant), `slice.py` (byte range/pretty split), `ipc_extract.py` (IPC channel +
protocol inventory), `cdp.js` (dependency-free CDP client: `list`, `eval`, `run <file>`, `shot`, `html`),
`cli_client.js` (Obsidian CLI socket client), `probe.sh` (batch of live probes).

## 4. Isolated runtime

* Launched the extracted x64 `Obsidian.exe` (payload tree `a2`, see `evidence/extract-manifest.txt`) with
  `--user-data-dir=<report>/_runtime/userdata --remote-debugging-port=9222`. The `userData` tree was disposable
  Chromium state and was deleted after the run; `evidence/logs/` keeps the parts that were analysed.
* **No vault registry existed**, so one was written by hand to the format derived from source:

```json
{"vaults":{"a1b2c3d4e5f60718":{"path":"…\\_runtime\\vaults\\ResearchVault","ts":1793683819733,"open":true}}}
```

  The app accepted it and opened the vault directly (no chooser), which itself confirms the registry schema.
* The vault was populated two ways: **externally** (shell writes → tests the file watcher) and **internally**
  (`app.vault.create/process/renameFile` → the same code path the UI uses).
* CDP target selection: the settings window is a separate page target (`about:blank`), so the client prefers the target
  whose URL starts with `app://obsidian.md`.

## 5. Experiment discipline

* Every experiment is a JS file under `evidence/scripts/` (`e1-e5.js` … `e20-tokens.js`) executed through
  `cdp.js run`, so it is **reproducible** and independent of shell quoting.
* Each step is wrapped so one failure does not abort the rest; raw results are pasted into `observations.md` with the
  parts that matter marked.
* Screenshots are captured with `Page.captureScreenshot` from the same session, saved under `evidence/screenshots/`.
* Reading-view DOM had to be read **after activating the leaf**: a background leaf keeps an empty
  `.markdown-preview-sizer` (virtualisation), which initially produced a false "sanitizer strips everything" result.
  That false negative is recorded in the observations because it is itself a behaviour a test harness must know.

## 6. What could not be tested, and why

| Area | Reason | Consequence |
| --- | --- | --- |
| Sync / Publish | requires an Obsidian account | client-side surface only (`features/sync-publish.md`) |
| PDF export | command opens a native save dialog | IPC path (`print-to-pdf`) verified in source only |
| Mobile | no mobile runtime | mobile-specific branches documented as unverified |
| Windows/macOS/Linux differences | only Windows exercised | macOS title bar, Linux installer/socket paths read from source |
| Commercial licence / account flows | credentials required | not attempted |
| Third-party plugins | would execute untrusted code | only a purpose-written test plugin |

## 7. Artefact retention (what was kept, what was deleted)

Bulk intermediates were pruned after analysis so the report stays portable (1.9 GB → 26 MB); nothing that a finding
depends on was deleted without a recorded substitute.

| Removed | Size | Why it is safe |
| --- | --- | --- |
| `_extract/{carve,a2,a3,nsis}` | 1.73 GB | Raw installer slices plus three extracted Electron trees; byte-identical duplicates of one app bundle. Hashes and the exact extraction recipe are in `evidence/extract-manifest.txt` |
| `_runtime/userdata` | 29 MB | Disposable Chromium profile (Cache, Code Cache, GPUCache, Partitions). Analysed parts saved in `evidence/logs/` |
| `_runtime/probes`, `_runtime/exp` | 184 KB | Exact duplicates (`cmp`-verified) of `evidence/probes/` and `evidence/scripts/`; the `.err` files were all 0 bytes |
| `_tools/node_modules` | 19 MB | Third-party npm dev dependencies, not authored here |

Kept deliberately: `_extract/asar-{app,obsidian}/` (the analysed JavaScript/CSS, 25 MB — local only, **not**
redistributed), `_runtime/vaults/ResearchVault/` (the resulting vault state that proves the behavioural findings), and
all of `evidence/`.

## 8. Fairness and cleanliness

* All runtime state lived in `_runtime/` (isolated `userData`), so the host machine's real Obsidian profile (none
  existed) was never touched.
* Processes were started and stopped by recorded PID (`taskkill /PID <parent> /T /F`); no pattern-based killing.
* The host's network was only used for Obsidian's own update check (which the app performs at startup) and for the
  documentation research; no Obsidian service was contacted by the investigation itself.
