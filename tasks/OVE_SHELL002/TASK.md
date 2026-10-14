---
id: OVE_SHELL002
title: "Implement GetTopBarSummary and the shell.top-bar gateway route with api-client"
area: SHELL
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF015, OVE_ENGINE013, OVE_ENGINE019, OVE_PAUSE003, OVE_PERM014, OVE_PERM016, OVE_PROV017, OVE_PROV019, OVE_PROV020, OVE_SHELL001, OVE_TEST002, OVE_TG005]
soft_depends_on: []
provides: ["usecase:GetTopBarSummary", "api:shell.top-bar", "lib:api-client-shell", "lib:extract-reported-percent"]
needs: ["usecase:ListConnections", "usecase:GetUsageSnapshot", "port:ConcurrencyLimiter", "port:ChannelStatusReader", "usecase:ListApprovals", "usecase:ListAccessRequests", "usecase:ListEscalations", "usecase:GetPauseSnapshot", "lib:route-registrar", "lib:api-client", "lib:test-utils"]
owns: ["packages/domain/src/shell/**", "packages/application/src/shell/**", "packages/gateway/src/routes/shell/**", "packages/api-client/src/shell/**", "apps/engine/src/composition/modules/shell.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 6, 22, 28]
---

# OVE_SHELL002: Implement GetTopBarSummary and the shell.top-bar gateway route with api-client

## 1. Summary

Builds the application use case that projects limits, slots, Telegram status, pending counts and pause state into `TopBarSummary`, the route module that serves it, and the typed api-client wrapper. Also contains the pure percentage extractor for CLI-printed limit text.

## 2. Context

Contract: OVE_SHELL001. This is a read-model projection (no writes, no decisions). It depends on read use cases of other areas through their ports, never on their tables (PLAN section 6). PROV017 forbids Overmind to compute a limit percentage; the only allowed source is an explicit '62%' that the CLI printed inside the verbatim limit text. The mock shows 'Claude Max 62% · reset 3 h · wg CLI': 'Claude Max' is the plan label from the Connection (`displayName`), '62%' from the CLI text, 'reset 3 h' from `resetsInText` or formatted from `resetsAt` by the UI. Pending counts: Approvals (PERM014 `ListApprovals`), Access Requests (PERM016 `ListAccessRequests`), Escalations (CHIEF015 `ListEscalations`). Pause: PAUSE003 `GetPauseSnapshot`.

## 3. Scope (in)

- `packages/domain/src/shell/extract-reported-percent.ts` pure function.
- `packages/application/src/shell/get-top-bar-summary.ts` use case with its input/output types and ports it needs (read-only facades).
- Route module `packages/gateway/src/routes/shell/shell-top-bar.route.ts` and module wiring `apps/engine/src/composition/modules/shell.module.ts`.
- api-client wrapper `packages/api-client/src/shell/top-bar.ts` (`getTopBarSummary`).
- In-memory fakes/builders for the use case tests.

## 4. Out of scope

- The UI hooks and rendering (OVE_SHELL015/016/017).
- Push events (existing events from other areas are reused, no new event is created).
- Notification counts (NOTIF owns them; the top bar shows Approvals only).

## 5. Detailed requirements

1. `extractReportedPercent(text: string): number | null`: matches the FIRST occurrence of `(\d{1,3})\s?%` in the first 500 characters of the already-sanitised verbatim text; returns an integer 0..100 or null. It never infers percentages from token counts or from words such as 'almost'. 'remaining 38%' vs 'used 62%': the function returns the number plus a `direction` hint `used|remaining|unknown` (keywords `used`, `remaining`, `left`, `zużyto`, `pozostało` within 20 characters before or after); when `remaining`, `percentUsed = 100 - n`; when `unknown`, the entry is returned with `percentUsed: null` (do not guess). Table-driven tests with at least 25 strings from the PROV017 parser fixtures (claude and codex samples) plus adversarial strings ('100000%', '%', '0x62%').
2. Use case `GetTopBarSummary.execute({ workspaceId? }, caller)`: requires `caller.kind === 'owner'`. Reads in parallel (`Promise.all`, each with a 1.5 s timeout via `AbortSignal`): `ListConnections` + `GetUsageSnapshot` per CLI/Ollama Connection; `ConcurrencyLimiter.status()`; `ChannelStatusReader.read()`; approvals/access requests/escalations counts (use cases accept `{ status: 'pending', limit: 0, countOnly: true }`; if a use case cannot count, list with `limit: 100` and use the length, capped display handled by the UI); `GetPauseSnapshot`. A failing or timed-out read degrades only its own part: limits -> `[]` plus `engine.state: 'degraded'`; Telegram -> `status: 'connecting'` (unknown, not 'error', so a transient read failure does not alarm the Owner); pending counts failing -> the whole call fails with `gateway.not_ready` (a wrong zero would hide waiting Approvals, which is worse than an error).
3. Entry mapping: `cliLabel = connection.displayName`; `state` from `Connection.status` (`ready -> ok`, `limit_reached -> limit_reached`, `needs_login -> needs_login`, others -> unavailable); `resetsInText`, `resetsAt`, `limitText`, `parse`, `stale` from the usage snapshot; `source` from the snapshot (`per_cli` for CLI, `ollama_local` for Ollama). Sort: CLIs with `limit_reached` first, then by higher `percentUsed`, then by name; max 8.
4. `slots`: `{ active, limit, queued }` copied from `ConcurrencyLimiter.status()`.
5. `telegram`: `status` copied from `ChannelStatusReader` (no mapping here); `botUsername` only when paired.
6. `pause.global` from the snapshot; `pause.workspace` only when `workspaceId` is given and exists (unknown -> `data.not_found`).
7. Route module follows ARCH009 `defineRouteModule`; `requires: { summary: GetTopBarSummaryToken }`; handler returns the Result of the use case; response validated in dev/test.
8. Response time target p95 < 150 ms with fakes; the route is rate limited to 20 requests per 10 s per principal (ENGINE014 declaration) because the UI refetches on events (debounced client side, OVE_SHELL005).
9. api-client: `getTopBarSummary({ workspaceId? })` returns `Result<TopBarSummary, AppError>`; no hand-written duplicate types.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Result`/`AppError` (ARCH003), `Clock` (ARCH007) for staleness, `defineRouteModule` (ARCH009), `defineModule` (ARCH006), builders and fakes from TEST002/PROV024/TG004.
- Use cases: `usecase:ListConnections`, `usecase:GetUsageSnapshot`, `port:ConcurrencyLimiter`, `port:ChannelStatusReader`, `usecase:ListApprovals`, `usecase:ListAccessRequests`, `usecase:ListEscalations`, `usecase:GetPauseSnapshot`.

## 8. Architecture and code placement

Domain function in `packages/domain/src/shell/`, use case in `packages/application/src/shell/` depending only on ports and other areas' use-case interfaces (DIP), route in gateway, module in the engine composition root. No adapter imports another adapter. No database access, no SQL: pure projection.

## 9. Security and safety

- Owner-only scope; agent and channel principals get 403 `gateway.forbidden_scope` (route registry test).
- Partial failure never produces a false 'nothing waiting': counts failing fails the call (fail closed for attention, fail soft for decoration).
- Verbatim CLI text is passed through the redactor already applied at write time (SEC003) and length capped again here (defence in depth); control and bidi characters removed.
- No audit event (read-only); the gateway pipeline logs the route id and status only.

## 10. Errors and edge cases

- A provider read times out: that part degrades, `engine.state: 'degraded'`.
- Pending-count read fails: 503 `gateway.not_ready` with `retryAfterMs`.
- Ollama only (no CLI): `limits` has one entry with `percentUsed: null`.
- Text '62%' with no direction word: `percentUsed: null` (never guessed) and `limitText` carries the text.
- Workspace deleted between UI selection and call: `data.not_found`; the UI falls back to the first Workspace (OVE_SHELL011).
- Clock skew: `stale` is computed with the injected Clock, never `Date.now()`.

## 11. Acceptance criteria

- [ ] Given the Claude CLI text 'Session limit: 62% used, resets in 3 h' then `percentUsed` is 62 and `resetsInText` is non-empty.
- [ ] Given 'You have 38% left' then `percentUsed` is 62; given '62%' alone then `percentUsed` is null.
- [ ] Given 2 Approvals, 1 Access Request and 3 Escalations then `pending.total` is 6.
- [ ] Given the escalations read throws then the route answers 503 and never 0.
- [ ] Given an agent token then the route answers 403.
- [ ] The route and client appear in the generated schema; additive-only check passes.

## 12. Test plan

- Unit: `extract-reported-percent.test.ts` (25+ cases), `get-top-bar-summary.test.ts` with fakes (ok, partial failure, ordering, truncation).
- Gateway: route test through `createGatewayUnderTest` (scope matrix, rate limit).
- Commands: `pnpm --filter @overmind/application test shell`, `pnpm --filter @overmind/gateway test shell`.

## 13. Parallelization notes

Starts after OVE_SHELL001. Parallel with all SHELL UI tasks (they use the example JSON or the mock gateway). Hotspot: `apps/engine/src/composition/modules/shell.module.ts` (own file; the module list is generated).

## 14. Open questions and assumptions

- ASSUMPTION: Approvals, Access Requests and Escalations counts are obtained from the listing use cases with a count-only option; if a `count` method is missing, the use cases' owners are asked via proposal and the list-with-limit fallback is used.
- ASSUMPTION: Escalations are counted in the 'N czekają' number (the Approvals view shows them in the section 'ESKALACJE', VIEWS 12).
- OPEN: Polish/English wording of `limitText` is the CLI's; never translated.
