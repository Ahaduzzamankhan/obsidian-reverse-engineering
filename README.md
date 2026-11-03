# Obsidian Desktop — Reverse-Engineering Report

**A careful, evidence-first study of how Obsidian 1.15.0 works — and a blueprint for building your own
Markdown knowledge base.**

Obsidian desktop · v1.15.0 (Windows x64) · Electron 43.8.4 · Chromium/Monaco-free custom editor · studied
2026-11-03 · no disassembler used.

---

## 👋 Start here

If you have five minutes, read this page and then **[the executive summary](executive-summary.md)**. If you came
with a specific goal, jump straight to a reading path:

| You want to… | Read this |
| --- | --- |
| 🏗️ **Build your own Obsidian alternative** | [Roadmap](implementation/development-roadmap.md) → [recommended architecture](implementation/architecture-recommendation.md) → [parity matrix](implementation/feature-parity.md) |
| 🧠 **Understand how it works inside** | [Architecture overview](architecture/overview.md) → desktop / frontend / storage chapters |
| 🔒 **Audit it, or learn from its security model** | [Security assessment](security/assessment.md) |
| 🎨 **Clone its look and feel** | [Layout](ui-analysis/layout.md) → [components](ui-analysis/components.md) → [themes](ui-analysis/themes.md) |
| 🔁 **Repeat or verify a finding** | [Methodology](experiments/methodology.md) → [observations](experiments/observations.md) → `evidence/` |
| ❓ **See what is still unknown** | [16 unresolved questions](unresolved-questions.md) |

New to the vocabulary? The [glossary](glossary.md) explains *vault, leaf, base, canvas, ASAR, CDP* and the rest in
plain language.

---

## Why this exists

Obsidian is closed source, but it ships as a **JavaScript application**, which means its behaviour is knowable
without touching a disassembler. This report reconstructs the product from what the app actually does: the packaged
code it runs, the files it writes, the UI it renders, and the protocols it speaks.

The goal is not to copy Obsidian. It is to answer, with receipts, the questions an independent reimplementation has
to answer anyway: *Where does state live? What is a file, really? How do links survive a rename? What does a plugin
get access to? Which parts are worth building first?*

**Rules honoured throughout:** no Ghidra/IDA/Binary Ninja/objdump, no decompilation, no DRM or licence bypass, no
untrusted plugin execution. Every claim below is traceable to a file in this repository.

---

## The ten findings that matter

1. **Everything ships in one bundle.** A 212 KB Electron main process, a 3.3 MB renderer bundle (`app.js`), and a
   598 KB stylesheet. No compile step, no hidden services.
2. **The renderer has no sandbox.** `nodeIntegration: true`, `contextIsolation: false`, `webviewTag: true`. A plugin
   can `require('fs')` and `require('child_process')` — Obsidian's security model is *trust*, not isolation.
3. **A vault is just a folder.** Configuration is `.obsidian/`; there is no database, no index file, no lock-in.
4. **Links are computed, not stored.** A rename rewrites every inbound link — including `#Heading` and `#^block-id`
   subpaths — and a move re-shortens links to the shortest unambiguous path.
5. **Properties have types but no schema.** The type is inferred from the value you type; 11 value types map to 9
   type names. Nothing in the vault records the schema.
6. **Session restore is state-complete but lazy.** `workspace.json` reproduces every pane, tab and scroll position,
   while file contents are read only when a leaf becomes active.
7. **Search is an in-memory index, built lazily.** First search after launch is slower; the index is rebuilt from the
   filesystem, so it can never go stale on disk.
8. **Two undocumented 1.15 features exist in the binary:** a managed **policy file** (`policy.json`, enterprise
   lockdown with `off|manual|default|forced`) and a **local CLI server** on a named pipe with 100+ commands.
9. **The UI is a CSS variable system.** 1,027 custom properties, 51 languages, Lucide icons — themeability is an
   architectural decision, not a feature.
10. **The attack surface is the plugin store, not the file format.** HTML in notes is sanitised; third-party plugin
    code is not contained at all.

---

## What is in this repository

| Section | What you get |
| --- | --- |
| 📄 **[executive-summary.md](executive-summary.md)** | The findings a decision-maker needs, with verified/hypothesis separated |
| 🏛️ **[architecture/](architecture/overview.md)** | Desktop (Electron, IPC, protocols), frontend (registries, editor, cache), storage (vault, userData, formats) |
| ⚙️ **[features/](features/markdown-editor.md)** | 13 deep-dives: editor, files, navigation, search, backlinks, graph, canvas, properties, plugins, bases, CLI, sync, attachments |
| 🎨 **[ui-analysis/](ui-analysis/layout.md)** | Layout measurements, component inventory, interaction/keyboard behaviour, theme tokens |
| 🧪 **[experiments/](experiments/methodology.md)** | How each experiment was run, and the raw observation log |
| 🔒 **[security/](security/assessment.md)** | Sandboxing, protocol handlers, sanitisation, plugin boundaries, ranked risk |
| 🗺️ **[diagrams/](diagrams/architecture.mmd)** | Three Mermaid sources: architecture, data flow, feature dependencies |
| 🚀 **[implementation/](implementation/feature-parity.md)** | Feature-parity matrix (P0–P3), recommended architecture, phased roadmap |
| 📌 **[unresolved-questions.md](unresolved-questions.md)** | 16 open questions, each with a concrete way to answer it |
| 📊 **[progress.md](progress.md)** | Checklist of every investigation: done / partial / blocked |
| 📚 **[sources.md](sources.md)** | Every URL and file consulted, with access dates |
| 🖼️ **[evidence/](evidence/README.md)** | Screenshots, live probe output, logs, and every script used |

