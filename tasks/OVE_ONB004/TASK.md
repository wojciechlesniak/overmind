---
id: OVE_ONB004
title: "Implement folder suggestions and validation of the Owner-picked folder"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ONB001, OVE_PERM002, OVE_PERM031, OVE_SEC002]
soft_depends_on: []
provides: ["usecase:SuggestFolders", "usecase:ValidateFolderCandidate", "port:DirectoryLister", "lib:folder-policy", "lib:folder-id-registry"]
needs: ["lib:path-guard", "contract:CanonicalPath", "port:AllowedDirectoryReader", "lib:allowed-directory-normalizer", "port:Clock"]
owns: ["packages/domain/src/onboarding/folder-policy.ts", "packages/application/src/onboarding/folders/suggest-folders.ts", "packages/application/src/onboarding/folders/validate-folder-candidate.ts", "packages/application/src/onboarding/folders/folder-id-registry.ts", "packages/application/src/ports/DirectoryLister.ts", "packages/adapters/fs/src/onboarding/**", "packages/testing/src/fakes/FakeDirectoryLister.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [3, 4, 10]
---

# OVE_ONB004: Implement folder suggestions and validation of the Owner-picked folder

## 1. Summary

Provides `SuggestFolders` (the tree shown in the folder step: `~/Projects` and its direct child directories) and `ValidateFolderCandidate` (canonicalise and vet a path coming from the native Finder picker), both returning opaque ids and display paths only, with a strict denylist of sensitive and system locations.

## 2. Context

The mock's folder picker shows a parent `~/Projects` (expanded) with children `aplikacja-rezerwacji` (selected), `fundacja-www`, `shared-ui`, plus a dashed 'Wybierz w Finderze…' button. The list is the engine's suggestion; the Finder path is untrusted text (SHELL003). Anything that becomes an Allowed Directory later passes SEC002 path-guard; here we must refuse obviously dangerous choices early so the Owner gets a clear reason instead of a failure later. Agents see only folders from the list (SPEC 11), so a mistake here widens what a malicious Agent could read or write.

## 3. Scope (in)

- Port `DirectoryLister` and adapter `FsDirectoryLister` (reads names only: no file contents, no stat of children beyond 'is directory').
- `SuggestFolders` use case: the root is `~/Projects` when it exists, else `~/Developer`, `~/Code` or `~/src` in this order (first existing wins).
- `ValidateFolderCandidate` use case for picker results.
- `FolderPolicy` pure rules (denylist, depth, home containment) in domain.
- Opaque id scheme `fld_<hash>` and an in-memory short-lived registry mapping id to canonical path (TTL 30 min) used by ONB005.

## 4. Out of scope

- Registering the Allowed Directory (ONB005).
- The picker UI (ONB012/013).
- Searching the disk or recursive scans.

## 5. Detailed requirements

1. **Roots.** Candidate roots in order: `~/Projects`, `~/Developer`, `~/Code`, `~/src`; the first that exists and is a directory is the single parent (depth 0); its direct children (depth 1) are listed alphabetically case-insensitively, max 50, directories only; hidden entries (leading dot) excluded; symlinked entries excluded from suggestions (not selectable: reason `symlink` when shown through validation); empty or missing root yields `nodes: []` and `root.displayPath` for the empty state text.
2. **Policy (`FolderPolicy.evaluate(canonical, home)`).** Reject with reason: `outside_home` (not under the Owner's home); `system_path` (`/`, `/System`, `/Library`, `/Applications`, `/usr`, `/bin`, `/sbin`, `/etc`, `/var`, `/private`, `/Volumes` root, `/Users` root itself); `sensitive` (home itself `~`, and any path equal to or inside `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.config`, `~/.kube`, `~/Library`, `~/.Trash`, Overmind's own data directory `~/Library/Application Support/Overmind` and the CLI credential locations such as `~/.claude`, `~/.codex`); `not_a_directory`; `unreadable`; `symlink` (the final component or any ancestor below home resolves outside home). The check applies to the canonical (realpath) path through SEC002 `path-guard`, never to the raw text.
3. **Containment of ancestors.** A folder that CONTAINS a sensitive directory is refused too (for example `~` and `~/Library` itself; `~/Projects` is fine). Folders deeper than 12 levels are refused (`too_deep`) to avoid pathological trees.
4. **ValidateFolderCandidate.** Input `{ pathText }`; steps: reject control characters and length > 1024; expand a leading `~` through the Owner's home (engine-side); `realpath` via `path-guard` (resolves symlinks); evaluate policy; check `already_added` against the Allowed Directories of existing Workspaces (`AllowedDirectoryReader`); return `{ candidate }` with an id and display path. Errors map to `onboarding.folder_rejected` with `details.reason`.
5. **Display path.** `displayPath` replaces the home prefix by `~`; the canonical path is never returned. Long paths are returned in full; the UI truncates (middle ellipsis) in the feature.
6. **Id registry.** `FolderIdRegistry.put(canonical) -> id`, `resolve(id) -> canonical | undefined`; ids expire after 30 minutes; the registry holds at most 100 entries (LRU); restart clears it (the UI re-requests).
7. **Listing limits.** `FsDirectoryLister.list(path, { max: 50 })` uses `opendir` with a cap and a 1 s timeout; permission errors yield `unreadable` entries instead of throwing.
8. **macOS privacy.** Access to `~/Documents`, `~/Desktop`, `~/Downloads` can trigger system consent prompts; suggestions never list them; Finder-picked ones are validated with `stat` only (a denied access gives `unreadable`).
9. **No side effects.** Listing and validation never create, modify or touch files.

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `path-guard` and `CanonicalPath` (SEC002), `AllowedDirectoryReader` (PERM031), `AllowedDirectory` normaliser rules (PERM002: ONB005 uses them to register), Clock/Id ports.

## 8. Architecture and code placement

`packages/domain/src/onboarding/folder-policy.ts`, `packages/application/src/onboarding/folders/{suggest-folders.ts,validate-folder-candidate.ts,folder-id-registry.ts}`, port `packages/application/src/ports/DirectoryLister.ts`, adapter `packages/adapters/fs/src/onboarding/fs-directory-lister.ts`, fake `packages/testing/src/fakes/FakeDirectoryLister.ts`.

## 9. Security and safety

- Path traversal and symlink tricks: only realpath results are evaluated; `..` and symlink escapes resolve before the policy.
- TOCTOU: the id registry stores the canonical path and ONB005 re-validates at provisioning time (the final authority is PERM002 + SEC002).
- The denylist protects CLI credentials, SSH keys and the engine's own data (an Agent with write access to the data dir could tamper with permissions).
- Listing returns names only; no content leaks; hidden directories are not enumerated.
- Names are plain text; a hostile directory name with control characters is escaped/rejected (control chars removed from display and the entry marked `unreadable`).

## 10. Errors and edge cases

- Home contains a symlinked `Projects` pointing elsewhere: root skipped (symlink), next root tried.
- No root exists: empty list with the root hint 'Utwórz ~/Projects albo wybierz w Finderze'.
- Directory named with emoji or very long name: allowed; display truncated by UI.
- External volume under `/Volumes`: refused `outside_home` (home-contained rule); documented.
- Case-insensitive filesystem duplicates: normalised with `already_added` check using canonical comparison.
- Path to a file: `not_a_directory`.

## 11. Acceptance criteria

- [ ] Given `~/Projects` with three child directories then the list contains them with the parent first.
- [ ] Given `~/.ssh` or `~` then validation fails with `sensitive`.
- [ ] Given a symlink inside `~/Projects` pointing to `/etc` then it is `symlink`/`outside_home`.
- [ ] Given a path already added in another Workspace then `already_added`.
- [ ] Given a valid folder then an opaque id and `~` display path are returned and the canonical path is absent from the response.

## 12. Test plan

- Vitest with `FakeDirectoryLister` and a fake path probe: policy table (each denylist entry, ancestors, depth), id expiry, limits.
- Integration test on a real temp directory tree with symlinks (skipped on non-POSIX).
- Security cases are added to the PERM abuse suite names (listed).
- Commands: `pnpm vitest run packages/domain/src/onboarding packages/application/src/onboarding/folders`.

## 13. Parallelization notes

After ONB001 and SEC002/PERM031. Parallel with ONB002/003/006. ONB005 needs the id registry.

## 14. Open questions and assumptions

- ASSUMPTION: suggestion roots list (`~/Projects`, `~/Developer`, `~/Code`, `~/src`) is a product choice from the mock's `~/Projects`; confirm.
- OPEN: external volumes and iCloud Drive paths are refused in MVP; revisit.
- OPEN: gap noted for the final report: there is no gateway route in other areas for listing directories; ONB owns it here.
