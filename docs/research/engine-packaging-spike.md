# Engine packaging and SQLite driver spike

Research date: 2026-10-16. Task: OVE_SETUP011.

**Decision: default applied — Node 22.23.3 SEA plus built-in `node:sqlite`.**
The required default-condition probes (a), (b), (e), (f), (g) passed in real signed
executables. [ADR 0030](../adr/0030-engine-packaging-and-sqlite-driver.md) records
this choice. No Bun runtime split or additional license exception is approved.

The four-hour exploratory cap was exceeded (start 13:32 UTC; last exploratory
verification about 18:10 UTC). This is a process deviation, not compliance with
the cap. Exploration has stopped; incomplete criteria remain explicit below.
The task's pre-agreed default is used because signing/distribution and corrected
recipe repetitions could not be completed. Documentation and review follow the
experiment; this report does not treat their duration as extra experiment time.

## Constraints and decision rule

ADR 0018 requires a TypeScript engine packaged as a standalone executable;
ADR 0005 requires it to survive the window process. ADR 0009 limits this experiment
to Apple silicon macOS. ADR 0019 keeps the workflow implementation in TypeScript.
The existing development and Vitest runtime is Node 22.23.3. The default in task
requirement 10 is Node SEA plus `node:sqlite`, conditional on actual probes (a),
(b), (e), (f), (g). Its fallback is Node SEA plus `better-sqlite3@13.0.3`. Bun
requires a lead greater than 15 weighted points and explicit Owner approval of
the runtime split. These are project requirements, not upstream claims.

## Verified candidate inputs

Exact registry metadata and publisher sources were read without installing or
executing these packages. Every listed release is older than 72 hours on the
research date. An npm package's license field does not cover every library linked
into a runtime executable.