### Repository layout

```text
reverse-engineering/
├── README.md                 ← you are here
├── glossary.md               plain-language definitions
├── executive-summary.md
├── progress.md · sources.md · unresolved-questions.md
├── architecture/             overview · desktop · frontend · storage
├── features/                 13 feature chapters
├── ui-analysis/              layout · components · interactions · themes
├── experiments/              methodology · observations
├── security/                 assessment
├── diagrams/                 3 × .mmd (Mermaid)
├── implementation/           feature-parity · architecture-recommendation · roadmap
├── evidence/
│   ├── screenshots/          10 annotated captures
│   ├── probes/               14 live JSON dumps + the 968-line CLI reference
│   ├── logs/                 app log, window state, vault registry
│   ├── scripts/              23 reproducible CDP/probe/experiment scripts
│   └── extract-manifest.txt  SHA-256 of everything analysed + regeneration recipe
├── _extract/                 analysed app JS/CSS (local only — not redistributed)
└── _runtime/vaults/          the disposable vault whose state proves the behavioural findings
```

---

## How the evidence was gathered

```text
installer (.exe, NSIS)
   └─ three 7z payloads (ARM64 · x64 · x86)  ← identical obsidian.asar inside each
        └─ app.asar  → bootstrap (main.js: remote, btime, get-fonts)
        └─ obsidian.asar → main.js (212 KB) + app.js (3.3 MB) + app.css (598 KB)
             └─ launched with an isolated userData + a hand-written vault registry
                  └─ driven live over the Chrome DevTools Protocol
                       └─ behaviours confirmed by filesystem experiments in a throwaway vault
```

Five independent kinds of evidence back the conclusions: **packaged source**, **live runtime probes**, **resulting
filesystem state**, **screenshots**, and **official documentation**. Where they disagree, the document says so.

---

## How to read the confidence labels

| Label | Meaning |
| --- | --- |
| **VERIFIED** | Observed directly at runtime, read in the shipped code, or captured in a screenshot |
| **DOCUMENTED** | Stated by an official Obsidian page (see [sources.md](sources.md)) |
| **INFERRED** | A conclusion drawn from several verified facts — stated as inference, not fact |
| **UNKNOWN** | Not observable from outside (server-side Sync/Publish, commercial licensing) |

Every feature chapter ends with implementation guidance and a **P0–P3 priority**, which is what the
[roadmap](implementation/development-roadmap.md) is built from.

---

## Reproduce it yourself

Nothing here needs special access — just the public installer and standard tooling.

```bash
# 1. unpack the architecture payloads (offsets in evidence/extract-manifest.txt)
npm i -D 7zip-bin @electron/asar

# 2. unpack the app bundle
npx @electron/asar extract <payload>/resources/obsidian.asar asar-obsidian

# 3. run it in isolation, with a debugger port
./Obsidian.exe --user-data-dir=./_runtime/userdata --remote-debugging-port=9222

# 4. drive it with the included client
node evidence/scripts/cdp.js list
node evidence/scripts/cdp.js run evidence/scripts/e12-search-graph.js
```

The full sequence, including how the vault registry was bootstrapped without a GUI, is in
[experiments/methodology.md](experiments/methodology.md).

---

## Legal and ethical scope

* Obsidian is proprietary software (its `package.json` is `UNLICENSED`). **No application code is redistributed
  here.** Extracted JavaScript stays in the local analysis workspace and is excluded from this repository; the report
  contains descriptions, measurements and short factual excerpts only.
* Observations are of the *installed application on this machine* — no server was probed, no account was used, no
  protection was circumvented.
* If you build on this: write your own implementation. File formats and observable behaviour are fair game; copying
  code, assets, icons or bundled libraries is not.
* "Obsidian" is a trademark of Dynalist Inc. This is an independent study, not affiliated with or endorsed by them.

---

## Status

Investigation **complete** for everything reachable without credentials or a second platform. Known gaps —
Sync/Publish internals, PDF export dialog, mobile, web-viewer privileges — are documented as limitations rather than
guessed, and each has a resolution path in [unresolved-questions.md](unresolved-questions.md).

*Report generated 2026-11-03. Corrections and additional experiments are welcome — every claim cites its evidence, so
every challenge can be checked the same way.*
