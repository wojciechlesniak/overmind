---
id: OVE_PAUSE003
title: "Implement Global Pause and Resume use cases with authority, audit and idempotency"
area: PAUSE
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_ENGINE011, OVE_ENGINE016, OVE_PAUSE001]
soft_depends_on: []
provides: ["usecase:PauseGlobal", "usecase:ResumeGlobal", "usecase:GetPauseSnapshot"]
needs: ["port:AuditSink", "port:EventBus", "port:Clock", "lib:gateway-principal"]
owns: ["packages/application/src/pause/global/**", "packages/application/src/pause/snapshot/**", "packages/application/src/pause/support/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16", "SPECIFICATION 5"]
adr_refs: [3, 5, 6]
---

# OVE_PAUSE003: Implement Global Pause and Resume use cases with authority, audit and idempotency

## 1. Summary

Application use cases that start and end Global Pause: `PauseGlobal`, `ResumeGlobal` and `GetPauseSnapshot`. They enforce who may call them (Owner via desktop or tray; Telegram may pause but not resume), are idempotent, write audit events and publish `pause.changed`.

## 2. Context

Global Pause is the Owner's immediate brake (GLOSSARY: 'natychmiastowe wstrzymanie wszystkich Runów'). SEC008 rule T6 assumes: Telegram may start Global Pause, resuming requires the desktop. ADR 0006: Telegram is a Channel with lesser rights; a stolen phone must not be able to restart work, but stopping work is always safe. Agents and the Chief must never pause or resume (they could otherwise stall or restart the system).

## 3. Scope (in)

- Use cases with typed inputs/outputs and the authority matrix.
- Optimistic-concurrency retry (one retry) against `PauseRepository`.
- Audit event and `pause.changed` publication on effective changes only.
- `GetPauseSnapshot` read use case combining stored state with the drain counters from the coordinator (read through a small `DrainReader` port with a default of zero).

## 4. Out of scope

- Per-Workspace use cases: OVE_PAUSE004.
- What actually stops work (gate, coordinator): OVE_PAUSE005, OVE_PAUSE006.
- HTTP routes: OVE_PAUSE007. Telegram command parsing: OVE_TG007.

## 5. Detailed requirements

1. **Signatures** (factories receive one `deps` object; no container access):
   ```ts
   PauseGlobal.execute({ principal }): Promise<Result<{ snapshot: PauseSnapshot; changed: boolean }>>
   ResumeGlobal.execute({ principal }): Promise<Result<{ snapshot: PauseSnapshot; changed: boolean }>>
   GetPauseSnapshot.execute(): Promise<Result<PauseSnapshot>>
   ```
   `principal = { kind: 'owner'|'chief'|'agent'|'system', channel: 'desktop'|'tray'|'telegram'|'internal' }` is produced by the gateway authentication layer, never by the request body.
2. **Authority matrix** (MUST, enforced inside the use case, not only in the gateway):
   | actor | pause | resume |
   |---|---|---|
   | owner, channel desktop or tray | allowed | allowed |
   | owner, channel telegram | allowed | `pause.resume_requires_desktop` |
   | chief, agent | `pause.forbidden_actor` | `pause.forbidden_actor` |
   | system, internal (boot recovery, restore) | allowed (pause only) | `pause.forbidden_actor` |
3. Flow of `PauseGlobal`: authorise, load current global state, `nextState` (OVE_PAUSE001), if `changed` then `save` with `expectedVersion`, write an audit event `pause.global.paused` `{ actor, via, version }`, publish `pause.changed` with the fresh snapshot. If not `changed` return success with `changed:false` and write nothing (idempotent; the Owner pressing the button twice or two channels racing is not an error).
4. `ResumeGlobal` mirrors this and writes `pause.global.resumed`. Resuming does NOT resume Workspaces paused individually: those stay paused until their own resume (OVE_PAUSE004). The returned snapshot makes that visible.
5. Audit ordering: the state save and the audit/event writes use the same unit of work when DATA provides one (`port:UnitOfWork`); otherwise save first, then audit; if the audit write fails the use case logs `error`, still returns success (the pause has taken effect) and sets `auditPending` in the log for the repair job. A pause must never fail because auditing failed; a resume MUST fail closed: if the audit write fails, the resume is rolled back (state restored to paused) and the error `data.write_failed` is returned.
6. `GetPauseSnapshot` reads the in-memory gate cache when available (OVE_PAUSE005) and the repository otherwise; it adds `phase` and `drain` from `DrainReader` (`port:DrainReader`, defined in OVE_PAUSE006; until then a zero implementation).
7. Every call is logged at `info` with correlation id, channel and result, never with message text.
8. Concurrency: a `data.conflict` on save is retried once after re-reading; a second conflict returns the error. Calls for the same scope are serialised through a keyed async mutex so two near-simultaneous presses produce one version bump.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `AuditSink` (PERM), `EventBus` (ARCH010), `Clock`, `Result`/`AppError` (ARCH003), `nextState` and `effectivePause` (OVE_PAUSE001). This task creates `packages/application/src/pause/support/{authorize.ts,keyed-mutex.ts}` (the authority matrix function `authorizePause(principal, scope, direction)` and a keyed async mutex, unless ARCH provides one) which OVE_PAUSE004 reuses.

