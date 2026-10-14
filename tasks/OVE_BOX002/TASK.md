---
id: OVE_BOX002
title: "Spike: host-container channels and herdr inside the container (SSH, socket, exec relay)"
area: BOX
kind: spike
size: M
priority: P0
mvp: true
status: todo
depends_on: []
soft_depends_on: [OVE_SETUP015, OVE_BOX001]
provides: ["decision:herdr-in-container", "decision:sandbox-channels"]
needs: []
owns:
  - docs/research/box-channels-spike.md
  - docs/adr/*-herdr-in-container-and-channels.md
reads: ["docs/research/herdr-analiza.md", "docs/research/prototyp-wnioski.md", "docs/engineering/bundled-binaries.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 18"]
adr_refs: [4, 5, 20, 22, 26, 27]
---

# OVE_BOX002: Spike: host-to-container channels and herdr inside the container (SSH vs socket vs exec relay)

## 1. Summary

SPEC 18 lists as an open decision how herdr running inside the isolation is reached: through herdr's remote-machine mode (SSH) or through a direct socket. The same question exists for two more channels the sandbox needs: the Agent API used by the Skill "overmind" and the egress proxy. This spike tries the candidates on a real Mac with Apple `container` 1.5.x and records an ADR with a decision and fallback order.

## 2. Context

ADR 0026: herdr runs inside the isolation (ADR 0020), Overmind uses its local JSON API (Unix socket 0600, JSON lines, `herdr api schema --json`, 128 methods in 0.9.3). The container is a Linux VM on Apple silicon, so a Unix socket inside the container filesystem is not directly connectable from macOS. herdr supports remote machines where the client connects over SSH to a herdr server on the other side (analysis 2.6). SR-20 and SR-21 require egress through an allowlist proxy and a login port forward that only exists while logging in. SR-31 requires the Agent API to be scoped and unable to widen permissions. The container must stay unprivileged (non-root, empty effective capabilities, ESC-032) and must not get a host-reachable TCP listener by default.

## 3. Scope (in)

- Experiments for the candidates below, executed with the pinned herdr Linux arm64 binary from OVE_SETUP015 (or 0.9.3 downloaded manually for the spike) and the real `container` CLI.
- A decision record plus a fallback order, and the exact commands/flags the BOX adapter must use.
- A capability probe list: which `container` flags exist in the installed version (needed by OVE_BOX003).

## 4. Out of scope

- Production implementation of the bridge: OVE_BOX020. The herdr JSON client: OVE_PROV004. The egress proxy: OVE_BOX011. SSH key management beyond what the spike needs: only needed if SSH is chosen.

## 5. Detailed requirements

1. **Candidates to test (each gets a pass/fail table):**
   - C1 `container run --publish-socket <host path>:<container path>` (or the equivalent flag in the installed version) so a Unix socket created by herdr inside the container appears as a host Unix socket. Check: file mode on the host side (must be 0600 in a 0700 directory owned by the user), behaviour when the container stops (stale socket cleanup), latency, throughput of an `events.subscribe` stream, and whether the host path may be in the Overmind data dir.
   - C2 exec relay: the host process spawns `container exec -i <env> <relay>` where `<relay>` is a tiny program in the base image that connects stdin/stdout to the herdr Unix socket (for example `socat - UNIX-CONNECT:<path>`). Check: one exec per connection cost, reconnect behaviour, zombie processes on crash.
   - C3 herdr remote-machine mode over SSH: sshd in the image, key pair generated per Environment, port published on host loopback or reached through the container network address. Check: attack surface added (sshd, keys, TCP listener), startup time, how herdr behaves when the SSH link drops.
   - C4 (agent API and egress) the same C1 and C2 mechanisms for a socket from host to container direction: host-created listeners exposed INTO the container (gateway agent socket, proxy socket). Check whether `container` can publish a host socket into the container or whether a published TCP port on a host-only address is the only way.
   - C5 container with no network device (`--network none` or equivalent) combined with C1: does the container work with only sockets as I/O; can an in-container relay on `127.0.0.1` forward to the published socket for tools that only speak TCP proxy (`HTTP_PROXY=http://127.0.0.1:3128`)?
   - C6 fallback egress control if C5 is impossible: default NAT network plus an in-container firewall set by a root entrypoint that then drops privileges (needs netfilter in the VM kernel). Record whether the recommended kernel has it.
2. **Measure for each candidate:** works (yes/no/partial), commands used, added capabilities needed (must be none), host-visible listeners created (must be none or loopback only), failure behaviours (container killed, herdr killed, host engine restart), security notes.
3. **herdr facts to capture** from the pinned binary: command that starts the headless server (as used in prototype test 1), where the socket lives and how to change it (env var or config), how to disable remote manifest updates (feeds OVE_SETUP015 requirement 9), how `HERDR_AGENT` is used, which directory holds local detection manifests (feeds OVE_PROV007), what `herdr api schema --json` returns (store the file for TEST009's snapshot if the Owner agrees).
4. **Decision rule:** prefer the candidate with no extra listener and no new credentials: C1 > C2 > C3. SSH (C3) is chosen only if C1 and C2 both fail. The ADR states the primary and the fallback and the condition to switch. The adapter code in BOX020 implements C1 and C2 behind one interface so a runtime fallback is possible.
5. **Output a capability probe list** (flags that must exist: read-only root, mount, tmpfs, user, cpus, memory, network mode, publish-socket, labels, exec stdin, env-file) to be encoded by OVE_BOX003 as `ContainerCliCapabilities`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Spike conventions of OVE_SETUP011 (spike with decision), pinned herdr (OVE_SETUP015), prototype commands (research section 4B).

## 8. Architecture and code placement

Documents only. Throwaway scripts stay out of the repository (paste the key commands into the research file). Resulting interfaces land in OVE_BOX020 (`SandboxSocketBridge`) and OVE_PROV004 (`HerdrTransport`).

## 9. Security and safety

The spike chooses how three trust boundaries are crossed. Rules for the ADR: no TCP listener reachable from other machines; any host listener is bound to Unix sockets in the owner-only run directory or to loopback with a per-Environment random port that is closed with the Environment; no private keys are written to the shared `/work` mount; no additional Linux capabilities; the Agent API channel carries only the scoped agent token. Experiments use throwaway containers, a fake project folder and no real credentials.

## 10. Errors and edge cases

- `container` 1.5.x lacks a publish-socket flag: C2 becomes primary; record the version in which the flag appears and the upgrade trigger.
- Socket path longer than 104 bytes on macOS: the ADR defines the run-directory layout and a short symlink-free path scheme (coordinate with OVE_ARCH005).
- herdr refuses to start without a TTY: record the workaround (pseudo-terminal wrapper) and test it.
- Two Environments publishing the same host path: collision rules (Environment id in the path).

## 11. Acceptance criteria

- [ ] Each of C1 to C6 has a documented result with commands, versions and outputs.
- [ ] The ADR names the primary channel, the fallback and the exact switch condition.
- [ ] The herdr facts of requirement 3 are recorded (start command, socket location, remote manifest switch, detection directory).
- [ ] The `container` capability probe list exists.
- [ ] No candidate in the final decision needs extra capabilities or a non-loopback listener.
- [ ] SPEC 18 open item is closed by linking the ADR in the research file.

## 12. Test plan

Evidence is the research file itself (real outputs). A second maintainer reproduces the primary candidate's key steps. Follow-up automated checks are written in OVE_BOX020 and OVE_BOX012.

## 13. Parallelization notes

Runs in parallel with BOX001 (same machine session is efficient). OVE_BOX012, OVE_BOX020 and OVE_PROV004 should wait for the ADR; OVE_BOX003 can start with a manually written probe list and be amended.

## 14. Open questions and assumptions

- ASSUMPTION: Apple `container` 1.5.x supports `--publish-socket` (host to container direction) and some form of read-only root and tmpfs. This is exactly what the spike verifies; if false the ADR must say so and BOX003 marks the flags as required capabilities that fail closed.
- Open: whether Overmind may ask upstream herdr for a documented way to disable remote manifest updates (OVE_SETUP015 open question).
