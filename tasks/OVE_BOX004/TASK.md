---
id: OVE_BOX004
title: Implement sandbox health, capabilities and ensureReady with OS and version preconditions
area: BOX
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH012, OVE_BOX003, OVE_ENGINE016, OVE_PERM014, OVE_SETUP015]
soft_depends_on: [OVE_SETUP015]
provides: ["lib:sandbox-health"]
needs: ["lib:preflight", "lib:herdr-bundle", "port:Sandbox", "port:AuditSink", "port:ApprovalVerifier", "port:Clock"]
owns:
  - packages/adapters/sandbox-macos/src/health/**
reads: ["apps/engine/src/preflight/", "docs/engineering/bundled-binaries.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 18"]
adr_refs: [4, 9, 20]
---

# OVE_BOX004: Implement sandbox health, capabilities and ensureReady with OS and version preconditions

## 1. Summary

Implement `Sandbox.capabilities()`, `Sandbox.health()` and `Sandbox.ensureReady()` for the Apple `container` runtime: macOS 26 and Apple silicon, container CLI located, signed and within the tested version range, system service running, kernel installed, herdr bundle verified. Installing the kernel or starting the system service happens only with an Owner approval token. Everything else fails closed.

## 2. Context

OVE_SETUP015 builds the `PreflightReport` (checks os, arch, locate, signature, version, system, herdr bundle) in the engine preflight module. This task adapts that report to the `Sandbox` port contract of OVE_ARCH012 and adds the actions needed to repair `degraded` states. The prototype showed the kernel must be installed separately (`container system kernel set --recommended`) and the first start of the system service asks for it. ADR 0020: when isolation cannot be ensured, the action is blocked.

## 3. Scope (in)

- `MacSandboxHealth` service mapping `PreflightReport` to `SandboxHealth`.
- `capabilities()` constant data for kind `apple-container`.
- `ensureReady({ approvalToken })` with state machine and idempotence.
- Health cache (max 5 minutes, invalidated by lifecycle failures) and audit emission.

## 4. Out of scope

- The preflight checks themselves (OVE_SETUP015). Wizard screens (ONB). Approval creation for the Owner (PERM issues the token; this task only verifies it). Lima fallback for older macOS (later).

## 5. Detailed requirements

1. **capabilities():** `{ kind: 'apple-container', perAgentEnv: true, workspaceNetworkPolicy: true, minOs: '26.0', arch: 'arm64', readOnlyRoot, publishSocket, networkNone }` where the last three come from the cached `ContainerCliCapabilities` (BOX003). Before the probe has run, `capabilities()` returns conservative `false` values (sync and pure).
2. **health():** returns `Result<SandboxHealth>` with `{ installed, version, osSupported, kernelPresent, running, herdrBundleOk, imageReady (from BOX006), issues: SandboxIssue[], overall: 'ready'|'degraded'|'blocked', checkedAt }`. `SandboxIssue = { code: 'box.*', remediationKey, details }`. `overall !== 'ready'` is treated by all callers as isolation unavailable (see OVE_BOX019).
3. **Mapping rules:** `blocked` when os, arch, locate, signature, version, herdr bundle or image digest check fails; `degraded` when the system is not running, the kernel is missing, the version is newer but same major (untested), or the image is not yet built (remediable). Exceptions inside a check map to `blocked` with `box.cli_failed`.
4. **ensureReady(opts: { approvalToken?: ApprovalToken; signal? }):**
   1. run health; if `ready` return ok;
   2. if `kernel_missing` or `not_running`: require `approvalToken` that verifies through the PERM `ApprovalVerifier` (single use, bound to action `sandbox.system_setup`); without it return `box.kernel_missing` or `box.system_not_running` with remediation (the wizard asks the Owner and retries with a token);
   3. with a valid token: `kernelSetRecommended()` then `systemStart()` (each with a long timeout and progress events for the wizard), then re-run health;
   4. never installs the `.pkg`, never runs `sudo`, never downloads executables; a missing or too old `container` returns `box.runtime_missing` or `box.version_unsupported` with the documented installation steps.
5. **Idempotence and concurrency:** concurrent `ensureReady` calls share one in-flight promise; repeated calls after success are cheap (cached for 5 minutes, never longer).
6. **Revalidation triggers:** engine start, before every Run (called by OVE_BOX019), after `container` returns unexpected errors, on macOS wake from sleep (the engine publishes a `system.woke` event if available; otherwise rely on the 5-minute TTL), on demand from the wizard.
7. **Audit:** `sandbox.health_checked` summary on state change only (not every poll): overall, failing issue codes. `sandbox.setup_performed` when kernel/system actions run, with approval id.
8. **Messages:** only keys (`preflight.*` from SETUP015, plus `box.setup.in_progress`); no free text from CLI output reaches the UI. CLI raw output is logged at `debug` after redaction.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`lib:preflight` types and checks (OVE_SETUP015) are imported through the application-level `PreflightService` interface; do not re-run `sw_vers`/`codesign` here. `ContainerCli` (OVE_BOX003). `AuditSink`, approval verification (PERM). `Clock` for TTL.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/health/{health-service.ts,map-preflight.ts,ensure-ready.ts,capabilities.ts}`. `map-preflight.ts` is pure. The adapter depends on the `PreflightService` port (application) so the engine composition passes the SETUP015 implementation. DIP: no direct import of `apps/engine`.

## 9. Security and safety

System-level changes (kernel install, service start) are permission-expanding in effect, so they need Local Approval (SR-25) and are audited. Untrusted data: CLI output text is parsed with strict patterns; unrecognised output never yields `ready`. TOCTOU: health is a snapshot; the lifecycle code (BOX008) re-validates the binary hash immediately before `run`. If the Owner declines the approval, no state changes and the Run is blocked with a clear reason.

## 10. Errors and edge cases

- macOS 15 or Intel: `blocked` with `box.os_unsupported`; remediation text is the requirements list (ONB).
- `container system status` hangs: 10 s timeout, `blocked`.
- Kernel install fails midway (network): `box.kernel_missing` with `retryable`, system left as is.
- Approval token expired or reused: `perm.approval_invalid`, nothing executed.
- User uninstalls `container` while the engine runs: next health is `blocked`; running Environments are left to the reaper (BOX016).
- Two Macs users on one machine: the system service is per user; health reports only the current user's state.

## 11. Acceptance criteria

- [ ] Table tests map every PreflightReport combination from SETUP015 to the expected `SandboxHealth.overall` and issue codes.
- [ ] `ensureReady` without a valid approval token never calls `systemStart` or `kernelSetRecommended` (spy test).
- [ ] With a valid token and a fake CLI, it performs kernel set, system start, re-check, in that order.
- [ ] Health result is cached at most 5 minutes (fake clock test) and invalidated after a `box.cli_failed` from lifecycle.
- [ ] A thrown error inside any check yields `blocked`.
- [ ] Audit events are emitted only on state change.

## 12. Test plan

Unit tests with `FakeProcessRunner` fixtures and `FakeClock`; contract test slice of `Sandbox.contract` for `capabilities`/`health`/`ensureReady` (TEST003). Opt-in integration on the macOS 26 runner (OVE_SETUP021) reading real health. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/health`.

## 13. Parallelization notes

Parallel with BOX005/BOX006. Hotspot: none (own folder). The `ApprovalVerifier` and `AuditSink` ports come from PERM; code against their interfaces and fakes.

## 14. Open questions and assumptions

- ASSUMPTION: PERM exposes `ApprovalVerifier.verify(token, action)`; the action name `sandbox.system_setup` is registered there as a non-expandable default-approval action (ADR 0021 spirit).
- Open: whether health should poll in the background; default no polling, only the triggers above.
