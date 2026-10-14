---
id: OVE_SETUP021
title: Self-hosted ephemeral macOS 26 runner for isolation escape tests (runbook and scripts)
area: SETUP
kind: infra
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_SETUP006]
soft_depends_on: [OVE_SETUP015, OVE_SETUP018]
provides: ["lib:isolation-runner", "lib:runner-runbook"]
needs: []
owns:
  - tools/runner/**
  - docs/engineering/self-hosted-runner.md
reads: [".github/workflows/isolation.yml", "docs/research/prototyp-wnioski.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 17"]
adr_refs: [4, 20, 25]
---

# OVE_SETUP021: Self-hosted ephemeral macOS 26 runner for isolation escape tests

## 1. Summary

Provide the runbook and the supporting scripts to operate one dedicated Apple-silicon Mac (macOS 26) as a GitHub Actions self-hosted runner that executes only the isolation escape-test workflow (`isolation.yml`) on trusted code, with per-job ephemerality, a separate unprivileged user, network restrictions, health checks and clean teardown of containers and volumes. Hosted runners cannot be assumed to offer macOS 26 with nested virtualization, and the isolation tests are a release gate (SPEC 16.8).

## 2. Context

Apple's `container` tool needs macOS 26 on Apple silicon and starts a lightweight Linux VM per container (ADR 0020, prototype: container 1.5.0, about 1.3 GiB RAM per active agent). Escape tests deliberately try to break out of the isolation (OVE_TEST007), so they run attacker-like code (the repository's own code under test, plus probes). A self-hosted runner is a persistent machine on someone's network: GitHub's guidance is never to use self-hosted runners with public repositories unless jobs are tightly controlled, because fork PRs could run arbitrary code. OVE_SETUP006 therefore restricts `isolation.yml` to merge groups, pushes to `main`, manual dispatch, and label-gated same-repository PRs. This task makes the machine side safe enough for that policy.

## 3. Scope (in)

- `docs/engineering/self-hosted-runner.md`: hardware and OS requirements, threat model, setup steps, operation, incident response.
- `tools/runner/install.sh` (idempotent bootstrap run once by the Owner as admin), `tools/runner/supervisor.sh` + `launchd/dev.overmind.ci-runner.plist` (ephemeral loop), `tools/runner/cleanup.sh` (per-job wipe), `tools/runner/health-check.sh`, `tools/runner/uninstall.sh`.
- ShellCheck-clean scripts with tests via `bats` or a Node test harness invoking them with a fake `PATH`.

## 4. Out of scope

- The escape tests themselves: OVE_TEST007. The workflow file: OVE_SETUP006.
- Buying or hosting the machine; Owner provides it.
- Apple `container` product integration code: BOX area.
- Running other CI jobs on this machine (forbidden by design).

## 5. Detailed requirements

1. **Machine requirements (documented):** Apple silicon Mac (M1 or newer; M3+ if nested virtualization of a VM-based variant is ever wanted), macOS 26.x with automatic updates paused between reviewed upgrades, at least 16 GB RAM and 150 GB free SSD, dedicated to CI (no personal accounts, no browser sessions, no iCloud, no Keychain items of the Owner), FileVault ON plus physical security, firewall ON, remote login disabled except from the Owner's admin IP.
2. **Accounts and separation.** Admin user (Owner) used only for setup. A standard (non-admin) user `ovm-ci` runs the runner process and the jobs; it has no sudo, no access to the admin's home, no stored GitHub credentials except the ephemeral runner token. A root-owned supervisor (launchd daemon) holds the registration credential (fine-grained token with only the repository permission needed to create runner registration tokens) in `/var/root/` or the System keychain, readable only by root; jobs cannot read it (test: attempt as `ovm-ci` fails).
3. **Ephemeral runner loop (`supervisor.sh`).** Repeat: request a one-time registration token via `gh api` (as root, scoped to this repository), start the official GitHub runner binary as `ovm-ci` with `--ephemeral --unattended --labels self-hosted,macOS,ARM64,overmind-macos26 --work /Users/ovm-ci/_work/<random>` so it accepts exactly one job and deregisters, wait for exit, run `cleanup.sh`, sleep 5 s. The runner binary version and SHA-256 are pinned in `tools/runner/runner.lock.json` (downloaded through the pinned downloader, OVE_SETUP006); runner self-update is disabled (`--disableupdate`) and updates are deliberate. The runner is registered at repository level with labels exactly as used by `isolation.yml`; the Owner restricts it to the single workflow where the plan supports runner groups ("selected workflows"), otherwise the job `gate` in `isolation.yml` is the control.
4. **Per-job cleanup (`cleanup.sh`, runs as root after each job):** stop and remove all containers, volumes, networks and images created by the job (names prefixed `ovm-ci-`; plus a full `container` system data reset between jobs: `container system stop`, remove the data root, `container system start` + kernel check), delete the work directory, kill leftover processes of user `ovm-ci` (`pkill -u ovm-ci`), clear `/tmp` entries owned by `ovm-ci`, clear its keychain and caches, remove launch agents/daemons the job may have created in `~/Library/LaunchAgents` (the escape tests install a test LaunchAgent for the engine), reset `defaults` domains created by tests (list in script), and verify the home directory against a manifest of expected files (hash list); any unexpected persistent file triggers `quarantine` mode: the supervisor stops and notifies (see 7).
5. **Base environment pre-provisioning (install.sh):** Xcode command line tools, the pinned `container` pkg (version and SHA-256 in `tools/runner/container.lock.json`, signature verified by `pkgutil --check-signature`), kernel installed, the Node image pinned by digest pre-pulled for tests, Node 22.23.3 via the pinned archive (no Homebrew auto-updates), pnpm via corepack. Lock files are CODEOWNERS-protected.
6. **Network policy:** egress allow-list through the macOS packet filter (`pf`) or the router: GitHub (`github.com`, `api.github.com`, `*.actions.githubusercontent.com`, `*.githubusercontent.com`, `ghcr.io`), the npm registry, the container image registries used by the tests, Apple services needed for `container` kernel download only during maintenance windows. Everything else denied. No access to the LAN (including the Owner's other machines) except DNS and the gateway. The escape tests assert from inside containers that LAN addresses and metadata endpoints are unreachable (OVE_TEST007); the host policy is a second layer.
7. **Monitoring and incident response:** `health-check.sh` (invoked by launchd every 10 minutes) checks: supervisor alive, runner binary version matches the lock, disk > 20% free, `container system status`, clock sync, no processes of `ovm-ci` older than the job timeout; results are written to a log and, on failure, a notification via a webhook URL stored in root's keychain (optional) or macOS notification for the console user. Runbook sections: quarantine procedure (disconnect network, `launchctl bootout`, wipe `ovm-ci`, rebuild from `install.sh`), suspected compromise (rotate the registration token, review `gh run list` history, re-image the machine), runner offline (what blocks: releases and merge queue), planned OS upgrade procedure.
8. **Job constraints:** `isolation.yml` sets `timeout-minutes: 30`; the supervisor additionally kills the runner process group after 45 minutes. Max one job at a time (single runner). Concurrency group `isolation` with `cancel-in-progress: false`.
9. **Auditability:** the supervisor appends to `/var/log/overmind-ci/supervisor.log` (rotated, mode 0640 root:admin): timestamp, job run id (from the runner's `_diag` log), exit code, cleanup result; no secrets. Evidence artifacts from the job are uploaded by the workflow, not by the supervisor.
10. **Uninstall:** `uninstall.sh` removes launchd items, the user data of `ovm-ci`, runner binaries, and deregisters leftover runners.
11. **Documentation of residual risk:** label-gated PR runs execute code written by a collaborator with write access. A malicious or compromised collaborator can attack the runner host. Mitigations: the dedicated, wiped, network-restricted machine, no secrets, and the rule that the label is applied by a maintainer after reading the diff. Documented honestly in the runbook.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Pinned downloader and lock-file pattern from OVE_SETUP006; the container version policy constants from OVE_SETUP015 (the runner's `container` version equals `MIN_CONTAINER_VERSION` or newer tested); cleanup naming prefix `ovm-ci-` shared with `isolation.yml` and OVE_TEST007.

## 8. Architecture and code placement

Operations tooling in `tools/runner/` (bash with `set -euo pipefail`, ShellCheck-clean) and documentation; no product code. Scripts take configuration from a root-owned file `/etc/overmind-ci.conf` (not in the repo).

## 9. Security and safety

- Self-hosted runner + public repository is a known dangerous combination; controls: never for fork PRs, never for unreviewed code (label by maintainer, merge group, main), ephemeral single-job runners, dedicated unprivileged user, root-held registration credential unreadable by jobs, per-job wipe with manifest check, network egress allow-list, no repository or organization secrets exposed to the job, short job timeouts, pinned and checksum-verified runner and container installers.
- The runner token and webhook URL never appear in logs, process lists (read from files/keychain, passed via environment to the single child) or the repository.
- Supply chain: runner binary, `container` pkg, Node archive pinned by hash; Homebrew auto-update disabled; OS updates reviewed.
- Fail closed: on any cleanup anomaly the supervisor stops accepting jobs; the release is blocked rather than run on a dirty host.
- Physical and disk security: FileVault, no personal data on the machine.
- Auditing: supervisor log plus GitHub's own runner and job history.

## 10. Errors and edge cases

- Runner fails to register (token request rejected): back off exponentially up to 10 minutes; health check alerts after 3 failures.
- Job exceeds the supervisor timeout: process group killed, cleanup runs, job marked failed by GitHub.
- Power loss mid-job: on boot `install.sh`-installed launch daemon runs `cleanup.sh` before starting the supervisor.
- `container` system fails to start after cleanup: supervisor enters quarantine and alerts.
- macOS update reboots the machine: documented maintenance window and manual verification (`health-check.sh --full`).
- Clock drift breaks token validity: health check compares with `sntp`.
- Runner image of GitHub deprecates the runner version: pin bump procedure in the runbook.

## 11. Acceptance criteria

- [ ] On a fresh macOS 26 Apple-silicon machine, `sudo tools/runner/install.sh` followed by documented steps results in a registered ephemeral runner that executes a label-gated `isolation.yml` run end to end.
- [ ] After each job, `cleanup.sh` leaves no containers/volumes with the `ovm-ci-` prefix, no files in `_work`, no extra launch items; the home manifest check passes.
- [ ] As user `ovm-ci`, reading the registration credential or the admin's home fails.
- [ ] A job that tries `curl http://192.168.0.1` (LAN) is blocked by the host policy (documented test job, manual).
- [ ] Killing the machine mid-job and rebooting results in a clean state before the next job.
- [ ] `health-check.sh` reports OK on a healthy host and fails when the container system is stopped.
- [ ] Scripts pass ShellCheck; unit tests with a fake PATH pass.
- [ ] The runbook lists the residual risk from requirement 11.

## 12. Test plan

ShellCheck in CI (`workflow-lint` job extension via proposal). Script tests with `bats-core` (pinned) or Node-driven tests that put fake `container`, `gh`, `launchctl`, `pkill` binaries on `PATH` and assert command sequences and refusal conditions (quarantine on unexpected files). Manual acceptance on the real machine, recorded in the PR (log excerpts, no secrets). Commands: `shellcheck tools/runner/*.sh`, `pnpm test -- tools/runner`.

## 13. Parallelization notes

Parallel with OVE_SETUP014, 015 and TEST007. Needs a physical Mac, so the manual acceptance may run later than code review; code can merge with the manual checklist pending (status stays `in_review` until done). Hotspot: `runner.lock.json`, `container.lock.json` updated only by deliberate upgrade PRs.

## 14. Open questions and assumptions

- ASSUMPTION: a dedicated Mac mini owned by the Owner; GitHub-hosted macOS 26 with nested virtualization is not available.
- Open question: use Tart (Virtualization.framework VMs) for per-job VM ephemerality on M3 or newer hardware; default no (nested virtualization requirements and image maintenance); revisit if the threat model grows.
- Open question: GitHub plan features (runner groups restricted to selected workflows) may not exist for a personal repository; the workflow `gate` job is then the only control.
- Open question: who monitors the notification channel when the Owner is away.
