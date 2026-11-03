# Feature: File management

**Priority P0.** Evidence: `experiments/observations.md#E2..#E6`; file-explorer DOM; `workspace.json`;
`architecture/storage-architecture.md`.

## 1. User-facing behaviour

* **Vault creation**: chooser window ("Create new vault" / "Open folder as vault"), or `obsidian://choose-vault`.
  Registered in `<userData>/obsidian.json`; a fresh vault gets `Welcome.md`, `.obsidian/{app,appearance,core-plugins,
  workspace}.json`.
* **File explorer** (core plugin, ribbon icon): collapsible folder tree, alphabetical sort (also by modified time),
  drag-and-drop move, context menu (new note/folder, rename, delete, duplicate, copy path/URL, merge, export),
  inline "new note / new folder / change sort / collapse all / auto-reveal" buttons in its header.
* **Create**: `Mod+N` new note (in the folder of the active file, per settings), `Mod+Shift+N` in a new pane, plus
  "New canvas"/"New base" and template-driven creation.
* **Rename**: `F2` or context menu; the title is also editable in place (inline title).
* **Delete**: removed to the OS trash by default (`trash` IPC → `shell.trashItem`-style); "Delete permanently" exists;
  1.12+ offers an "unused attachments" cleanup prompt.
* **Move**: drag and drop; folders and files; multiple selection.
* **Link maintenance on rename/move** (the defining behaviour — **VERIFIED**):
  * Renaming `Projects/Alpha.md` → `Projects/Alpha Renamed.md` rewrote **every** inbound link in the vault,
    including `[[Alpha#Section One]]` → `[[Alpha Renamed#Section One]]` and
    `[[Alpha#^block-abc123]]` → `[[Alpha Renamed#^block-abc123]]`.
  * Moving `Projects/Beta.md` → `Archive/Beta.md` rewrote `[[Projects/Beta|the beta project]]` to
    `[[Beta|the beta project]]`, i.e. it re-renders each link as the **shortest path that still resolves uniquely**.
  * Controlled by `app.json` `"alwaysUpdateLinks": true`.
* **File recovery** (core plugin, enabled by default): periodic local snapshots, "File recovery: Open local history",
  per-file version list, restore/diff. Backed by IndexedDB (see below) and exposed through CLI `history*`.
* **Multiple vaults**: switcher lists registered vaults with "Copy vault ID", remove, rename/move; each open vault owns
  its own window and its own `appId`.

## 2. File explorer details (DOM/behaviour)

```
.nav-header   → header buttons: New note, New folder, Sort, Auto-reveal, Collapse all
.nav-files-container
  .nav-file / .nav-folder
    .nav-file-title / .nav-folder-title   (draggable, context menu, inline rename)
    .nav-file-tag                          (e.g. "BASE", "CANVAS" badges)
  .nav-folder-children                   (recursive)
```

Observed behaviour: new files appear without a re-scan (watcher); an externally created file appeared in the tree and in
`metadataCache` within ~300 ms; folder badges for non-markdown types; drag targets highlight ("Move into "folder"",
"Insert link here", "Insert links here", "Star this file" tooltips exist in the i18n bundle).

## 3. Technical requirements

* **Vault adapter** abstraction (`DataAdapter`): `read`, `readBinary`, `write`, `writeBinary`, `append`, `process`
  (read-modify-write in one operation), `mkdir`, `rmdir`, `remove`, `rename`, `copy`, `stat`, `list`, `exists`,
  `getResourcePath`, `getFilePath`, `watch`/events. Two implementations ship: `FileSystemAdapter` (Node `original-fs`)
  and `CapacitorAdapter` (mobile).
* **Event bus**: `create`, `modify`, `delete`, `rename` on `Vault`; `changed`/`resolved`/`deleted` on `MetadataCache`.
  `rename` must fire with `(file, oldPath)` so listeners can rewrite links.
* **Link rewriting engine**: for each affected file, parse links, compute the new target text with the configured link
  format (`shortest path when possible` / `relative` / `absolute`), apply minimal text edits, write atomically.
