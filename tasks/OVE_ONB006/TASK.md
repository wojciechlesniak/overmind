---
id: OVE_ONB006
title: "Implement the wizard system checks: container, isolation test, herdr, CLIs and Ollama"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOX004, OVE_BOX006, OVE_BOX008, OVE_BOX010, OVE_BOX018, OVE_BOX019, OVE_ONB001, OVE_PERM017, OVE_PROV022, OVE_SETUP015]
soft_depends_on: []
provides: ["usecase:RunWizardChecks", "usecase:GetWizardChecks", "usecase:SetupIsolationSystem", "port:IsolationSelfTest", "adapter:SandboxIsolationSelfTest"]
needs: ["lib:sandbox-health", "lib:image-provisioner", "usecase:RequireIsolation", "lib:sandbox-exec", "lib:environment-lifecycle", "usecase:PrepareRunMounts", "usecase:DetectConnections", "lib:herdr-bundle", "lib:evaluate-wizard-gate", "event:sandbox.image_progress"]
owns: ["packages/application/src/onboarding/checks/**", "packages/application/src/ports/IsolationSelfTest.ts", "packages/adapters/sandbox-macos/src/onboarding/**", "packages/testing/src/fakes/FakeIsolationSelfTest.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [4, 20, 22]
---

# OVE_ONB006: Implement the wizard system checks: container, isolation test, herdr, CLIs and Ollama

## 1. Summary

Implements `RunWizardChecks` and `GetWizardChecks`: one orchestrated, incremental detection of the six rows of step 2 (Apple container, isolation test, herdr, Claude Code, Codex CLI, Ollama), each independently retryable, producing `WizardChecksResult` with the gate that blocks 'Dalej', and the `IsolationSelfTest` that proves a container cannot read the host's `~/.ssh`.

## 2. Context

Step 2 (VIEWS 'Onboarding 2') shows: 'Apple container: Izolacja Agentów w lekkich maszynach wirtualnych · macOS 26' (gotowe), 'Test izolacji: Odczyt ~/.ssh z kontenera został zablokowany' (zaliczony), 'herdr: Warstwa terminali dla CLI · wersja przypięta 0.9.2', 'Claude Code: claude 2.4.1 · zalogowany w CLI · Claude Max' (zalogowany), 'Codex CLI: codex 0.61 · logowanie trwa w terminalu poniżej' (czeka na Ciebie), 'Ollama: Opcjonalny model zapasowy, działa lokalnie' (pominięto, button 'Wykryj'). The checks live in other areas: sandbox health and ensureReady (BOX004), image provisioning (BOX006), herdr bundle (SETUP015/BOX004 `herdrBundleOk`), connection detection (PROV022). There is no existing 'isolation test' use case and no single route for the wizard. This task composes them with narrow ports and adds the self-test. SPEC 11: isolation unavailable means nothing runs, so a failed or missing isolation blocks the wizard.

## 3. Scope (in)

- Use case `RunWizardChecks({ ids?, workspaceId })`: runs the requested checks (default all) in dependency order, publishes `onboarding.check_updated` after each, persists nothing (state is derived), returns `WizardChecksResult`.
- Use case `GetWizardChecks()`: returns the last known result (in-memory cache with 5 min TTL) without running anything.
- Port `IsolationSelfTest` with the adapter `SandboxIsolationSelfTest` over `Sandbox.exec` (BOX010) in a transient Environment (BOX008) built from the first Workspace's mount plan (PERM017).
- Mapping functions from `SandboxHealth`, `Connection` and herdr info to `WizardCheck` rows (pure).
- Image provisioning trigger and progress forwarding (`sandbox.image_progress`) for the isolation row's `running` state.
- Use case `SetupIsolationSystem({ proof })`: when the check says `kernel_missing` or `system_not_running`, verifies a Local Approval proof for the action `sandbox.system_setup` (single use, bound to that action: BOX004 `ensureReady` contract) and calls `Sandbox.ensureReady({ approvalToken })`, forwarding progress; the Owner flow is ONB016.

## 4. Out of scope

- The routes (ONB009), the UI rows (ONB014..018), the login terminal (ONB008/010/017).
- Installing Apple container (manual step; guidance text only).
- Persisting the checks (they are cheap and re-run on each visit).

## 5. Detailed requirements

1. **Check order and dependencies.** (1) `apple_container` via `Sandbox.health()`: `ready` when `overall === 'ready'`, `running` while `ensureReady` is executing, `failed` with `reasonCode` mapped from `BlockReason` (`runtime_missing` -> `container_missing`, `os_unsupported`, `kernel_missing`, `system_not_running`, `version_unsupported`, `image_not_ready` -> sub-state handled by (2)); (2) image: if `imageReady` is false and health is `degraded` only for the image, call `ImageProvisioner.ensureImage({ onProgress })` as part of the `isolation_test` row (status `running`, `detail.progress {done,total}` from phases); (3) `isolation_test` after container and image are ready: run the self-test; (4) `herdr` via bundle check (`herdrBundleOk`, pinned version text `0.9.2` from the bundle manifest); (5) `claude`, `codex` via `DetectConnections({ providers, workspaceId, source: 'wizard' })` (needs isolation ready: otherwise status `pending` with reason `isolation_unavailable`); (6) `ollama` via `DetectConnections` for ollama: reachable with models -> `ready` ('działa lokalnie'); not running or absent -> `skipped` (button 'Wykryj' re-runs); errors -> `failed` only if the endpoint config is invalid.
2. **Statuses.** `claude` / `codex`: `ready` = installed and logged in (`statusKey: 'logged_in'`, `planText` from the probe, plain text max 60); `waiting` = installed and a login terminal is open for it (`waiting_for_owner`; the mock shows Codex as 'czeka na Ciebie' while the terminal is open); `pending` = installed, not logged in, no login started (the UI offers 'Zaloguj', ONB017); `failed` = not installed in the image or the probe errored.
3. **IsolationSelfTest (adapter).** Runs in a transient Environment with ONLY the first Workspace's mounts and the standard no-network-except-proxy profile; executes a fixed list of probes (no user input, no shell string building; argv arrays): (a) `ssh_read_blocked`: attempt to read the host's `~/.ssh` through the host-user path layout (`/Users/<name>/.ssh`, `/root/.ssh`, `/home/*/.ssh`) and the host data directory: all must be absent; (b) `home_not_mounted`: `/proc/self/mountinfo` lists only the allowed mounts (`/work`, credential volume paths, tmpfs) — compared against the expected mount plan; (c) `root_readonly`: writing outside `/work` and tmp fails; (d) `egress_blocked`: a request to a non-allowlisted host through the environment fails (the proxy refuses; no external request is made); (e) `no_secret_env`: environment variables contain none of the host token variables (names from a list). Each probe returns pass/fail and a closed reason code only; command output is discarded. The row is `ready` only if all pass; any failure -> `failed` with `reasonCode: 'isolation_probe_failed'` plus the failing probe ids in `detail.reasonCode` list (closed set) and remedy key `isolation.failed` ('Izolacja nie działa. Overmind nie uruchomi Agentów.').
4. **Hostile-environment note.** The self-test is a diagnostic, not a guarantee; escape tests in CI (TEST007) are the guarantee. The result text must say what was checked ('Odczyt ~/.ssh z kontenera został zablokowany') and not claim more.
5. **Gate.** `evaluateGate` from contracts (ONB001) on the produced checks. `canContinue` false -> `blockedBy` list used by the UI for the reason hint.
6. **Concurrency.** One run at a time (lock); a second `RunWizardChecks` while running returns the current result with `runningAny: true`; single-check re-runs are allowed for rows not currently running; the image build (long) runs in the background and can be awaited by the UI through events.
7. **Timeouts.** Each check 20 s (isolation 60 s, image build up to 15 min with progress); timeouts produce `failed` with `reasonCode: 'timeout'` and the Retry action.
8. **Events.** `onboarding.check_updated { id, status }` per change (ephemeral). Results never include raw output, versions are plain text from controlled sources (bundle manifest, image labels, CLI `--version` probe).
9. **Audit.** `onboarding.isolation_test` with pass/fail and probe ids (no content); `onboarding.checks_run`.
10. **While paused.** Global Pause does not block the wizard checks (setup, not Agent work; BOX019 allows purpose 'login' and 'exec' while paused for diagnostics).

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `Sandbox.health/ensureReady` (BOX004), `ImageProvisioner` (BOX006), `RequireIsolation` (BOX019), `Sandbox.exec` and Environment lifecycle (BOX008/010), `PrepareRunMounts` (PERM017), `DetectConnections` (PROV022), herdr bundle info (SETUP015), `evaluateGate` (ONB001).

## 8. Architecture and code placement

`packages/application/src/onboarding/checks/{run-wizard-checks.ts,get-wizard-checks.ts,check-mappers.ts,check-lock.ts}`, port `packages/application/src/ports/IsolationSelfTest.ts`, adapter `packages/adapters/sandbox-macos/src/onboarding/isolation-self-test.ts`, fake `packages/testing/src/fakes/FakeIsolationSelfTest.ts`.

## 9. Security and safety

- Probes run inside the sandbox through the normal exec path with argv arrays; no host shell; outputs discarded; the transient Environment is destroyed after the test (reaper covers crashes, BOX016).
- The `egress_blocked` probe targets a fixed non-routable test host so no real third party is contacted even if the proxy fails (fail-safe: a response from a reserved address range still proves nothing leaked).
- Version and plan texts come from CLI output: plain text, length-capped, never interpreted.
- Results contain only codes; no paths, no hostnames of the Owner's machine.
- If the self-test cannot run, the result is `failed`, never 'skipped' (fail closed).

## 10. Errors and edge cases

- Apple container not installed: `failed` with remedy 'Zainstaluj Apple container i wybierz Wykryj'; subsequent rows `pending`.
- Kernel missing or system not running: `failed(reason kernel_missing|system_not_running)` with the setup action requiring a Local Approval (ONB016).
- Image build fails offline: `box.offline` mapped to `failed(reason offline)` retryable.
- Both CLIs absent in the image: rows `failed`, gate blocks.
- Detection throws: the row is `failed(reason unknown)`; other rows continue.
- Probe flakiness: one automatic retry for infrastructure errors only (not for a failed security probe).

## 11. Acceptance criteria

- [ ] Given a healthy fake sandbox then all rows are ready/skipped as in the mock and `canContinue` is true when Claude is logged in.
- [ ] Given a failing `ssh_read_blocked` probe then `isolation_test` is `failed`, the gate lists `isolation` and Next stays blocked.
- [ ] Given no CLI logged in then `canContinue` is false with `no_cli_logged_in`.
- [ ] Given Ollama unreachable then its row is `skipped` and does not block.
- [ ] Given two concurrent runs then only one executes and both observe the same result.
- [ ] Given each probe failing individually then the reason code list contains exactly that probe id.

## 12. Test plan

- Use-case tests with fakes for sandbox, image provisioner, connections and self-test: mapping table, ordering, lock, timeout, events.
- Adapter test with the fake sandbox exec scripted outputs; real isolation checks run in the escape-test CI (TEST007) which gains the same probe list (documented).
- Commands: `pnpm vitest run packages/application/src/onboarding/checks packages/adapters/sandbox-macos/src/onboarding`.

## 13. Parallelization notes

After ONB001 and BOX004/006/019, PROV022. Parallel with ONB002..005. ONB009 exposes it; ONB015/016/018 consume it.

## 14. Open questions and assumptions

- OPEN (cross-area): BOX has no 'isolation self-test' use case; this task adds one in the sandbox adapter folder and must be reconciled with TEST007's escape probes (share the probe list).
- OPEN: event name `sandbox.image_progress` (BOX018) vs `sandbox.image.progress` (BOX006 text); linker must unify.
- ASSUMPTION: `DetectConnections` accepts `source: 'wizard'`.
