---
id: OVE_ENGINE022
title: "Desktop bridge contract: Tauri gateway_request/subscribe, token injected by the shell"
area: ENGINE
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ENGINE012, OVE_ENGINE013, OVE_ENGINE017, OVE_ENGINE019, OVE_SETUP010]
soft_depends_on: []
provides: ["lib:desktop-bridge-contract", "lib:api-client-tauri-transport", "api:system.bridge.register"]
needs: ["lib:desktop-gateway-bridge", "lib:api-client-transport", "lib:gateway-auth", "lib:route-registrar"]
owns: ["docs/architecture/desktop-bridge.md", "packages/api-client/src/transport/tauri-bridge.ts", "packages/contracts/src/bridge/**", "packages/gateway/src/routes/engine/system-bridge-register.route.ts", "packages/gateway/src/bridge/bridge-session.ts", "tasks/_proposals/OVE_ENGINE022-setup010-bridge-changes.md"]
reads: ["apps/desktop/src-tauri/src/gateway_bridge.rs", "docs/security/gateway-auth.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 13", "SPECIFICATION 16"]
adr_refs: [5, 6, 18]
---

# OVE_ENGINE022: Desktop bridge contract: Tauri gateway_request/subscribe, token injected by the shell

## 1. Summary

A WebKit webview cannot open a Unix socket, so the Rust shell forwards requests. This task fixes the contract of the two Tauri commands, makes the SHELL (not the webview) attach authentication so the token never reaches JavaScript, defines the "local desktop session" proof used for Local Approval, and delivers the TypeScript transport used by the UI.

## 2. Context

SETUP010 describes `gateway_request(method, path, headers, body)` and `gateway_subscribe(path, on_event)` as a byte forwarder and ASSUMES the webview's api-client attaches the bearer token obtained at a handshake. SEC005 test 17 and the Owner's requirement say the opposite: the shell adds the auth and the webview has no API that returns the token (a compromised webview, a malicious dependency or XSS must not be able to steal a credential that works from outside). This task states the final contract and files a proposal to SETUP010 to adapt. The alternative (loopback TCP with a per-launch token) remains a documented fallback only (ENGINE023), because a TCP listener widens the attack surface (any local process, DNS rebinding).

## 3. Scope (in)

- `docs/architecture/desktop-bridge.md` (normative contract, threat analysis).
- TypeScript `createTauriBridgeTransport(invoke, listen)`.
- Bridge session registration route and `local: true` derivation.
- Proposal file with the exact changes for the Rust side.

## 4. Out of scope

- Rust implementation (SETUP010 after the proposal). Webview CSP (SETUP010). UI engine-status state (SHELL).

## 5. Detailed requirements

