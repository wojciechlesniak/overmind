---
id: OVE_BOX003
title: Scaffold the sandbox-macos package with a typed ContainerCli wrapper and box.* error codes
area: BOX
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH004, OVE_ARCH007, OVE_ARCH012, OVE_ARCH014]
soft_depends_on: [OVE_BOX002, OVE_TEST002]
provides: ["lib:container-cli", "lib:box-errors"]
needs: ["port:ProcessRunner", "port:Sandbox", "lib:result", "lib:error-catalogue", "port:Logger", "port:Clock"]
owns:
  - packages/adapters/sandbox-macos/package.json
  - packages/adapters/sandbox-macos/tsconfig.json
  - packages/adapters/sandbox-macos/src/cli/**
  - packages/contracts/src/errors/box.errors.ts
reads: ["docs/research/box-channels-spike.md", "packages/application/src/ports/Sandbox.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 13"]
adr_refs: [9, 20]
---

# OVE_BOX003: Scaffold the sandbox-macos package with a typed ContainerCli wrapper and box.* error codes

## 1. Summary

Create the `packages/adapters/sandbox-macos` package skeleton and the only module allowed to talk to the Apple `container` binary: `ContainerCli`. It builds argv arrays, runs them through `ProcessRunner`, parses outputs into typed values, probes which flags the installed version supports, and registers every `box.*` error code.

## 2. Context

`port:Sandbox` (OVE_ARCH012) models environments, not Docker. The macOS adapter implements it on top of the `container` CLI 1.5.x (prototype). Host binaries are started only through `ProcessRunner` (OVE_ARCH014): argv arrays, no shell, minimal env. The binary is located by absolute paths only (`/usr/local/bin/container`, `/opt/homebrew/bin/container`) as established in OVE_SETUP015; this task consumes the located path from the preflight rather than searching again. Platform code lives only in `adapters/*-macos` (ADR 0009).

## 3. Scope (in)

- Package scaffold (`package.json` with name `@overmind/adapters-sandbox-macos`, `tsconfig.json` referencing application and contracts only).
- `ContainerCli` class: one method per container command used by BOX, each returning `Promise<Result<T, AppError>>`.
- Output parsers (JSON where the CLI offers `--format json`, otherwise strict line parsers) with fixtures recorded from the real CLI.
- `ContainerCliCapabilities` probe (which flags exist) from `container <cmd> --help`.
- `box.errors.ts` error catalogue entries.

## 4. Out of scope

- Detecting OS, signature and version preconditions: OVE_BOX004 (uses the preflight of OVE_SETUP015). Image building: OVE_BOX006. Building the `run` argument list from a spec: OVE_BOX008. Exec streaming: OVE_BOX010.

## 5. Detailed requirements

1. **Class surface** (internal to the package, not a port):
   ```ts
   class ContainerCli {
     constructor(deps: { runner: ProcessRunner; binaryPath: string; logger: Logger; clock: Clock })
     version(): Promise<Result<SemVer>>
     systemStatus(): Promise<Result<{ running: boolean; kernelInstalled: boolean; raw: string }>>
     systemStart(): Promise<Result<void>>                 // only called by BOX004 after Owner approval
     kernelSetRecommended(): Promise<Result<void>>        // same
     capabilities(): Promise<Result<ContainerCliCapabilities>>  // cached per binary hash+version
     run(args: RunArgs): Promise<Result<ContainerId>>     // detached
     start(id) / stop(id, { timeoutSec }) / kill(id) / delete(id, { force })
     inspect(id): Promise<Result<ContainerInfo | null>>
     list(filter: { labels: Record<string,string> }): Promise<Result<ContainerInfo[]>>
     stats(id): Promise<Result<ContainerStats>>           // uses `container stats --no-stream`
     exec(id, spec): ProcessHandle                        // streaming, see OVE_BOX010
     imageList / imageInspect / imagePull / imageBuild / imageDelete
     volumeCreate / volumeList / volumeInspect / volumeDelete
   }
   ```
   `RunArgs` is already validated by `EnvironmentSpecSchema` plus BOX007; this class does not make security decisions, it translates.
2. **Argv rules:** every call builds `string[]` from constants and validated values; a value is never concatenated into a flag (`--mount`, `type=bind,source=<path>,target=/work,readonly` is built with a helper that rejects `,` and `=` inside path components by switching to the CLI's non-comma form if one exists, otherwise failing with `box.spec_invalid`). Image references must match `^[a-z0-9._/-]+(@sha256:[0-9a-f]{64})$`. No user-controlled text reaches argv except through validated fields (names, labels, paths from CanonicalPath).
3. **Never pass secrets in argv:** environment values go through an `--env-file` created with mode 0600 in the run directory and deleted after `run`, or through `--env` only for non-secret values. The `Environment.env` already excludes secrets (OVE_ARCH012), but the wrapper additionally rejects keys matching the redaction key rule. `redactArgs` is set for every env value.
4. **Timeouts and caps:** every command passes `timeoutMs` (defaults: `run` 60 s, `stop` timeout+10 s, `list/inspect/stats` 10 s, `imageBuild` 20 min handled by BOX006). `maxOutputBytes` 1 MiB except builds (streamed to a log file).
5. **Parsing:** parsers live in `src/cli/parse/*.ts`, pure and unit-tested against fixtures `src/cli/fixtures/*.txt` captured from the real 1.5.x CLI (scrubbed). Unknown extra fields are ignored; missing required fields yield `box.cli_output_unparseable` (fail closed, never guess).
6. **Capabilities probe:** `ContainerCliCapabilities` lists booleans for the flags BOX needs: `readOnlyRoot`, `mountReadOnly`, `tmpfs`, `user`, `cpus`, `memory`, `networkNone`, `publishSocket`, `labels`, `execStdin`, `envFile`, `workdir`, `initProcess`, `rm`. The probe parses `--help` output of `run`, `exec`, `build`. `required` flags (set decided in OVE_BOX002) missing => `box.cli_missing_capability` with the flag name. Result cached by (binary sha256, version).
7. **Error codes in `box.errors.ts`** (registered via the ARCH003 catalogue, with `telegramSafe` flags and generic messages): `box.runtime_missing`, `box.os_unsupported`, `box.kernel_missing`, `box.system_not_running`, `box.version_unsupported`, `box.cli_missing_capability`, `box.cli_output_unparseable`, `box.cli_failed` (details: command label and exit code, never argv values), `box.image_missing`, `box.image_digest_mismatch`, `box.image_build_failed`, `box.offline`, `box.spec_invalid`, `box.mount_forbidden`, `box.mount_drift`, `box.env_not_found`, `box.env_exists`, `box.exec_denied`, `box.exec_timeout`, `box.oom_killed`, `box.resource_limit`, `box.egress_blocked`, `box.egress_policy_invalid`, `box.proxy_unavailable`, `box.login_forward_denied`, `box.worktree_dirty`, `box.git_tamper`, `box.isolation_unavailable`, `box.bridge_failed`, `box.credential_volume_error`.
8. **Logging:** `logLabel` constants per command (`container.run`, `container.stop`, ...). Container stderr is logged at `debug` after redaction only.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ProcessRunner` and `FakeProcessRunner` (OVE_ARCH014/TEST002), `Result`/`AppError`/`defineErrors` (OVE_ARCH003), `Logger` (OVE_ARCH004), `Clock` (OVE_ARCH007), `CanonicalPath` (OVE_SEC002). Do not call `child_process` here; boundary lint forbids it outside `adapters/system`.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/cli/{container-cli.ts,capabilities.ts,args/*.ts,parse/*.ts,fixtures/}`; errors in `packages/contracts/src/errors/box.errors.ts`. Layer: adapter. Depends on `application` ports and `contracts` only; never imports other adapters. SRP: this module translates; policy lives in BOX007/BOX008. OCP: a Lima implementation later gets its own `LimaCli` behind the same `Sandbox` port.

## 9. Security and safety

This is the sole host-side entry to the isolation boundary, so argument injection is the main risk: a path or name containing spaces, commas, `=`, leading `-`, newlines or `--privileged` text must never alter the command line. Mitigations: constant flag names, validated value types, `--` separators where supported, rejection of control characters, argv arrays only. The wrapper refuses any flag outside a fixed allowlist (`--privileged`, `--cap-add`, `--network host`, `--device`, `--security-opt` are not representable in `RunArgs` at all). Fail closed: unparseable output or a missing required capability blocks isolation.

## 10. Errors and edge cases

- Binary path missing at construction: `box.runtime_missing`.
- `container` prints warnings on stderr yet exits 0: warnings logged, result parsed from stdout.
- JSON output format changes in a new minor version: parser rejects unknown major structures, preflight marks `untested_version`.
- Name collision on `run`: `box.env_exists`; the caller decides.
- Concurrent calls: the wrapper is stateless; `ProcessRunner` limits concurrency.
- Locale or `NO_COLOR` differences: the runner sets `LANG=C.UTF-8` and `NO_COLOR=1` in the minimal env.

## 11. Acceptance criteria

- [ ] Package builds and appears in the boundary manifest as an adapter importing only application and contracts.
- [ ] Every ContainerCli method has a unit test with a fixture-backed fake runner asserting the exact argv.
- [ ] An image reference without a digest, a path with `,` or a leading `-` is rejected before spawning (tests).
- [ ] Capability probe parses recorded `--help` fixtures and fails closed when a required flag is absent.
- [ ] All `box.*` codes are registered and pass the hostile-error test from OVE_ARCH003.
- [ ] No secret value appears in any logged argv (tested with `expectNoSecrets`).

## 12. Test plan

Unit tests per parser and per argv builder (`src/cli/**/*.test.ts`), table tests for injection strings, `FakeProcessRunner` expectations. One opt-in integration test `container-cli.int.test.ts` (macOS runner, label `needs-container`) running `version`, `system status`, `list`. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/cli`.

## 13. Parallelization notes

First BOX implementation task; BOX004, BOX006, BOX008 and BOX009 build on it. Fixtures are conflict-free files. `box.errors.ts` is owned here; other BOX tasks add codes through proposals only if a code is missing from the list above (it is intended to be complete).

## 14. Open questions and assumptions

- ASSUMPTION: `container` supports `--format json` for `list`/`inspect`; otherwise strict table parsing is used, covered by fixtures.
- ASSUMPTION: required flag set = those listed in requirement 6 except `publishSocket`/`networkNone`, which depend on the OVE_BOX002 decision.
