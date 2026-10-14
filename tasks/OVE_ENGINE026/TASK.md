---
id: OVE_ENGINE026
title: "Spike with decision: peer credential check for the Unix socket (SR-11)"
area: ENGINE
kind: spike
size: S
priority: P2
mvp: false
status: todo
depends_on: [OVE_ENGINE010, OVE_SETUP011]
soft_depends_on: [OVE_SEC005]
provides: ["decision:peer-credentials", "lib:peer-credentials"]
needs: ["lib:gateway-server"]
owns: ["docs/research/peer-credentials-spike.md", "docs/adr/gateway-peer-credentials.md"]
reads: ["docs/security/gateway-auth.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13"]
adr_refs: [5, 6]
---

# OVE_ENGINE026: Spike with decision: peer credential check

## 1. Summary

SR-11 says the gateway SHOULD verify that the process at the other end of the Unix socket runs as the same user (peer uid), in addition to the token. A Node server has no API for `LOCAL_PEERCRED`/`getpeereid`. This time-boxed spike evaluates the options and records a decision.

## 2. Context

SEC005 G3 and its open question: options are a small native helper, a launchd-provided socket with a helper, or accepting socket permissions (0600 in a 0700 directory) plus the token. Socket permissions already restrict connects to the same uid (and root) on macOS; the extra check is defence in depth against mode mistakes and against root-less impersonation scenarios that do not exist for a single-user Mac. Cost: a native addon must be signed (SETUP014) and complicates the Node SEA packaging (SETUP011).

## 3. Scope (in)

- Evaluate: (A) no check (permissions + token) with documented residual risk; (B) native addon via N-API exposing `getpeereid`; (C) tiny separate helper binary spawned per connection (too slow, expected drop); (D) `launchd` socket activation with a Swift/Rust shim; (E) verifying via `lsof`/`netstat` of the peer (racy, expected drop).
- Measure feasibility on macOS: can the fd of an accepted `net.Socket` (`socket._handle.fd`) be passed to a native function; binary size; signing impact; Node SEA compatibility.
- Decision ADR and, if B is chosen, the interface `PeerCredentialProvider` (`uidOf(socket): Result<{uid,pid?}>`) for ENGINE010's `onConnection`.

## 4. Out of scope

- Implementing the chosen native helper (follow-up task if chosen). Windows/Linux (`SO_PEERCRED` noted only).

## 5. Detailed requirements

1. Time box 3 hours; default if inconclusive: option A (no native check), documented residual risk, SEC005 peer tests remain `skip(reason)` by capability flag `peerCredentials: false`.
2. Document each option: security gain (what attack it stops that mode 0600 + token do not), complexity, packaging impact (SEA cannot load `.node` from the blob: separate signed file in Resources, SETUP011 note), maintenance, license.
3. Analyse the threat precisely: with socket mode 0600 owned by the user and a 0700 parent, which attackers can connect? (same uid processes: yes, root: yes; other uids: no). The peer check does not stop same-uid malware (which can read the token file anyway). It adds value only if a bug creates a wider socket mode or the socket path is exposed in a shared directory (fallback `tmpdir` path). State this conclusion explicitly.
4. If a prototype of B is built, record: macOS API (`LOCAL_PEERCRED` via `getsockopt(SOL_LOCAL)` or `getpeereid`), fd extraction, latency per connection (< 1 ms target), behaviour with keep-alive.
5. Output: research doc plus ADR with decision, SR-11 status (MUST/SHOULD/N-A), consequences for SEC005 tests and SETUP011/014.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Findings feed SEC005 capability flags and SETUP011 packaging notes.

## 8. Architecture and code placement

Docs only. If B is chosen, a new task creates `packages/adapters/peer-cred-macos/`.

## 9. Security and safety

The decision must not weaken the baseline: permissions check (G2) and token (G4) stay mandatory in every option. Any native helper increases the signed attack surface and must be reviewed.

## 10. Errors and edge cases

- Helper missing at runtime: fall back to option A with a startup warning, never block (unless config `gateway.requirePeerCredentials: true`, then fail closed).
- Fd extraction not possible on the pinned Node: option B is dropped.

## 11. Acceptance criteria

- [ ] Research doc compares all five options with the threat analysis in requirement 3.
- [ ] ADR states the decision, SR-11 status and consequences.
- [ ] SEC005 capability flag value is stated (`peerCredentials` true/false).

## 12. Test plan

Prototype outputs pasted into the doc; no tests on `main`. If B is prototyped, latency numbers from 1000 connections.

## 13. Parallelization notes

Independent; can run any time after ENGINE010 exists; not on the MVP critical path.

## 14. Open questions and assumptions

- ASSUMPTION: default option A. The Owner may require B after reading the analysis.
