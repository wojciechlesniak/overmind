---
id: OVE_PERM002
title: Normalise and validate Allowed Directory lists (canonical form, overlap, limits)
area: PERM
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_PERM001, OVE_SEC002, OVE_ARCH003]
soft_depends_on: []
provides: ["lib:allowed-directory-normalizer", "usecase:RegisterAllowedDirectory"]
needs: []
owns: ["packages/domain/src/perm/directories/**", "packages/application/src/perm/register-directory.ts"]
reads: ["packages/domain/src/security/path/**", "packages/application/src/security/path-guard.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1", "SPECIFICATION 16.8"]
adr_refs: [3, 20]
---

# OVE_PERM002: Normalise and validate Allowed Directory lists

## 1. Summary

A pure domain module that turns a list of candidate directories into a valid, canonical, non-overlapping-by-rule `AllowedDirectory[]` (or a precise error), plus the small application function that registers one directory by asking `PathGuard.canonicalizeRoot` first. Everything that adds a directory (wizard, settings, permanent Access Request grant) goes through this one place.

## 2. Context

SEC002 owns "is this path safe and what is its canonical form". PERM owns "is this list a valid permission grant". The two must not be mixed: a path library must not know about rights, and a policy module must not touch the filesystem. ADR 0003: an empty list means no access; the first-run wizard requires one folder (SPEC 16.1).

## 3. Scope (in)

- `normalizeDirectoryList(entries, rules): Result<AllowedDirectory[]>` (pure).
- `mergeOverlaps`, `findConflicts`, `pickPrimary` helpers.
- `registerAllowedDirectory(input, deps)` application function: PathGuard canonicalisation, protected-location refusal, rights validation, fingerprint capture, returns a new list (does not persist; persistence is in policy use cases, `OVE_PERM011`).

## 4. Out of scope

- Path canonicalisation itself, symlink and mount checks (SEC002). Persistence (`OVE_PERM024`). Authority checks on who may add (`OVE_PERM008`, `OVE_PERM011`). UI folder picker (ARCH012 `FileDialog`, WSPACE/ONB).

## 5. Detailed requirements

1. **Input rules for `registerAllowedDirectory`** `{ rawPath: string, rights: RightSet, primary?: boolean, label?: string, source }`: call `PathGuard.canonicalizeRoot(rawPath, { allowTilde: source !== 'access_grant' })`. Any `Err` from PathGuard is passed through unchanged (codes `path.*`). The function never accepts an already-branded `CanonicalPath` from its caller, it always re-canonicalises (defence against a forged brand).
2. **List invariants** enforced by `normalizeDirectoryList` (all return `perm.invalid_policy` with `details.issue`):
   - max 64 entries; no duplicates after canonical comparison (the comparison function comes from `PathGuard`'s domain layer, case/Unicode rules per volume are the caller's input via `ComparePaths` port-free function type).
   - exactly zero or one `primary`; if the list is non-empty and none is primary, the first entry by `addedAt` becomes primary (deterministic).
   - nested entries are allowed (child inside parent) **only** when their rights differ; a child with identical rights to its ancestor is redundant and is dropped with a `warnings` entry (`redundant_nested`); a child with wider rights than its parent is kept (explicit sub-grant); a child with narrower rights is kept (explicit restriction).
   - an entry that is an ancestor of the Overmind data directory or inside it is refused (`perm.protected_location`); PathGuard already forbids this, the list check is a second line of defence.
3. **Rights ceiling:** `rights` must be valid (`PERM001`). `execute` is accepted but flagged in `warnings` (`execute_granted`) so the UI can show a confirmation.
4. **Determinism:** output sorted by path (component-wise) then id, so hashes and diffs are stable.
5. **Fingerprint:** `rootFingerprint` is copied from PathGuard's verdict (`dev`, `ino`); `normalizeDirectoryList` never invents one.
6. Result type: `{ entries: AllowedDirectory[], warnings: DirectoryWarning[] }`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`PathGuard`, `CanonicalPath`, protected-location table (SEC002), `Result`/errors (ARCH003), contracts from PERM001, `IdGenerator`/`Clock` ports (ARCH007) injected into `registerAllowedDirectory`.

## 8. Architecture and code placement

Pure logic in `packages/domain/src/perm/directories/{normalize.ts,overlap.ts,warnings.ts}`; the thin application function in `packages/application/src/perm/register-directory.ts` depends only on `PathGuard`, `Clock`, `IdGenerator`. No I/O in domain. Other PERM tasks import `normalizeDirectoryList`, they do not re-implement overlap logic (DRY).

## 9. Security and safety

This is the gate behind "the Owner grants a folder": a bug here becomes a sandbox mount of the wrong host path. Therefore: re-canonicalise always; refuse `/`, `~`, `/Users`, system folders and the data directory (PathGuard list); refuse symlinks that resolve outside what the Owner typed only if PathGuard says so, otherwise store the resolved target (so the displayed and the mounted path are the same). Fail closed on any probe error. Every refusal is returned as a typed error so the caller can write the violation/audit event.

## 10. Errors and edge cases

- Same folder added twice via two spellings (`/Users/a/Proj` and `/users/a/proj` on APFS): one entry, second is a duplicate error.
- Folder deleted between pick and register: `path.not_found` passed through.
- Parent added after child with identical rights: child dropped with warning, parent kept.
- 65th entry: `perm.invalid_policy` (`too_many_entries`).
- Home directory itself: `path.root_forbidden` from PathGuard.

## 11. Acceptance criteria

- [ ] Given `~` or `/`, when registering, then it fails (PathGuard error unchanged).
- [ ] Given nested entries with the same rights, then the child is dropped and a warning returned; with different rights both are kept.
- [ ] Given two primaries, then `perm.invalid_policy`; given none, the earliest becomes primary.
- [ ] Output is deterministic for any input permutation (property test).
- [ ] A forged `CanonicalPath` string cast by the caller is re-validated and rejected when unsafe.

## 12. Test plan

Unit tests in `packages/domain/src/perm/directories/*.test.ts` using `FakePathProbe` (SEC002) for symlink, case-variant and protected cases; fast-check property: `normalize(shuffle(x)) == normalize(x)`, idempotence `normalize(normalize(x)) == normalize(x)`. Command: `pnpm vitest run packages/domain/src/perm/directories`.

## 13. Parallelization notes

Can run in parallel with PERM003/004 (different folders). Consumers: PERM011, PERM016, WSPACE/ONB use cases. No shared file edits.

## 14. Open questions and assumptions

- ASSUMPTION: nested entries with identical rights are redundant and dropped (keeps the mount plan small).
- Open: whether network volumes (SMB/NFS) may be added; SEC002 flags them, default here: allowed only with the `network_volume` warning surfaced to the UI.
