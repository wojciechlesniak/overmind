---
id: OVE_ENGINE018
title: Gateway test support - createGatewayUnderTest, hostile client helpers, protocol doc check
area: ENGINE
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE002, OVE_ENGINE010, OVE_ENGINE012, OVE_ENGINE013, OVE_TEST002]
soft_depends_on: [OVE_ENGINE017]
provides: ["lib:gateway-test-support", "lib:gateway-under-test", "lib:test-engine-harness"]
needs: ["lib:test-utils", "lib:gateway-server", "lib:gateway-auth", "lib:engine-entry"]
owns: ["apps/engine/test-support/gateway-under-test.ts", "apps/engine/test-support/mint-agent-token.ts", "tools/docs/check-protocol-snippets.ts"]
reads: ["packages/gateway/test/security"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16"]
adr_refs: [6]
---

# OVE_ENGINE018: Gateway test support

## 1. Summary

Provide the factory the SEC005 security suite and every route test uses: start a real gateway (Unix socket or in-process) with fakes, on a temp data directory, expose the socket path, tokens, route registry and helpers, and verify that the protocol document's curl snippets really work.

## 2. Context

SEC005 task text fixes the interface: `GatewayUnderTest { start(), stop(), socketPath, httpBaseUrl?, mintAgentToken(), registry, capabilities }`. Area route tests need a quick way to call routes with a chosen caller kind. TEST004 uses the mock gateway, not this.

## 3. Scope (in)

- `createGatewayUnderTest({ mode, overrides, config })`, token helpers, request helper with caller selection, registry export, readiness wait, doc snippet checker.

## 4. Out of scope

- The security tests themselves (SEC005). Mock gateway (SETUP012).

## 5. Detailed requirements

1. `createGatewayUnderTest(opts)`: uses `createTestEngine` (ENGINE002) with fakes; `mode: 'socket'` (default) binds a real Unix socket under a short temp dir (`/tmp/ovm-t-<rand>/g.sock`, < 100 bytes); `mode: 'inprocess'` uses the in-process transport; `mode: 'loopback'` only when ENGINE023 exists (`capabilities.loopback`).
2. Returns: `{ start(), stop(), socketPath, ownerToken(), mintAgentToken({ runId, agentId, workspaceId, ttlMs? }), request(spec), client(callerKind), registry, capabilities: { peerCredentials, loopback }, dataDir, clock: FakeClock, logs }`. `request` builds raw HTTP so tests can send malformed input; `client('owner'|'agent'|'channel')` returns an `ApiClient` (ENGINE019) with the matching credential.
3. Readiness: `start()` resolves after `GET /v1/system/health` reports ready; fails fast with redacted logs if startup fails.
4. Isolation: each instance has its own temp data dir (0700), socket, tokens, in-memory or temp-file SQLite; `stop()` removes all; leak detector warns on open handles.
5. Hostile helpers (shared with SEC005, which owns the suite but imports these): `rawSocketWrite(bytes, opts)`, `slowWriter`, `halfOpen()`, `tokenVariants(token)`. SEC005 may add its own in `packages/gateway/test/security/helpers/`; duplicates are avoided by SEC005 importing these.
6. `tools/docs/check-protocol-snippets.ts` extracts fenced `bash` blocks tagged `curl-check` from `docs/architecture/gateway-protocol.md`, runs them against a gateway-under-test (token substituted), and asserts the status code in a trailing `# expect: 200` comment (`pnpm docs:check-protocol`).
7. Fake ports wired by default: `FakeClock`, `FakeIdGenerator`, `MemoryLogger`, fake Keychain/Sandbox/Notifier/ServiceManager, `InMemoryUnitOfWork` + `InMemoryEventStore`, fake `LocalApprovalGate` (auto-deny unless configured), fake `SecureRandom` OFF by default (real random tokens in security tests).
8. Release guard: the module refuses to import in a release bundle (dependency check in SETUP016 bundle guard).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`createTestEngine` (ENGINE002), fakes (TEST002), data-dir helpers, ENGINE019 client.

## 8. Architecture and code placement

`apps/engine/test-support/` (importable from tests only); no production code depends on it.

## 9. Security and safety

Test-only; temp directories 0700; tokens are fresh random values per instance; hostile helpers can target only the instance under test (socket path from the object). The release guard keeps test backdoors (mint tokens) out of shipped binaries.

## 10. Errors and edge cases

- Socket path too long under a deep temp dir: use `/tmp` short dir.
- Parallel test files: unique dirs.
- Startup failure: error includes log tail (redacted).
- Leaked server after test failure: global `afterAll` closes all instances.

## 11. Acceptance criteria

- [ ] A test starts the gateway, calls `system.health` with owner and agent clients, and stops cleanly in under 300 ms.
- [ ] 20 instances run in parallel without collision.
- [ ] `mintAgentToken` yields a token the gateway accepts as `agent` scope.
- [ ] Doc snippet checker fails when a documented endpoint changes status.
- [ ] Importing the module from a release-flag bundle fails the guard.

## 12. Test plan

Self-tests of the factory; parallel instance test; snippet checker test with a deliberately wrong snippet. Commands: `pnpm vitest run apps/engine/test-support`.

## 13. Parallelization notes

Unblocks SEC005 real-gateway switch and all route test suites; merge early after ENGINE013.

## 14. Open questions and assumptions

- ASSUMPTION: Linux CI uses the real Unix socket mode (supported) for the portable subset.