| Input | Exact version | Publisher release time, UTC | Declared package license | Evidence |
| --- | --- | --- | --- | --- |
| Node.js | 22.23.3 | 2026-09-23, date precision | MIT plus bundled third-party notices | [Official index](https://nodejs.org/dist/index.json), [versioned LICENSE](https://github.com/nodejs/node/blob/v22.23.3/LICENSE) |
| better-sqlite3 | 13.0.3 | 2026-08-05 03:47:44.751 | MIT | [Registry time/manifest](https://registry.npmjs.org/better-sqlite3), [versioned manifest](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/package.json) |
| Bun | 1.4.3 | 2026-10-10 05:24:54, GitHub binary release | MIT for Bun itself; linked libraries have additional licenses | [Release API](https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v1.4.3), [versioned runtime licenses](https://github.com/oven-sh/bun/blob/bun-v1.4.3/LICENSE.md) |
| postject | 1.0.0-alpha.6 | 2023-05-19 06:25:32.487 | MIT | [Registry time/manifest](https://registry.npmjs.org/postject), [versioned manifest](https://github.com/nodejs/postject/blob/v1.0.0-alpha.6/package.json) |
| esbuild | 0.28.2 | 2026-08-08 20:00:55.454 | MIT | [Registry time/manifest](https://registry.npmjs.org/esbuild) |
| @yao-pkg/pkg | 6.23.0 | 2026-09-29 08:48:27.992 | MIT | [Registry time/manifest](https://registry.npmjs.org/@yao-pkg%2fpkg) |

`better-sqlite3@13.0.3` requires Node >=22 and declares one runtime dependency,
`node-addon-api ^8.0.0`. Its pinned manifest has `gypfile: false`, includes
`prebuilds/**`, and has **no install/preinstall/postinstall script**. The task's
generic description of a `prebuild-install` installation is outdated for this
version. The complete installed graph and bundled prebuild remain subject to
integrity, provenance and license verification. `postject` requires Node >=14 and
depends on `commander ^9.4.0`; esbuild requires Node >=18 and declares a
postinstall script; `pkg` requires Node >=22 and declares 19 dependencies.
None of those declarations authorizes installation scripts. [Pinned better-sqlite3
manifest](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/package.json),
[postject metadata](https://registry.npmjs.org/postject/1.0.0-alpha.6),
[esbuild metadata](https://registry.npmjs.org/esbuild/0.28.2),
[pkg metadata](https://registry.npmjs.org/@yao-pkg%2fpkg/6.23.0).

The official arm64 archive checksums read from publisher checksum files are:

| Archive | SHA-256 |
| --- | --- |
| `node-v22.23.3-darwin-arm64.tar.gz` | `23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53` |
| `bun-darwin-aarch64.zip` | `80afd4c069b46a6fa8f3ec520bebc750a7843e4a8d5b9583d29ad436c00a3403` |

Sources: [Node SHASUMS256.txt](https://nodejs.org/dist/v22.23.3/SHASUMS256.txt),
[Bun SHASUMS256.txt](https://github.com/oven-sh/bun/releases/download/bun-v1.4.3/SHASUMS256.txt).
Both publishers also offer `.asc` checksum signatures. Bun's release API reports
the same archive digest; the ZIP asset size is 30,530,705 bytes. Verifying this
checksum metadata is distinct from verifying the downloaded archive or the
publisher's signature; the experiment must record those separately. [Node release
directory](https://nodejs.org/dist/v22.23.3/), [Bun release
assets](https://api.github.com/repos/oven-sh/bun/releases/tags/bun-v1.4.3).

## Packaging options screened

### A. Official Node SEA — keep for the experiment

Pinned Node 22.23.3 runs one embedded CommonJS script. Its injected `require`
loads builtins only; filesystem modules need `createRequire` or bundling.
`__filename` equals `process.execPath`. Generate the blob with the same Node
version as the executable, remove the original macOS signature, inject
`NODE_SEA_BLOB` using postject's `NODE_SEA` Mach-O segment and documented fuse,
then sign the result. SEA stability is 1.1, active development. Disable snapshots
and code cache initially to reduce changing build inputs; code cache also
prevents dynamic `import()`. Explicit `execArgvExtension: "none"` prevents
`NODE_OPTIONS` from extending the SEA runtime arguments. These are documented
capabilities, not a reproducibility or signing result. [Node 22.23.3 SEA
documentation](https://nodejs.org/download/release/v22.23.3/docs/api/single-executable-applications.html).

Esbuild can produce the one CommonJS bundle; the experiment must pin its binary
and inspect the actual metafile. Source maps cannot be assumed from bundling
alone: the pinned SEA main loader calls `maybeCacheSourceMap` when it finds a
source-map URL, so inline source maps plus enabled mapping have a source-backed
path to test. The thrown-error probe must still show the original TypeScript
file and line. [Versioned SEA
loader](https://github.com/nodejs/node/blob/v22.23.3/lib/internal/main/embedding.js).

### B. Bun compile — keep as the required comparison

The official compiler supports `bun-darwin-arm64`, build-time constants, embedded
source maps and explicitly required `.node` assets. Its runtime uses
JavaScriptCore, so Node compatibility is not runtime parity. Embedded SQLite
database assets are in-memory when compiled; changes do not persist after exit,
so the engine database must remain an external file. The current executable
documentation recommends JIT-related exceptions beyond `allow-jit`; this is not
proof that all are necessary for our candidate. Probe the minimum rather than
copying the example. These rolling docs were read while the site advertised
1.4.3; executable behavior must be checked on the pinned binary. [Official Bun
executable documentation](https://bun.com/docs/bundler/executables).

Bun's versioned license inventory identifies statically linked JavaScriptCore
under LGPL-2 and TinyCC under LGPL-2.1, among other linked-library licenses. The
npm `bun` wrapper's MIT field is insufficient distribution evidence. A shipping
Bun choice would require a full binary license/notice/relink assessment; the
Owner's 27 Rust exceptions do not grant an exception for these libraries.
Research probes add no Bun runtime to the product. [Bun 1.4.3 license
inventory](https://github.com/oven-sh/bun/blob/bun-v1.4.3/LICENSE.md).

### C. @yao-pkg/pkg — drop from the hands-on shortlist

Version 6.23.0 offers both a patched-Node Standard mode and an Enhanced SEA mode
using stock Node. It must not be described as only a patched-runtime tool.
Its native-addon path extracts code into a cache before loading, which adds a
writable executable location and signing/cache lifecycle to assess. For the
required small bundled entry, using the official SEA mechanism directly avoids
this extra packaging abstraction and its dependency graph. This is a project
maintenance/supply-chain inference, not a claim that `pkg` cannot work.
[Versioned mode comparison](https://github.com/yao-pkg/pkg/blob/v6.23.0/docs-site/guide/sea-vs-standard.md),
[versioned native-addon behavior](https://github.com/yao-pkg/pkg/blob/v6.23.0/docs-site/guide/native-addons.md).

### D. Official Node plus an esbuild resource bundle — retain as a contingency

Shipping Node and a JavaScript resource bundle avoids blob injection and keeps
the same runtime, but a launcher must locate both correctly and pass fixed
arguments. It is a multi-file deployment rather than the requested standalone
engine entry. Tauri supports external executables and resources, so this remains
a technically plausible contingency if SEA fails; the standalone requirement
would need an explicit architectural change. [Tauri sidecar
documentation](https://v2.tauri.app/develop/sidecar/).

### E. Deno compile — drop from this spike's hands-on shortlist

Deno officially supports compiling to `aarch64-apple-darwin` and npm/native-addon
packaging. A blanket claim that Deno cannot handle npm addons would be wrong.
It nevertheless adds a second runtime, a separate permission/packaging model and
another conformance surface to a project pinned to Node for development/tests.
No Deno version is selected or installed; compatibility risk is an inference
from the runtime change, not a measured incompatibility. [Official Deno compile
documentation](https://docs.deno.com/runtime/reference/cli/compile/).

### F. Rust engine rewrite — drop

ADR 0018 explicitly rejected a Rust engine to keep application logic in one
language. The thin Tauri shell does not authorize moving the workflow engine
into Rust. No performance comparison is needed to establish this project gate.

## SQLite options screened

| Driver | Screening | Evidence and limits |
| --- | --- | --- |
| `node:sqlite` on Node 22.23.3 | Keep; conditional default | Builtin synchronous database/statements, `exec`, `prepare`, `run/get/all`, explicit SQL transactions, and async online `backup`. Extension loading is opt-in. Required SQL features still need real probes. |
| `better-sqlite3@13.0.3` | Keep; fallback | Synchronous API, transactions, pragmas, backup, extension loading and explicit native binding. Companion Mach-O adds signing/path work. |
| `bun:sqlite` on Bun 1.4.3 | Keep for comparison | Synchronous prepare/query/run/get/all and transaction support. No backup method is exposed in the pinned JavaScript implementation; test SQL `VACUUM INTO`. |
| WASM SQLite | Drop from hands-on shortlist | Official browser persistence targets OPFS; its WAL requires exclusive locking and adds no concurrency benefit. A custom Node VFS could change the outcome, but proving OS-file locking and live backup is extra work with no present requirement. No unsupported universal speed claim is made. |

For `node:sqlite`, the pinned API has stability 1.1 and is no longer flag-gated
since 22.13. `DatabaseSync` defaults foreign keys on and busy timeout to zero,
so the probe sets its own values. `allowExtension` defaults false; enabling it
later is forbidden unless the connection was constructed with permission.
`backup` copies in batches and returns a Promise; external-connection writes
can restart it. FTS5 is explicitly enabled in Node's pinned SQLite build.
[Node 22.23.3 API](https://nodejs.org/download/release/v22.23.3/docs/api/sqlite.html),
[SQLite build flags](https://github.com/nodejs/node/blob/v22.23.3/deps/sqlite/sqlite.gyp).

`better-sqlite3`'s pinned default entrypoint accepts an already loaded addon
object as `nativeBinding`; its binding resolver returns that object directly.
Platform-specific entrypoints reject this option. Thus the fallback recipe can
bundle the JS wrapper, load the separate signed `.node` with `process.dlopen`
using a path derived from `process.execPath`, and pass the resulting exports to
the constructor. Its online backup can proceed while the connection is in use,
but writes from a different connection restart copying. [Pinned constructor](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/lib/database.js),
[binding resolver](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/lib/binding.js),
[backup API](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/docs/api.md#backupdestination-options---promise).

Bun's pinned implementation exposes `loadExtension`, `serialize` and
`setCustomSQLite`, with no `backup` method. Its current official docs say macOS
uses Apple's SQLite and extension loading requires a custom SQLite dylib. Record
the actual `sqlite_version()` and extension failure on macOS 26; do not silently
install Homebrew or add a dylib to improve the candidate. [Pinned Bun SQLite
implementation](https://github.com/oven-sh/bun/blob/bun-v1.4.3/src/js/bun/sqlite.ts),
[Bun SQLite documentation](https://bun.com/docs/runtime/sqlite).
The WASM rejection above is specifically about the official OPFS persistence
design, not every possible WASM VFS. [SQLite WASM persistence](https://sqlite.org/wasm/doc/trunk/persistence.md).

WAL permits concurrent readers and a writer, but only one writer at a time;
`synchronous=NORMAL` has a power-loss durability tradeoff. Online backup can
restart under external writes and potentially starve, so the probe must bound
the writer duration and verify the resulting backup, not just its existence.
FTS5 supports `MATCH` and `ORDER BY rank`; JSON functions are independently
documented. [SQLite WAL](https://www.sqlite.org/wal.html),
[SQLite backup](https://www.sqlite.org/backup.html),
[FTS5](https://www.sqlite.org/fts5.html), [JSON](https://www.sqlite.org/json1.html).

## macOS signing, sidecars and privacy pitfalls

Apple's hardened runtime permits library loading from Apple or the executable's
own Team ID by default. Sign a companion addon with the same Developer ID as the
engine and retain library validation. Ad-hoc signing cannot establish this
Developer ID/Team ID result. `allow-jit` permits `MAP_JIT` memory; only measured
necessary exceptions belong on the engine executable, not automatically on the
Rust shell or addon. [Library validation](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.disable-library-validation),
[JIT entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-jit).

Node's pinned upstream development entitlements include JIT, unsigned executable
memory, disabled executable-page protection, DYLD environment variables, disabled
library validation and `get-task-allow`. That file is **not** a safe release
template. Measure the arm64 SEA with `allow-jit` alone first; retain failures as
evidence if more is needed. [Pinned Node entitlements](https://github.com/nodejs/node/blob/v22.23.3/tools/osx-entitlements.plist).

Apple requires valid signatures on all distributed executables, Developer ID,
hardened runtime, secure timestamps, and no enabled `get-task-allow` for normal
notarization. Sign nested code inside out; `--deep` is appropriate for recursive
verification, not the production signing strategy. The spike host has no usable
Developer ID Application identity, as reported by the experiment owner:
**not notarized, ad-hoc signed only** must be stated for its results. A successful
ad-hoc signature or direct execution after setting quarantine is not a successful
notarized Gatekeeper distribution test. [Apple notarization](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution),
[inside-out signing](https://developer.apple.com/library/archive/technotes/tn2206/).

Use the task's exact sidecar basename with the target-triple suffix in the
scratch build and inspect the final bundle. For the addon contingency, resolve
`../Resources/engine/native/better_sqlite3.node` from the executable directory in
`Contents/MacOS`; test the actual packaged path rather than a working-directory
assumption. The official Tauri guide specifies target-suffixed external binary
inputs. [Tauri sidecars](https://v2.tauri.app/develop/sidecar/).

Documents access is affected by consent and code attribution, not just POSIX
permissions. Apple documents implicit consent for an app-created file and for a
file selected via an Open panel. Therefore, reading the probe's own synthetic
file and receiving no prompt cannot prove prompt behavior for arbitrary existing
user files. Report the exact launch path and synthetic-file provenance; do not
inspect personal data or reset the user's privacy database. The signed
LaunchAgent experiment is still required; signing alone does not settle its
privacy behavior. [Documents usage description](https://developer.apple.com/documentation/bundleresources/information-property-list/nsdocumentsfolderusagedescription).

## Experiment evidence and recipe identity

Host: arm64 macOS 26.5.1 (25F80), Xcode 26.6 (17F113), Node 22.23.3,
pnpm 12.11.2, Vitest 5.0.4. No Developer ID Application identity was available.
Runtime archives were downloaded through the existing `installResource` verifier
with the SHA-256 values above. Publisher signature verification was not performed.
The nested lock installs six packages, including the platform esbuild executable,
commander and node-addon-api, with installation scripts disabled; no dependency
or package is added to DEVELOP by this task. Runtime third-party notices must
still be handled by SETUP017; the Rust exceptions do not cover Node/Bun binaries.

Retained spike branch: `spike/OVE_SETUP011`, final source/evidence commit
`ba898762b78a2bc95bc09f270f96c665495daeea`. It must never be merged or deleted. The ten-run baseline is
commit `6b6a9b6a8208a4e6b75669f418a5d04c285d158d`; its source differs from the
final recipe. [Retained evidence](https://github.com/wojciechlesniak/overmind/tree/ba898762b78a2bc95bc09f270f96c665495daeea/spike/evidence)
contains immutable raw results and their derived summary.

- Baseline A/B: absolute SEA `main`, esbuild CJS with inline maps, no snapshots
  or code cache. A's mapped stack passed, but absolute build paths broke hashes.
- Baseline C: Bun compiled that CJS bundle; its stack stopped at generated CJS.
- Revised A/B: relative `main`/`output`, canonical virtual source identities and
  fixed sourceURL. A's pre-sign and signed hashes match across two builds at the
  same output path; cross-directory reproducibility was **not measured**. Its
  automatic TypeScript stack mapping fails. Offline symbolication of an actual
  thrown stack with Node's public SourceMap API **passes**; no eval or global
  Error hook is used. SETUP017 must solve/verify this tradeoff before shipping.
- Revised C: Bun compiles TypeScript directly with inline maps and embedded
  version constants; its TypeScript stack passes. Neither revised recipe received
  ten repeated timing measurements before exploration stopped.
- LaunchAgent results use the intermediate relative-main recipe recorded in
  `relative-main-builds.txt`, before Node's canonical-map change. They must not
  be attributed to the final Node binary hash.

### Probe matrix

PASS refers to actual assertions/output; NM means not measured, with the reason
in the cell or the notes below. B's addon cannot load with the ad-hoc Team IDs
under hardened library validation; this is not proof that real same-Team-ID
Developer ID signing fails. No library-validation exception was enabled.

| Probe | A: SEA + node:sqlite | B: SEA + better-sqlite3 | C: Bun + bun:sqlite |
| --- | --- | --- | --- |
| (a) WAL/busy/FK/NORMAL | PASS, 10 baseline runs | NM: addon load denied | PASS, 10 baseline runs |
| (b) FTS5 MATCH/ranking | PASS, 10 | NM: addon load denied | PASS, 10 |
| (c) 100,000 transaction inserts | PASS, 10 | NM: addon load denied | PASS, 10 |
| (d) indexed reads | PASS, 100 selected rows/run | NM: addon load denied | PASS, 100 rows/run |
| (e) consistent active-writer backup | PASS, VACUUM INTO and async backup API | NM: addon load denied | PASS, VACUUM INTO; API unavailable |
| (f) user_version | PASS, 11 | NM: addon load denied | PASS, 11 |
| (g) JSON extraction | PASS, 42 | NM: addon load denied | PASS, 42 |
| (h) no-op loadExtension | FAIL to load; API present | NM: addon load denied | FAIL: macOS SQLite extension loading unavailable |
| (i) Unix socket 0600/response | PASS | FAIL before socket, addon denied | PASS |
| (j) child output | PASS, child-ok | NM: addon load denied | PASS, child-ok |
| (k) embedded version/protocol | PASS, mismatch exits 30 | PASS, version mode needs no addon | PASS, mismatch exits 30 |
| (l) SIGTERM within 2s | PASS, worst 5.283ms | NM: cannot serve | PASS, worst 2.901ms |
| (m) survives parent exit | PASS, once | NM: cannot serve | PASS, once |
| (n) TypeScript stack | Baseline PASS; revised automatic FAIL, offline PASS | NM: sentinel not exercised | Baseline FAIL; direct-TS revision PASS |
| (o) signed LaunchAgent/Documents | Own created marker read PASS; prompt attribution NM | INCONCLUSIVE, no output within deadline | INCONCLUSIVE, no output within deadline |

SQLite versions were 3.51.3 (A) and 3.51.0 (C). Backups were opened and checked
with `integrity_check`; row counts and JSON consistency were checked while a
separate writer increased the live row count. The Node backup API was awaited.
The writer is bounded and terminated by the harness. Extension loading is a
future sqlite-vec capability probe, not a default-selection condition. Node's
reported extension error includes an appended `.dylib` path; its deeper cause was
not resolved. Future extension support must be separately tested without relaxing
library validation. Production connections should keep extension loading disabled.

### Measurements

Ten baseline repetitions for A/C; B stops after its first startup failure.
Each cell is **median / worst**. MB means decimal bytes / 1,000,000; RSS is MiB.
Worst throughput is the minimum; all other worst values are maxima. Exact raw
values and extrema are retained in `baseline-summary.json` and the NDJSON below.
Fresh-process startup was measured after a version preflight: file/trust caches
were warm. **OS-cold startup and first Gatekeeper launch were not measured.**

| Measurement | A | B | C |
| --- | --- | --- | --- |
| Executable size, MB | 114.695 / 114.695 | 114.711, one revised build only | 72.029 / 72.029 |
| Companion size, MB | 0 | 1.987, one revised build only | 0 |
| Build including ad-hoc sign/verify, ms | 8898.646 / 10806.101 | NM ten-run result: startup failure | 672.381 / 1230.292 |
| Fresh-process socket ready, ms | 68.113 / 109.165 | NM: addon load denied | 29.707 / 33.324 |
| Idle RSS after 30s, MiB | 68.094 / 72.469 | NM: addon load denied | 22.875 / 22.984 |
| Insert 100,000 rows, ms | 141.206 / 175.879 | NM: addon load denied | 128.492 / 182.852 |
| Insert rows/s | 708245.198 / 568573.116 | NM: addon load denied | 778334.627 / 546891.380 |
| Indexed read of 100 rows, ms | 0.123 / 0.185 | NM: addon load denied | 0.237 / 0.267 |
| SIGTERM to exit, ms | 4.015 / 5.283 | NM: cannot serve | 2.174 / 2.901 |
| LaunchAgent socket ready, ms | 123.320 / 402.102, 10 runs | FAIL first run | 62.218 / 120.851, 10 runs |

A RSS spans 41.875–72.469 MiB and startup 65.185–109.165ms; C insert latency spans
120.712–182.852ms. These variations are retained, not discarded. LaunchAgent
polling is approximately 50ms, so those values include harness quantization.

| Additional check | Actual result / missing evidence |
| --- | --- |
| Hardened signing | All candidates: ad-hoc hardened runtime with only allow-jit; codesign --verify --deep --strict passes. B then fails actual addon loading. |
| Secure timestamp / Developer ID / notarization | **Not notarized, ad-hoc signed only**; no identity available, --timestamp=none used. No notary credentials used. |
| Quarantined bundle copy | NM: experiment stopped at time cap; no Gatekeeper distribution claim. SETUP014 must test. |
| Tauri scratch bundle build | NM: experiment stopped at time cap; fit explained below. SETUP017 must demonstrate. |
| Revised recipe ten-run repetition | NM: experiment stopped; baseline timings cannot validate revised source-map/reproducibility recipe. |
| Reproducibility | Baseline all A/C pre-sign hashes differ. A identical CJS bundles yielded SEA blobs differing at byte 66 (absolute main path). Revised A same-path two-build pre-sign SHA-256: 00f7527d566a3e8761e255906396681156d7d92a0788682fbc7f858f584af225; different-directory equality NM. |
| First launch transient | One revised version launch timed out after replacing an executed output. A fresh generated inode and subsequent version check passed; stale signature state remains a hypothesis. |
| Runtime argument injection | Revised relocated A ignored an invalid NODE_OPTIONS --require and returned its version, with execArgvExtension none. |
| Adapter Vitest on Node 22.23.3 | Four real tests pass: pragmas, FTS/JSON/migration/row absence, constraint rollback, awaited backup integrity. |
| Bun adapter parity | NM under Vitest: Node cannot import bun:sqlite; the Node suite imports node:sqlite. Bun's compatibility version reports Node 26.3.0, not the tested Node 22.23.3. A shipping split would require the same contract suite under both runtimes, separate harness/config and CI job (TEST003), not a Node-only result. |
| Inspector | NM: time cap. No production inspector argument/entitlement is granted. |
| TCC attribution | A read only its own newly created nonsensitive Documents marker. B/C timed out without output; existing user files and prompt attribution NM. Temporary agents and marker were removed; no permissions were granted or reset. |

### Tauri fit and follow-up obligations

SETUP010 now supplies the Tauri shell, but an actual scratch bundle was not built.
The documented fit is one input executable
`apps/desktop/src-tauri/binaries/overmind-engine-aarch64-apple-darwin`, declared
without its target suffix in `bundle.externalBin`, placed by Tauri under
`Contents/MacOS/`. Node SEA needs no external JS/blob at runtime. SETUP017 must
verify the actual bundle path and execution, not infer success from this layout.
Fallback B's probe physically used
`Contents/Resources/engine/native/better_sqlite3.node`, resolved relative to
`process.execPath` and loaded via `process.dlopen`; library validation rejected
its ad-hoc Team IDs. SETUP014 must demonstrate same-Team-ID Developer ID signing
before that fallback could ship, without disable-library-validation. Resource
notices/source maps/manifests belong in Resources, without treating them as
writable executable code. [Tauri external binary layout](https://v2.tauri.app/develop/sidecar/).

### Scores and default applied

Scores are engineering judgments from the partial evidence, **not passing gates**.
0 means no demonstrated capability in this environment; unmeasured release
signing limits every signing score. `score * weight / 5` gives weighted points.
Only A/B/C reached the required hands-on shortlist; scores apply
to A/B/C only, with the separate rejection reasons above governing the others.

| Criterion (weight) | A | B | C | Reason |
| --- | --- | --- | --- | --- |
| Runtime parity (20) | 5 | 5 | 1 | Node exact match; Bun has a separate runtime/test surface. |
| SQLite correctness (20) | 5 | 0 | 4 | A required gates and native backup pass; B denied; C VACUUM passes, no backup API. |
| Signing/notarization (15) | 3 | 1 | 2 | Ad-hoc only; B addon denied; C also has binary-license work. |
| Sidecar/process model (10) | 3 | 1 | 3 | A/C detach/LaunchAgent pass; actual Tauri bundle remains unmeasured. |
| Startup/RSS (10) | 3 | 0 | 5 | Baseline C faster/smaller resident set; B cannot serve. |
| Reproducibility/supply chain (10) | 3 | 2 | 2 | Official verified inputs; corrected cross-directory hashes unmeasured; B addon/C runtime add inputs. |
| Debugging (5) | 2 | 1 | 4 | A offline mapping works but automatic mapping conflicts with recipe; C direct TS works; inspector unmeasured. |
| Maintenance (5) | 4 | 3 | 3 | A one runtime/driver provider; B native addon; C second runtime and contracts. |
| Size (5) | 2 | 2 | 4 | Baseline A 114.7MB vs C 72.0MB; B also ships addon. |
| **Weighted total / 100** | **75** | **35** | **57** | B dropped from current viable shortlist due addon startup denial. |

**Default applied**: A passed (a), (b), (e), (f), (g), so the task's explicit
conditional default selects Node SEA plus node:sqlite. Missing release and
revised-recipe measurements prevented a complete comparison. B's contingency is
unneeded because the built-in gates passed. C has neither a >15-point lead nor
Owner approval of a runtime split; its linked licenses have no approved exception.
This decision chooses the implementation direction for later tasks, not release
readiness. The accepted ADR preserves the unresolved signing, TCC, Tauri fit,
source-map and cross-directory reproducibility checks for their owning tasks.

### Commands and verbatim raw output

Executed with the pinned Node/pnpm PATH and COREPACK_HOME; no install scripts,
privacy reset or weakened signing settings:

```sh
pnpm install --frozen-lockfile
node spike/prepare.mjs
pnpm exec tsx spike/probe.ts
pnpm exec tsx spike/build.mjs --build-once
pnpm exec tsx spike/build.mjs --candidate A
pnpm exec tsx spike/symbolicate.mjs 0
pnpm exec vitest run --config spike/vitest.config.ts
python3 spike/platform-probe.py
codesign --force --options runtime --timestamp=none --entitlements spike/engine.plist --sign - <executable>
codesign --verify --deep --strict <executable>
```

The original benchmark ran at the baseline commit. The current branch command
reruns the revised recipe; a retention-only fix moved tool manifests under ignored
node_modules and changed driver selection to compiler plugins after measurements.
These plumbing changes are not additional measured performance evidence; select the baseline commit in a separate checkout to
reproduce the original recipe. Commands rebuilding binaries need the pinned
runtime archives/cache and Xcode; see the retained branch README.

The following NDJSON is the unmodified 21-record baseline probe output, including
B's failure. Paths and hashes intentionally retain the actual experiment inputs.

```jsonl
{"candidate":"A","iteration":1,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/1/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"68fbd92459931c8222c1adb3b17a0b9901b94e2bc8047552feb6ddcd78fd18f6","signedHash":"2fb10ded2dba9ed74d7c890c26a3d9c319ae4eab2c7ce7145cb87292dc82ffc8","buildMs":10287.504167000001,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":65.18454100000054,"idleRssMiB":41.875,"shutdownMs":5.282541999993555,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":139.36483399999997,"rowsPerSecond":717541.1266230907,"indexedReadRows":100,"readMs":0.10954200000000469,"before":100100,"backupCount":100100,"after":100800,"integrity":"ok","apiBackup":100400,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":2,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/2/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"32b0a882d8824b4036a4196e632f4fde7ac99238b521eac4a658e5da8d9f743a","signedHash":"35f06ce2ad69e496acf4e947c4f6d245a3e73457e4682bb57d2f9dc4fadde4fa","buildMs":8983.579667000005,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":67.91225000000122,"idleRssMiB":72.46875,"shutdownMs":4.00312500000291,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":139.05066599999998,"rowsPerSecond":719162.3231779416,"indexedReadRows":100,"readMs":0.1846670000000188,"before":100100,"backupCount":100100,"after":100900,"integrity":"ok","apiBackup":100400,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":3,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/3/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"f6868bd73a60e165c9b346e0eeabe0263504b9688e1bdb7f86968e85b44ef547","signedHash":"cd2bc1b44f92e106c1f9bb44bb87b2e93fd8d3ceeac6bf8e08a70c84b781e50d","buildMs":8404.498082999999,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":65.33887499998673,"idleRssMiB":71.1875,"shutdownMs":4.188792000000831,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":136.44320900000002,"rowsPerSecond":732905.658939757,"indexedReadRows":100,"readMs":0.11466699999999719,"before":100100,"backupCount":100100,"after":100800,"integrity":"ok","apiBackup":100400,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":4,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/4/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"150762dea6db7d655128dbdc37721fdabc0393eeb771251c2f4b0b728ddd0275","signedHash":"96cf0c9100a735566f40c2595884acc90124643695247fdbd19ffd9fc3db0e96","buildMs":8217.452083000011,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":74.17758400001912,"idleRssMiB":67.171875,"shutdownMs":3.4260829999984708,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":139.889833,"rowsPerSecond":714848.233466688,"indexedReadRows":100,"readMs":0.11983299999999986,"before":100100,"backupCount":100100,"after":100900,"integrity":"ok","apiBackup":100400,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":5,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/5/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"5c9cba15c5e91906dfb26c6a70db3b4e3c45f127d2ce36ebb99e3536bc4d7e82","signedHash":"abdb4aa6cd3710ef70319df439027bb062009ecdba7c67459e5d3673e6af8e84","buildMs":9028.490832999989,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":79.40562500001397,"idleRssMiB":45.984375,"shutdownMs":4.814582999999402,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":153.747375,"rowsPerSecond":650417.6087559218,"indexedReadRows":100,"readMs":0.13433299999999804,"before":100100,"backupCount":100100,"after":100900,"integrity":"ok","apiBackup":100400,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":6,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/6/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"3e195429b58092682fe7ce1244f509691a904ae5df8a7bb87fb8579c70e36a14","signedHash":"6a8e0288d8c1b347422f9237ee8fe16357f26ad286cdcdaf243c63d68a6c7fbb","buildMs":10806.100542,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":109.16520799999125,"idleRssMiB":47.6875,"shutdownMs":4.918166999996174,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":175.87887499999997,"rowsPerSecond":568573.1160152123,"indexedReadRows":100,"readMs":0.11595899999997528,"before":100100,"backupCount":100100,"after":100900,"integrity":"ok","apiBackup":100500,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":7,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/7/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"e774619cc04dac66350c0365070a082ee36f7ad31d1469af5dd7c931d5fbb8cc","signedHash":"152a2ad20adf77a0b1b2bd33e6817fe240a2a4250118d8d86855caca3c3d04c8","buildMs":9093.94524999999,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":74.00066600000719,"idleRssMiB":48.71875,"shutdownMs":3.536791999998968,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":145.73920800000002,"rowsPerSecond":686157.1527134962,"indexedReadRows":100,"readMs":0.12291700000000105,"before":100100,"backupCount":100100,"after":100900,"integrity":"ok","apiBackup":100400,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":8,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/8/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"7a7b75e52bd97f5f6d9638efcc7cabb09fa4c09edfe7242b25cfdfac9cb2bb80","signedHash":"aa1aa5a73aa4558a84f3a5bae0041ed45539c3ffcfc241f102be9e0d1b89c40d","buildMs":8813.71220900002,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":65.66833299997961,"idleRssMiB":69.15625,"shutdownMs":3.0139169999747537,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":174.04375,"rowsPerSecond":574568.1761051461,"indexedReadRows":100,"readMs":0.12650000000002137,"before":100100,"backupCount":100100,"after":101000,"integrity":"ok","apiBackup":100500,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":9,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/9/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"8bf7472729ec6100eced710464a092a0d89eb6457b9eb2b123d11af6a57da755","signedHash":"1203a268eaf46a25c02659c019ac8350bd5e387fc6fdcc6ccc893485738f181e","buildMs":8428.054250000045,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":66.37424999999348,"idleRssMiB":71.53125,"shutdownMs":3.9213749999762513,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":142.522792,"rowsPerSecond":701642.1626093319,"indexedReadRows":100,"readMs":0.14683299999998667,"before":100100,"backupCount":100100,"after":100900,"integrity":"ok","apiBackup":100400,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"A","iteration":10,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/A/10/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"e0d305e0916e51c78e5abe922bd169fb244ca06409b2a7fc1d2132d24f16978f","signedHash":"d46e05e7a55bcfb457c2ac04d230bd4687b475f3f24be1e4250acac76476eaf9","buildMs":8449.940375000006,"executableBytes":114694736,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"node:sqlite","node":"22.23.3"},"startupMs":68.31445800000802,"idleRssMiB":69.015625,"shutdownMs":4.027708999987226,"sourceMapped":true,"features":{"driver":"node:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":136.664208,"rowsPerSecond":731720.4809030906,"indexedReadRows":100,"readMs":0.12333300000000236,"before":100100,"backupCount":100100,"after":100800,"integrity":"ok","apiBackup":100400,"userVersion":11,"jsonValue":42,"extension":"dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib, 0x000A): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/noop.dylib.dylib' (","childOutput":"child-ok","sqlite":"3.51.3"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"B","iteration":1,"error":"Engine exited before ready: Error: dlopen(/private/tmp/overmind-OVE-011-spike/spike/dist/B/1/Contents/Resources/engine/native/better_sqlite3.node, 0x0001): tried: '/private/tmp/overmind-OVE-011-spike/spike/dist/B/1/Contents/Resources/engine/native/better_sqlite3.node' (code signature in <C87A9325-F748-3E31-91DC-18CFB1217A68> '/private/tmp/overmind-OVE-011-spike/spike/dist/B/1/Contents/Resources/engine/native/better_sqlite3.node' not valid for use in process: mapping process and mapped file (non-platform) have different Team IDs), '/System/Volumes/Preboot/Cryptexes/OS/private/tmp/overmind-OVE-011-spike/spike/dist/B/1/Contents/Resources/engine/native/better_sqlite3.node' (no such file), '/private/tmp/overmind-OVE-011-spike/spike/dist/B/1/Contents/Resources/engine/native/better_sqlite3.node' (code signature in <C87A9325-F748-3E31-91DC-18CFB1217A68> '/private/tmp/overmind-OVE-011-spike/spike/dist/B/1/Contents/Resources/engine/native/better_sqlite3.node' not valid for use in process: mapping process and mapped file (non-platform) have different Team IDs)\n    at openDatabase (/private/tmp/overmind-OVE-011-spike/spike/driver-better.ts:7:11)\n    at main (/private/tmp/overmind-OVE-011-spike/spike/entry.ts:51:14)\n    at <anonymous> (/private/tmp/overmind-OVE-011-spike/spike/entry.ts:100:1)\n    at embedderRunCjs (node:internal/main/embedding:89:10)\n"}
{"candidate":"C","iteration":1,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/1/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"39b97db5affd785510ab83c312db98088859641e7f735c484d1ad587d8e0a828","signedHash":"c71e4cc88911532ece22a8997a486a9a1b94c1a4543eaec98131f86b41082f1b","buildMs":1230.2920840000152,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":29.7515419999836,"idleRssMiB":22.890625,"shutdownMs":1.903374999994412,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":129.738291,"rowsPerSecond":770782.4669896414,"indexedReadRows":100,"readMs":0.22499999999999432,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":2,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/2/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"c11233587df5ea5bad667119308461e8095df0360c2a0e41a1814508c08dd833","signedHash":"bc2da09d72c4e9bfc5a22f8c2fe7ed780ef54986f653a384bba1370ce2be7fa8","buildMs":526.3250000000116,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":30.539208000001963,"idleRssMiB":22.921875,"shutdownMs":1.8207920000422746,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":122.67616699999999,"rowsPerSecond":815154.2589360492,"indexedReadRows":100,"readMs":0.23962499999998954,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":3,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/3/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"792eb87503fa5aac896a80b2d754e821f9b5e2afde7ae81a54b14def796aead1","signedHash":"9ffcc61278d5eb11273be9bbd9acbc3060952f4cd1b3716f9cbd547fa5063cac","buildMs":660.3686250000028,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":29.54958299995633,"idleRssMiB":19.90625,"shutdownMs":2.126542000041809,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":136.56829199999999,"rowsPerSecond":732234.3901027921,"indexedReadRows":100,"readMs":0.2412080000000003,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":4,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/4/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"0e6343a3795e6017db5c72cf245d80ed47ad780d8f7cf365ed9e95825630a6a4","signedHash":"b528b9eaf54f1e230c540c08714b1274d7eb8f1caae205886be569ca10425e6c","buildMs":701.8882919999887,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":33.32358299999032,"idleRssMiB":22.859375,"shutdownMs":1.946250000037253,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":134.911167,"rowsPerSecond":741228.4855559807,"indexedReadRows":100,"readMs":0.2294170000000122,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":5,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/5/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"b5fcc86c484540a9e99db2decf0e5ec2cc1f8f2ca9bd7c4308613454c3c585fd","signedHash":"e00d5154e89b201a4da9c71683bb3f5f4377efaaf2be2082e56b4ca3ac611aa6","buildMs":1034.390207999968,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":29.022457999992184,"idleRssMiB":22.734375,"shutdownMs":2.493125000037253,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":182.851666,"rowsPerSecond":546891.3802513563,"indexedReadRows":100,"readMs":0.24141700000001265,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":6,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/6/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"3d352dc325cedd9bd456c778cc555306d996d16039fb88c138d0bff66a3ca701","signedHash":"1234b67002c47f79a301ac836274ffad62d26122f6eb72103123a781c0e185ad","buildMs":679.6355840000324,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":28.54350000002887,"idleRssMiB":19.453125,"shutdownMs":2.2578750000102445,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":120.71237500000001,"rowsPerSecond":828415.4793574394,"indexedReadRows":100,"readMs":0.22991700000000037,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":7,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/7/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"11c1014d9f4e57a25c7ba794579ce4d6589bdf35fbc6db83f91ff122dd6a108b","signedHash":"e82e47e099b83e585eed725bcc8d8df2316395deca2be1d27b77391cb97351a2","buildMs":687.048375000013,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":29.570958000025712,"idleRssMiB":22.90625,"shutdownMs":2.220833000028506,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":127.24479099999999,"rowsPerSecond":785886.787302751,"indexedReadRows":100,"readMs":0.23537500000000477,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":8,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/8/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"42bed193f046d79095e3556fd9827122cba509d914bc02b52e79c7fc60ccda03","signedHash":"049b6bf161b8735c31887f5f608a7d522728c31ce01f6934dc37f7bf16dfb939","buildMs":665.1269579998916,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":29.66266699996777,"idleRssMiB":22.9375,"shutdownMs":2.9007079999428242,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":123.62812499999998,"rowsPerSecond":808877.4297919669,"indexedReadRows":100,"readMs":0.254792000000009,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":9,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/9/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"9471870850158174d5cf9b34a6db10072687070080d07b91370586d62da8510a","signedHash":"3ab2d1589173d385510214a621f3967e83e635951d0e21608c8f9acb96f7e9df","buildMs":660.7057499999646,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":30.599374999990687,"idleRssMiB":22.984375,"shutdownMs":1.9904170000227168,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":130.637542,"rowsPerSecond":765476.741747024,"indexedReadRows":100,"readMs":0.23191599999998402,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
{"candidate":"C","iteration":10,"executable":"/private/tmp/overmind-OVE-011-spike/spike/dist/C/10/Contents/MacOS/overmind-engine","companions":[],"unsignedHash":"431c9858f466012f363fdd1286be27096c3ca368c1be59313d536efb5467f7bb","signedHash":"db074b70d2e4975b8c6f945b5bc298d7c2c1f85397ec2d6723a201e5f354834e","buildMs":634.7771669999929,"executableBytes":72028592,"companionBytes":0,"version":{"version":"0.0.0-ove011","protocol":1,"driver":"bun:sqlite","node":"26.3.0"},"startupMs":30.211875000037253,"idleRssMiB":22.859375,"shutdownMs":2.54625000001397,"sourceMapped":false,"features":{"driver":"bun:sqlite","pragmas":{"journal_mode":"wal","busy_timeout":5000,"foreign_keys":1,"synchronous":1},"fts":"pass","insertRows":100000,"insertMs":122.98808299999999,"rowsPerSecond":813086.9069647993,"indexedReadRows":100,"readMs":0.2667080000000226,"before":100100,"backupCount":100100,"after":100700,"integrity":"ok","apiBackup":"unavailable","userVersion":11,"jsonValue":42,"extension":"This build of sqlite3 does not support dynamic extension loading","childOutput":"child-ok","sqlite":"3.51.0"},"signing":"ad-hoc hardened runtime, allow-jit only; not notarized"}
```

Actual final Node offline symbolication output (not automatic Error.stack mapping):

```text
(node:29441) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `overmind-engine --trace-warnings ...` to show where the warning was created)
Error: OVE011_SOURCE_MAP_SENTINEL
    at probeMappedFailure (file:///overmind/source/spike/entry.ts:15:9)
    at main (file:///overmind/source/spike/entry.ts:32:9)
    at file:///overmind/source/spike/entry.ts:106:1
    at embedderRunCjs (node:internal/main/embedding:89:10)
```

Actual Node adapter test output:

```text

 RUN  v5.0.4 /private/tmp/overmind-OVE-011-spike

(node:29315) ExperimentalWarning: SQLite is an experimental feature and might change at any time
(Use `node --trace-warnings ...` to show where the warning was created)

 Test Files  1 passed (1)
      Tests  4 passed (4)
   Start at  20:09:45
   Duration  220ms (import 56%, transform 25%, tests 16%, worker 3%)
```

LaunchAgent raw outputs, later build logs and argument-denial/relocation diagnostics
are retained under the immutable spike commit above. No failed or unavailable
probe is presented as passed.

## Independent review confirmation

Standards/security and Spec reviews found zero actionable issues at documentation
commit `054815319c049a186c5ddbee172cd48a80d03637` against DEVELOP base
`3fbc902e8fc278f27b40007d0913a66e5e1de108`. Both explicitly recognized the time-cap
overrun and the permitted default with incomplete measurements.

The Spec reviewer executed the existing revised A/0 binary once, without a
rebuild: 100,000 inserts in 152.839ms (654,284 rows/s), 100 indexed rows in 0.118ms.
WAL/FK/NORMAL, ranked FTS5, active-writer backups, migration and JSON passed;
backup integrity was `ok`. Strict codesign verification passed. Its size was
114,612,656 bytes (different recipe from the baseline size table), and signed
SHA-256 matched `d1bc4446698f2617fc2ce1d3979ec3a19803b252ed7a8c22fc827e8595a0e5ec`.
After the retention fix, all four adapter tests were rerun with the isolated
Vitest configuration and passed. This is a single post-experiment review verification, not a ten-run repeat or
an additional distribution claim. The reviewer's own temporary data was removed.

## Follow-up contract and revisit triggers

The driver-neutral port needed by DATA is `exec`, prepared `run/get/all`,
transaction, pragma, `backupTo(path)` and `close`. Domain/application code must
not expose `DatabaseSync`, Bun database objects or addon types. The adapter must
define row absence, integer precision, transaction rollback and backup completion
semantics once and run the same conformance checks against the chosen driver.

The accepted ADR names exact follow-up files for SETUP016/017/014 and states the
embedded engine/app protocol version check with exit code 30. Keep inspector and
runtime argument injection out of production defaults. If Bun were selected,
Node cannot import `bun:sqlite`; the contract suite needs both runtimes, and a
Node Vitest result alone cannot validate that adapter.

Node 22 entered maintenance on 2025-10-21 and its scheduled EOL is 2027-04-30.
Revisit before that date, when `node:sqlite` stability changes, after material SEA
or Bun changes, if mandatory SQLite probes regress, or if Developer ID signing
requires broader exceptions than measured here. [Official Node release
schedule](https://github.com/nodejs/Release/blob/main/schedule.json).