1. **Commands (Tauri `invoke`)** — request: `gateway_request({ method, path, query?: Record<string,string>, headers?: Record<string,string>, body?: number[] | string })` -> `{ status, headers, body: number[] }`. Subscribe: `gateway_subscribe({ path, query? , channelId })` streaming `{ id?, event, data }` messages through a Tauri `Channel`; `gateway_unsubscribe({ channelId })`. Errors: `{ code: 'bridge.invalid_request' | 'bridge.engine_unavailable' | 'bridge.timeout', message }`.
2. **Authentication is added by the shell.** The shell reads `run/session-token` (after verifying owner uid, mode 0600, not a symlink), attaches `Authorization: Bearer <token>` and drops any `Authorization`, `Cookie`, `Host`, `X-Overmind-Bridge`, `Content-Length`, `Transfer-Encoding` supplied by the webview. The token lives only in Rust memory (zeroized on drop), re-read on a 401 from the engine (one retry) and after `ensure-running`. No command returns the token, its hash, its file path content or any header containing it. Response headers returned to JS are filtered by allow-list (`content-type`, `x-request-id`, `retry-after`, `idempotent-replay`, `allow`).
3. **Path/method validation in the shell** (shape only, as SETUP010): path starts `/v1/`, no `..`, no CR/LF, <= 2048, method in GET/POST/PUT/PATCH/DELETE, body <= 8 MiB, header names/values free of CR/LF. Additionally the shell BLOCKS these shell-only paths from the webview: `/v1/system/bridge/register`, `/v1/system/token/rotate` (token rotation is invoked by the shell menu/tray code, never by webview JS), `/v1/system/shutdown` unless called with the user gesture marker `X-Overmind-Confirm: shutdown` set by a native menu action (webview cannot set it: the shell strips it from webview requests and adds it only from native code).
4. **Local desktop session proof.** On shell start (and after each engine restart) the shell registers: `POST /v1/system/bridge/register` with the Owner token and a 32-byte random `bridgeSecret` it generated; the engine stores `sha256(bridgeSecret)` in memory and returns `{ bridgeSessionId }`. Subsequent bridged requests carry `X-Overmind-Bridge: <bridgeSecret>`; the gateway marks `caller.local = true` only when this header matches (constant-time). The header is stripped from the request before handlers and never logged. A CLI with only the Owner token is `local: false`. Rationale: Local-Approval-only actions (SR-25) need "the human at this Mac in the app", not "any process of this user holding the token".
5. **Webview-origin restrictions.** The shell binds the commands to the main window label only (Tauri capability `main`); remote origins can never call IPC (SETUP010 capability file). The UI's CSP forbids network calls so the webview cannot exfiltrate the data it receives except via bridge calls (which the engine authorises).
6. **TypeScript transport** `createTauriBridgeTransport({ invoke, Channel })` implements `Transport` (ENGINE019): `send` -> `gateway_request`; `stream` -> `gateway_subscribe` with a `Channel` and incremental event objects (SSE parsing is done in Rust or here: contract says the shell sends parsed `{id,event,data}`); `onUnauthorized` is a no-op (the shell handles 401). It never sets an `Authorization` header and throws in dev if a caller passes one.
7. **Engine side** `POST /v1/system/bridge/register` (scope owner, `local:false` allowed, idempotency none; returns 201 + id; replaces the previous registration; rate-limited to 5/min); the registration is invalidated on token rotation and on engine restart (the shell re-registers when it sees 401/`bridge unknown`).
8. **Streaming contract:** the shell keeps one SSE connection per `gateway_subscribe`, forwards parsed events, reconnects with `Last-Event-ID` on engine restart is the UI's job (ENGINE027), the shell only reports `events.closed`/transport errors as final messages `{ event: 'bridge.closed', data: {reason} }`. Window close cancels all streams.
9. **Fallback.** If a later decision chooses loopback TCP, the same `Transport` interface is used (ENGINE023) and the `local` proof becomes a per-launch nonce delivered through the shell; the Owner must approve that change (documented trade-off table).
10. Proposal file lists the Rust changes: remove "token attached by api-client", add token reading/injection, header allow-lists, blocked paths, bridge registration, zeroization, tests (`cargo test` cases for stripping and blocked paths), and removal of the `engine.sock` ping (use `GET /v1/system/health` with the token).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Transport` (ENGINE019), gateway auth (ENGINE012), SSE hub (ENGINE017), socket path resolver algorithm (ARCH005, documented in Rust-portable form).

## 8. Architecture and code placement

Docs, a browser-safe TS transport (depends on `@tauri-apps/api` only through injected `invoke`/`Channel` parameters, so the package has no Tauri import), contracts for command payloads in `packages/contracts/src/bridge/`, engine route and session helper.

## 9. Security and safety

Core goals: (a) webview JavaScript can never read or reuse the session token, (b) the bridge cannot be used as a generic proxy (only `/v1/` on the gateway socket, no other host), (c) the "local" claim cannot be forged by a plain socket client, (d) a compromised webview can still make API calls as the Owner through the bridge (inherent) but cannot exceed route authorisation, cannot rotate tokens, shut down the engine or register a bridge. Residual: another process of the same user can read the token file and bridge secret is only in memory (not on disk), so such a process gets Owner REST access but not `local:true`.

## 10. Errors and edge cases

- Engine restarted: bridge secret unknown -> engine answers normally with `local:false`; Local-Approval routes return `perm.local_approval_required`; the shell re-registers on next request after seeing `gateway.bridge_unknown` hint header `X-Overmind-Bridge-State: unknown` and retries once.
- Token file unreadable: `bridge.engine_unavailable`.
- Multiple windows: one registration per shell process.
- Webview sends `X-Overmind-Bridge`: stripped.

## 11. Acceptance criteria

- [ ] No Tauri command, event or error text contains the token (grep + test with a fake engine returning a sentinel token).
- [ ] A webview request with `Authorization: Bearer evil` is sent with the shell's token instead.
- [ ] Calls to blocked paths from the webview return `bridge.invalid_request` without reaching the engine.
- [ ] A Local-Approval route succeeds via the bridge and fails via the CLI transport with the same token.
- [ ] Registration is replaced after engine restart; old secret no longer yields `local:true`.
- [ ] Proposal file exists and enumerates every SETUP010 change.

## 12. Test plan

TS transport unit tests with fake `invoke`; engine-side tests through gateway-under-test (register, local flag, constant-time compare); Rust tests described in the proposal (executed by SETUP010 owner); SEC005 test 17 fake-forwarder contract test lives in SEC005 and is validated against the doc here. Commands: `pnpm vitest run packages/api-client/src/transport packages/gateway/src/auth`.

## 13. Parallelization notes

Conflicts with SETUP010 assumption 14.1: needs the Owner/linker to confirm that SETUP010 follows the proposal. Hotspot: none in my files; Rust files remain SETUP010's.

## 14. Open questions and assumptions

- ASSUMPTION: shell-side token injection (Owner requirement) overrides SETUP010's webview-side attachment.
- Open: whether SSE parsing happens in Rust (preferred, less JS exposure) or TS; default Rust forwards parsed events.
