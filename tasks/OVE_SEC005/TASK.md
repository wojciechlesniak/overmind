---
id: OVE_SEC005
title: Write gateway authentication threat tests and the SecureRandom/token rules
area: SEC
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE010, OVE_SEC001, OVE_TEST001]
soft_depends_on: []
provides: ["lib:gateway-security-suite", "port:SecureRandom", "doc:gateway-auth-rules"]
needs: ["lib:gateway-server", "lib:gateway-auth"]
owns: ["packages/gateway/test/security/**", "packages/application/src/ports/SecureRandom.ts", "packages/adapters/system/src/secure-random/**", "packages/testing/src/fakes/FakeSecureRandom.ts", "packages/testing/src/contracts/SecureRandom.contract.ts", "docs/security/gateway-auth.md"]
reads: ["docs/security/requirements.md", "docs/architecture/data-directory.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 12", "SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [5, 6, 10, 27]
---

# OVE_SEC005: Write gateway authentication threat tests and the SecureRandom/token rules

## 1. Summary

Specify the authentication and authorisation rules of the gateway and deliver a security test suite that attacks the real gateway server: socket and directory permissions, peer credential check, session token handling, scoped agent tokens, absence of TCP listeners by default, Host/Origin protection if any localhost HTTP is used, CSRF and replay. The ENGINE area implements the gateway; this suite must fail until it complies.

## 2. Context

The gateway is the only door into the engine (ARCH001) for the desktop UI, the Telegram adapter, a future CLI and the agents' "overmind" Skill (ADR 0027). herdr's model: Unix socket 0600 without tokens. Overmind adds a session token because the socket path is reachable by other processes of the same user and because the webview and agent sandboxes are separate principals. A Node engine cannot read peer credentials without a native helper, which is a known gap (SR-11). Dev and test setups may use localhost HTTP (mock gateway), which brings DNS-rebinding and CSRF threats.

## 3. Scope (in)

- `docs/security/gateway-auth.md`: normative rules (token format, lifetime, scopes, storage, rotation, headers, error responses, audit).
- `SecureRandom` port and implementation (used for tokens and prompt fences).
- A test suite in `packages/gateway/test/security/` runnable against any gateway factory (`createGatewayUnderTest()` provided by ENGINE test support) in two modes: real Unix socket (default) and loopback HTTP (only if a TCP/HTTP mode exists).
- Negative-test fixtures (hostile clients).

## 4. Out of scope

- Gateway server, token issuance and route authorisation code: ENGINE (`lib:gateway-server`, `lib:gateway-auth`). Per-route authorisation tables: owning areas (checked generically by test 8 below).
- Telegram authentication: `OVE_SEC008`. UI session handling in the Rust shell: SETUP010/SHELL.

## 5. Detailed requirements

1. **Rules documented (MUST)**:
   - G1 Transport: the gateway listens on a Unix domain socket `run/gateway.sock` (path rules ARCH005). No TCP listener in release builds. Dev/test loopback HTTP is allowed only when started with an explicit flag, binds `127.0.0.1` (never `0.0.0.0` or `::`), uses a random port, and is refused in release builds (build-time constant).
   - G2 File permissions: socket 0600 owned by the current uid inside a 0700 directory; created with umask 077 *before* `bind` (no window where it is world-accessible); startup aborts if the directory or socket mode/owner is wrong; stale socket removal only if no live process answers.
   - G3 Peer identity (SHOULD, SR-11): on connect, verify peer uid equals the engine's uid (via `LOCAL_PEERCRED`/`getpeereid` helper or equivalent). If unavailable on the platform, log once at startup and rely on G2+G4; the suite marks the peer-credential tests `skip(reason)` only when `capabilities.peerCredentials === false`.
   - G4 Token: every request carries `Authorization: Bearer <token>`. Owner session token: 256-bit from `SecureRandom`, base64url, prefix `ovm_st_`, regenerated at every engine start, stored in `run/session-token` (0600) for the Rust shell to read, kept in engine memory as a hash for comparison (constant-time compare via `timingSafeEqual`), never logged (ARCH004 pattern), never in URLs, query strings, cookies or the process arguments/environment of child processes.
   - G5 Agent tokens: `ovm_at_` + 256-bit, minted per (Run, Agent) by the engine when it starts an Agent environment, delivered to the sandbox through an environment variable only visible to that environment, scope `agent` (routes whose contract `scope` includes `agent`), bound to `runId` and `agentId`, expire when the Run ends or after the max lifetime (default 24 h), revoked on Run cancel/complete and on engine restart (agents re-authenticate through a new token injected at resume). Global Pause does not revoke tokens but the gateway rejects agent mutating calls while paused (SR-30). An agent token cannot read other Runs' data, cannot call Owner-scope routes, cannot mint tokens, cannot subscribe to events of other Runs.
   - G6 Channel identity: the Telegram adapter authenticates in-process as `channel:telegram` (no bearer token over the wire, in-process transport); the gateway pipeline still applies scope checks, with channel-specific restrictions (SR-15, SR-16).
   - G7 Authorisation: each route's `scope` (ARCH008) is enforced by the gateway before the handler; missing scope declaration = deny. Permission-expanding routes require `caller.kind === 'owner'` AND `local: true` (desktop session) (SR-25).
   - G8 Replay and idempotency: approval/access-request decisions are bound to `{ id, runId, actionHash, expiresAt }`, single-use (second use returns `perm.approval_already_resolved`), expire (default 15 min for Telegram, longer for desktop), and mutating non-idempotent routes require an `Idempotency-Key` header (ULID) with server-side dedupe for 24 h. Responses never reveal whether a token was almost correct.
   - G9 Limits: max request body 1 MiB (configurable per route up to 8 MiB), max 64 concurrent connections, per-connection rate limit (token bucket 50 req/s), slow-loris timeout 10 s for headers, 60 s idle; violations -> 413/429/408 mapped through ARCH003 errors (`gateway.payload_too_large`, `gateway.rate_limited`).
   - G10 Failure behaviour: authentication failure returns `401 gateway.unauthenticated` with no detail; after 20 failures within 1 minute from one connection the connection is closed; every authentication failure and every denial writes an audit/log entry with `requestId` (without token material).
   - G11 Loopback HTTP mode (dev/test only): requires `Host` header equal to `127.0.0.1:<port>` or `localhost:<port>`; rejects any request with an `Origin` header not in an explicit allowlist (default none); no CORS headers except for the explicit e2e origin; preflight (`OPTIONS`) is answered without credentials; token only via the `Authorization` header (never cookies); `Content-Type: application/json` required for mutating requests (blocks form-based CSRF); `Sec-Fetch-Site: cross-site` rejected; DNS rebinding is defeated by the Host check.
2. **`SecureRandom`** port: `bytes(n: number): Uint8Array` (n <= 1024), `token(prefix: string, bytes = 32): string` (base64url) using `node:crypto.randomBytes`; fake `FakeSecureRandom` written by this task in `packages/testing/src/fakes/` (deterministic, only for tests, refused when `NODE_ENV=production` or in release builds). Contract: output length, uniqueness over 10k draws, distribution sanity (chi-square on bytes, loose), no `Math.random`.
3. **Test suite** (each numbered test is a named `it`, grouped in `describe('OVE_SEC005 ...')`), run against `createGatewayUnderTest({ mode })`:
   1. Socket file mode is exactly 0600, owner is the current uid; parent directory 0700.
   2. Socket is never reachable with mode 0666 even briefly: a watcher thread polls `stat` while the server starts under `umask 000` and asserts mode never exceeds 0600 (tight loop, 200 iterations).
   3. Starting with a pre-existing socket file of wrong mode/owner aborts; with a stale socket and no listener removes and recreates; with a live listener refuses (no takeover).
   4. Starting with a symlinked `run` directory aborts (`config.data_dir_symlink`).
   5. No TCP listener: after startup, enumerate listening sockets of the process (`lsof -nP -p <pid> -iTCP -sTCP:LISTEN` via ProcessRunner in macOS CI; on Linux use `/proc/net/tcp`) and assert none, unless loopback mode.
   6. Requests without token, with empty token, wrong token, token in query string, token in cookie, token with wrong scheme, token with extra whitespace, truncated valid token, valid token of a previous engine start: all 401 with identical body and similar timing (compare mean latency distributions with a tolerance, informational).
   7. Constant-time comparison: unit test asserts the comparison function is `timingSafeEqual` based (mutation: replacing with `===` is caught by a lint rule `security/no-token-equality` shipped in this task's test helpers via AST test).
   8. Authorisation matrix: generated from the route registry: for every route and each caller kind (owner, agent token, channel:telegram, anonymous) the expected allowed/denied result derives from the route `scope`; every route not declaring `scope` fails the suite. Agent token on Owner route -> 403 `gateway.forbidden_scope`; agent A token on agent B resources -> 404 (not 403, no enumeration) or 403 per route contract.
   9. Agent token lifecycle: expired token rejected; token after Run completed rejected; token minted for Run A rejected for Run B events subscription; agent cannot call the token-minting route; token not present in `engine` log output (scan logs with `expectNoSecrets`).
   10. Permission-expanding routes (add Allowed Directory, lift approval requirement, edit Owner Rule, accept Skill import) reject: agent tokens, `channel:telegram`, and Owner sessions flagged `remote`; accept only Owner desktop session with a fresh local confirmation marker.
   11. Replay: approve request R once -> ok; again -> `perm.approval_already_resolved`; approve expired request -> `perm.approval_expired`; approval with altered `actionHash` -> rejected; same `Idempotency-Key` twice on a non-idempotent route executes the action once and returns the same response.
   12. Oversize body 1 MiB+1 -> 413; 10 000 small requests burst -> 429 appears and the server stays responsive; slow-loris half-written header -> connection closed within 10 s (+ tolerance).
   13. Malformed input: invalid JSON, wrong content type, deeply nested JSON (depth 1000), `__proto__` keys, huge string fields, invalid UTF-8 -> 400 `validation.*` with no stack traces and no crash.
   14. Information leakage: error bodies contain no file paths, stack traces, token fragments (`expectNoSecrets`, no `/Users/`).
   15. Loopback HTTP mode only: (a) Host `evil.example` -> 421/403; (b) Origin `http://evil.example` -> 403; (c) `OPTIONS` preflight returns no credentials allowance for unknown origins; (d) form POST (`application/x-www-form-urlencoded`) -> 415; (e) `Sec-Fetch-Site: cross-site` -> 403; (f) DNS rebinding simulation (Host header of rebinding domain with correct token absent) -> rejected; (g) server binds only 127.0.0.1 (check via listener enumeration); (h) release-build flag refuses to start loopback mode.
   16. Peer credential tests (when supported): a connection from a process running as a different uid (simulated via helper binary/unit with injected `getPeerUid`) is dropped before any bytes are read.
   17. Rust-shell forwarder contract (documented test for SETUP010/SHELL authors): frames are forwarded opaquely, the token is attached by the shell from the token file, the webview never sees the token (test with a fake forwarder: webview API has no method returning the token).
   18. Audit: each denial in tests 6, 8, 9, 10, 11 produced an audit/log record with `requestId` and no token.
4. **Helpers:** `hostileClient` (raw socket writer for malformed frames, slow writes, half-open connections), `tokenFactory` (valid/invalid variants), `listenerEnumerator`, `modeWatcher`.
5. The suite is a CI gate (`pnpm test:security:gateway`) on Linux for the portable tests and on macOS for socket-specific ones (tagged).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

TEST002 fakes (clock, logger), TEST001 conventions, `expectNoSecrets` (SEC003), `ProcessRunner` (ARCH014) for listener enumeration, route registry from ARCH008/009, error codes from ARCH003, data-dir rules from ARCH005.

## 8. Architecture and code placement

Tests: `packages/gateway/test/security/*.sec.test.ts` plus `helpers/`. Port `packages/application/src/ports/SecureRandom.ts`; adapter `packages/adapters/system/src/secure-random/node-secure-random.ts`. The suite imports a factory from `apps/engine/test-support/gateway-under-test.ts` (ENGINE-owned) through a documented interface `GatewayUnderTest { start(), stop(), socketPath, httpBaseUrl?, mintAgentToken(), registry, capabilities }`, avoiding any dependency of the suite on internal gateway code.

## 9. Security and safety

These are the security tests of the most exposed interface. The suite runs with disposable data dirs and fake secrets only. Hostile-client helpers must never be pointed at anything but the under-test instance. Tokens used in tests are real random tokens created by the under-test engine, never reused values. Failing tests MUST NOT be skipped silently: any `skip` requires a reason string and a capability flag, and CI prints skipped security tests prominently.

## 10. Errors and edge cases

- macOS vs Linux differences in socket mode semantics: assertions use `fs.stat` on the socket file; Linux CI checks the portable subset, macOS CI the full set.
- Parallel test runs: each test gets its own socket path under a temp dir (short path to respect the 104-byte limit).
- Timing assertions are flaky by nature: they are informational (no fail) except for the structural `timingSafeEqual` check.
- Token file read by the Rust shell: file permission assertion also in SETUP010 tests.
- Engine start races: tests await a readiness signal exposed by `GatewayUnderTest.start()`.

## 11. Acceptance criteria

- [ ] `gateway-auth.md` documents G1-G11 with SR links.
- [ ] Each of the 18 numbered tests exists and fails when the corresponding protection is removed (mutation checks documented in the PR: e.g. chmod 0666, remove token check, accept wrong scope).
- [ ] The authorisation matrix test is generated from the route registry and fails for a route without a declared scope.
- [ ] `SecureRandom` contract passes; no `Math.random` in token code (lint).
- [ ] Peer-credential tests skip only with `capabilities.peerCredentials === false` and print the skip reason.
- [ ] Loopback mode tests pass against the mock gateway of `OVE_SETUP012` as well.
- [ ] CI job `test:security:gateway` is defined (fragment for SETUP006).

## 12. Test plan

The suite itself is the deliverable; additionally: unit tests for helpers, a "sabotage" test that runs the suite against a deliberately insecure fake gateway (`InsecureGateway` in test helpers: 0666 socket, no token check, wildcard CORS) and asserts the suite fails with the expected tests (proves the tests bite). Commands: `pnpm test:security:gateway`, `pnpm vitest run packages/gateway/test/security`.

## 13. Parallelization notes

The documentation and `SecureRandom` can merge first. The suite is developed against a fake secure gateway and the insecure sabotage gateway until ENGINE lands the real server, then switched to `createGatewayUnderTest`. ENGINE authors read `gateway-auth.md` before implementing auth.

## 14. Open questions and assumptions

- ASSUMPTION: peer credential check requires a tiny native helper (Rust shell side cannot help because the engine is the server). ENGINE decides between a Node native addon, a launchd-provided socket with `SO_PEERCRED` equivalent in a helper binary, or accepting G2+G4 only; SR-11 stays SHOULD until decided.
- ASSUMPTION: the Rust shell forwards frames and holds the token; the webview never sees it (verify with SETUP010).
- Open: whether agent tokens should be delivered via a file mounted read-only instead of an environment variable (environment variables may leak into child processes of the CLI); default env var, scoped to the single environment.
