---
id: OVE_SETUP016
title: apps/engine scaffold - CLI contract, version stamping and bundling entry
area: SETUP
kind: infra
size: S
priority: P0
mvp: true
status: in_review
depends_on: [OVE_SETUP001, OVE_SETUP002, OVE_SETUP011]
soft_depends_on: [OVE_SETUP004, OVE_SETUP010]
provides: ["lib:engine-scaffold", "lib:engine-cli-contract", "lib:engine-version-info"]
needs: []
owns:
  - apps/engine/src/main.ts
  - apps/engine/src/cli.ts
  - apps/engine/src/exit-codes.ts
  - apps/engine/src/version.ts
  - apps/engine/src/commands/**
  - apps/engine/build/bundle.mjs
  - apps/engine/tsconfig.json
  - apps/engine/README.md
reads: ["docs/adr", "docs/research/engine-packaging-spike.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 18]
---

# OVE_SETUP016: apps/engine scaffold - CLI contract, version stamping and bundling entry

## 1. Summary

Create the entry point of the engine process: a dependency-free command-line front (`run`, `ensure-running`, `version`) with a fixed exit-code contract, build-time version stamping, and an esbuild bundling entry that produces the single file that OVE_SETUP017 turns into the standalone executable. The engine's real composition root, gateway and service management are filled in by the ENGINE area behind this front.

## 2. Context

ADR 0005 and 0018: the engine is a separate process, packaged as a standalone executable, independent of the window. OVE_SETUP010 defines the contract the Tauri shell relies on: `overmind-engine ensure-running --json` exits 0/10/20/30 and prints one JSON line. The packaging method and SQLite driver are decided by OVE_SETUP011 (default: Node SEA from the pinned Node 22.23.3, built-in `node:sqlite`); this task keeps source code runtime-neutral (only `node:` APIs) so a packaging change touches `build/` only. The composition root (`apps/engine/src/compose/`) belongs to ENGINE/ARCH006; this task leaves a documented hook.

## 3. Scope (in)

- `src/main.ts` (entry), `src/cli.ts` (argument parsing with `node:util.parseArgs`), `src/exit-codes.ts`, `src/version.ts`, `src/commands/{run,ensure-running,version}.ts`.
- `build/bundle.mjs` (esbuild, bundle to one file, define version constants, source maps external).
- `tsconfig.json` for the app (Node types), `README.md` with the command contract.
- `apps/engine/package.json` additions (scripts `build`, `start`; devDependency esbuild from catalog).

## 4. Out of scope

- Composition root, ports wiring, config loading: ENGINE/ARCH006 and ARCH005.
- Starting the gateway, SQLite, LaunchAgent install, single-instance lock, daemonization: ENGINE area (service lifecycle) using the platform interface `ServiceManager` (OVE_ARCH012).
- Executable packaging and signing: OVE_SETUP017, OVE_SETUP014.
- Logging implementation: OVE_ARCH004 (the scaffold uses a minimal stderr writer until it lands).

## 5. Detailed requirements

1. **Commands.** `overmind-engine run [--data-dir <path>] [--foreground]` (starts the engine; implementation hook `startEngine()` imported from `./compose` if it exists, otherwise prints `engine bootstrap not implemented` to stderr and exits 20); `overmind-engine ensure-running [--json]` (hook `ensureRunning()`; same stub behaviour); `overmind-engine version [--json]` (prints version info; always works); `--help`. Unknown command: usage to stderr, exit 64 (EX_USAGE). Arguments are parsed with `parseArgs` in strict mode; unknown flags are errors.
2. **Exit codes (`exit-codes.ts`, single source, mirrored in OVE_SETUP010 docs):** `0` ok / started or already running reported via status, `10` already running, `20` cannot start, `30` incompatible protocol, `64` usage error, `70` internal error. `ensure-running --json` prints exactly one line of JSON on stdout: `{"status":"running"|"already_running"|"failed"|"incompatible","pid":number|null,"socket":string|null,"version":string,"protocol":number,"detail":string|null}` and nothing else on stdout; diagnostics go to stderr.
3. **Version info (`version.ts`).** Constants injected at build time by esbuild `define`: `__OVERMIND_VERSION__` (from root `package.json` version), `__PROTOCOL_VERSION__` (integer from a single constant `PROTOCOL_VERSION` exported by `@overmind/contracts` once it exists; until then `1`), `__BUILD_SHA__` (git short SHA or `dev`), `__BUILD_TIME__` is NOT embedded (reproducibility). `version --json` prints `{version, protocol, buildSha, node: process.versions.node, platform: process.platform, arch: process.arch}`. At runtime outside a bundle (development) the constants fall back to `0.0.0-dev`, protocol `1`, sha `dev`.
4. **Bundling entry (`build/bundle.mjs`).** esbuild API: `entryPoints: ["src/main.ts"]`, `bundle: true`, `platform: "node"`, `target: "node22"`, `format`: the format required by the packaging ADR (default `cjs` for Node SEA), `outfile: "dist/engine.cjs"`, `sourcemap: "external"`, `minify: false` (readable stack traces; size is secondary), `legalComments: "linked"`, `external`: only the native addon names if the ADR chooses `better-sqlite3`, `define`: the constants above, `metafile: true` writing `dist/engine.meta.json` (used by SBOM/size checks). Fails the build if the metafile shows imports from `apps/desktop`, `react`, `@tauri-apps/*` or `node_modules` packages not listed in `apps/engine/package.json` dependencies (guards layering and accidental UI code in the engine).
5. **Source layout contract for the ENGINE area:** `src/compose/index.ts` exports `startEngine(options): Promise<never>` and `src/service/index.ts` exports `ensureRunning(options): Promise<EnsureResult>`; this task creates neither (hooks use dynamic `import()` guarded by `try/catch` for `ERR_MODULE_NOT_FOUND`, so the scaffold works before they exist and bundling includes them once they do; esbuild is configured with `logOverride` so unresolved optional imports are a warning). When the ENGINE area lands, the optional import is replaced by a static import in one commit by the ENGINE task (documented in `README.md`).
6. **Runtime neutrality.** `src/` MUST use only `node:*` built-ins and `@overmind/*` packages; no `Bun.*`, no `process.binding`. A lint rule in `eslint.config.d/engine.mjs` is NOT added here (OVE_ARCH002 handles import boundaries); a unit test greps the `src` tree for `Bun.` and `Deno.`.
7. **Signals.** `run` installs `SIGTERM`/`SIGINT` handlers calling a `shutdown()` hook with a 5 s deadline, then exits 0; second signal exits immediately with 130. (The hook body is ENGINE's; the scaffold implements the plumbing and a test.)
8. **No console.log in library code:** the CLI prints via `process.stdout.write` / `process.stderr.write` helpers in `cli.ts` so output channels are explicit (stdout is machine-readable only).
9. **tsconfig** extends the base (OVE_SETUP002), `types: ["node"]`, references to all packages the engine will use (as in OVE_SETUP001 manifest).
10. **README** documents commands, exit codes, JSON shapes, and the optional-hook mechanism.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Version constants and the protocol version are defined once (`@overmind/contracts` for the protocol, `package.json` for the version). The exit-code table is imported by OVE_SETUP010's documentation test and by the ENGINE area. `parseArgs` is from Node (no CLI library dependency: KISS).

## 8. Architecture and code placement

Layer: `apps/engine` is the composition root; `main.ts` and `cli.ts` are the outermost layer and contain no business logic. They depend on `./commands/*`, which depend on the optional ENGINE hooks. Nothing imports from `apps/engine`.

## 9. Security and safety

- stdout of `ensure-running --json` is machine-parsed by the Tauri shell: any extra output would break parsing; tests assert exactly one JSON line.
- Arguments are strictly parsed; the data directory argument is passed as data to the ENGINE hooks, which canonicalise it (OVE_SEC002); this task never joins or touches paths.
- Version and protocol are exposed so the shell can fail closed on incompatibility (exit code 30).
- The bundle guard keeps UI code and unexpected packages out of the privileged engine process.
- No secrets in argv: documented rule "never pass secrets as command-line arguments"; any later flag taking a secret is rejected in review.
- Logs and `version --json` contain no environment variables or home paths.

## 10. Errors and edge cases

- Hook module throws on import (not "not found"): exit 70 with the error message on stderr (no stack in `--json` mode stdout).
- `--json` combined with `--help`: help to stderr, exit 0.
- Output closed early (EPIPE): handled silently with exit 0 for `version`, 70 otherwise.
- Running outside the bundle with `tsx`: version constants fall back, behaviour identical.
- Extremely long argv: rejected by `parseArgs` limits at 4096 characters total (explicit check) with exit 64.

## 11. Acceptance criteria

- [x] `node dist/engine.cjs version --json` prints one JSON line containing version, protocol 1, buildSha and node version.
- [x] `ensure-running --json` without ENGINE hooks exits 20 with `{"status":"failed",...}` as the only stdout line.
- [x] Unknown command exits 64; unknown flag exits 64.
- [x] SIGTERM during `run` calls the shutdown hook and exits 0 within 5 s; a hanging hook is abandoned at 5 s.
- [x] `pnpm --filter @overmind/engine build` produces `dist/engine.cjs`, `dist/engine.cjs.map` and `dist/engine.meta.json`; build fails when a fixture import of `react` is added.
- [x] No `Bun.` or `Deno.` appears in `src/` (test).
- [x] `pnpm typecheck` and tests pass.

## 12. Test plan

Unit tests for `cli.ts` (argument matrix), `version.ts` (fallbacks), exit-code table. Process-level tests (`*.int.test.ts`): spawn `tsx src/main.ts` and the bundled file, assert stdout/stderr/exit codes, signal handling with a fixture hook. Build test: run `bundle.mjs` into a temp dir and inspect the metafile. Commands: `pnpm --filter @overmind/engine test`, `pnpm --filter @overmind/engine build`.

## 13. Parallelization notes

After OVE_SETUP011 decides packaging. Parallel with OVE_SETUP012 and OVE_SETUP015. ENGINE-area tasks add `src/compose/` and `src/service/` (their own paths) and replace the optional imports with one-line static imports through a small coordinated edit of `src/commands/*.ts` (those files are owned here; the ENGINE task lists them in `reads` and requests the edit via proposal, or this task is merged before so ENGINE can own them afterwards; recommended: ENGINE's first task takes ownership by an explicit statement in its own `owns` after this task is `done`).

## 14. Open questions and assumptions

- ASSUMPTION: CJS single-file bundle for Node SEA (ADR may require another format; then only `bundle.mjs` changes).
- ASSUMPTION: exit codes 10, 20, 30 as in OVE_SETUP010 plus BSD sysexits 64 and 70.
- Open question: whether `run` should refuse to start without `--data-dir` in production; default: the ENGINE area decides, the scaffold passes the flag through.

## Implementation evidence

The scaffold contains no ENGINE composition/service placeholder. Both source and
bundle commands are tested as real subprocesses; fixture-only hooks exercise
SIGTERM/SIGINT, the five-second shutdown deadline, second-signal exit130, EPIPE,
import failures and the one-line JSON channel contract. Negative bundle tests
reject actual React and undeclared npm imports. Independent output directories
produce identical CJS and external map bytes; SEA reproducibility remains017.
The build reads the shared contracts protocol export when present and rejects
invalid values; before that export exists it stamps1.

The coordinated integration proposal is
`tasks/_proposals/OVE_SETUP016-engine-integration.md`. It records the approved
catalog/manifest/lockfile and minimal shell receipt compatibility edit, preserving
unknown-field rejection, exact socket/live ping checks and rejecting an explicit
null protocol instead of treating it as a legacy missing field. No Cargo dependency
or license policy changed. Review and hosted gates remain required before merge.

Independent review regressions reproduce ordinary hook detail containing a home
path, ANSI/control characters and more than600 characters, and a real process
holding an open resource while startup rejects after shutdown begins. Both JSON
and stderr now use one normalized detail; active shutdown retains its five-second
deadline and second-signal exit130 despite startup failure. Ordinary startup
failure still removes handlers. Red/green evidence is retained in local review
logs; independent review and hosted gates must assess the corrected head.
