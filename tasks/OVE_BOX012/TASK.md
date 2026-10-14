---
id: OVE_BOX012
title: Wire the no-network path (sockets, relays) and prove egress cannot bypass the proxy
area: BOX
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_BOX002, OVE_BOX008, OVE_BOX011]
soft_depends_on: [OVE_BOX020]
provides: ["lib:egress-path"]
needs: ["port:Sandbox"]
owns:
  - packages/adapters/sandbox-macos/src/egress/path/**
reads: ["docs/research/box-channels-spike.md", "packages/adapters/sandbox-macos/image/pins.json"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [4, 20, 21]
---

# OVE_BOX012: Wire the no-network path (sockets, relays) and prove egress cannot bypass the proxy

## 1. Summary

Implement `Sandbox.setEgressPolicy` and the container side of egress control: the container is created without a usable network (or with the fallback firewall chosen in OVE_BOX002), the only way out is the Unix socket published to the host egress proxy through the in-container loopback relay, and proxy settings are exported to every process. Tests prove that direct connections, DNS and raw sockets fail.

## 2. Context

The proxy (OVE_BOX011) is only a control if there is no other route. Apple `container` gives containers a NAT network by default (prototype: the CLIs reached the provider servers directly). The spike OVE_BOX002 decides the mechanism; the preferred design is `no network device + --publish-socket + socat relay on 127.0.0.1:3128`. SR-20, ESC-050. Port `3128` and the socket path `/run/overmind/egress.sock` are fixed constants shared with the image (OVE_BOX005).

## 3. Scope (in)

- Network mode selection in the run arguments per the ADR (primary and fallback).
- Per-Environment proxy socket creation/publishing and teardown tied to the Environment lifecycle.
- `setEgressPolicy(id, policy)` implementation (policy applies to new connections immediately).
- In-container verification probes (health of the relay, absence of other interfaces).
- Documentation of the bypass analysis.

## 4. Out of scope

- The proxy logic: OVE_BOX011. New-domain approvals: OVE_BOX013. Agent API and herdr channels: OVE_BOX020 (shares the publishing helper).

## 5. Detailed requirements

1. **Primary design (if BOX002 confirms support):** `run` is called with network mode `none` (or the equivalent) so the container has only loopback; the egress socket is published with the host path `<runDir>/egress/<envId>.sock` and the container path `/run/overmind/egress.sock`; the entrypoint (BOX005) starts `socat TCP-LISTEN:3128,bind=127.0.0.1,fork,reuseaddr UNIX-CONNECT:/run/overmind/egress.sock`. Environment variables `HTTP_PROXY`, `HTTPS_PROXY`, `http_proxy`, `https_proxy` all equal `http://127.0.0.1:3128`, `NO_PROXY=127.0.0.1,localhost,::1`, `ALL_PROXY` unset, plus CLI-specific disable-telemetry variables from the profiles (PROV010/011).
2. **Fallback design (only if BOX002 selects it):** default NAT network plus a firewall set by a root entrypoint stage that allows only traffic to the proxy address and drops the rest, then drops privileges before starting anything; the container keeps no CAP_NET_ADMIN afterwards. The ADR states the exact rules. The fallback must pass the same probes; otherwise the Environment is refused (`box.egress_policy_invalid`).
3. **No egress without proxy:** if the proxy for that Environment cannot be opened, `startEnvironment` fails (`box.proxy_unavailable`); a policy of `deny-all` still creates the socket (all requests denied by the decider) so tools fail uniformly.
4. **Policy API:** `setEgressPolicy(id, EgressPolicy)` validates (`hosts` entries match the allowlist grammar, `onNewHost` in `block|ask`, no IP literals, max 200 entries), stores it in the policy store used by `AllowlistDecider` and returns; it never changes container networking. A policy with `mode: 'allowlist'` and an empty host list behaves as provider-only.
5. **Verification probes (`verifyEgressIsolation(envId)`)**: run through `exec` after start and in the nightly escape job: (a) `/proc/net/dev` lists only `lo` (primary design) or the single expected interface (fallback), (b) a TCP connect to `1.1.1.1:443` and to the container gateway address fails within 3 s, (c) `getent hosts example.com` fails (no DNS), (d) UDP send to `8.8.8.8:53` fails, (e) a request through the proxy to a denied host returns the proxy's `403`, (f) a request to an allowed provider host reaches the stub target in tests, (g) IPv6 egress fails. Any unexpected success: destroy the Environment, emit `sandbox.violation` (reason `egress_bypass`), return `box.egress_policy_invalid`.
6. **Run directory hygiene:** `<runDir>` (ARCH005) permissions 0700; socket names include the Environment id; stale sockets for destroyed Environments are removed on lifecycle hooks and by the reaper; the path length stays under the macOS 104-byte limit (use short ids; if the data dir is deep, use a short alias directory under `$TMPDIR` created 0700 and recorded).
7. **Tool compatibility notes** (in docs, from tests with the real CLIs): processes ignoring proxy variables simply fail, which is the intended secure default; git uses `http.proxy` from env; `curl` honours the env; `npm` honours `HTTPS_PROXY` but the host is denied until approved.
8. **Lifecycle hooks:** implements `EnvironmentHooks.onStart/onStop` so BOX008 opens/closes proxy sockets in the right order (socket exists before the container starts; closed after it stops).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`EgressProxyHost.openFor/closeFor` (BOX011), publishing helper and `SandboxSocketBridge` conventions (BOX020), `EgressPolicy` (ARCH012), `exec` (BOX010) for probes.

## 8. Architecture and code placement

`packages/adapters/sandbox-macos/src/egress/path/{egress-path.ts,network-mode.ts,set-egress-policy.ts,verify-isolation.ts,run-dir.ts}`. `network-mode.ts` maps the ADR decision to run arguments (pure). Depends on BOX011's host interface only.

## 9. Security and safety

If any non-proxied route exists the allowlist is theatre, so verification is mandatory at start, not optional. Abuse cases: a process in the container opens a raw socket to the internet (no interface/no capability); DNS exfiltration (`<hex>.exfil.example.test` queries cannot leave because there is no resolver); a process rewrites `HTTPS_PROXY` to point to another local relay (it can only reach loopback inside its own container); a process tries to connect to the host's loopback services through a gateway address (no route). Residual: data smuggled inside traffic to an allowed provider host (accepted, documented in the threat model).

## 10. Errors and edge cases

- `container` update changes default network behaviour: probes fail, Environment refused, health shows `degraded` with the reason.
- Relay process (`socat`) crashes inside the container: the entrypoint supervises and restarts it; if it cannot, the Environment is marked failed.
- Socket path too long: short alias directory (requirement 6).
- Two Environments with colliding ids: impossible by ULID, guarded by `O_EXCL`-style socket creation.
- Proxy engine restarts: sockets recreated, relay reconnects per connection automatically.
- Owner machine with a corporate proxy: the host proxy chains to the system proxy only if configured (documented as post-MVP; MVP uses direct host networking from the engine).

## 11. Acceptance criteria

- [ ] In a real Environment all probes of requirement 5 pass; a deliberately misconfigured Environment (fake runner returning an extra interface) is destroyed and audited.
- [ ] Without the proxy socket the Environment does not start.
- [ ] `setEgressPolicy` rejects IP literals, oversized lists and wildcard-only `*` entries.
- [ ] Proxy socket files are 0600 in a 0700 directory and removed on destroy.
- [ ] Proxy env variables are present in the spec env and no other proxy variants point elsewhere (test).
- [ ] Escape cases ESC-050 pass in TEST007 against this implementation.

## 12. Test plan

Unit: network-mode mapping, policy validation, run-dir path rules. Integration (macOS runner): probes (a) to (g), plus a fake-cli scenario that tries direct network. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/egress/path`.

## 13. Parallelization notes

Needs the BOX002 ADR to choose the primary design. Parallel with BOX013 and BOX020 after BOX011. Hotspot: `network-mode.ts` (single owner).

## 14. Open questions and assumptions

- ASSUMPTION: a no-network container mode and socket publishing exist in `container` 1.5.x or a later pinned version; otherwise the fallback firewall design is implemented and the minimum `container` version is raised accordingly (SETUP015 constants).
- Open: whether the Owner wants an optional "full internet" mode for trusted Workspaces. Default and MVP: no; it would be a lifting of a Zgoda requirement and need Local Approval.
