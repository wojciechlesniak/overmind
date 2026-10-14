---
id: OVE_SEC002
title: Implement the path canonicalisation and symlink/mount checking library
area: SEC
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH006]
soft_depends_on: [OVE_SEC001]
provides: ["lib:path-guard", "port:PathProbe", "contract:CanonicalPath", "lib:path-canonicaliser"]
needs: []
owns: ["packages/domain/src/security/path/**", "packages/application/src/ports/PathProbe.ts", "packages/adapters/system/src/path-probe/**", "packages/testing/src/fakes/FakePathProbe.ts", "packages/testing/src/contracts/PathProbe.contract.ts", "docs/security/path-canonicalisation.md"]
reads: ["docs/security/requirements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 4, 20]
---

# OVE_SEC002: Implement the path canonicalisation and symlink/mount checking library

## 1. Summary

Every access decision about a path (Allowed Directory membership, Access Request, mount list) goes through one library: pure lexical normalisation and containment logic in `domain`, filesystem facts (realpath, lstat, device ids, volume case sensitivity) through a `PathProbe` port. It handles `..`, symlinks, case-insensitive APFS, Unicode normalisation, firmlinks, mount points and TOCTOU, and ships with a large test matrix.

## 2. Context

ADR 0003: paths are canonicalised, symlinks and mounts checked, violations logged. SPEC 11 and 16.8: access outside Allowed Directories must be blocked even for commands issued by a CLI. The real wall is the sandbox mount list (ADR 0020), so this library's main job is to make sure that only correct canonical directories are ever mounted or approved, and to protect host-side operations done by the engine itself (reading Project Documentation, git worktrees, backups). macOS specifics: default APFS volumes are case-insensitive and normalisation-insensitive, `/Users` is a firmlink into `/System/Volumes/Data/Users`, `/var`, `/tmp`, `/etc` are symlinks into `/private`, external volumes live under `/Volumes`.

## 3. Scope (in)

- Pure functions in `packages/domain/src/security/path/` (lexical and comparison logic, types).
- `PathProbe` port + Node/macOS implementation in `adapters/system`.
- Orchestrating functions (`resolveForAccess`, `canonicalizeRoot`, `isWithin`) as application-level service `PathGuard` in `packages/application/src/security/path-guard.ts` (depends only on `PathProbe`).
- `CanonicalPath` branded type.
- Test matrix (fixtures builder for virtual file trees) and property tests.
- Documentation of the algorithm and TOCTOU strategy.

## 4. Out of scope

- Computing Effective Permissions: PERM. Mount construction: BOX (uses this library). Showing paths in UI: UI areas (they display `~`-relative forms from `displayPath`).
- Windows/Linux path rules (later; the pure layer is OS-parameterised via a `PlatformPathRules` object).

## 5. Detailed requirements

1. **Types:** `type CanonicalPath = string & { readonly __canonical: true }` produced only by `PathGuard`. `PathVerdict = { ok: true, canonical: CanonicalPath, rootId: string, relative: string, flags: PathFlag[] } | Err<AppError>`. `PathFlag`: `crossesMountPoint`, `viaSymlink`, `hardlinked` (nlink > 1 for files), `caseVariantInput`, `unicodeVariantInput`, `firmlinkAlias`.
2. **PathProbe port** (all methods `Promise<Result<...>>`, none follows symlinks unless named so):
   ```ts
   interface PathProbe {
     realpath(p: string): Promise<Result<string>>;                 // fs.realpath.native, resolves all symlinks of an EXISTING path
     lstat(p: string): Promise<Result<FileFacts | null>>;          // null when missing; FileFacts = { kind:'file'|'dir'|'symlink'|'other', dev, ino, nlink, mode, uid }
     stat(p: string): Promise<Result<FileFacts | null>>;
     readlink(p: string): Promise<Result<string>>;
     volumeInfo(p: string): Promise<Result<{ dev: number; mountPoint: string; caseSensitive: boolean; unicodeNormalizationSensitive: boolean; fsType: string; readOnly: boolean }>>;
     homeDir(): string;
   }
   ```
   `caseSensitive` is determined WITHOUT writing: given an existing path component with letters, `lstat` the same path with the case of one letter flipped; if it exists with the same `dev`+`ino` the volume is case-insensitive (cache per `dev`). Mount point from `statfs`/parsing `getfsstat` equivalent (macOS: `diskutil`-free, use `fs.statfs` where available or `df -P` through `ProcessRunner` as fallback). 
3. **Lexical normalisation (pure):** input MUST be a string of at most 4096 UTF-8 bytes without NUL or control characters (< 0x20, 0x7f) and, for programmatic callers, absolute. `~` and `~/` expand to `probe.homeDir()` only if the caller sets `allowTilde` (UI-originating strings); `~user` is rejected. Collapse repeated `/`, remove `.` segments, resolve `..` lexically ONLY for the pre-check (never as the final decision), reject paths whose lexical resolution escapes `/`. Trailing slash removed. Backslash is a normal character on macOS but rejected (ambiguity) with `path.invalid_character`.
4. **Resolution algorithm `resolveForAccess({ input, roots, mode, followFinalSymlink })`:**
   1. Lexical normalise + validate. 
   2. Split into existing prefix and non-existing suffix by walking components with `lstat` (do not use `realpath` on a non-existent path). 
   3. `realpath` the longest existing prefix (resolves every symlink in the chain, so `..` after a symlink is evaluated physically). Append the remaining suffix components after validating that none is `..` or `.`.
   4. Map firmlink aliases: if the result starts with `/System/Volumes/Data/` and the remainder's first component is in the firmlink set (`Users`, `Applications`, `Library`, `opt`, `usr/local`, `private`, `Volumes`? (`Volumes` is NOT a firmlink: keep), `cores`, `home`?), strip the prefix to the canonical short form. Keep the list in one table with the macOS version it was verified on (ASSUMPTION: read `/usr/share/firmlinks` at runtime when present to build the set; fall back to the built-in list). Symlink roots (`/var`, `/tmp`, `/etc`) are covered by `realpath` (`/private/var`).
   5. Normalise Unicode to NFC and compare using the volume's rules: if `unicodeNormalizationSensitive` is false (APFS) compare NFC-normalised strings; if `caseSensitive` is false compare with locale-independent Unicode case folding (`toLowerCase('und')` plus the special cases `ß`, final sigma, Turkish dotless i handled by simple case fold). Containment is component-wise: `/a/b` is within `/a` but `/ab` is not.
   6. Determine the matching root among canonical roots (roots are canonicalised the same way at registration time and stored with their `dev`). Decide `rootId` by the longest matching root.
   7. Mount-point check: for each existing component below the root, compare `dev` with the root's `dev`; a change means the path crosses a mount point: flag `crossesMountPoint` and DENY by default (`path.crosses_mount`) unless the root was registered with `allowMountCrossing` (never default; requires approval flag from PERM).
   8. Symlink policy: resolved target must be inside the same root (already ensured by realpath + containment). If the final component is a symlink and `followFinalSymlink` is false (operations such as delete or write that must not follow), return the symlink itself as `canonical` with flag `viaSymlink` and verify the link's own parent is inside the root; its target is irrelevant for `lstat` operations but `resolveForAccess` for read/write modes always follows.
   9. Files with `nlink > 1`: allowed but flagged `hardlinked` (a hardlink to a file outside the root cannot be detected cheaply; sandbox mounting is the real control); PERM may refuse writes through hardlinks to files whose other link is unknown (open question).
   10. Return `CanonicalPath` + relative path (always `/`-separated, never starting with `..`).
5. **Registration of roots `canonicalizeRoot(input)`:** requires existing directory (not file), owned by the current user (or readable by user), not the filesystem root `/`, not the home directory itself, not `/Users`, `/System`, `/Library`, `/private`, `/etc`, `/var`, `/usr`, `/bin`, `/sbin`, `/Applications`, `/Volumes` itself, not an ancestor of the Overmind data directory, and not inside the data directory; not `~/Library`, `~/.ssh`, `~/.gnupg`, `~/.aws`, `~/.config`, `~/.claude`, `~/.codex`, `Library/Keychains`, `Library/Application Support/Overmind` (a deny-list `PROTECTED_LOCATIONS` shipped with the library; Owner cannot override in MVP). Returns the canonical root + `dev`, `caseSensitive`, `mountPoint`. Nested roots allowed; overlapping duplicates deduplicated.
6. **TOCTOU strategy (documented and implemented):** (a) The authoritative control for Agents is the sandbox mount list: only canonical roots are mounted; paths inside the container cannot name host locations, so symlink swaps inside `/work` cannot reach the host (a symlink inside `/work` pointing to `/Users/x/.ssh` resolves inside the container, where it does not exist). (b) For host-side operations done by the engine on behalf of an Agent (reading Project Documentation, copying Artifacts, creating worktrees), use `openVerified(canonical, flags)`: `open(..., O_NOFOLLOW)` on the final component after `resolveForAccess`, then `fstat` the descriptor and compare `dev`/`ino` with the earlier `lstat`; any mismatch aborts (`path.changed_during_check`). Intermediate components are re-verified by calling `realpath` again after the open and comparing with the canonical value. (c) Decisions are never cached across a Run boundary; canonical roots are re-validated when a Run starts and before every mount update (the directory may have been replaced by a symlink). (d) Residual race window documented: between the post-open check and use, the descriptor is already bound to the checked inode, so the check is not stale for that descriptor.
7. **Display paths:** `displayPath(canonical)` returns the `~`-relative form for UI/audit; never exposes other users' names.
8. **Error codes** (registered, `telegramSafe`): `path.invalid`, `path.access_denied`, `path.not_absolute`, `path.invalid_character`, `path.too_long`, `path.outside_allowed`, `path.crosses_mount`, `path.protected_location`, `path.not_directory`, `path.not_found`, `path.changed_during_check`, `path.root_forbidden`. `details` contain only a `~`-relative or workspace-relative path.
9. **Test matrix** (all in a fixtures builder using a virtual `FakePathProbe` for pure logic AND a real temp-dir integration set on macOS CI where available): each row = input, tree, roots, mode, expected verdict/flags.
   - Lexical: `/a/b/../c`, `/a/b/./c`, `//a///b`, `/a/b/`, empty, relative, 5000-byte path, NUL, newline, backslash, `~`, `~root`, `/a/b/..%2f..` (percent-encoding is NOT decoded: literal name), `/a/b/‮..` (bidi).
   - Traversal: `root/../outside`, `root/sub/../../outside`, `root/link/..` where `link -> /elsewhere/deep` (physical resolution differs from lexical), `root/..;/x`.
   - Symlinks: link inside root to file inside root (ok, `viaSymlink`), to file outside (deny), to directory outside, relative link `../../x`, chain of 3, loop (`a -> b -> a`, ELOOP -> `path.invalid`), dangling link (write target absent), final-component symlink with `followFinalSymlink=false`, link replaced after check (integration TOCTOU test using `openVerified`).
   - Case: `/Users/Me/Proj` vs `/users/me/proj` on a case-insensitive volume (same directory -> inside root); on a case-sensitive volume different -> outside; mixed-case sibling `Proj2` not inside `Proj`.
   - Unicode: root `Zażółć` NFC vs input NFD (`Zazó...`), emoji names, combining marks, Hangul jamo; fullwidth slash `／` is a normal character (not separator); lookalike `‥`.
   - Firmlinks/aliases: `/System/Volumes/Data/Users/x/p` equals `/Users/x/p`; `/private/var/...` vs `/var/...`; `/tmp` -> `/private/tmp`; `/Users/Shared`.
   - Mounts: path crossing into `/Volumes/Ext` under a root that contains a mount point (denied); root on an external volume (allowed, flagged `mountPoint`); mount over a subdirectory (dev differs); read-only volume flagged for write mode.
   - Hardlinks: file with nlink 2 flagged.
   - Protected locations: root `~`, `~/.ssh`, `~/Library/Keychains`, `/`, `/Users`, a parent of the data dir, the data dir itself.
   - Roots: nested roots, duplicate roots, root that is a symlink to another root (canonicalised to target), root deleted after registration (verification fails at Run start).
   - Property tests (fast-check): for random trees with random symlinks/`..`/case variants, `resolveForAccess` never returns `ok` with a canonical path whose physical `realpath` is outside the root's physical `realpath`; idempotence (`resolve(resolve(p)) == resolve(p)`).
10. **Performance:** resolution under 2 ms typical (cached `volumeInfo` per `dev`, bounded LRU of 256 entries, entries invalidated at Run start).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Result`/errors (ARCH003), `ProcessRunner` (ARCH014) only for the `df` fallback, `Logger` (ARCH004) for violation logs (callers also write audit events). Consumers: PERM (Access Requests, Effective Permissions), BOX (mount specs; `Mount.hostPathCanonical` type), ONB/WSPACE (adding folders), BACKUP (target folder validation), `FileDialog` results (ARCH012).

## 8. Architecture and code placement

- Pure: `packages/domain/src/security/path/{lexical.ts,compare.ts,firmlinks.ts,protected-locations.ts,types.ts}` (no I/O, parameterised by `PlatformPathRules`).
- Service: `packages/application/src/security/path-guard.ts` (depends on `PathProbe` port only).
- Port: `packages/application/src/ports/PathProbe.ts`; adapter `packages/adapters/system/src/path-probe/node-path-probe.ts` (Node fs + volume detection).
- SRP: lexical vs physical vs policy are separate modules; OCP: another OS adds a `PlatformPathRules` and probe.

## 9. Security and safety

This library is a gate for SR-04 and supports SR-01/SR-05/SR-33. Fail closed everywhere: any probe error, unknown volume property, oversized input, or ambiguity yields a denial with a specific code and an audit-worthy log (violations are logged; the caller writes the audit event). Never trust a path string supplied by the UI, an Agent or Telegram: always canonicalise on the engine side. Do not follow symlinks implicitly. Never log absolute home paths (display form only). Agents must not learn about host paths outside their roots from error messages (`details` limited to the offending relative form).

## 10. Errors and edge cases

- Path exists but is unreadable (EACCES): return `path.access_denied`, which maps to the same user message as `path.outside_allowed`, so that existence of paths outside the roots is not disclosed (do not return `path.not_found` in that case).
- Race: root replaced by a symlink between registration and Run start: Run start re-canonicalises and compares `dev`/`ino`; mismatch blocks the Run and notifies the Owner.
- Network volumes (SMB/NFS): `fsType` flagged; roots on network volumes are allowed only with a warning flag (open question).
- Very deep trees (> 64 components): rejected.
- Case-only rename of a directory by the Owner: handled because comparison uses canonical on-disk form from `realpath`.
- iCloud Drive / Dataless files: `stat` may trigger downloads; library uses `lstat` only on directories chain and never reads content.
- Sparse bundles, Time Machine snapshots: not supported (treated as `other`).

## 11. Acceptance criteria

- [ ] Every row of the test matrix exists as an automated test and passes (pure tests on Linux with `FakePathProbe`; macOS-only integration rows are tagged and run in the macOS CI job).
- [ ] Property test: no `ok` verdict resolves outside the root physically over 10k random cases.
- [ ] Protected locations and `canonicalizeRoot` rules reject `/`, `~`, `/Users`, `~/.ssh`, the data dir and its parents.
- [ ] Case-insensitive and Unicode-variant inputs resolve to the same canonical path as the on-disk spelling.
- [ ] `/System/Volumes/Data/Users/...` and `/Users/...` yield equal canonical paths.
- [ ] Crossing a mount point is denied by default and flagged otherwise.
- [ ] `openVerified` fails when the target is swapped for a symlink between check and open (integration test with a tight swapper).
- [ ] No error `details` contain absolute home paths.
- [ ] `docs/security/path-canonicalisation.md` documents the algorithm, firmlink table source, and the TOCTOU strategy.

## 12. Test plan

- Unit (pure): `lexical.test.ts`, `compare.test.ts`, `protected-locations.test.ts`, `path-guard.test.ts` with `FakePathProbe` (virtual tree DSL; this task writes it in `packages/testing/src/fakes/FakePathProbe.ts` following the fake conventions of TEST002).
- Property: `path-guard.property.test.ts` (fast-check).
- Integration (real fs, temp dirs): `node-path-probe.int.test.ts`, `open-verified.int.test.ts` (symlink swap race), macOS-only: `apfs-case.int.test.ts` (creates a case-insensitive disk image via `hdiutil` in CI helper, tagged `@macos`).
- Contract: `PathProbe.contract.ts`.
- Commands: `pnpm vitest run packages/domain/src/security packages/application/src/security packages/adapters/system/src/path-probe`, `pnpm test:macos -- path`.

## 13. Parallelization notes

Types and the pure layer can merge first so PERM and BOX authors can code against `CanonicalPath` and `PathGuard` with a fake probe. The adapter and macOS integration tests follow. Other tasks must not implement their own path checks; if they need a variant they file a proposal.

## 14. Open questions and assumptions

- ASSUMPTION: the firmlink set is read from `/usr/share/firmlinks` at runtime when available (macOS), otherwise a built-in list verified on macOS 26.
- ASSUMPTION: roots on network volumes are allowed with a visible warning (PERM/UI) but never silently.
- Open: should writes through hardlinked files (nlink > 1) require approval? Default: allowed with flag and audit entry.
- Open: Spotlight/Time Machine snapshot paths (`/Volumes/.timemachine`) default to denied as protected.