## 8. Architecture and code placement

`packages/application/src/pause/global/{pause-global.usecase.ts,resume-global.usecase.ts}` and `snapshot/get-pause-snapshot.usecase.ts`; ports consumed by interface only. Wiring in OVE_PAUSE008. Layer rule: application depends on domain and contracts only.

## 9. Security and safety

- Authority is enforced in the use case so that every entry point (gateway, in-process Telegram transport, future CLI) gets the same rule; tests call the use case directly with each principal.
- Resume is the dangerous direction: it is only allowed for Owner on desktop or tray. The `tray` channel is the macOS menu-bar popover rendered by the local desktop shell, authenticated like the desktop; the gateway assigns the `tray` channel only to the local app token (SEC005).
- Pausing from Telegram is allowed because it can only reduce activity; the audit event records `via: 'telegram'`.
- No request text is stored; audit payload has fixed fields.
- Idempotency prevents replayed Telegram `/pause` updates or double clicks from producing a noisy audit trail.

## 10. Errors and edge cases

- Pause pressed while the engine is starting: the use case is not available until boot recovery has loaded state (OVE_PAUSE008); the gateway returns `gateway.not_ready` and the UI retries.
- Resume pressed while a Workspace is individually paused: success, snapshot still shows that Workspace paused.
- Telegram `/resume`: `pause.resume_requires_desktop`, audited as a denied attempt (`pause.global.resume_denied`, via telegram).
- Agent principal forged via prompt injection into a request: impossible, the principal is derived from the transport, but the use case still rejects `agent` and `chief`.
- Audit sink unavailable on resume: resume rolled back as described.

## 11. Acceptance criteria

- [ ] Given owner/desktop, When PauseGlobal is called twice, Then the first returns changed:true, the second changed:false and exactly one audit event and one `pause.changed` exist.
- [ ] Given owner/telegram, When ResumeGlobal is called, Then `pause.resume_requires_desktop` is returned, state unchanged, a denial audit event exists.
- [ ] Given chief or agent principal, Then both operations return `pause.forbidden_actor`.
- [ ] Given Workspace A individually paused, When ResumeGlobal succeeds, Then the snapshot still lists A as paused.
- [ ] Given the audit sink fails, Then PauseGlobal still succeeds and ResumeGlobal leaves the system paused and returns an error.
- [ ] Two concurrent PauseGlobal calls produce version 1 only.

## 12. Test plan

Unit tests with `InMemoryPauseRepository`, `FakeAuditSink`, `FakeEventBus`, `FakeClock`: `pause-global.usecase.test.ts`, `resume-global.usecase.test.ts` (authority matrix table), `idempotency.test.ts`, `concurrency.test.ts`, `audit-failure.test.ts`. Commands: `pnpm vitest run packages/application/src/pause`.

## 13. Parallelization notes

OVE_PAUSE004 depends on this task (shared `support/` helpers). Parallel with OVE_PAUSE005 and OVE_PAUSE006 (different folders).

## 14. Open questions and assumptions

- OPEN (Owner decision): may Telegram resume? DEFAULT in this backlog: pause allowed, resume only at the desktop (ADR 0006 spirit: Telegram never gets to restart work an Owner stopped). Tracked as one switch `PauseAuthorityPolicy.telegramMayResume = false` that is not user-configurable in the MVP.
- ASSUMPTION: the tray popover talks to the same gateway with the local app token and is therefore channel `tray`, treated like `desktop`.
