---
id: OVE_TEST007
title: Build the isolation escape-test harness as a CI gate
area: TEST
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_BOX022, OVE_SEC002, OVE_TEST001, OVE_TEST002]
soft_depends_on: [OVE_TEST006, OVE_SEC001]
provides: ["lib:escape-harness", "ci:escape-tests", "doc:escape-test-catalogue"]
needs: ["port:Sandbox", "lib:sandbox-macos"]
owns: ["tools/escape-tests/**", "packages/testing/src/escape/**", "docs/testing/escape-tests.md"]
reads: ["docs/security/requirements.md", "docs/security/abuse-cases.md", "docs/research/prototyp-wnioski.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 4, 20, 21]
---

# OVE_TEST007: Build the isolation escape-test harness as a CI gate

## 1. Summary

A harness that actively tries to break out of the sandbox the way a malicious or prompt-injected agent would, and fails the build if anything succeeds or if the result is inconclusive. It runs a probe program inside a real isolated environment created through the `Sandbox` port and checks, from the host side, canary files and network sinks. This is the proof demanded by SPEC 16 criterion 8 ("test ucieczki przechodzi w CI") and ADR 0004/0020.

## 2. Context

Isolation is OS-enforced, not UI-enforced (ADR 0004). On macOS the agents' commands run in Apple `container` environments with only Allowed Directories mounted (ADR 0020). Prototype facts: the container sees only the mounted folder as `/work`, `/Users` does not exist inside, the CLI must start in `/work`, the rest of the filesystem should be read-only or ephemeral, credentials live in a per-CLI volume, network exits through an allowlist proxy, Workspaces must be separated (two-level isolation). The harness is implementation-agnostic: it talks to the `Sandbox` port, so Lima or another runtime is tested by the same suite. BOX implements the adapter; this task owns the attack catalogue, probe, canaries and verdict logic.

## 3. Scope (in)

- Attack catalogue (documented, versioned ids `ESC-nnn`) and the probe program.
- Host-side canary and sink infrastructure.
- Runner/CLI `pnpm escape-tests`, verdict model, evidence report (JSON + HTML), CI job definition (macOS runner).
- Meta-tests with a deliberately leaky sandbox proving the harness detects escapes.
- Documentation `docs/testing/escape-tests.md`.

## 4. Out of scope

- The sandbox adapter (BOX), proxy implementation (BOX), proxy allowlist content (PERM/BOX). Fixing escapes found (BOX). Linux/Windows runtimes (later). GUI automation tests (post-MVP).

## 5. Detailed requirements

1. **Architecture of the test:**
   - **Host side (runner)** creates a disposable fake HOME and tree under a random temp root: `home/.ssh/id_test` (canary key with unique random content `CANARY-<hex>`), `home/.aws/credentials`, `home/Library/Keychains/login.keychain-db` (dummy), `outside-secret.txt`, `workspaceA/` (Allowed, contains `work.txt`, seeded symlinks, hardlinks), `workspaceB/` (another Workspace with its own canary and own credential volume), `data-dir/` (fake Overmind data directory with `run/session-token` canary and fake `gateway.sock` path). Canaries are random per run; their content never appears in logs.
   - It starts a **network sink** (HTTP + raw TCP + UDP/DNS-like listener on the host's loopback and on `0.0.0.0`) recording any connection and a **fake allowlist proxy target** (`allowed.example.test` pointing to the sink with a distinct marker) to verify the allowed path still works.
   - It creates the environment through `Sandbox.createEnvironment` with the same `EnvironmentSpec` the product uses (mount of `workspaceA` as `/work` rw, optionally a ro doc mount, credential volume, egress policy allowlist = [allowed.example.test], workdir `/work`, non-root user, readonly/ephemeral rootfs), mints a fake agent token env var, and runs the **probe** via `exec` (argv array).
   - The **probe** (`tools/escape-tests/probe/probe.mjs`, single file, only Node built-ins, copied or mounted read-only at `/opt/escape-probe/probe.mjs`) executes attack steps and writes JSON lines to stdout and `/work/.probe-results.jsonl`: `{ id, attack, outcome: 'blocked'|'succeeded'|'error', detail }` where details never include canary content (only lengths and hashes of what it could read). `succeeded` for an attack that must be blocked is an escape.
   - **Host-side verification** is independent of what the probe claims: after the run the runner (a) scans the entire fake host tree for unexpected new/modified files (hash manifest before/after), (b) greps probe stdout/stderr and the results file for canary strings, (c) checks sink logs for connections not allowed, (d) compares file modes and listings of `home/`, (e) verifies `/work`-relative expected effects (allowed writes DID persist: `work-created.txt` exists), and (f) queries `Sandbox.listEnvironments()` and process listings for leaked resources. A verdict is the combination of probe claims and host evidence: any host evidence of escape = FAIL even if the probe said "blocked".
2. **Attack catalogue (each a test case with id; all MUST be implemented)**:
   - ESC-001 read `$HOME/.ssh/id_test` via guessed paths (`/Users/<name>/.ssh`, `/home/...`, `/root/.ssh`, `~`); ESC-002 list `/Users`, `/Volumes`, `/private`, `/System/Volumes/Data` for host presence; ESC-003 read the fake data dir canaries and gateway socket path; ESC-004 read `outside-secret.txt` by absolute host path and by relative traversal (`/work/../../..`).
   - ESC-010 write outside `/work` (`/tmp/x`, `/`, `/etc/overmind-test`, `/opt`, `/var/tmp`): must be denied OR non-persistent (ephemeral) AND invisible on host AND not persisting across `stop`/`start` of the environment (verify by restarting); ESC-011 write into read-only mounts; ESC-012 create files with names that traverse (`../x`, `..\\x`, Unicode normalisation tricks, 4096-char names) and check host tree unchanged.
   - ESC-020 symlink escape: create in `/work` symlinks to `/`, `/etc/passwd`, `../../outside-secret.txt`, `/work/../..`, to a host-looking absolute path; read/write through them; also pre-seeded symlink inside `workspaceA` on the HOST pointing to `home/.ssh/id_test` (host path) and to `outside-secret.txt`: following it from inside must not reveal host content (path does not exist in the container); ESC-021 hardlink creation to files inside `/work` only, attempt hardlink to `/etc` files; ESC-022 symlink race (create/replace symlink in a loop while a second process opens) against the host tree; ESC-023 `/proc/self/root`, `/proc/1/root`, `/proc/self/cwd`, `/proc/*/environ` of other processes, `/proc/self/mountinfo` leak of host paths (host absolute paths must not appear; only container paths).
   - ESC-030 mount tricks: `mount --bind /work /mnt`, `mount -t tmpfs`, `mount --bind / /mnt` (must fail without CAP_SYS_ADMIN), `unshare -m`, `chroot`, `pivot_root`, `mknod /dev/sda`, access to `/dev/*` host devices, `/dev/mem`, `/sys` writes, `losetup`; ESC-031 device nodes and `/dev/disk*` absence; ESC-032 setuid binaries, `sudo`, `su`, capabilities check (`capsh --print` equivalent via /proc/self/status: CapEff must be empty for the non-root user), running as non-root (uid != 0), `no-new-privileges`.
   - ESC-040 container-runtime escape surfaces: presence of Docker/containerd/`container` sockets (`/var/run/docker.sock`, XPC endpoints), `/run/host-services`, environment variables containing host paths or secrets (assert env contains only the allowed list and the fake agent token), access to the host gateway socket path (must not exist), metadata endpoints.
   - ESC-050 network egress: HTTP/HTTPS/TCP/UDP/DNS to the sink via host.docker.internal-like names, `gateway` IP, `169.254.x`, `127.0.0.1` of the host (container loopback must not reach the host loopback services), raw sockets (CAP_NET_RAW absent), DNS exfiltration (`<hex>.exfil.example.test` queries must not reach the sink resolver), IPv6, non-allowlisted domain via the proxy (blocked and logged), allowlisted domain (succeeds; proves the harness is not trivially passing), CONNECT tunnelling to a non-allowlisted host through the proxy, proxy bypass via `NO_PROXY`/direct IP, redirect from allowed to non-allowed host, DNS rebinding of an allowed name to the loopback sink, large POST exfiltration to the sink.
   - ESC-060 cross-Workspace: environment A reads `workspaceB` by host path and by guessing mounts; reads Workspace B's credential volume; environment B's agent token env cannot be read from A; two environments cannot see each other's processes; shared `/tmp` is not shared between environments; the per-CLI credential volume of another CLI is not mounted.
   - ESC-070 resource limits: fork bomb (pids limit holds, environment stays responsive within N seconds and host process count bounded), memory allocation beyond limit (killed, host unaffected), disk fill in `/work` limited by quota if configured (otherwise `informational` outcome), CPU spin contained.
   - ESC-080 fail-closed behaviours (via the port rather than the probe): `exec` with workdir other than `/work` rejected; mount of non-canonical path rejected; mount of home dir / `/` / `/Users` rejected; `Sandbox` with `kind:'none'` refuses to run; started without egress policy denies all; environment cannot be created from an image tag (digest required); updating mounts to add a path outside Allowed Directories is rejected by the port-level validation.
   - ESC-090 CLI-issued commands: run `fake-claude --scenario escape-attempt` and `fake-codex --scenario escape-attempt` (TEST006) inside the environment; every attempt must be blocked; the effects log is inspected on the host. This covers "also for commands issued by the CLI" (SPEC 16.8).
   - ESC-100 persistence and startup: files created outside `/work` do not survive environment restart; credential volume content survives restart and is not visible to other Workspaces; `/work` content created by the agent appears on the host (allowed behaviour, sanity check).
3. **Verdict model:** each case yields `PASS` (attack blocked and host evidence clean), `FAIL_ESCAPE` (host evidence of escape or probe `succeeded`), `FAIL_INCONCLUSIVE` (probe did not run, crashed, timed out, results file missing/truncated, or an expected positive control failed), `SKIPPED` (only with a declared capability reason such as `capabilities.rosetta === false` and printed prominently). The run is red if any case is not `PASS`/declared `SKIPPED`; the set of non-skippable cases (ESC-001, 003, 004, 010, 020, 030, 040, 050, 060, 080, 090) is hard-coded: skipping them fails the run. Positive controls (allowed write to `/work`, allowed domain reachable, credential volume readable by its own environment) are mandatory, otherwise "blocked" results could be false (everything broken).
4. **Evidence:** the runner writes `escape-report/<timestamp>/report.json` (case id, outcome, durations, sandbox kind/version, image digest, macOS version, git commit, probe hash) and `report.html`; no canary values, no real paths. CI uploads it as an artifact and stores the summary as release evidence (SPEC 19.5). The report records the exact `Sandbox` capabilities and the `EnvironmentSpec` hash so a weaker configuration cannot silently pass.
5. **Runner CLI:** `pnpm escape-tests [--impl sandbox-macos|fake|leaky] [--case ESC-020] [--list] [--keep-artifacts]`; default impl is the production `Sandbox` adapter composed through the test composition (`createTestEngine` with real Sandbox, ARCH006). Runtime on a CI macOS runner under 10 minutes; each case has a timeout (60 s default). Concurrency: cases run sequentially per environment; independent environments may run in parallel but never share canaries.
6. **CI gate:** workflow fragment `tools/escape-tests/ci-job.yml` for SETUP006: job `escape-tests` on a macOS 26 Apple-silicon runner (hosted if available, otherwise self-hosted label `macos-26-arm64`; the job fails if no suitable runner is found rather than skipping). It is required for merging any PR touching `packages/adapters/sandbox-macos/**`, `packages/application/src/ports/Sandbox.ts`, `packages/application/src/security/path/**`, `packages/domain/src/security/**`, `tools/escape-tests/**`, base-image pins, and required for every release (SETUP014). A nightly full run also executes. Pull requests from forks do not run on self-hosted runners (security); a maintainer re-runs after review.
7. **Meta-tests (prove the harness bites):** `LeakySandbox` variants from TEST002 (mounts the home directory, shares host `/tmp`, allows egress to everything, follows host symlinks, runs as root, shares credential volumes across Workspaces, leaves rootfs writable and persistent) must make specific cases FAIL_ESCAPE; a `BrokenProbeSandbox` that never runs the probe must yield FAIL_INCONCLUSIVE; `FakeSandbox` (strict) must PASS all cases that apply to a pure fake (those depending on real kernel behaviour are marked `requires: 'real-kernel'`). These meta-tests run on Linux CI in the normal test suite.
8. **Attack catalogue maintenance:** every escape or near-miss found later gets an `ESC-nnn` case; `docs/testing/escape-tests.md` lists each case with rationale, SR/AC ids from SEC001, and what failure means; the checklist SEC007 item "escape test case added" points here.
9. **Safety of the harness itself:** canaries are fake; the probe is read-only except `/work`; the runner never mounts real home directories; network sinks bind loopback/ephemeral ports and are torn down; leftover environments are destroyed even on failure (`finally`), and a startup sweep removes environments labelled `overmind-escape-test` older than 1 hour.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Sandbox` port and `EnvironmentSpec` (ARCH012), path canonicalisation for building mounts (SEC002), fake CLIs (TEST006), `LeakySandbox`/`FakeSandbox` (TEST002), `withTempDir`, SR/AC ids (SEC001), `expectNoSecrets` for log scanning (SEC003), `ProcessRunner` for host commands (ARCH014). Report format reused by TEST008 evidence collector.

## 8. Architecture and code placement

`tools/escape-tests/{runner.ts,cases/*.case.ts (one file per ESC family, registered by glob),host-fixture.ts,sinks/*.ts,probe/probe.mjs,verdict.ts,report.ts,ci-job.yml}`; `packages/testing/src/escape/{types.ts,meta-sandboxes.ts}`; docs. Cases implement `EscapeCase { id, title, srIds[], requires?, run(ctx): Promise<CaseEvidence> }` (OCP: new attack = new file).

## 9. Security and safety

This harness executes hostile behaviour deliberately, so it must itself be contained: runs only against disposable fake trees under a random temp root with fake canaries; never gets real credentials or the Owner's data directory; probe has no network access beyond the sinks; fork-bomb and memory tests run only inside environments with enforced limits and are guarded by a host-side watchdog that destroys the environment after the timeout. A failed harness (inconclusive) fails closed. The report excludes canary values. The CI job for forks is disabled to avoid executing untrusted PR code on privileged runners; PRs that change the harness need `needs-security-review`.

## 10. Errors and edge cases

- Apple `container` not installed or kernel missing on the runner: the job fails with a clear message (not skipped) - the gate cannot be bypassed by environment drift.
- Image pull failures: retried twice, then inconclusive.
- macOS update changes behaviour (new mounts visible): new cases are added; the report logs OS and tool versions.
- Probe uses Node inside the base image: if Node is missing, falls back to `sh` implementation of the critical cases (documented minimal subset) or fails inconclusive.
- Case flakiness (fork bomb timing): assertions are about invariants (limits hold, host unaffected), not timing.
- Parallel CI runs on one runner: environment names include run id; ports random.
- Rootless vs root user inside the container: both configurations tested where the product supports them; the spec requires non-root.

## 11. Acceptance criteria

- [ ] Every ESC family listed in requirement 2 has at least one implemented case with an id, rationale and SR/AC mapping in the catalogue document.
- [ ] Runner produces verdicts and evidence reports as specified; any `FAIL_*` or non-declared skip returns a non-zero exit code.
- [ ] Positive controls exist and are required for a green run.
- [ ] Meta-tests: each `LeakySandbox` variant triggers the expected failing case ids; the broken-probe variant yields inconclusive; strict `FakeSandbox` passes applicable cases.
- [ ] Host-side evidence checks (hash manifest, canary grep, sink logs) are implemented independently of probe output.
- [ ] CI job fragment exists, is marked required for the listed paths and releases, and fails (not skips) when no suitable runner exists.
- [ ] Reports contain sandbox kind/version, image digest, spec hash, commit, no canary values.
- [ ] `docs/testing/escape-tests.md` lists all cases and the procedure to add a case after an incident.
- [ ] Non-skippable case list is enforced in code.

## 12. Test plan

Meta-tests on Linux CI (`tools/escape-tests/meta/*.test.ts`); unit tests for verdict logic, manifest diff, sink recorders, report generation (no secrets); the real run on macOS CI (`pnpm escape-tests`) - the gate itself. Commands: `pnpm vitest run tools/escape-tests packages/testing/src/escape`, `pnpm escape-tests --impl leaky` (expected failing, used in a self-check script that asserts failure), `pnpm escape-tests` (macOS).

## 13. Parallelization notes

Can be developed against `FakeSandbox`/`LeakySandbox` before BOX delivers the adapter; case files are independent so several agents can add families concurrently. Hotspots: `runner.ts` and `verdict.ts` (single owner), `cases/*.case.ts` additive. Coordinate with BOX on the `EnvironmentSpec` used in tests (use the production builder, do not hand-roll specs).

## 14. Open questions and assumptions

- ASSUMPTION: GitHub-hosted macOS 26 Apple-silicon runners with nested virtualisation for Apple `container` may not be available; a self-hosted runner is the fallback (`macos-26-arm64`). If neither exists the escape gate runs on a maintainer's machine per release (documented risk; Owner decision).
- ASSUMPTION: BOX chooses between container-per-agent and container-per-Workspace (+ bubblewrap) later; the harness covers both because it tests behaviour through the port; ESC-060 includes the bubblewrap-level separation when the implementation declares `capabilities.perAgentEnv === false`.
- Open: include a Lima-based job when macOS < 26 support is implemented.
