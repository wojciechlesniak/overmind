---
id: OVE_PROV022
title: Implement Connection detection and testing (CLI versions, login state, Ollama, checks)
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH007, OVE_ARCH012, OVE_BOX006, OVE_BOX007, OVE_BOX009, OVE_BOX010, OVE_BOX019, OVE_BOX022, OVE_BOX023, OVE_ENGINE016, OVE_ENGINE029, OVE_PERM017, OVE_PROV001, OVE_PROV002, OVE_PROV016, OVE_PROV020, OVE_PROV034]
soft_depends_on: [OVE_PROV010, OVE_PROV011, OVE_PROV017, OVE_PROV027]
provides: ["usecase:DetectConnections", "usecase:TestConnection", "port:ProbeEnvironmentProvider", "lib:connection-probes"]
needs: ["port:ConnectionRepository", "usecase:SetConnectionStatus", "usecase:SaveConnection", "lib:cli-profile-registry", "port:Sandbox", "lib:sandbox-exec", "lib:image-provisioner", "usecase:RequireIsolation", "usecase:PrepareRunMounts", "lib:environment-spec-builder", "lib:credential-volumes", "lib:provider-hosts", "port:ModelProvider", "port:Clock", "port:AuditSink", "port:JobScheduler", "lib:redaction"]
owns:
  - packages/application/src/prov/detect/**
  - packages/application/src/ports/ProbeEnvironmentProvider.ts
reads: ["packages/contracts/src/connection/", "docs/research/prototyp-wnioski.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 14", "SPECIFICATION 17"]
adr_refs: [7, 20, 22, 26]
---

# OVE_PROV022: Implement Connection detection and testing (CLI versions, login state, Ollama, checks)

## 1. Summary

Detect which model sources are available (the `claude` and `codex` CLIs in the pinned image, a running Ollama), whether each CLI is logged in, which models they offer, and whether the CLI version matches the version the rules were captured against; update the Connection rows accordingly. A second use case runs the user-visible "test connection" checklist. Neither reads credentials.

## 2. Context

ADR 0022: Overmind detects installed official CLIs and never logs in for the Owner. In Overmind the CLIs live in the pinned agent image (BOX005: `claude` and `codex` baked in, labels `app.overmind.image.claude`, `.codex`), so "installed" and "version" come from the image info (BOX006) without starting anything; login state lives in the credential volume and can be probed only by running the CLI in an Environment; Ollama is probed over loopback HTTP (PROV016). Detection runs at engine start, from the wizard and from `connections.detect` (PROV021), and re-runs after login (PROV014). The CLI profile (`verifiedAgainst`) is compared with the detected version; drift is a warning, not a failure. Prototype note: the CLI install step for Apple's `container` itself is BOX/SETUP, not here.

## 3. Scope (in)

- `DetectConnections` and `TestConnection` use cases.
- `ProbeEnvironmentProvider` port with the default policy for obtaining an Environment for login probes.
- Probes: image CLI versions, login status (exit code only), model list, Ollama health, provider host reachability, profile version drift.
- Startup and periodic re-detection job; status updates through PROV020.

## 4. Out of scope

- Login flow itself (PROV014), usage probes (PROV017), session start (PROV027), the sandbox and image build (BOX), routes (PROV021), UI.

## 5. Detailed requirements

1. **`DetectConnections.execute({ providers?, workspaceId?, source })` returns `Result<Connection[]>`:** for each requested provider (default all registered):
   - **cli (`claude`, `codex`):** `installed` and `version` from the image provisioner info (labels) without starting a container; if the image is not ready, status `not_installed` with detail `image_not_ready` (remediation is BOX006); then the login probe (item 3); then models from the profile static table plus `probes.models` output when the profile has one; version compared with `profile.verifiedAgainst.cliVersion` -> detail `profile_version_drift` and status `degraded` only when the major version differs, otherwise `ready` with a warning flag in `statusDetail`.
   - **ollama:** `OllamaProvider.health()` (PROV016): reachable with models -> `ready`; reachable without models -> `degraded` (`no_models`); refused -> `not_installed` (`not_running`); invalid endpoint -> `error`.
2. **Upsert:** `SaveConnection` (source `detection`) creates missing rows (display names `Claude Code`, `Codex CLI`, `Ollama`), `SetConnectionStatus` updates status, version, models, `lastCheckedAt`. Rows are never deleted by detection.
3. **Login probe:** only if isolation is ready (`RequireIsolation` purpose `exec`; failure leaves the status `unknown` with detail `isolation_unavailable`). Uses `ProbeEnvironmentProvider.acquire({ providerId, workspaceId? })` which returns a running Environment that mounts the CLI's credential volume: order of preference (a) an already running Environment of the same CLI, (b) a transient Environment built from the chosen Workspace's mount plan (`PrepareRunMounts` + `buildEnvironmentSpec`, label `app.overmind.purpose=probe`), destroyed after probing (credential volumes kept, BOX008), (c) none available: status `unknown` with `needs_workspace` (the wizard asks for the folder first). The probe runs the profile's `loginStatus` argv through `Sandbox.exec` with a 15 s timeout, stdout and stderr DISCARDED (only the exit code is used); without a profile probe the status stays `unknown` and a login screen check happens at first session start (PROV006). Nothing under `/creds` is listed or read. Exit code 0 -> `ready`; non-zero with the probe documented as "not logged in" -> `needs_login`; any other failure -> `unknown` with `probe_failed`.
4. **`TestConnection.execute({ connectionId })` returns `{ connection, checks[] }`** where `checks` is an ordered list `{ id, ok, messageKey }`: `isolation` (RequireIsolation), `image` (CLI present at the expected version), `login` (probe), `models` (list non-empty), `egress` (provider hosts from `lib:provider-hosts` are reachable through the proxy: a `curl --head --max-time 10` per host inside the probe Environment, only the HTTP status class is kept, no body), `profile` (version drift), and for Ollama `endpoint`, `reachable`, `models`. A failing check sets `messageKey` such as `connections.test.login.needs_login`; the Connection status is updated from the result.
5. **Egress check care:** it only issues HEAD requests to hosts from the reviewed provider list, inside the sandbox proxy (so the proxy and its logs apply); a blocked host (BOX013 Approval) is reported as `egress_blocked`, never auto-approved.
6. **Startup and periodic:** an engine start hook runs `DetectConnections` after the sandbox is ready (non-blocking, 20 s overall timeout) and then every 30 minutes (`JobScheduler`), skipping while Global Pause is on for probes that start Environments (Ollama and image checks still run). Detection never runs concurrently with itself (single flight) and never starves sessions (probe Environments count against the memory admission, BOX017, but not against the Agent slot limit).
7. **Debounce:** `connections.detect` called within 5 s returns the cached result with `fromCache: true`.
8. **Audit:** `provider.connections_detected` (provider ids and resulting statuses), `provider.connection_tested`; no CLI output.
9. **No mutation of the Owner's setup:** detection never installs, updates, logs in or pulls anything.

## 6. Design notes

N/A, functionality only. Message keys live under `connections.test.*` and `connections.detail.*` (EN + PL strings are CONNUI's namespace; this task lists the keys in `docs/providers/connection-detection.md`).

## 7. Reuse

CLI profiles (PROV034), Ollama health (PROV016), Connection use cases (PROV020), image provisioner info (BOX006), mount plan and spec builder (PERM017, BOX007), credential volumes (BOX009), provider hosts (BOX023), `Sandbox.exec` (BOX010). The version comparison helper is the one from PROV034 (`verifiedAgainst`).

## 8. Architecture and code placement

`packages/application/src/prov/detect/{detect-connections.ts,test-connection.ts,probes/{cli-image.ts,cli-login.ts,ollama.ts,egress.ts,profile-drift.ts},probe-environment.ts,schedule.ts}` and the port `ProbeEnvironmentProvider`. Application layer over ports; the default `ProbeEnvironmentProvider` implementation is part of `probe-environment.ts` (composition in PROV026). No adapter imports.

## 9. Security and safety

Detection must not become a credential reader: probes discard output, use fixed argv from the compiled profile, never list the credential volume, and never send anything beyond HEAD requests to reviewed hosts. A transient probe Environment follows the same mount plan rules as any Environment (no extra mounts). No CLI text is shown to the Owner (keys only). A hostile repository cannot influence detection (no file in `/work` is read). Isolation unavailable means probes are skipped (fail closed), not run on the host. Egress checks cannot widen the allowlist.

## 10. Errors and edge cases

- Image not built yet: `not_installed` with `image_not_ready`; detect again after provisioning (BOX006 event `sandbox.image_progress` completion triggers re-detect).
- No Workspace yet (first run before the folder step): login `unknown` with `needs_workspace`, Ollama and versions still detected.
- Probe timeouts: `unknown`, no flapping (status changes only after two consecutive identical results, except to `needs_login` from a session observation which is immediate via PROV014).
- CLI major version changed: `degraded` with `profile_version_drift`; sessions still work, a warning is shown (PROV006 rules may be outdated).
- Ollama running on another port: Owner sets the endpoint in CONNUI; detection uses the saved endpoint only.
- Probe Environment creation fails on memory admission: `unknown` with `resource_limit`, retried at the next tick.

## 11. Acceptance criteria

- [ ] With fakes: image labels give `claude` and `codex` versions; a login probe exit 0 -> `ready`, non-zero -> `needs_login`; stdout of the probe is never read or logged (spy).
- [ ] Ollama running with models -> `ready`; refused -> `not_installed` (`not_running`); empty model list -> `degraded`.
- [ ] Major version drift -> `degraded` with `profile_version_drift`; patch drift -> `ready` plus warning.
- [ ] `TestConnection` returns the ordered checks with message keys and never contains CLI text; the egress check issues only HEAD requests to provider hosts through the sandbox.
- [ ] With isolation unavailable no container command is run and statuses are `unknown` with `isolation_unavailable`.
- [ ] Single-flight and 5 s debounce hold under concurrent calls.
- [ ] Probe Environment is destroyed after probing and the credential volume is untouched (fake sandbox assertions).

## 12. Test plan

Use case tests with `FakeSandbox`, fake image provisioner, `FakeOllamaServer`, `FakeClock`; adversarial probe output (huge, ANSI, token-like) discarded; drift tests; concurrency tests. Commands: `pnpm vitest run packages/application/src/prov/detect`.

## 13. Parallelization notes

Needs PROV020 repo and PROV016 health; the Environment acquisition helper reuses BOX/PERM ports, same as PROV027 (do not copy code: import `EnsureAgentEnvironment` once PROV027 lands, otherwise stub behind `ProbeEnvironmentProvider`). PROV021 depends on this task.

## 14. Open questions and assumptions

- ASSUMPTION: each profile defines a `loginStatus` probe whose exit code is meaningful; the spikes in PROV010/PROV011 confirm or the status stays `unknown` until the first session (screen-based).
- Open: a mount-less probe Environment would avoid mounting the Workspace for a status check (BOX007 currently rejects empty plans): proposal for BOX recorded in `docs/providers/connection-detection.md`.
