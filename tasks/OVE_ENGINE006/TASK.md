---
id: OVE_ENGINE006
title: Engine lifecycle state machine, health aggregation and the system.health route
area: ENGINE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH006, OVE_ARCH007, OVE_ARCH009, OVE_ARCH010, OVE_ENGINE002, OVE_ENGINE010]
soft_depends_on: []
provides: ["api:system.health", "port:HealthCheck", "lib:engine-lifecycle-state", "event:system.state_changed"]
needs: ["lib:route-module", "port:Clock", "port:Logger", "lib:multi-token", "port:EventBus"]
owns: ["apps/engine/src/lifecycle/**", "packages/application/src/ports/HealthCheck.ts", "packages/contracts/src/system/health.schema.ts", "packages/contracts/src/system/system.routes.ts", "packages/contracts/src/events/system.state-changed.event.ts", "packages/gateway/src/routes/engine/system-health.route.ts", "apps/engine/src/composition/modules/engine-health.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 15"]
adr_refs: [5]
---

# OVE_ENGINE006: Lifecycle state, health aggregation and `system.health`

## 1. Summary

A small explicit state machine for the engine (`starting`, `migrating`, `recovering`, `ready`, `degraded`, `draining`, `stopped`, `failed`), a multi-provider `HealthCheck` port that every area can contribute to, and the authenticated route the UI, tray and shell poll.

## 2. Context

The tray shows status (SPEC 12), the shell needs to know whether the engine is usable (SETUP010), the UI shows an engine-unavailable state, TEST011 and SEC005 wait for readiness. Health must never leak internals or secrets.

## 3. Scope (in)

- State machine, `HealthCheck` port, aggregation, route `GET /v1/system/health`, event `system.state_changed`.

## 4. Out of scope

- Individual checks of other areas (DB: DATA020; herdr: PROV; sandbox: BOX; Telegram: TG). Support bundle: ENGINE025.

## 5. Detailed requirements

1. States and transitions (table in code and docs): `starting -> migrating -> recovering -> ready`, `ready <-> degraded`, `ready|degraded -> draining -> stopped`, any `-> failed`. Illegal transitions throw an `InvariantError`. Every transition appends a NON-persisted bus event `system.state_changed {from, to, reason}` (persisted variant only for `failed`, `draining`).
2. `HealthCheck` multi-port: `{ id, critical: boolean, check(signal): Promise<HealthStatus> }`, `HealthStatus = { status: 'ok'|'degraded'|'failed'; detail?: Record<string, string|number|boolean> }`. Details are bounded scalars (no strings longer than 80 chars, no paths).
3. Aggregation: run all checks in parallel with 2 s timeout each (timeout = `degraded` for non-critical, `failed` for critical); overall `ready` if all ok, `degraded` if any non-critical not ok, `failed` if a critical check fails. Result cached for 1 s to survive polling. A failed critical check moves the lifecycle to `degraded` (never auto-`failed`, the Owner decides) except database corruption (DATA020 refuses start).
4. Route `GET /v1/system/health` (scope owner, agent-minimal, channel): response `{ state, uptimeSeconds, startedAt, version, protocol, checks: [{ id, status, detail? }], recovery?: {total, done}, paused: boolean }`; agent scope receives only `{ state }` (no checks, no versions) to avoid reconnaissance.
5. During `starting|migrating|recovering` the gateway answers health with 200 and the state; all other routes except `system.version` answer `503 gateway.engine_not_ready` with `Retry-After: 1` (middleware in ENGINE011 reads the lifecycle state).
6. Prometheus-style metrics are NOT exposed. A minimal `GET /v1/system/stats` is part of diagnostics (ENGINE025).
7. Sleep/wake: on macOS wake notifications (via `Notifier`/platform hook if available) or detected monotonic-vs-wall clock jump > 30 s, run all checks once and log `info system.resumed_from_sleep`; Runs are not auto-paused (ADR 0005: work does not continue during sleep, the process is simply suspended).
8. Uptime from `Clock.monotonicMs` (not wall clock).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`multiToken`, `defineRouteModule`, `Clock`, event definition helpers.

## 8. Architecture and code placement

State machine in `apps/engine/src/lifecycle/`; port in application; contract in `packages/contracts/src/system/`; route in `packages/gateway/src/routes/engine/` (area dir `engine`).

## 9. Security and safety

Health is information disclosure: agent scope gets only the state, details contain no paths, tokens or versions of third-party components beyond bounded numbers. The route requires the token like all others (ENGINE001). Timeouts keep a hung check from blocking the engine.

## 10. Errors and edge cases

- Check throws: that check `failed` with detail `error: 'check_failed'`, logged with the check id only.
- Clock jump after sleep: uptime unaffected (monotonic).
- Polling storm: cached 1 s.

## 11. Acceptance criteria

- [ ] Illegal transition throws; table-driven test covers all transitions.
- [ ] Given a hung check, then the route answers within 2.5 s with the check `degraded` or `failed` per criticality.
- [ ] Agent token receives only `{ state }`.
- [ ] During `migrating`, other routes return 503 with `Retry-After`.
- [ ] Response validates against the generated JSON Schema.

## 12. Test plan

Unit tests (state table, aggregation with fake checks and FakeClock), route tests through `createGatewayUnderTest`. Commands: `pnpm vitest run apps/engine/src/lifecycle packages/gateway/src/routes/engine`.

## 13. Parallelization notes

Areas add `HealthCheck` providers in their own modules. Route area folder `engine` (my area lowercase) is separate from `data`.

## 14. Open questions and assumptions

- ASSUMPTION: no external metrics endpoint in MVP.
