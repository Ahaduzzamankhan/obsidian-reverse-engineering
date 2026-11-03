# Feature: Sync and Publish

**Priority P3 (proprietary services, out of scope for a first clone).** Status: **blocked / partial** — both require an
Obsidian account, which this investigation did not create. This chapter therefore records only what is observable
client-side, and states clearly what is unknown.

## 1. What was observable without an account

| Observation | Evidence |
| --- | --- |
| `sync` core plugin is **enabled by default** on a fresh vault; `publish` is **disabled** | `.obsidian/core-plugins.json` |
| Account section in Settings → General: "Log in" / "Sign up", "You're not logged in right now. An account is only needed for Obsidian Sync, Obsidian Publish, and early access versions." | `evidence/screenshots/09-settings.png` |
| Commercial licence section: "Activate" / "Purchase" | same |
| Sync commands exist without an account: `sync:setup`, `sync:view-version-history`, `sync:open-sync-view`, `sync:open-sync-log` | `evidence/probes/commands.json` |
| CLI sync commands exist: `sync`, `sync:status`, `sync:history`, `sync:read`, `sync:restore`, `sync:deleted`, `diff` | `evidence/probes/cli-help.txt` |
| A status-bar item for Sync exists and reads as unconfigured ("Uninitialized" was observed as a status text before the sync plugin initialised) | live status bar probe |
| Key derivation code ships (`lib/scrypt.js`) | lib inventory |
| Sync state persists in `Local Storage` / `IndexedDB` under the app origin, not in the vault | userData inspection |
| 1.9.10 added a Sync **conflict resolution** setting ("Merge" vs "create conflict file") | documented changelog |
| 1.13 added a warning when **plugins are about to be synced**, and battery-friendly status icons | documented changelog |

## 2. What is UNKNOWN (not tested, not guessed)

* Transport protocol, endpoints, authentication tokens, encryption scheme, chunking, blob storage.
* Server-side conflict resolution semantics; how version history is stored and for how long.
* Whether E2E encryption keys are derived from the account password + vault salt (the presence of `scrypt.js` is a hint,
  not a finding).
* Publish: site building, slug generation, redirects, custom domains, access control (password/subscription), CDN.
* Pricing, quota, per-vault vs per-account limits.

> Anything that would have required logging in with an account, or probing Obsidian's servers, was deliberately not
> done. The chapter stays at the client-observable boundary.

## 3. Client-side design worth copying (INFERRED from UX + names)

* **Version history is a first-class view per file** (`sync:view-version-history`, CLI `sync:history` /
  `sync:read` / `sync:restore`), and the same UI is shared with **File recovery** (local snapshots). A clone should
  implement *local* history first — Obsidian itself does (IndexedDB snapshots) — and treat remote history as the same
  interface with a different provider.
* **Conflict handling is a user-visible setting**, not a silent merge: "Merge" vs "keep both as conflict file". This is
  the right default for a text knowledge base.
* **Diffing** is exposed to scripting (`diff` CLI) which implies a line-level diff engine shared with the UI.
* **Sync must not run through the renderer** for large blobs; a background service with the vault as the source of
  truth fits the observed architecture.

## 4. Reimplementation guidance (if you build sync)

| Requirement | Suggested approach |
| --- | --- |
| Storage | content-addressed blobs (BLAKE3/SHA-256) + a per-vault manifest of `path → {blob, mtime, deleted}` |
| Transport | resumable delta upload/download over HTTPS, per-device cursors |
| Conflicts | three-way merge on text (base = last common version); on failure write `Note (conflict YYYY-MM-DD).md` |
| Encryption | XChaCha20-Poly1305, key derived with Argon2id/scrypt from the user's passphrase; server stores ciphertext only |
| History | keep immutable blob versions per path with a retention policy; expose `history`, `read`, `restore` |
| Publish | static build of selected notes → HTML with the same CSS variables, hashed asset names, per-note access flags |
| Trust | device list with revoke, audit log, and "pause sync" (Obsidian exposes exactly this) |

## 5. Priority

| Item | Priority |
| --- | --- |
| Local file history (snapshots + restore + diff) | P1 — implement this instead of remote sync first |
| Optional third-party sync via the filesystem (Dropbox/git/iCloud) | P1 — "just works" because the vault is plain files |
| Conflict detection + conflict-file creation for external edits | P1 |
| Full remote sync protocol | P3 |
| Static publishing/export | P3 (a good "export site" feature is cheaper than a hosted service) |

## 6. Explicit limitation statement

> Sync and Publish could not be exercised: both require an Obsidian account and their servers were not contacted. All
> statements above about these features are either client-side observations (commands, settings, files) or clearly marked
> inferences. No claim is made about their protocols or security properties.