* **External change detection**: filesystem watcher plus mtime/size comparison; conflict policy when a file changed on
  disk while dirty in the editor.
* **Trash**: OS trash integration on desktop (history/undo impossible after trash), permanent delete on mobile.
* **Unused-attachment detection** (1.12+): compare `resolvedLinks` + `embeds` against all non-markdown files.

## 4. Data structures

```ts
class TAbstractFile { path: string; name: string; parent: TFolder|null; vault: Vault; }
class TFile extends TAbstractFile { stat: {ctime,mtime,size}; extension: string; basename: string; }
class TFolder extends TAbstractFile { children: TAbstractFile[]; isRoot(): boolean; }

interface VaultConfig {  // app.json subset that affects file behaviour
  alwaysUpdateLinks: boolean; newFileLocation: "root"|"current"|"folder";
  newFileFolderPath?: string; attachmentFolderPath: string;
  newLinkFormat: "shortest"|"relative"|"absolute"; useMarkdownLinks: boolean;
  trashOption: "system"|"local"|"none"; userIgnoreFilters?: string[];
}
```

Observed `app.json` after link rewrites: `{"alwaysUpdateLinks": true}` — the key is written when the first rewrite
happens, which is a useful signal for a clone's migration logic.

## 5. Edge cases (verified or to test)

* Rename to an existing name; rename with only case changes (Windows case-insensitive filesystem); rename a folder that
  contains linked files (links must keep resolving to the same files).
* Links that were already broken must not be "fixed" by a rename.
* Duplicate basenames (`A/Note.md`, `B/Note.md`): after a move the short form must only be used if it stays unique.
* Renaming while the file is open in multiple tabs/windows (all leaves must retarget, not close).
* Move across drives (rename fails → copy+delete path).
* Name sanitisation/invalid characters on Windows (`con`, `prn`, `aux`, `nul`, `com1`… — Obsidian's main process
  validates these names, `tn` regex in the policy/validator module).
* Deleted folder containing the active file; undo-close-tab for a file that no longer exists.
* Unicode normalisation (NFC/NFD) between macOS and Windows vaults.
* Very large vault (100k files): explorer must stay virtualised.

## 6. Testing strategy

* Filesystem integration tests on a temp vault: create/rename/move/delete and assert **both** the file tree and every
  inbound link text.
* Property test: generate a random link graph, apply random renames, then assert `resolvedLinks` is isomorphic to the
  graph before the rename (a rename must never change the set of resolved edges).
* Watcher tests: external write, external delete, external rename, rapid successive writes.
* Crash-safety: kill the process mid-write; the note must be either the old or the new content, never truncated.

## 7. Implementation sketch

* `VaultService` owns a `Map<path, TFile>` + a watcher; every mutation goes through a **write queue keyed by path** so
  concurrent operations serialise.
* Atomic write = write `.<name>.tmp` in the same folder, `fsync`, `rename` over the target; keep the mtime you wrote to
  distinguish your own writes from external ones.
* Link rewriting = parse → collect links whose `linkpath` resolves to the moved file → replace only the linkpath part →
  write; do it before or after the filesystem rename inside one transaction-like operation, and roll back on failure.
* Represent the "shortest path" decision as a pure function `formatLink(target, sourcePath, allPaths, config)`; unit-test
  it exhaustively — it is the single most user-visible behaviour of this feature.

## 8. Complexity and priority

| Item | Complexity | Priority |
| --- | --- | --- |
| Vault CRUD + explorer tree + watcher | M | **P0** |
| Atomic writes, write queue, conflict policy | M | **P0** |
| Link rewriting on rename/move (incl. subpaths) | L | **P0** |
| Trash/permanent delete, unused-attachment cleanup | S | P1 |
| File recovery (snapshots + diff UI) | M | P1 |
| Drag & drop with link/embed insertion semantics | M | P1 |
| Multiple vaults / vault switcher / move vault | S | P1 |
| Explorer virtualisation for 100k files | M | P2 |
