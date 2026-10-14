---
id: OVE_ENGINE023
title: Loopback HTTP dev and test mode for the gateway with Host/Origin protection
area: ENGINE
kind: security
size: M
priority: P1
mvp: false
status: todo
depends_on: [OVE_ENGINE010, OVE_ENGINE012, OVE_ENGINE013, OVE_ENGINE019]
soft_depends_on: [OVE_SEC005]
provides: ["lib:gateway-loopback-mode", "lib:api-client-http-transport"]
needs: ["lib:gateway-server", "lib:gateway-auth", "lib:api-client-transport"]
owns: ["packages/gateway/src/loopback/**", "packages/api-client/src/transport/http-loopback.ts"]
reads: ["docs/security/gateway-auth.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13"]
adr_refs: [5]
---

# OVE_ENGINE023: Loopback HTTP dev and test mode for the gateway with Host/Origin protection

## 1. Summary

Browsers and Playwright cannot reach a Unix socket, so developers need the gateway on `127.0.0.1` during `pnpm dev` and UI tests. This task adds that mode with strict protections and a hard block in release builds. It is also the documented fallback if the Owner ever prefers TCP over the Tauri bridge.

## 2. Context

SEC005 G1 and G11, SR-13; SETUP012 assumes the dev engine and mock gateway expose the same API on loopback with a bearer token and that Vite proxies `/v1`. Any TCP listener is reachable by all local processes and by web pages via DNS rebinding and CSRF, hence the checks.

## 3. Scope (in)

- Opt-in second listener, Host/Origin/Fetch-metadata checks, content-type rule, port selection, token delivery to the dev proxy, HTTP transport for api-client.

## 4. Out of scope

- The mock gateway (SETUP012) mirrors this behaviour but is separate code. Production TCP: never.

## 5. Detailed requirements

1. Enabled only when ALL are true: build is not release (`__RELEASE__ === false`), `OVERMIND_ENV=dev` or test harness flag, and CLI/option `--loopback-port <n|0>` given. Otherwise the module does not load; in release builds the code is dead-code-eliminated and a CI assertion greps the bundle for the listener symbol.
2. Bind `127.0.0.1` only (never `0.0.0.0`/`::`); port `0` selects a random free port; the chosen port is written to `run/loopback.port` (0600) and logged.
3. Request checks before the pipeline: `Host` must equal `127.0.0.1:<port>` or `localhost:<port>` (else 421); any `Origin` must be in the explicit allowlist (default empty; dev passes `--allow-origin http://localhost:5173`) else 403; `Sec-Fetch-Site: cross-site` -> 403; mutating methods require `Content-Type: application/json` (415 otherwise, blocks form posts); `OPTIONS` preflight answered 204 without credentials headers unless origin allowed; no `Access-Control-Allow-Origin: *` ever; token only via `Authorization`.
4. Same pipeline, same token (the Owner session token), same authz; the caller is `owner` with `local:false` (Local-Approval routes remain unreachable over loopback; a dev flag `--dev-local` can set `local:true` for UI development only, logged as `warn` and refused outside `OVERMIND_ENV=dev`).
5. Vite proxy integration: the orchestrator reads `run/loopback.port` and `session-token` and configures the proxy to add the Authorization header server-side (so the token is not shipped to the browser in dev either).
6. `createHttpLoopbackTransport({ baseUrl, tokenProvider })` implements `Transport` with `fetch`; used by Playwright against the dev engine; documented as test-only.
7. Connection limits identical to the socket listener; shares counters.
8. The SEC005 loopback test group (15 a-h) runs against this mode and the mock gateway.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Pipeline/registrar/auth, `Transport`, SEC005 suite.

## 8. Architecture and code placement

`packages/gateway/src/loopback/{listener.ts,host-origin-guard.ts}`; loaded only by a dev-only composition module `gateway-loopback.module.ts` listed in a non-release module set.

## 9. Security and safety

Dev-only, double gated (build constant + env + explicit flag). Host check defeats DNS rebinding; Origin/Fetch-metadata and content-type rules defeat CSRF; token never in URL/cookie. Production bundle must not contain the module (assertion). The port file and token file are 0600.

## 10. Errors and edge cases

- Port in use: pick another (`0`), report.
- Proxy sends `Host: localhost:5173` (Vite) : the proxy must set `changeOrigin` so Host equals the target; documented.
- IPv6 `::1`: not bound.
- Origin `null` (sandboxed iframe): rejected.

## 11. Acceptance criteria

- [ ] SEC005 group 15 (a-h) passes against this mode.
- [ ] A release-flag build refuses to start loopback and the bundle assertion finds no symbol.
- [ ] Listener enumeration shows only 127.0.0.1.
- [ ] Form POST gets 415; cross-site fetch gets 403.
- [ ] `--dev-local` is refused when `OVERMIND_ENV` is not dev.

## 12. Test plan

Integration tests with raw HTTP over TCP loopback; bundle assertion in the packaging test. Commands: `pnpm vitest run packages/gateway/src/loopback`.

## 13. Parallelization notes

Low priority (P1); UI e2e (TEST004) can use the mock gateway meanwhile.

## 14. Open questions and assumptions

- ASSUMPTION: not MVP-critical for release builds; required for developer workflow, hence `mvp: false` yet P1.
