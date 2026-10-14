---
id: OVE_BOX020
title: Implement the SandboxSocketBridge for herdr and the Agent API with verified binary mounts
area: BOX
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH012, OVE_ARCH013, OVE_BOX002, OVE_BOX008, OVE_BOX010, OVE_ENGINE010, OVE_ENGINE028, OVE_SEC005, OVE_SETUP015]
soft_depends_on: [OVE_SETUP015, OVE_BOX012]
provides: ["port:SandboxSocketBridge", "lib:socket-bridge"]
needs: ["lib:herdr-bundle", "port:Sandbox", "lib:gateway-server", "port:AgentTokenIssuer", "port:SecureRandom", "port:AtomicFileWriter"]
owns:
  - packages/application/src/ports/SandboxSocketBridge.ts
  - packages/adapters/sandbox-macos/src/bridge/**
reads: ["docs/research/box-channels-spike.md", "docs/engineering/bundled-binaries.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 11", "SPECIFICATION 13"]
adr_refs: [5, 20, 26, 27]
---

# OVE_BOX020: Implement the SandboxSocketBridge for herdr and the Agent API with verified binary mounts

## 1. Summary

Provide the two controlled channels between host and Environment that are not egress: (1) a host-side Unix socket that reaches the herdr server running inside the Environment (used by the herdr adapter), and (2) an in-Environment endpoint `127.0.0.1:7077` that reaches the engine's Agent API with a scoped token (used by the Skill "overmind"). Also mount the verified herdr binary and the Skill directory read-only.

## 2. Context

OVE_BOX002 decides the mechanism (published sockets primary, exec relay fallback, SSH only if both fail). herdr is bundled and verified by OVE_SETUP015 (`verifyHerdrBundle`), then copied into a root-owned read-only volume and re-hashed (TOCTOU mitigation described there). Agent API: the Skill calls engine routes `report progress`, `access_request`, `message`, `decision` (ADR 0027); SR-31 demands a separate scoped listener that cannot call Owner-scope routes or widen permissions. ESC-040 requires that the host gateway socket path does NOT exist in the Environment; the Agent API socket is a different, scoped endpoint.

## 3. Scope (in)

- Port `SandboxSocketBridge` and the macOS implementation for channels `herdr` and `agent-api`.
- Verified read-only mount preparation of the herdr binary and the Skill directory.
- Run-directory layout and cleanup of bridge sockets.
- Environment variables that tell tools where to go.

## 4. Out of scope

- The herdr JSON client and its protocol (OVE_PROV004). The Agent API routes and token minting (ENGINE and SKILL: `lib:gateway-server`). Egress channel (OVE_BOX011/BOX012; shares helpers only).

## 5. Detailed requirements

1. **Port:**
   ```ts
   interface SandboxSocketBridge {
     open(envId: EnvironmentId, channel: 'herdr'): Promise<Result<{ hostSocketPath: string }>>;      // host connects here
     attachAgentApi(envId: EnvironmentId, scope: AgentApiScope): Promise<Result<void>>;               // gateway listener -> container
     close(envId: EnvironmentId): Promise<Result<void>>;
     status(envId): Promise<Result<BridgeStatus>>;
   }
   AgentApiScope = { agentId, workspaceId, runId?, tokenRef: string }   // token itself is held by the gateway, not here
   ```
2. **herdr channel (primary design from BOX002):** the container is created with the published socket pair `<runDir>/bridge/<envId>-herdr.sock` (host) and `/run/overmind/herdr.sock` (container); herdr in the Environment is started with its socket configured to that path (flag/env found in BOX002). Host side mode 0600 in a 0700 directory; the path is returned to the herdr client. If the primary mechanism is unavailable and the exec relay is selected, the bridge creates the host `net.Server` on the same path that, per connection, spawns `container exec -i <env> socat - UNIX-CONNECT:/run/overmind/herdr.sock` via `ProcessRunner`, with a connection cap of 8, idle timeout and byte counters; semantics for the client are identical.
3. **Agent API channel (owned here per ENGINE028):** the engine gateway is the single API server (ADR 0027); agents reach it through a per-Environment host relay. `attachAgentApi` creates `<runDir>/bridge/<envId>-agent.sock` (0600, directory 0700) served by a dumb byte relay inside the engine that forwards each accepted connection to the gateway Unix socket (path from `ConfigStore`/data dir); the relay does no parsing, so authentication and route scoping stay in the gateway (agent token, `scope: agent`, run binding, ENGINE028). The relay socket is published to `/run/overmind/agent-api.sock`; the image relay exposes it as `http://127.0.0.1:7077`. The real host gateway socket path is never mounted or revealed (ESC-040 stays valid: the container only sees the relay endpoint). The relay enforces connection cap 8, request header size 16 KiB and closes on Environment stop. After start the bridge checks that the gateway answers the agent-scope health route through the relay.
4. **Token and variable injection (contract with ENGINE028):** on every session start PROV calls `AgentTokenIssuer.mint({ runId, agentId, workspaceId })` and passes the token to `Sandbox.exec` as `secretEnv.OVERMIND_API_TOKEN`; the bridge supplies the non-secret variables through `agentApiEnv(envId, runId)`: `OVERMIND_API_SOCKET=/run/overmind/agent-api.sock`, `OVERMIND_API_URL=http://127.0.0.1:7077`, `OVERMIND_RUN_ID=<runId>`. The token is never stored in the spec, labels, files under `/work`, logs or the herdr command line (secretEnv uses an env-file/fd, see BOX010). The bridge holds no token. On Environment stop or Run end the relay is closed and the issuer revokes (ENGINE028 listens to Run events). After an engine restart tokens are gone: PROV re-mints for resumed sessions and restarts the CLI with the new env (a running CLI cannot get a new env, so resume restarts it).
5. **Verified read-only mounts:** `prepareBinaries(envId)` calls `verifyHerdrBundle` (SETUP015); copies the verified binary into a root-owned, read-only volume or directory prepared per install (`ovm-bin-<hash12>`) if not present, re-hashes inside the volume via a throwaway exec before first use, and mounts it read-only at `/opt/overmind/herdr`. The Skill directory (`skills/overmind`, SKILL area) is mounted read-only at `/opt/overmind/skill`. Mismatch: `box.bridge_failed` + violation `unexpected_privilege`/`image_digest_mismatch` depending on cause, Environment not started. These mounts are added by the lifecycle through the `EnvironmentExtras` hook, not by the caller, and are the only non-plan mounts permitted; they are ro and fixed by code.
6. **Environment variables:** `OVERMIND_API_URL=http://127.0.0.1:7077` (already in the spec), `HERDR_AGENT=<name>` per start (PROV), `HERDR_DISABLE_REMOTE_MANIFESTS` handling per SETUP015 constants if herdr reads it from env.
7. **Lifecycle:** `open` before `startEnvironment` completes (socket prepared first, in-container server comes up second), `close` on stop/destroy; stale sockets removed; unique names include the envId; failure to open leads to a failed start.
8. **Health:** `status` reports `connected`, `lastActivityAt`, `bytesIn/Out`, `restarts`; periodic liveness check using the herdr `server.ping` is PROV's job; the bridge only checks socket existence and accepts a connection.
9. **No new listeners:** no TCP listener is created on the host for these channels; only Unix sockets in the owner-only run directory.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`verifyHerdrBundle` and constants (OVE_SETUP015), `SecureRandom` (SEC005), run-dir helpers and short-path alias (BOX012), `ProcessRunner`, `Sandbox.exec` (BOX010), agent listener (ENGINE).

## 8. Architecture and code placement

Port `packages/application/src/ports/SandboxSocketBridge.ts`; adapter `packages/adapters/sandbox-macos/src/bridge/{socket-bridge.ts,published-socket.ts,exec-relay.ts,binary-mounts.ts,env.ts}`. The transport choice is a strategy (`PublishedSocketTransport`, `ExecRelayTransport`) selected by capability probing (OCP); the ADR's fallback order is data in `transport-order.ts`.

## 9. Security and safety

Channels are the only intentional holes in the box. Controls: Unix sockets only, owner-only directory, one socket per Environment (identity by socket, not by claim), agent socket bound to a scope and token, no Owner-scope routes reachable, byte and connection caps, read-only verified binaries, no gateway socket path in the container. Abuse: Agent calls the Agent API to widen permissions or read other Runs (listener scope + route allowlist, SR-31, tested in TEST007 ESC-040 and SEC005 suite); Agent replaces `/opt/overmind/herdr` (read-only mount); Agent floods the herdr socket (caps; the herdr server is inside the same Environment so impact is local); another local process connects to the host bridge socket (0600 + directory perms; peer credentials where available); symlink swap of the socket path (created with `O_EXCL`, directory 0700, path checked at open).

## 10. Errors and edge cases

- Published socket flag unsupported at runtime: fall back to exec relay; audit `bridge_fallback`.
- herdr crashes inside the Environment: socket closes; clients get ECONNRESET; PROV004 reconnects; bridge stays open; Environment is not restarted by the bridge.
- Host path length limit: short alias dir (BOX012).
- Herdr binary missing in resources: `box.bridge_failed` with `herdr_missing`, blocked.
- Token revoked while the CLI is running: Skill calls fail with 401; CLI continues; PROV treats Skill failure as a degraded signal, not an error.
- Engine restart: sockets recreated for tracked running Environments (reconnect path) or the Environment is stopped and recreated.

## 11. Acceptance criteria

- [ ] A client connecting to the returned host socket reaches the in-Environment herdr (`server.ping`) via the primary transport; and via the fallback transport in a forced-fallback test.
- [ ] Agent API reachable from inside at `127.0.0.1:7077` only with the minted token; owner-scope route returns 403/404 (integration with a fake gateway).
- [ ] The herdr binary mounted in the Environment is the verified one (hash check); tampering the resource file before start prevents the start.
- [ ] `/opt/overmind/*` mounts are read-only (write attempt fails).
- [ ] No TCP listener is opened (test with listening-port snapshot before/after).
- [ ] Sockets and relay processes are removed on destroy; stale ones are cleaned by the reaper.
- [ ] ESC-040 (no gateway socket, env without host paths) passes with these channels active.

## 12. Test plan

Unit tests for transport selection, naming and cleanup; integration with a real Environment on macOS (herdr or `fake-herdr` copied in as test binary through a test-only hook), negative tests for wrong token/scope. Commands: `pnpm vitest run packages/adapters/sandbox-macos/src/bridge`.

## 13. Parallelization notes

Needs the BOX002 ADR and the SETUP015 verifier. PROV004 can develop against `FakeHerdr` socket without waiting. ENGINE's agent listener is a hard dependency for criterion 2; stub with the fake gateway until it lands.

## 14. Open questions and assumptions

- ASSUMPTION: the Skill speaks plain HTTP over loopback (`OVERMIND_API_URL`) or, if it supports Unix sockets, via `OVERMIND_API_SOCKET`; both reach the same relay.
- Open: running one herdr server per Environment (default) versus one per Workspace; follows the BOX001 granularity ADR.
