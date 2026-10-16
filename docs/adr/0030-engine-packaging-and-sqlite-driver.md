---
adr: 30
title: Use Node SEA and node:sqlite for the engine
status: accepted
date: 2026-10-16
deciders: [Owner]
supersedes: []
superseded_by: []
tags: [architecture, security, tooling]
---

# Use Node SEA and node:sqlite for the engine

Default applied under SETUP011 requirement 10: package the TypeScript
engine as a Node SEA from the checksum-pinned official Node 22.23.3 arm64 binary,
esbuild 0.28.2 CommonJS bundle and postject 1.0.0-alpha.6 injection, with built-in
`node:sqlite` behind the SQLite port. This preserves the test/runtime version and
avoids a native addon companion. Actual required SQLite probes (a, b, e, f, g)
passed. The experiment exceeded its time cap and stopped with incomplete signing,
sidecar and revised-recipe evidence; these remain explicit in
[the spike report](../research/engine-packaging-spike.md), not waived release gates.

## Consequences

- SETUP016 produces `apps/engine/src/{main,cli,exit-codes,version}.ts`,
  `src/commands/{run,ensure-running,version}.ts`, `build/bundle.mjs`, `tsconfig.json`
  and `README.md`; the bundle is `dist/engine.cjs` with maps and metafile. Source
  maps must retain stable source identities without host build paths. Own source
  stays Node-only; version/protocol mismatches fail closed with exit code 30.
- SETUP017 produces `tools/package-engine/run.ts`, the step modules and
  `node.lock.json`, `steps/{bundle,fetch-runtime,sea-blob,inject,sign,verify,manifest}.ts`,
  plus `docs/engineering/engine-packaging.md`. Outputs are
  `apps/desktop/src-tauri/binaries/overmind-engine-aarch64-apple-darwin` and
  `overmind-engine.manifest.json`. Disable snapshots/code cache; compare two
  pre-sign hashes from independent build directories; preserve runtime licenses
  and checksum/provenance evidence. Relative SEA inputs removed one path leak;
  two same-path builds matched, but independent-directory equality is unmeasured.
  Canonical maps broke automatic stack mapping; offline SourceMap symbolication
  passed. Verify a deployable mapping strategy and actual Tauri bundle execution
  before accepting packaging; do not copy the probe as production code.
  Use the shared verified resource downloader with the exact archive member;
  its generic basename selector also matches the archive's `include/node/` folder.
  Set SEA `execArgvExtension: "none"`; no inherited NODE_OPTIONS or inspector.
- SETUP014 produces `build/entitlements/{app,engine}.plist`,
  `.github/workflows/release.yml`, `tools/release/{check-versions,prepare,verify-bundle,notes}.ts`
  and `docs/engineering/release.md`. Start with an empty app dictionary and engine
  `com.apple.security.cs.allow-jit` only. Reject disabled library validation,
  DYLD injection, debugger/get-task-allow and unproven extra memory entitlements.
  Developer ID, secure timestamp, notarization and protected-folder attribution
  remain release gates; ad-hoc execution is not a notarization result.
- DATA defines a driver-neutral port: `exec`, `prepare/run/get/all`, `transaction`,
  `pragma`, `backupTo(path)`, `close`. No DatabaseSync, addon or Bun types cross it.
  Define row absence, integer precision and rollback semantics in its contract.
- TEST runs the SQLite adapter/conformance suite on Node 22.23.3. Preserve visible
  unrelated warnings; any SQLite ExperimentalWarning filter must match that warning
  specifically. A runtime split requires a new decision and dual-runtime contracts.
- BACKUP uses asynchronous `node:sqlite.backup` into a new destination, validates
  integrity and completion before publishing; a bounded WAL writer and migration
  state are part of conformance. `VACUUM INTO` is the measured alternative.
- Revisit before Node 22 EOL on 2027-04-30, on node:sqlite stability changes,
  material SEA/Bun changes, failed SQLite gates, or new signing/TCC evidence.

## Alternatives considered

`better-sqlite3` remains only the task's contingency if required built-in SQLite
probes fail; it needs a separately signed same-Team-ID `.node` companion. Bun
changes the runtime and adds binary-license obligations; no split is approved.
pkg adds a third-party runtime pipeline; loose Node/resources add a launcher and
extra files. Deno changes runtime compatibility and Rust contradicts ADR 0018.
WASM persistence adds a VFS/locking seam without value for this native engine.
