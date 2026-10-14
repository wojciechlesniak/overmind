---
id: OVE_TRAY004
title: "Implement GetTraySummary and the tray.summary gateway route with api-client"
area: TRAY
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT010, OVE_AGENT018, OVE_CHIEF015, OVE_DATA011, OVE_ENGINE006, OVE_ENGINE013, OVE_ENGINE019, OVE_PAUSE003, OVE_PERM014, OVE_PERM016, OVE_PROV019, OVE_TRAY003]
soft_depends_on: []
provides: ["usecase:GetTraySummary", "api:tray.summary", "lib:api-client-tray"]
needs: ["usecase:ListWorkspaces", "usecase:GetAgentStates", "usecase:GetPauseSnapshot", "usecase:ListApprovals", "usecase:ListAccessRequests", "usecase:ListEscalations", "port:ConcurrencyLimiter", "port:RunReader", "api:system.health", "lib:route-registrar", "lib:api-client"]
owns: ["packages/domain/src/tray/**", "packages/application/src/tray/**", "packages/gateway/src/routes/tray/**", "packages/api-client/src/tray/**", "apps/engine/src/composition/modules/tray.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 23]
---

# OVE_TRAY004: Implement GetTraySummary and the tray.summary gateway route with api-client

## 1. Summary

Builds the read-only use case that assembles `TraySummary` from the other areas' read ports, registers `GET /v1/tray/summary` and adds the typed api-client function and the engine module that wires them.

## 2. Context

The tray needs one fast, safe aggregate (see TRAY003). Every input already exists as a use case or port in another area: Agent states (AGENT010), Workspaces (DATA011), pause snapshot (PAUSE003), pending Approvals, Access Requests and Escalations (PERM014/016, CHIEF015), concurrency (PROV019) and active Runs (AGENT018). The use case only composes read models; it never writes. It follows the same pattern as `GetTopBarSummary` (SHELL002).

## 3. Scope (in)

- `GetTraySummary` use case in `packages/application/src/tray/` with injected read ports (no imports of other areas' internals).
- Phase and agent ordering rules (pure functions in `packages/domain/src/tray/`).
- Route handler `packages/gateway/src/routes/tray/summary.route.ts`.
- api-client function `tray.summary()` in `packages/api-client/src/tray/`.
- Engine module `apps/engine/src/composition/modules/tray.module.ts`.
- Contract and fake-based tests.

## 4. Out of scope

- Contract definitions (TRAY003).
- Any write operation (pause actions use PAUSE routes).
- UI.

## 5. Detailed requirements

1. **Ports consumed (narrow interfaces declared in `application/tray/ports.ts`, adapted from existing use cases in the module):** `ListWorkspacesPort` (`usecase:ListWorkspaces`), `AgentStatesPort.listAll()` (`usecase:GetAgentStates` per Workspace, aggregated; the module adapter loops over Workspaces), `PausePort.snapshot()` (`usecase:GetPauseSnapshot`), `PendingCountsPort` (`usecase:ListApprovals`/`ListAccessRequests`/`ListEscalations` in count-only form), `ConcurrencyPort` (`port:ConcurrencyLimiter`), `RunCountPort` (`port:RunReader`), `HealthPort` (engine state).
2. **Algorithm.** (1) Read all ports in parallel with a 400 ms budget each; a failing optional port (RunCount, Concurrency) yields a zero value and the summary is still returned; failure of the Workspace list or pause snapshot fails the call with `gateway.not_ready`. (2) Build `workspaces[]` sorted by `updatedAt desc`. (3) Select `agents[]`: state not idle, ordered `waiting_approval`, then `working`, then `error`, then `finished`; max 12; initials by a fixed rule (an all-caps name of up to 3 characters is kept as is; a two-word name uses the first letter of each word in upper case; otherwise the first letter upper case plus the second lower case); hue passed through. (4) `status.phase` = `paused` when global pause, `pausing` when the pause snapshot says draining, `working` when `workingAgents > 0`, else `idle`. (5) `pendingTotal` = sum of approvals, access requests and escalations over all Workspaces.
3. **Counts only.** The use case must not load full Approval objects: it requires count-only query options on the three list use cases (`{ countOnly: true }`); if they do not exist the adapter requests them via the PERM/CHIEF owners (gap in the final report); until then it uses `limit: 1` plus the total field.
4. **Route.** Registered through the route registrar (ENGINE013) with scope `owner`; response validated against `TraySummary`; `Cache-Control: no-store`; rate limit default.
5. **Performance.** Target p95 under 60 ms with 20 Workspaces and 12 working Agents on the reference Mac; a benchmark test with fakes asserts no N+1 per Workspace beyond one call each.
6. **Isolation of failures.** Each port wrapped by `safeRead(name, fn, fallback)` that records a metric and a log line (no content); partial results are normal.
7. **Events.** The route does not push; the UI uses `TRAY_INVALIDATING_EVENTS` with the event hub.
8. **Module wiring.** `tray.module.ts` registers the use case and route through the extension points of ARCH006/009 (no edits to shared composition files).

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- Route registrar (ENGINE013), `defineRoute` helpers, `safeRead` pattern from SHELL002, existing read use cases; fakes from AGENT, PAUSE, PERM, PROV test kits.

## 8. Architecture and code placement

`packages/domain/src/tray/**`, `packages/application/src/tray/**`, `packages/gateway/src/routes/tray/**`, `packages/api-client/src/tray/**`, `apps/engine/src/composition/modules/tray.module.ts`. Clean Architecture: domain pure rules, application ports, gateway adapter.

## 9. Security and safety

- Owner scope enforced by the route registrar; agent and channel tokens get 403 (test).
- Read-only; no secrets; names are plain text.
- No Approval payloads or message content are loaded or returned (counts only).
- An isolated Workspace is listed by name for the Owner only; no cross-Workspace content is exposed beyond names and counts.

## 10. Errors and edge cases

- Zero Workspaces: valid empty summary.
- Agent state projection not ready (engine just started): agents empty, `engine.state: 'degraded'`.
- Pause snapshot stale: the summary uses the store value; the PAUSE event invalidates quickly.
- Port timeout: fallback zero and metric; summary still 200.
- Workspace deleted between reads: its agents are filtered by the Workspace list join.

## 11. Acceptance criteria

- [ ] Given fakes for all ports then the response equals the expected summary and validates against the schema.
- [ ] Given global pause then phase is `paused` and `pause.global` true.
- [ ] Given 15 working Agents then 12 are returned and `workingAgents` is 15.
- [ ] Given an agent-scope token then the route returns 403.
- [ ] Given a failing RunReader then the summary returns `activeRuns: 0` and 200.

## 12. Test plan

- Unit tests for domain rules (phase, ordering, initials); use case tests with fake ports; route test with `createGatewayUnderTest` (ENGINE018); benchmark smoke test.
- Commands: `pnpm vitest run packages/application/src/tray packages/gateway/src/routes/tray`.

## 13. Parallelization notes

After TRAY003 and the read use cases of other areas (names in needs). Parallel with TRAY001/002. Module file is new, no hotspot.

## 14. Open questions and assumptions

- OPEN (cross-area): count-only options on `ListApprovals`, `ListAccessRequests`, `ListEscalations`; `RunReader` needs an active-run count; `GetAgentStates` is per Workspace (a cross-Workspace variant would avoid the loop).
- ASSUMPTION: the engine can compute `pausingAgents` from the PAUSE006 drain reader.
