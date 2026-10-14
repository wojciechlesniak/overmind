---
id: OVE_SETUP011
title: "Spike with decision: engine standalone executable packaging and SQLite driver"
area: SETUP
kind: spike
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP001, OVE_SETUP002]
soft_depends_on: [OVE_SETUP008, OVE_SETUP010]
provides: ["decision:engine-packaging", "decision:sqlite-driver"]
needs: []
owns:
  - docs/research/engine-packaging-spike.md
  - docs/adr/*-engine-packaging-and-sqlite-driver.md
reads: ["docs/dependencies.md", "apps/desktop/src-tauri/tauri.conf.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9, 18, 19]
---

# OVE_SETUP011: Spike with decision: engine standalone executable packaging and SQLite driver

## 1. Summary

ADR 0018 requires the TypeScript engine to ship as a standalone executable that runs independently of the window (ADR 0005) and is declared as a Tauri sidecar. This time-boxed spike compares Node SEA, Bun compile and other options together with the SQLite driver question (`better-sqlite3` native addon vs built-in `node:sqlite` vs `bun:sqlite`), measures them with one fixed experiment, and records the decision as an ADR. If the spike is inconclusive after the time box, a pre-agreed default applies.

## 2. Context

Constraints from the project:
- Engine = separate Node-compatible TypeScript process, one language for own code (ADR 0018), uses SQLite with WAL, FTS and a daily backup (SPEC 10, 12).
- It is started by `overmind-engine ensure-running` from the Tauri shell and by a per-user LaunchAgent, must outlive the window, must survive crashes and be restartable (ADR 0005).
- Tauri sidecar rules: `bundle.externalBin` entries are single executables named with a target-triple suffix; extra files go to `resources`; arm64 macOS only (ADR 0009 and Apple `container` need Apple silicon).
- Notarization requires every Mach-O file in the bundle, including the engine and any `.node` addon, to be signed with the Developer ID and the hardened runtime (OVE_SETUP014).
- Tests run under Node 22 and Vitest (OVE_SETUP004). A runtime different from the test runtime means tests do not exercise what ships.
- The engine exposes ports; SQLite access is behind a port in `packages/application` and an adapter in `packages/adapters/sqlite` (DATA area), so a driver swap is one adapter.
Candidate facts (registry, 2026-10-13; verify): Node 22.23.3 (the official binary is also the SEA base), `better-sqlite3@13.0.3` (engines Node >=22, depends on `node-addon-api ^8`), `bun@1.4.3` (`bun build --compile` targets `bun-darwin-arm64`, supports embedding `.node` files and `bun:sqlite`), `@yao-pkg/pkg@6.23.0` (engines Node >=22), `postject@1.0.0-alpha.6` (SEA blob injection), `esbuild@0.28.2`.

## 3. Scope (in)

- Paper screening of all options in requirement 1, with reasons to drop any.
- Hands-on experiment (requirement 3) for the shortlist (at least: A. Node SEA + `node:sqlite`, B. Node SEA + `better-sqlite3`, C. Bun compile + `bun:sqlite`).
- Measurement table and recommendation in `docs/research/engine-packaging-spike.md`.
- ADR file `docs/adr/<next free number>-engine-packaging-and-sqlite-driver.md` (English, template of OVE_OSS006) with the decision, consequences and what to revisit.
- Updating the compatibility matrix rows `better-sqlite3`, `node:sqlite`, `bun`, `postject`, `@yao-pkg/pkg`, `esbuild` in OVE_SETUP008's table to final/rejected (done in the ADR PR through a proposal if OVE_SETUP008 is already merged).

## 4. Out of scope

- Implementing the engine scaffold: OVE_SETUP016. Implementing the packaging script and signing: OVE_SETUP017 and OVE_SETUP014.
- SQLite schema, migrations, repositories, event log, backup: DATA and BACKUP areas.
- The SQLite port contract: DATA area; this spike only checks that every capability the port needs is available.
- LaunchAgent plist design: ENGINE area.

## 5. Detailed requirements

1. **Options to screen on paper** (each gets one paragraph with a keep/drop decision): (A) Node SEA (official Node binary + blob injected with `postject` or the Node built-in SEA build flow if the pinned Node has it), (B) Bun `compile`, (C) `@yao-pkg/pkg`, (D) official Node binary plus an esbuild bundle shipped as app resources behind a tiny launcher, (E) Deno compile (expected drop: different runtime, npm compatibility risk), (F) Rust rewrite of the engine (dropped by ADR 0018, only noted). SQLite drivers: (1) `better-sqlite3` addon, (2) `node:sqlite`, (3) `bun:sqlite`, (4) WASM SQLite (expected drop: speed and file locking).
2. **Evaluation criteria and weights** (score 0 to 5, weights sum to 100): runtime parity with tests and development (20), correctness of required SQLite features (20), signing and notarization simplicity (15), Tauri sidecar fit and process model (10), startup time and memory (10), build reproducibility and supply-chain visibility (SBOM, pinned inputs) (10), debuggability (source maps, stack traces, inspector) (5), maintenance burden and bus factor (5), binary size (5). Any option failing a mandatory gate (below) is dropped regardless of score.
3. **Mandatory probes** (the hello-engine used for every shortlisted option, written once as `entry.ts` plus `probe.ts`, kept in the spike branch, not on `main`): (a) open a database file in WAL mode with `busy_timeout`, `foreign_keys=ON`, `synchronous=NORMAL`; (b) create an FTS5 virtual table and run a `MATCH` query with ranking; (c) insert 100 000 event rows (id, ts, type, JSON payload) in one transaction and report ms and rows per second; (d) read them back through an index; (e) take a consistent backup while a writer is active (`VACUUM INTO` and, if available, the driver backup API); (f) `PRAGMA user_version` read/write (migrations); (g) JSON functions (`json_extract`); (h) attempt `loadExtension` of a no-op extension (only to document availability for future `sqlite-vec`); (i) listen on a Unix socket with mode 0600 and answer one request; (j) spawn a child process and capture its output; (k) read the bundled version number embedded at build time; (l) install a signal handler for SIGTERM and exit cleanly within 2 s; (m) detach: started by a parent process that then exits, the engine keeps running; (n) throw an error and show a source-mapped stack trace; (o) when the signed binary is started by a LaunchAgent, read a file under `~/Documents` and record whether and how macOS TCC prompts (needed for OVE_SETUP014 open question 2).
4. **Measurements** (each on the same Apple-silicon Mac, macOS 26, 10 runs, report median and worst): executable size (MB), build time, cold start time to socket ready (ms), idle RSS after 30 s (MB), probe (c) throughput, signing result (`codesign --force --options runtime --timestamp --entitlements <plist> ...`, `codesign --verify --deep --strict`, and an actual `notarytool submit` of a throw-away zip if a Developer ID is available; otherwise record "not notarized, ad-hoc signed only" and mark the criterion partially measured), launch under `launchctl bootstrap` as a LaunchAgent, behaviour when started from a Gatekeeper-quarantined bundle copy (`xattr -w com.apple.quarantine`).
5. **Tauri sidecar fit check:** copy the candidate binary to `apps/desktop/src-tauri/binaries/overmind-engine-aarch64-apple-darwin` in a scratch checkout, run `pnpm tauri build --debug` (once OVE_SETUP010 exists; else a throw-away Tauri project) and confirm the binary lands in `Contents/MacOS/`, is signed with the app, and runs from the bundle. Also confirm any required companion file (a `.node` addon, a blob, a data directory) can sit in `Contents/Resources/` and be found relative to `process.execPath`.
6. **Runtime parity check:** run the repository's Vitest suite for one small adapter (a stub SQLite adapter test written for the probe) under Node 22.23.3. For Bun candidates, state precisely which tests cannot run under Bun or which APIs differ (`bun:sqlite` is unavailable under Node), and what the extra port-conformance suite costs (OVE_TEST003 contract tests would have to run under both runtimes).
7. **Output 1: `docs/research/engine-packaging-spike.md`:** options table, scores, the measurement table (all numbers), probe pass/fail matrix, commands used, versions (exact), spike branch commit hash, pitfalls found (for example: SEA needs a single CommonJS file or has ESM limits in the pinned Node; native addons cannot load from inside the blob; `postject` is alpha; Bun uses JavaScriptCore so some `node:` behaviour differs; entitlements required).
8. **Output 2: the ADR** (status accepted, English): decision, drivers, rejected options with one reason each, consequences for OVE_SETUP016, OVE_SETUP017, OVE_SETUP014 (entitlements list), DATA (driver adapter), TEST (runtime parity), BACKUP (backup method), and a "revisit when" list (Node 22 end of life April 2027, `node:sqlite` stability change, Bun/Node SEA changes).
9. **Time box:** 4 hours of agent work in total. At the end of the time box, write the ADR even if measurements are incomplete, mark incomplete criteria, and apply the default rule below.
10. **Default rule (if inconclusive or if the experiment cannot be completed):** package with **Node SEA** built from the pinned official Node 22.23.3 binary (bundle with esbuild into one CommonJS file, inject with `postject`), run the engine on the same Node version as the tests, and use the built-in **`node:sqlite`** behind the SQLite port. Condition: probes (a), (b), (e), (f), (g) pass on Node 22.23.3. If any of those fail, use **`better-sqlite3@13.0.3`** shipped as a separate `.node` file in `Contents/Resources/engine/native/`, signed with the same Developer ID, loaded explicitly via `process.dlopen` using a path derived from `process.execPath`. Bun is chosen only if it wins by more than 15 weighted points AND the Owner approves the runtime split (open question). The default is recorded in the ADR as "default applied" with the reasons it was not overridden.
11. **Port-neutrality requirement for the ADR:** whatever is chosen, the SQLite port (DATA area) MUST NOT leak driver types; the ADR lists the minimal port surface the probes used (exec, prepare/run/get/all, transaction, pragma, backupTo(path), close) so DATA can write its contract suite once (OVE_TEST003).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Uses the pinned versions and the pinned-binary downloader (OVE_SETUP006) for Node and Bun archives (checksums verified). The ADR uses the template from OVE_OSS006. Probe code is throw-away; reusable parts (the Unix-socket 0600 listener, detach logic) are described in the research doc for OVE_SETUP016 to re-implement properly.

## 8. Architecture and code placement

Documentation only on `main`: `docs/research/engine-packaging-spike.md` and one ADR. Spike code lives on a branch `spike/OVE_SETUP011` (never merged, not deleted, its commit hash is quoted). No product package is created or changed.

## 9. Security and safety

- Downloads of Node, Bun and addons are checksum-verified (pinned-bin); nothing is piped from `curl` into a shell.
- Supply chain comparison is a criterion: number of transitive packages added, install scripts (`better-sqlite3` builds or downloads prebuilt binaries at install; check `prebuild-install` behaviour and whether `onlyBuiltDependencies` must allow it), provenance of the Bun and Node binaries (official signatures/SHASUMS).
- Signing: record whether `com.apple.security.cs.disable-library-validation` would be required (it weakens hardened runtime and must be avoided: sign the `.node` addon with the same Team ID instead) and which JIT entitlements the runtime needs (`com.apple.security.cs.allow-jit`; the minimal set is part of the ADR).
- The probe handling secrets: none; the Unix socket probe uses mode 0600 and checks it.
- Fail closed: the chosen packaging must start the engine only if the executable's embedded version and the app protocol version are compatible (exit code 30 contract from OVE_SETUP010).
- The spike machine's notarization credentials, if used, are never committed; use a temporary keychain profile.

## 10. Errors and edge cases

- Notarization unavailable on the spike machine: record as not measured; weigh signing simplicity from documentation and ad-hoc signing results; the ADR states the residual risk and OVE_SETUP014 must verify early.
- FTS5 missing from the bundled SQLite of an option: that option fails the gate for features (SPEC 10 requires FTS).
- `node:sqlite` prints an ExperimentalWarning: acceptable if it can be silenced via `process.removeAllListeners('warning')` filtering for that specific warning only; note the stability index of the pinned Node.
- SEA blob cannot be reproduced bit-for-bit: record and propose a mitigation (verify by rebuilding twice and comparing the pre-sign binary hash).
- A measurement varies wildly: report the spread; do not cherry-pick.
- The option wins on score but fails a gate: dropped, ADR explains.

## 11. Acceptance criteria

- [ ] Research doc contains the screened options, weighted scores, all measurements (or explicit "not measured" with reason), the probe matrix and exact versions.
- [ ] ADR exists, accepted, states the packaging method, SQLite driver, the entitlements needed, and the "revisit when" list.
- [ ] The decision follows the criteria, or states that the default rule of requirement 10 was applied and why.
- [ ] The ADR lists the minimal SQLite port surface (requirement 11) and the exact files OVE_SETUP016/017/014 must produce.
- [ ] Sidecar fit (requirement 5) is demonstrated or explained, including where companion files live.
- [ ] Matrix rows for the shortlisted and rejected options are updated through OVE_SETUP008 (or a proposal file).
- [ ] The spike branch exists with a commit hash quoted in the doc.

## 12. Test plan

The probes are the tests; their output is pasted verbatim into the research doc. Re-runnable by `pnpm tsx spike/probe.ts` on the spike branch. No tests land on `main`. A reviewer reproduces the numbers for the chosen option once.

## 13. Parallelization notes

Runs in parallel with OVE_SETUP010 and 012. Blocks OVE_SETUP016, OVE_SETUP017, OVE_SETUP014 (entitlements), the DATA area's driver adapter task, and BACKUP. To avoid blocking them for long, publish the decision within the first working day and let those tasks start against the SQLite port while the ADR is in review (soft dependency).

## 14. Open questions and assumptions

- ASSUMPTION: default rule in requirement 10. The Owner may overrule after seeing numbers.
- Open question: is running the engine on a different runtime than the tests (Bun) acceptable? Default no (violates "test what you ship").
- Open question: Node 22 leaves maintenance in April 2027; the ADR should state when the move to Node 24 (new SEA/`node:sqlite` behaviour) is re-evaluated.
- Open question: whether a Developer ID certificate is available during the spike (Owner action); without it notarization risk remains open until OVE_SETUP014.
