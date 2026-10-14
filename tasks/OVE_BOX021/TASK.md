---
id: OVE_BOX021
title: Wire the sandbox adapter into the escape-test harness with adapter attack cases
area: BOX
kind: test
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_BOX007, OVE_BOX008, OVE_BOX010, OVE_BOX012, OVE_BOX014, OVE_BOX020, OVE_SEC002]
soft_depends_on: [OVE_TEST007, OVE_SETUP021]
provides: ["lib:escape-adapter-fixtures"]
needs: ["port:Sandbox", "lib:path-guard"]
owns:
  - packages/adapters/sandbox-macos/src/testing/**
  - docs/sandbox/escape-wiring.md
  - tasks/_proposals/OVE_BOX021-escape-cases.md
reads: ["tools/escape-tests/", "docs/testing/escape-tests.md", "docs/security/abuse-cases.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [4, 20]
---

# OVE_BOX021: Wire the sandbox adapter into the escape-test harness with adapter attack cases

## 1. Summary

Make the production `Sandbox` adapter testable by the escape-test harness of OVE_TEST007 without special paths: a factory that builds environments with the same builders as the product, labels and cleans them, plus a documented set of adapter-specific attacks (git metadata tampering, bridge scope abuse, proxy tricks, credential volume scope, spec drift) handed to TEST007 as a proposal. SPEC 16 criterion 8 depends on this wiring.

## 2. Context

TEST007 owns the catalogue ESC-001..ESC-100, probe, canaries, sinks, verdicts and the CI job fragment; it runs against the real adapter through the `Sandbox` port with the product's `EnvironmentSpec`. It cannot import adapter internals, so this task exports a narrow testing entry. Cases that exist only because of BOX design decisions (the `/git/*` mounts, proxy socket, credential scope, `/opt/overmind` mounts, agent API relay) are specified here and adopted by TEST007, which owns `tools/escape-tests/cases/`.

## 3. Scope (in)

- `createEscapeSandbox(options)` in the adapter `testing` entry, excluded from production bundles.
- Spec building for harness fixtures via the production `EnvironmentSpecBuilder`.
- Cleanup sweep for `overmind-escape-test` labelled resources.
- Proposal document with the extra cases and adapter-specific CI notes.

## 4. Out of scope

- Harness, probe and verdict logic (OVE_TEST007). Fixing escapes (owner of the failing component). Linux/Lima runners (later).

## 5. Detailed requirements

1. **Entry point:** `createEscapeSandbox({ dataDir, runDir, imageDigest, labelPrefix: 'overmind-escape-test' })` returns `{ sandbox: Sandbox, buildSpec(fixture), sweep(), teardown() }`. `sandbox` is the full production facade composed with a fake `AuditSink`, fake approval verifier and a real `ProcessRunner`. No `if (test)` branch exists in production code; only dependency injection differs.
2. **buildSpec(fixture):** converts the harness fixture (`workspaceA` rw, optional ro doc mount, credential volume, egress allowlist `[allowed.example.test]`) into a `MountPlan` and calls the production builder. The harness temp root is registered as an Allowed Directory of the fixture Workspace so PathGuard rules apply normally. The factory refuses any host path outside that temp root (assertion in `fixture-to-plan.ts`).
3. **Labelling and sweep:** each Environment gets `app.overmind.escape-test=<runId>`; `sweep()` removes escape-test labelled containers, volumes and sockets older than 1 hour and never touches other labels.
4. **Bundle exclusion:** the `testing` entry is excluded from the packaged engine bundle (build assertion shared with SETUP014: the release must not contain `createEscapeSandbox`); a lint rule forbids importing it outside `tools/escape-tests`, `packages/testing` and `*.test.ts`.
5. **Adapter-specific cases** (each specified with attack steps, evidence and pass condition in `docs/sandbox/escape-wiring.md` and in the proposal):
   - ESC-024 git metadata tamper: write a hook, `core.fsmonitor`, `filter.x.smudge` and an `!` alias into the mounted common git dir; after stop `WorktreeManager.checkIntegrity` reports `tampered` and the hardened wrapper refuses; no host canary file is created.
   - ESC-041 bridge scope: call the Agent API with the minted token on an Owner-scope route (403/404), with another Environment's token (401), and try to open another Environment's `/run/overmind/*.sock` (does not exist); verify the real host gateway socket path is not visible and `OVERMIND_API_TOKEN` is absent from other Environments and from `ps` output on the host.
   - ESC-051 proxy specifics: IP-literal CONNECT in decimal/hex/octal, CONNECT to port 22, IDN look-alike host, redirect from allowed to denied host, name rebinding to the loopback sink, header smuggling.
   - ESC-061 credential scope: CLI A's Environment cannot see CLI B's volume; with `credentialScope: 'cli-workspace'` Workspace B cannot see A's volume.
   - ESC-081 spec drift: mutate the live container via a second `container` call (add a mount); `verifyEnvironment` must destroy it and emit `sandbox.violation`.
   - ESC-082 mount modes: write through an `ro` mount must fail; `rw` persists across restart (positive control).
   - ESC-083 binary mounts: writes to `/opt/overmind/herdr` and the Skill directory fail.
6. **CI details:** job `escape-tests` runs `pnpm sandbox:escape` (build image cached by input hash, run harness with `--impl sandbox-macos`, assert no labelled leftovers). A nightly variant also runs `verifyEgressIsolation`, the BOX001 memory measurement (informational artifact) and the credential persistence test. Required for PRs touching `packages/adapters/sandbox-macos/**`, `docs/sandbox/**`, `packages/application/src/ports/Sandbox.ts` and image pins.
7. **Cheap local mode:** `--impl fake` uses `FakeSandbox` (TEST002) with the same `buildSpec`, so Linux CI exercises spec building.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EnvironmentSpecBuilder` (BOX007), the adapter facade (BOX022 re-exports), `LeakySandbox`/`FakeSandbox` (TEST002), TEST007 `EscapeCase` interface, `withTempDir`.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/testing/{create-escape-sandbox.ts,fixture-to-plan.ts,sweep.ts,index.ts}`; docs and proposal as listed. The `./testing` export is declared in the package manifest by OVE_BOX022.

## 9. Security and safety

The harness runs hostile code, so cleanup must be certain: labels, `finally` teardown, sweep at start. The testing entry never ships in releases and does not weaken production checks: it injects only fakes for audit and approval and registers the temp root through the normal mount-plan route. No real credentials or user directories are ever used.

## 10. Errors and edge cases

- Runner without `container`: clear error, the CI job fails (TEST007: never skip).
- Leftover Environments from a cancelled job: removed by `sweep()`.
- Image build cache miss in nightly: time reported, not a failure.
- Parallel jobs on one runner: run id in labels, run dir and sockets.
- Fixture asks for a path outside the temp root: factory throws (test).

## 11. Acceptance criteria

- [ ] `createEscapeSandbox` yields environments built by the production builder (spy proves `build-spec` was called).
- [ ] The production engine bundle does not contain the testing entry (build assertion).
- [ ] Each case in requirement 5 has steps, evidence and pass condition in the doc, and the proposal lists exact file names for TEST007.
- [ ] `sweep()` removes only escape-test labelled resources older than the threshold (fake inventory test).
- [ ] `--impl fake` runs on Linux CI and builds specs.
- [ ] CI notes list required paths and nightly additions.

## 12. Test plan

Unit tests for `fixture-to-plan` (rejects foreign paths), sweep selection, labelling. Integration: the real escape run on the macOS runner is the gate. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/testing`, `pnpm sandbox:escape` (macOS).

## 13. Parallelization notes

Starts when the listed adapter components are in review. TEST007 authors read the proposal; no file in `tools/escape-tests` is edited here.

## 14. Open questions and assumptions

- ASSUMPTION: TEST007 accepts the proposed cases; renumbering is its right.
- Open: where the self-hosted runner lives (SETUP021); until then the gate runs on a maintainer Mac before release.
