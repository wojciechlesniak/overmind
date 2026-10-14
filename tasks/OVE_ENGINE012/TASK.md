---
id: OVE_ENGINE012
title: Gateway authentication - session token, constant-time compare, token file, auth middleware
area: ENGINE
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH007, OVE_ARCH013, OVE_ENGINE011, OVE_SEC005]
soft_depends_on: [OVE_ENGINE026]
provides: ["lib:gateway-auth", "port:SessionTokenStore", "usecase:AuthenticateRequest"]
needs: ["port:SecureRandom", "port:AtomicFileWriter", "lib:data-dir", "lib:gateway-pipeline", "port:Clock", "lib:redaction"]
owns: ["packages/gateway/src/auth/**", "packages/application/src/ports/SessionTokenStore.ts", "packages/adapters/system/src/session-token/**"]
reads: ["docs/security/gateway-auth.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [6, 10]
---

# OVE_ENGINE012: Gateway authentication

## 1. Summary

Every request is authenticated with a high-entropy bearer token. This task implements the Owner session token (rotated at every engine start, stored 0600 for the Rust shell), the constant-time comparison, the authentication middleware and the failure behaviour, exactly as `docs/security/gateway-auth.md` (SEC005 G4, G10) requires.

## 2. Context

SEC005 defines the rules and the threat tests; this task makes them pass. Tokens: `ovm_st_` + 256 bits base64url from `SecureRandom`. The shell reads `run/session-token` and attaches the token to bridged requests; the webview never sees it (ENGINE022). Agent tokens are ENGINE028; Telegram is in-process (ENGINE020).

## 3. Scope (in)

- Token generation, storage (file + in-memory hash), rotation at start, verification, middleware, failure counters and connection closing, audit/log of failures.

## 4. Out of scope

- Agent token minting (ENGINE028). Authorisation by scope (ENGINE013). Peer credentials (ENGINE026).

## 5. Detailed requirements

1. At start (after the instance lock): generate a new Owner token via `SecureRandom.token('ovm_st_', 32)`; write `run/session-token` with `AtomicFileWriter` (mode 0600, directory 0700), contents = token + newline; keep in memory only `sha256(token)` plus the raw token buffer zeroed after writing (best effort). The previous file is overwritten; clients holding the old token get 401 and re-read the file (api-client does this once per 401, ENGINE019).
2. Verification: parse `Authorization: Bearer <t>` strictly (one header, scheme case-insensitive `Bearer`, single space, token matches `^ovm_(st|at)_[A-Za-z0-9_-]{43}$`); compute `sha256(t)` and compare to the candidate hashes with `crypto.timingSafeEqual` on equal-length buffers; never use `===` (a lint rule `security/no-token-equality` ships with SEC005). Token in query string, cookie or body is ignored and the request is unauthenticated.
3. Result of authentication is a `GatewayCaller` (ENGINE011): Owner token -> `{ kind:'owner', channel: header 'X-Overmind-Channel' desktop|cli (informational), local: <session flag> }`. The `local` flag is true only when the request arrives through the shell bridge session (the shell sends `X-Overmind-Bridge: <nonce>` known to the engine via a bridge registration, see ENGINE022); a plain socket client with the Owner token (CLI) is `local: false` and cannot perform Local-Approval-only actions.
4. Failure behaviour: all failure causes (missing, malformed, wrong, expired, previous-start token) produce the same `401 gateway.unauthenticated` body, no `WWW-Authenticate` hints, no timing-distinguishable branch (dummy compare against a random hash when the format is invalid). After 20 failures within 60 s on one connection the connection is destroyed; after 200 failures per minute globally the engine logs `error security.auth_flood` and slows responses by 250 ms (does not lock out the Owner).
5. Unauthenticated routes: none. (`system.health` and `system.version` also require the token, ENGINE001.)
6. Token secrecy: never logged (`ovm_` patterns are in the redactor), never in error `details`, never returned by any route. A route that returns the token does not exist; the file is the only channel.
7. Token file hygiene at start: if `run/session-token` exists as a symlink or with wrong mode/owner -> remove and recreate only after the data-dir check passed; otherwise abort. At shutdown the file is deleted (ENGINE004).
8. Auth decisions are logged at `warn` for failures: `{ requestId, reason: 'missing'|'malformed'|'mismatch', connectionId }` (reason is internal, not sent to the client) and written as `gateway.auth_failed` non-persisted events for the diagnostics ring (max 100); denied privileged attempts by valid tokens are audited by ENGINE016.
9. Rotation on demand: `POST /v1/system/token/rotate` (owner, `local: true` only) generates a new token and file; existing in-flight requests finish; bridge re-reads (ENGINE022). Used after suspected leakage.
10. Clock independence: tokens do not expire by time (rotated by restart/rotation), avoiding clock-skew failures.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`SecureRandom` (SEC005), `AtomicFileWriter` (ARCH013), redaction patterns (ARCH004/SEC003), `GatewayCaller` and pipeline (ENGINE011). Test suite from SEC005 is the acceptance test.

## 8. Architecture and code placement

`packages/gateway/src/auth/{owner-token.ts,authenticate.ts,compare.ts,failure-tracker.ts}`; port `SessionTokenStore` (file read/write abstraction) in application with adapter `packages/adapters/system/src/session-token/`. Dependency: gateway -> application ports.

## 9. Security and safety

This is the primary control behind SR-12. 256-bit random token, constant-time compare, hash in memory, 0600 file in 0700 dir, rotation each start, uniform failure responses, no oracle for partial tokens, flood slow-down. Residual risk (documented): any process of the same Unix user can read the token file; mitigations are sandboxing of agents (they have no access to the host data dir) and the optional peer-credential check (ENGINE026). Fail closed: if the token file cannot be written, the engine does not start serving.

## 10. Errors and edge cases

- Two `Authorization` headers: 400 (ENGINE010).
- Token with trailing whitespace/newline: malformed -> 401.
- File write fails (disk full): startup aborts with `data.disk_full`.
- Rotate while SSE subscribers are connected: they stay connected (authenticated at connect) and are closed by the hub with `events.closed{reason:'token_rotated'}` for the old token, forcing reconnect with the new one.
- Clock jump: irrelevant.

## 11. Acceptance criteria

- [ ] SEC005 tests 6, 7 and 18 pass (variants of bad tokens give identical bodies; compare is `timingSafeEqual`).
- [ ] Token file is 0600 in a 0700 directory and changes on every start.
- [ ] A request authenticated only by a token in the query string is 401.
- [ ] After 20 failures on one connection the connection is closed.
- [ ] Logs and events contain no token text (scan with `expectNoSecrets`).
- [ ] Rotation invalidates the old token immediately.

## 12. Test plan

Unit tests for header parser and compare; gateway-under-test security suite (SEC005); mutation checks (replace compare with `===` -> lint/test fails). Commands: `pnpm test:security:gateway`.

## 13. Parallelization notes

After ENGINE011. SEC005 suite is developed against a fake gateway until this lands.

## 14. Open questions and assumptions

- ASSUMPTION: no token expiry (rotation on start/demand).
- ASSUMPTION: CLI with the Owner token is `local:false`.
