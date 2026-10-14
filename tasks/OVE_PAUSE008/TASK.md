---
id: OVE_PAUSE008
title: "Wire the pause module: fail-closed boot recovery, startup order and restore step"
area: PAUSE
kind: infra
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH006, OVE_BACKUP008, OVE_ENGINE016, OVE_NOTIF004, OVE_PAUSE002, OVE_PAUSE003, OVE_PAUSE004, OVE_PAUSE005, OVE_PAUSE006]
soft_depends_on: []
provides: ["lib:pause-module", "lib:pause-restore-step"]
needs: ["lib:composition-root", "port:AuditSink", "usecase:CreateNotification", "port:RestoreSanitizerStep"]
owns: ["apps/engine/src/composition/modules/pause.module.ts", "packages/application/src/pause/boot/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5]
---

# OVE_PAUSE008: Wire the pause module: fail-closed boot recovery, startup order and restore step

## 1. Summary

Registers all pause pieces in the composition root and guarantees that after any restart the engine starts with the stored pause state loaded before any dispatcher starts. If the state cannot be read, the engine starts in Global Pause and tells the Owner.

## 2. Context

ADR 0005 and SPEC 16.7: restart must not lose or ignore state. A Mac that reboots while the Owner had paused must not start working on its own. The module also provides the post-restore step so that restoring a backup never resurrects an unpaused system (OVE_BACKUP008).

## 3. Scope (in)

- `pause.module.ts` following ARCH006 (`requires`, `provides`, `start`, `stop`).
- `BootRecovery` that loads the repository, applies it to the gate, handles corruption and reports.
- `RestoreSanitizerStep` implementation for pause (global paused after restore).
- Start-order guarantee test: dispatching modules require `PauseGateToken`.

## 4. Out of scope

- Other modules (WFRT, PROV, CHAT) registering participants: their tasks.
- Notification texts for the corrupt-state case: OVE_NOTIF013 (kind `system_attention`).

## 5. Detailed requirements

1. `pause.module.ts` provides `PauseGateToken`, `PauseGateControlToken`, `PauseParticipantsToken` (collect), `PauseGlobalToken`, `ResumeGlobalToken`, `PauseWorkspaceToken`, `ResumeWorkspaceToken`, `GetPauseSnapshotToken`, `DrainReaderToken`; `requires` repository, event bus, audit sink, clock, logger, workspace repository.
2. `start()` order: (1) `BootRecovery.run()` BEFORE any module that requires `PauseGateToken` starts (guaranteed by topological order: the gate token is provided by this module); (2) start the coordinator; (3) call `onPause` once for the loaded paused scopes so that participants restore their 'held' state.
3. **BootRecovery outcomes**: (a) rows loaded: apply to the gate; if any scope is paused, log `info` 'starting paused (global|N workspaces)'; (b) no rows: running; (c) `load()` fails or a row is corrupt: save nothing, apply a synthetic snapshot `global.paused = true, via: 'system'` to the gate (in memory only; persisting would overwrite a possibly recoverable file), emit one notification request `system_attention` with `reasonKey: 'pause.state_unreadable'` and write an audit event `pause.state_unreadable`. The Owner resumes at the computer, which writes a fresh valid row.
4. A paused-at-boot global state is NOT auto-resumed after any amount of time; only an Owner action resumes (documented in `docs/architecture/pause.md` section 'restart').
5. **Restore step**: implements `RestoreSanitizerStep` (BACKUP): after a database restore, remove all workspace pause rows that reference unknown Workspaces and set global paused with `via: 'system'` (audit `pause.global.paused`), so the Owner confirms resuming after checking the restored data.
6. `stop()` flushes nothing (state is saved synchronously by use cases) and unsubscribes the coordinator.
7. A test asserts via module metadata that every module providing a dispatcher (a module whose `provides` includes `port:RunDispatcher`, `service:AgentCommandSender` or `service:ChatDelivery`) has `PauseGateToken` in `requires` (lint-like unit test over the composed module list; unknown capabilities are skipped with a warning until those modules exist).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `defineModule`, `composeEngine`, `multiToken` (ARCH006), `Notifier`-free notification request through the NOTIF `usecase:CreateNotification` (listed in `needs` as `usecase:CreateNotification`, provided by OVE_NOTIF004), `AuditSink`.

## 8. Architecture and code placement

`apps/engine/src/composition/modules/pause.module.ts` is the only wiring file; `packages/application/src/pause/boot/{boot-recovery.ts,restore-step.ts}` hold logic without I/O (repository injected). Composition root is the only place that knows both adapters and use cases.

## 9. Security and safety

- Fail closed on every uncertainty (unreadable state, corrupt row, missing table): the system starts paused.
- No automatic resume: neither a timer nor a client reconnect can lift the pause.
- The synthetic paused snapshot is not persisted, so a transient read error cannot overwrite a good stored state with a wrong one.
- Boot notifications contain keys and counts only.

## 10. Errors and edge cases

- Database present but table missing (very old restore): treated as empty and running; migrations create it; the restore step then pauses (restore path).
- One workspace row corrupt, global row fine: global state applied, that Workspace treated as paused, notification sent.
- Boot while Keychain is locked: irrelevant to pause; Telegram handles its own degraded state.
- Module order cycle introduced by a future module: `composeEngine` reports `di.cycle`; this task's test guards the dispatcher rule.
- Participants not registered yet: coordinator reports drain 0 immediately.

## 11. Acceptance criteria

- [ ] Given a stored `global.paused = 1`, When the engine restarts, Then the gate reports paused before any dispatcher module's `start` runs and no step is dispatched.
- [ ] Given a corrupt row, Then the engine starts paused, one `system_attention` notification request and one audit event are produced, and the stored row is untouched.
- [ ] Given the restore step, When it runs, Then global is paused with `via: 'system'`.
- [ ] Given stored state `paused=false`, Then startup is running and nothing is notified.
- [ ] The dispatcher-requires-gate test fails when a fake dispatcher module omits the gate.

## 12. Test plan

Integration tests with in-memory repository and the composition test harness: `boot-recovery.test.ts`, `module-order.test.ts`, `restore-step.test.ts`, `pause-module.compose.test.ts`. Commands: `pnpm vitest run packages/application/src/pause/boot apps/engine/src/composition`.

## 13. Parallelization notes

Last backend wiring task; touches only its module file (extension point of ARCH006). OVE_BACKUP008 consumes the restore step. WFRT/PROV/CHAT modules add `PauseGateToken` to their own `requires`.

## 14. Open questions and assumptions

- OPEN: should the Owner be able to choose 'start paused after reboot' vs 'start as left'? DEFAULT: start exactly as left (paused stays paused, running stays running).
- The notification key `pause.state_unreadable` text is added by OVE_NOTIF013.
