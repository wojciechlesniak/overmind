---
id: OVE_ARCH013
title: Provide the AtomicFileWriter port with rolling snapshots
area: ARCH
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH056]
soft_depends_on: []
provides: ["port:AtomicFileWriter", "lib:atomic-fs"]
needs: []
owns: ["packages/application/src/ports/AtomicFileWriter.ts", "packages/adapters/system/src/atomic-fs/**"]
reads: ["docs/research/herdr-analiza.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 13"]
adr_refs: [8]
---

# OVE_ARCH013: Provide the AtomicFileWriter port with rolling snapshots

## 1. Summary

A small port and implementation for crash-safe file writes (temp file, `fsync`, atomic rename, directory `fsync`) with permissions control, optional previous-copy backup and rolling snapshots, following the herdr pattern. Config, session pointers, backup manifests and any engine-owned file use it, so a power loss never leaves a half-written file.

## 2. Context

Spec 13 lists "atomic writes and rolling snapshots" among the patterns taken from herdr (`session.json` deferred write, temp file, fsync, rename, 48 snapshots no more often than every 15 min, corrupt file copied byte for byte). ADR 0008 and spec 10 require the Decision Register and DB to survive; the SQLite file itself is handled by DATA/BACKUP, but small JSON/text files are written by many tasks and must not each invent their own routine.

## 3. Scope (in)

- Port `AtomicFileWriter` and value types.
- Node implementation in `packages/adapters/system/src/atomic-fs/`.
- Snapshot rotation helper `SnapshotRotator`.
- Corrupt-file quarantine helper.

## 4. Out of scope

- SQLite backup (use SQLite online backup API): BACKUP. Config semantics: ARCH005. Reading/parsing files: callers.

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface AtomicFileWriter {
     write(path: string, data: Uint8Array | string, opts?: { mode?: number /* default 0o600 */; keepPrevious?: boolean; ensureDirMode?: number /* 0o700 */ }): Promise<Result<void>>;
     writeJson(path: string, value: unknown, opts?): Promise<Result<void>>;     // stable 2-space JSON + trailing newline
     readIfExists(path: string): Promise<Result<Uint8Array | null>>;
     quarantine(path: string, reason: string): Promise<Result<string>>;         // moves to <path>.corrupt-<ts>, mode 0600
     snapshot(path: string, policy: SnapshotPolicy): Promise<Result<string | null>>;   // returns snapshot path or null when skipped by min interval
   }
   SnapshotPolicy = { dir: string; keep: number /* default 48 */; minIntervalMs: number /* default 15 min */ }
   ```
2. **Algorithm for `write`:** create temp file in the SAME directory with name `.<basename>.<ulid>.tmp`, open with `O_CREAT|O_EXCL|O_WRONLY` and explicit mode (mode applied regardless of umask via `fchmod`), write all bytes, `fsync(fd)`, close, if `keepPrevious` then hard-link or copy the existing target to `<path>.bak` (atomically, itself via the same routine), `rename(tmp, path)`, `fsync` the directory fd. On any error remove the temp file and return a typed error; never leave the target modified. Refuse if `path` is a symlink or the parent directory is a symlink (`data.symlink_refused`) unless the caller passes `allowSymlink` (not exposed in MVP).
3. Concurrent writers to the same path from within the process are serialised by a per-path async mutex; cross-process safety relies on rename atomicity (last writer wins) and callers using `engine.lock` (ARCH005).
4. **Snapshots:** `snapshot` copies the current file into `policy.dir` as `<basename>.<timestamp>.snap` (timestamp from `Clock`), only if the newest snapshot is older than `minIntervalMs`; then deletes the oldest beyond `keep`. Snapshots are 0600, written atomically via `write`.
5. **Quarantine:** copy byte for byte (never parse), keep the original path free for a fresh file; name includes reason slug and timestamp; returns the quarantine path so the caller can tell the Owner.
6. **Error codes** (registered in `data.errors.ts`): `data.write_failed`, `data.disk_full` (ENOSPC), `data.permission_denied`, `data.symlink_refused`, `data.read_failed`. Error `details` hold only a workspace-relative or `~`-relative path (no absolute home).
7. Max file size guard: default 16 MiB for `write` (configurable per call), larger payloads belong in the artifact store.
8. Performance: small file write under 5 ms on SSD (informational); no busy waits.
9. Contract suite `AtomicFileWriter.contract.ts` (TEST003) with an injectable failure point abstraction in the in-memory implementation (`failAt: 'write'|'fsync'|'rename'`) to prove atomicity.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Clock`, `IdGenerator` (ARCH007) for temp names and snapshot timestamps; `Result`/errors (ARCH003). Consumers: ARCH005 config store, BACKUP manifests, herdr session pointer, TG pairing state files if any.

## 8. Architecture and code placement

Port in `packages/application/src/ports/AtomicFileWriter.ts`; implementation `packages/adapters/system/src/atomic-fs/{node-atomic-file-writer.ts,snapshot-rotator.ts,path-mutex.ts}`. Uses Node `fs/promises` only inside the adapter. A `InMemoryAtomicFileWriter` fake is delivered by TEST002.

## 9. Security and safety

Integrity of config and state files is security-relevant (a truncated policy file must not be read as empty = allow everything; callers must treat parse failure as fail closed). Files are created 0600 and directories 0700; temp files are created exclusively to avoid symlink races in shared directories (`O_EXCL`, no following of pre-planted names). Symlink targets refused. No secrets are written by default callers (config schema forbids them).

## 10. Errors and edge cases

- Crash between temp write and rename: stale `.tmp` files are ignored; `cleanupStaleTemps(dir)` removes tmp files older than 1 h at startup.
- Rename across filesystems cannot happen because temp is in the same directory.
- Target is a directory: `data.write_failed`.
- Disk full mid-write: temp removed, original intact.
- Directory fsync unsupported: ignore ENOTSUP on that call only, keep file fsync mandatory.
- Empty data allowed (writes an empty file).

## 11. Acceptance criteria

- [ ] A fault injected before `rename` leaves the old content intact and no stray temp file (after cleanup).
- [ ] Resulting file mode is 0600 regardless of umask; created dirs 0700.
- [ ] `keepPrevious` yields a valid `.bak` of the old content.
- [ ] Snapshots honour `minIntervalMs` and `keep` with a fake clock.
- [ ] Symlinked target or parent is refused.
- [ ] Concurrent writes to the same path are serialised (final content equals one of the inputs, never a mix).
- [ ] Contract suite passes for the Node implementation and the in-memory fake.

## 12. Test plan

- Integration with real temp dirs: `node-atomic-file-writer.int.test.ts` (modes, symlink refusal, ENOSPC simulated through a small `fs` wrapper injected via constructor, concurrency with `Promise.all`).
- Unit: `snapshot-rotator.test.ts` (fake clock), `path-mutex.test.ts`.
- Contract: `AtomicFileWriter.contract.ts`.
- Commands: `pnpm vitest run packages/adapters/system/src/atomic-fs`.

## 13. Parallelization notes

Small and independent; unblocks ARCH005. Conflict hotspot: none (`adapters/system/src/atomic-fs/` is exclusive).

## 14. Open questions and assumptions

- ASSUMPTION: `fsync` of the directory is performed on macOS using `fs.open(dir)` + `fsync`; F_FULLFSYNC (`fcntl`) is not available in Node, so durability against power loss on macOS is best effort (documented).
