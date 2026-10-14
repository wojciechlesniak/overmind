---
id: OVE_BOX001
title: "Decision: isolation granularity (container per Agent) and resource budget, measured"
area: BOX
kind: decision
size: S
priority: P0
mvp: true
status: todo
depends_on: []
soft_depends_on: [OVE_SETUP015, OVE_SETUP021]
provides: ["decision:sandbox-granularity", "doc:sandbox-resource-budget"]
needs: []
owns:
  - docs/adr/*-isolation-granularity.md
  - docs/research/box-granularity-measurements.md
reads: ["docs/research/prototyp-wnioski.md", "docs/security/requirements.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 16", "SPECIFICATION 18"]
adr_refs: [4, 20, 22]
---

# OVE_BOX001: Decision: isolation granularity (container per Agent) and resource budget, with measurements

## 1. Summary

ADR 0020 leaves open whether Overmind runs one Apple `container` per Agent (strongest isolation, about 1.3 GiB RAM each) or one per Workspace with bubblewrap per Agent inside. This task measures both on a real Mac, records the numbers, and writes the ADR that fixes the granularity, the default resource limits and the warm-reuse policy that all other BOX and PROV tasks assume.

## 2. Context

Prototype (`docs/research/prototyp-wnioski.md` section 5B): `container` 1.5.0, `node:22`, 2 CPU, 4 GiB limit; one active Claude used 1.29 GiB RAM, 1.6% CPU, 11 processes; two-level isolation worked in a Linux VM with bubblewrap (test 7). Spec: 3 parallel Agents by default (SPEC 9), isolation enforced by the OS (SPEC 11), `Sandbox.capabilities().perAgentEnv` exists in `OVE_ARCH012` so both models fit the port. SR-33 requires Workspaces to be isolated from each other at sandbox level; TEST007 ESC-060 tests exactly that. A decision is needed before BOX008 (lifecycle) and PROV009 (sessions) are written against it.

## 3. Scope (in)

- Measurement protocol executed by the implementer on a real Apple-silicon Mac with macOS 26 (numbers are evidence; do not estimate or copy the prototype).
- ADR "Isolation granularity and resource budget" (next free ADR number, slug `isolation-granularity`).
- Measurements document with raw numbers, hardware, versions, commands.
- Default resource table and warm-reuse policy, written as constants the config section in OVE_BOX017 will adopt.

## 4. Out of scope

- Implementation of lifecycle, limits and stats: OVE_BOX008, OVE_BOX017.
- Lima or other runtime for macOS < 26: later / not planned for MVP (ADR 0020 note).
- The herdr-in-container transport: OVE_BOX002.

## 5. Detailed requirements

1. **Options compared** (table in the ADR, each with measured data): (A) one container per Agent; (B) one container per Workspace with bubblewrap per Agent; (C) one shared container with no inner sandbox (documented only to be rejected: it breaks SR-33).
2. **Measure on A and B** with `container stats --no-stream`, `container run`/`exec` timing, and `vm_stat`/Activity Monitor for host impact: cold start time of the first container (including kernel), warm start of a second, RSS idle, RSS with `claude` and `codex` doing a small task, RSS with 3 simultaneous Agents, behaviour at 4 GiB / 2 GiB limits, behaviour when the host has 8 GiB and 16 GiB RAM (if hardware is available; otherwise record "not measured" explicitly).
3. **Bubblewrap feasibility check for B:** in an unprivileged non-root container `bwrap --unshare-all` normally needs user namespaces or CAP_SYS_ADMIN. Record whether it works with an empty effective capability set (ESC-032 requires CapEff empty). If it requires extra capabilities, B is rejected because it weakens the container itself.
4. **Default decision (ASSUMPTION, confirm with data):** option A. Reasons to verify: simplest trust boundary (VM per Agent, no inner namespace code), matches `perAgentEnv: true`, no capabilities needed, SR-33 satisfied by construction (another Workspace's folder is never mounted). Cost: roughly 1.3 GiB per active Agent, so about 4 GiB at the default parallel limit of 3.
5. **Resource defaults to record** (final values come from the measurements): `cpus: 2`, `memoryMiB: 4096` hard limit, planning estimate `memoryEstimateMiB: 1536` per active Agent, `pidsLimit: 512`, `maxParallelAgents: 3`, minimum host RAM warning threshold (recommended: warn below 16 GiB total, block starting another Agent when available memory is below `estimate + 2048 MiB`).
6. **Warm-reuse policy:** an Environment is created when an Agent is granted a slot, kept running while the Agent has work, stopped after `idleStopSeconds` (default 600) and destroyed (root filesystem discarded) after `idleDestroySeconds` (default 3600) or when its Workspace mounts change. `/work` (host folder) and credential volumes persist; everything else is disposable.
7. **Mount-change rule:** adding or removing an Allowed Directory recreates the Environment (ADR 0020: a Zgoda means attaching the directory to the VM); there is no live mount mutation unless measurements show `container` supports it safely (record the finding).
8. The ADR states consequences for: `Sandbox.capabilities()` values, ESC-060 interpretation (cross-Workspace separation is by construction), PROV session resume (a recreated container loses herdr state, so CLI session ids must live on the credential volume), memory-pressure queueing.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

ADR template and index (OVE_OSS006), measurement conventions of SPEC 19.5 (real evidence only), prototype commands from `docs/research/prototyp-wnioski.md` section 4B.

## 8. Architecture and code placement

Documents only: `docs/adr/<next>-isolation-granularity.md` (Polish ADR conventions follow OVE_OSS005/OSS006: English), `docs/research/box-granularity-measurements.md`. Downstream tasks cite the ADR number once assigned.

## 9. Security and safety

This decision defines the strength of the main security boundary. The ADR MUST state which attacker it defends against (malicious repository, prompt-injected CLI, compromised agent in Workspace A reaching Workspace B) and which it does not (kernel or hypervisor escape of Apple's VM). Measurements are run on a test Mac with fake projects only; no real credentials are in the measured containers except the Owner's own CLI login when the Owner runs the CLI measurements (the credentials never leave the machine or enter the document).

## 10. Errors and edge cases

- The Mac has less than 16 GiB RAM: record results anyway and define the warning threshold.
- `container` update changes memory behaviour: the document lists versions; BOX021 reruns the memory test in CI nightly (informational).
- Measurement cannot be performed (no suitable Mac): the ADR is accepted as "provisional" with option A and the gap is listed in section 14 of this task; downstream tasks proceed with A.

## 11. Acceptance criteria

- [ ] ADR exists, compares A, B and C, and states the chosen option with the numeric evidence.
- [ ] Measurements file lists hardware, macOS and `container` versions, exact commands and raw outputs (scrubbed of user names).
- [ ] Bubblewrap capability finding for B is recorded (works with empty CapEff: yes or no).
- [ ] Resource defaults, warm-reuse timers and the mount-change rule are listed as constants for OVE_BOX008 and OVE_BOX017.
- [ ] The ADR states the consequence for SR-33 and ESC-060.

## 12. Test plan

Documentation task. Review: another maintainer re-runs two of the measurements on a second machine if available. Link check for the ADR index (`OVE_OSS006` tooling).

## 13. Parallelization notes

Can start immediately; BOX002 can run in parallel (same Mac session). Downstream BOX tasks should not start BOX008 before this merges; BOX003-BOX006 do not depend on the result.

## 14. Open questions and assumptions

- ASSUMPTION: option A (container per Agent) is chosen; if measurements show memory is prohibitive on 8 GiB machines, the ADR may define a lower default of 2 parallel Agents on such hosts (the config default stays 3, with a startup warning).
- Open for the Owner: minimum supported RAM (recommendation 16 GiB).
