---
id: OVE_ONB007
title: "Implement CompleteOnboarding: final gate, completion record and hand-off event"
area: ONB
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DATA002, OVE_ONB002, OVE_ONB003, OVE_ONB006, OVE_PERM020, OVE_PERM031, OVE_TG003]
soft_depends_on: []
provides: ["usecase:CompleteOnboarding"]
needs: ["port:OnboardingRepository", "port:AllowedDirectoryReader", "usecase:GetPairingState", "usecase:AppendAudit", "port:UnitOfWork", "port:Clock"]
owns: ["packages/application/src/onboarding/complete/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [10, 21]
---

# OVE_ONB007: Implement CompleteOnboarding: final gate, completion record and hand-off event

## 1. Summary

Implements the last server-side step: `CompleteOnboarding` re-verifies every required fact (Allowed Directory, working isolation, one logged-in CLI, a confirmed Workspace), allows an optional Telegram step to be skipped, records the completion once and publishes `onboarding.completed`.

## 2. Context

The wizard must not be completable by skipping or by a stale UI (SPEC 16.1: no folder means no agent access; SPEC 11: isolation required). The UI only requests completion; the engine decides. Completion flips `needsOnboarding` to false for good (ONB003), which the shell guard (SHELL025) reads. After completion other areas start working: Chief becomes available for the Owner's first conversation (CHIEF area subscribes to `onboarding.completed` if it needs to greet; not required).

## 3. Scope (in)

- `CompleteOnboarding` use case, idempotent.
- Gate verification through narrow ports reused from ONB003/006 (facts reader, cached checks with a forced re-run of isolation if older than 10 minutes).
- Persistence via `OnboardingRepository.markCompleted` (ONB002) inside one transaction with the outbox event.
- Audit `onboarding.completed` with step results summary (no secrets).

## 4. Out of scope

- Routes (ONB009), UI redirect (ONB022).
- Greeting or seeding Chief content.
- Telegram step logic (TG).

## 5. Detailed requirements

1. **Preconditions (all re-checked, not trusted from state):** (1) `AllowedDirectoryReader.has(workspaceId)` true for the provisioned Workspace; (2) `GetWizardChecks` shows `apple_container`, `isolation_test`, `herdr` ready and at least one of claude/codex ready — if the cached result is older than 10 min or missing, run `RunWizardChecks` for those rows first (`isolation_test` is re-run when older than 10 min); (3) the Workspace exists and `steps.workspace.done` is true; (4) Telegram: `pending` is allowed only if explicitly skipped: the request body carries `telegram: 'skipped' | 'done'` and the use case verifies `done` against `GetPairingState` (TG003) being `paired`; `pending` is refused (`onboarding.not_ready_to_complete`, details.missing: ['telegram_decision']) so the Owner makes a decision, even if only to skip.
2. **Failure detail.** On failure return `onboarding.not_ready_to_complete` with `details.missing` from the closed set `['folder','isolation','herdr','cli_login','workspace','telegram_decision']` so the UI can route the Owner to the right step (the UI sets the step through `SaveOnboardingProgress`).
3. **Record.** `markCompleted(now)` sets `status: 'completed'`, `completedAt`, `currentStep: 4`; emits `onboarding.completed { workspaceId }` and `onboarding.state_changed`. A repeated call returns the stored result (`onboarding.already_completed` as a success-with-flag result, idempotency key honoured).
4. **Principal.** Owner desktop session only; no Local Approval needed (completion changes no permissions: the folder was approved in step 1).
5. **Side effects on completion.** None beyond the event; no Agents start; no Runs; no Telegram messages are sent. The current Workspace for the UI is `workspaceId` from the event payload.
6. **Audit.** `AppendAudit` action `onboarding.completed` with details `{ workspaceId, clis: ['claude'], telegram: 'skipped'|'done', isolationCheckedAt }` (allowlisted keys).
7. **Observability.** Counter metric `onboarding_completed_total` (diagnostics endpoint only).

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `OnboardingRepository.markCompleted` (ONB002), `GetWizardChecks/RunWizardChecks` (ONB006), `AllowedDirectoryReader` (PERM031), `GetPairingState` (TG003), `AppendAudit` (PERM020), outbox (DATA002).

## 8. Architecture and code placement

`packages/application/src/onboarding/complete/complete-onboarding.ts`. Application layer; ports only.

## 9. Security and safety

- Cannot be bypassed by the UI: all conditions verified server-side with fresh facts.
- Owner scope only; Telegram or agents cannot complete onboarding.
- Isolation freshness check prevents completing with a stale 'ready' after the sandbox broke.
- No secrets in events or audit.

## 10. Errors and edge cases

- Telegram `done` claimed but not paired: refused with `telegram_decision`.
- CLI logged out between step 2 and completion: refused with `cli_login`; the UI returns to step 2.
- Engine restart during completion: transaction is atomic; the retry returns the stored result.
- Workspace deleted by another action meanwhile: `workspace` missing.
- Cached checks missing after engine restart: forced re-run (may take up to 60 s; the route allows a long timeout of 90 s).

## 11. Acceptance criteria

- [ ] Given all conditions satisfied then the state becomes completed and one event is emitted.
- [ ] Given a stale cache older than 10 minutes then isolation is re-run before completion.
- [ ] Given Telegram pending and no decision then the call is refused with `telegram_decision`.
- [ ] Given a repeated call then no second event.
- [ ] Given isolation failing then refused with `isolation`.

## 12. Test plan

- Use-case tests with fakes (each missing condition, freshness, idempotency).
- Commands: `pnpm vitest run packages/application/src/onboarding/complete`.

## 13. Parallelization notes

After ONB003 and ONB006. Parallel with ONB008. ONB009 exposes it.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram needs an explicit decision (skip or done); the mock marks the step 'opcjonalnie' but the wizard still asks once.
- OPEN: should completion create the first Chief conversation or greeting? Left to CHIEF via the event.
