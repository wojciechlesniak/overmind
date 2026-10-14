---
id: OVE_SHELL004
title: "Provide the API client provider with transport selection and connection status"
area: SHELL
kind: infra
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH011, OVE_ENGINE006, OVE_ENGINE007, OVE_ENGINE019, OVE_ENGINE022, OVE_ENGINE023, OVE_SHELL003]
soft_depends_on: []
provides: ["lib:use-api-client", "lib:api-client-provider", "lib:use-connection", "lib:ui-error-mapper", "lib:error-messages"]
needs: ["lib:api-client", "lib:api-client-transport", "lib:api-client-tauri-transport", "lib:api-client-http-transport", "lib:compat-handshake", "api:system.health", "api:system.version", "lib:error-catalogue", "lib:i18n-ui"]
owns: ["apps/desktop/src/app/providers/api-client-provider.tsx", "apps/desktop/src/app/providers/connection-reducer.ts", "apps/desktop/src/app/providers/transport.ts", "apps/desktop/src/app/providers/use-connection.ts", "apps/desktop/src/app/errors/ui-error.ts", "apps/desktop/src/app/log.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 18]
---

# OVE_SHELL004: Provide the API client provider with transport selection and connection status

## 1. Summary

Creates the one `ApiClient` instance of the desktop window, chooses the right transport (Tauri bridge, loopback HTTP for dev, mock gateway for tests), runs the version handshake and exposes the connection status (`connecting | ready | incompatible | unavailable`) and a `retry()` action through React context.

## 2. Context

ENGINE019 defines `createApiClient({ transport })` with `connect()` and `client.status`; ENGINE022 defines `createTauriBridgeTransport({ invoke, Channel })` where the shell (Rust) injects authentication and the webview never sees a token; ENGINE023 defines the loopback HTTP transport used only in dev/test; ENGINE007 defines `performHandshake`. SETUP010 requires the shell to emit `engine:status` events (`running|starting|unavailable|incompatible`). The window is only a client of the engine (ADR 0005): the engine may be stopped, restarting or incompatible, and the UI must reflect that without crashing. The engine-down and version-mismatch screens are separate tasks (OVE_SHELL020, OVE_SHELL021) and consume the status produced here. No global singletons: the client is created by the host component (ENGINE019 req. 7).

## 3. Scope (in)

- `ApiClientProvider`, `useApiClient()`, `useConnection()` (status + `retry`) in `apps/desktop/src/app/providers/`.
- Transport factory `createTransportForRuntime(platform)`.
- Startup sequence and status state machine (pure, unit tested).
- Typed `AppError` -> UI error mapping helper `toUiError(appError)` (message key + retryable flag) in `apps/desktop/src/app/errors/ui-error.ts`.

## 4. Out of scope

- Data fetching helpers and cache (OVE_SHELL005).
- Push subscription (OVE_SHELL006).
- Engine-down and mismatch screens (OVE_SHELL020/021).
- Rust side of the bridge (SETUP010 + ENGINE022 proposal).

## 5. Detailed requirements

1. Transport choice: Tauri runtime -> `createTauriBridgeTransport({ invoke, Channel })` imported through `usePlatform()` internals (the factory lives in `platform/tauri`, this task only calls a function `platform.createTransport()` that SHELL003 must expose; if missing, file a proposal to OVE_SHELL003 and use a local adapter file `app/providers/transport.ts` until merged). `web` runtime in dev -> `createHttpTransport` (ENGINE023) pointed at the Vite dev proxy `/v1` (SETUP009/SETUP012). `mock` runtime -> the same HTTP transport against the mock gateway URL from `import.meta.env.VITE_OVERMIND_MOCK_GATEWAY` (dev/test only). Production builds contain only the Tauri path (tree shaking verified by the dist guard).
2. State machine `ConnectionState`: `connecting -> ready` (handshake compatible and `system.health` state in ready|degraded), `connecting -> starting` (health `starting|migrating|recovering`, shows progress `recovery?: {done,total}`), `-> incompatible` (handshake `engine_older|engine_newer`, or Tauri event `incompatible`, or HTTP 412 `gateway.incompatible_protocol`), `-> unavailable` (transport error, Tauri event `unavailable`, or 3 consecutive failed health probes), `ready -> unavailable` on stream/transport loss, `unavailable -> connecting` on `retry()` or on Tauri event `running`. Pure reducer `connectionReducer(state, event)` exported for tests; no timers inside it.
3. Health probing: while `starting` or `unavailable` poll `system.health` every 1 s (starting) / 3 s (unavailable) using the client `AbortSignal`; stop polling when `ready`. While `ready` the status is driven by the push stream status (SHELL006) and by failures of regular calls (`internal.transport_unavailable`), not by polling.
4. `useConnection()` returns `{ state, detail?: { engine?: {protocol, appVersion}, client: {protocol}, recovery?: {done,total} }, retry(): void, lastChangeAt }`. `retry()` is idempotent while a probe is in flight.
5. `useApiClient()` returns the same client instance for the lifetime of the provider; it throws a developer error outside the provider. The provider disposes subscriptions on unmount (StrictMode double-mount safe: creation is memoised with `useRef`, effects are idempotent).
6. `toUiError(appError)`: maps `AppError.code` to `{ titleKey, messageKey?, retryable, correlationId }` using `errors:<code>` keys from ARCH011 `renderMessage`; unknown code -> `errors:generic.unknown`. The raw server `message` is NEVER rendered (it is for logs); only `correlationId` is shown as a copyable reference in support-oriented error screens.
7. 401 handling: the transport owns it (`onUnauthorized`); this provider only surfaces repeated `gateway.unauthenticated` as state `unavailable` with detail `auth` so the engine-down screen can offer 'Restart connection' (OVE_SHELL020).
8. Logging: the provider logs state transitions (from, to, reason code) through a `console`-free dev logger helper (`app/log.ts`, no-op in production beyond `warn`); never request bodies or headers (ENGINE019 req. 10).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `createApiClient`, `Transport`, `performHandshake` (ENGINE019/007), `createTauriBridgeTransport` (ENGINE022), `createHttpTransport` (ENGINE023), `usePlatform` (OVE_SHELL003), `AppError` (ARCH003).
- Do not reimplement retry/backoff: the client has it.

## 8. Architecture and code placement

`apps/desktop/src/app/providers/api-client-provider.tsx`, `connection-reducer.ts`, `transport.ts`, `use-connection.ts`, `app/errors/ui-error.ts`. UI layer depending on `api-client` and `contracts` only (CONVENTIONS 6). The reducer is pure (testable without React).

## 9. Security and safety

- The webview never receives a token (ENGINE022): this provider never passes an `Authorization` header and fails in dev if a caller tries.
- The mock/HTTP transports are unreachable in production builds; a test asserts `VITE_OVERMIND_MOCK_GATEWAY` is ignored when `import.meta.env.PROD`.
- Raw server messages are not displayed (could contain paths or injected text); only i18n keys.
- Fail closed: while not `ready`, feature hooks must not show stale data as live (consumers read `useConnection()`; the data layer in SHELL005 marks queries disabled).

## 10. Errors and edge cases

- Engine answers 503 `gateway.engine_not_ready`: state `starting` with `Retry-After`.
- Handshake HTTP 412: `incompatible` with both protocol numbers.
- Tauri event `unavailable` while the first handshake is in flight: wins (no flicker back to connecting).
- Window regains focus and engine was `unavailable`: SHELL008 calls `retry()` (rate limited to once per 10 s by the shell).
- Two rapid `retry()` calls: one probe.
- StrictMode double effects: exactly one client and one probe loop.

## 11. Acceptance criteria

- [ ] Given a healthy fake engine then `useConnection().state` becomes `ready` after one handshake.
- [ ] Given engine protocol older than the client then state is `incompatible` and `detail.engine.protocol` is set.
- [ ] Given the transport rejecting then state is `unavailable` and `retry()` re-enters `connecting`.
- [ ] Given 3 health failures in `starting` then state is `unavailable`.
- [ ] Production bundle contains no HTTP/mock transport (dist guard).
- [ ] Reducer tests cover every transition in a table.

## 12. Test plan

- Unit: `connection-reducer.test.ts` (table), `ui-error.test.ts`, hook tests with a fake `Transport` and fake timers.
- Integration: provider mounted in Vitest + jsdom with the in-process gateway-under-test (ENGINE018) if available, else the mock gateway.
- Commands: `pnpm --filter @overmind/desktop test providers`.

## 13. Parallelization notes

After SHELL003 (platform) and ENGINE019/022 contracts. Everything in the shell depends on this provider; keep its public hooks stable (`useApiClient`, `useConnection`). Hotspot: `app/providers/` index is composed by OVE_SHELL010 (bootstrap), not edited here.

## 14. Open questions and assumptions

- ASSUMPTION: a single client per webview window; the tray window (TRAY002) creates its own instance with the same provider.
- OPEN: whether SHELL003 or this task exposes `createTransport()`; default SHELL003 exposes it (listed in its open questions); until then this task's local `transport.ts` is acceptable and is deleted by SHELL010 once merged.
- ALIASES: this task also provides `lib:error-messages`, the names other view areas reported; they are the same module as the primary capability (no second implementation).
