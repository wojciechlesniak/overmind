---
id: OVE_ONB003
title: "Implement the onboarding state use cases: first-run detection, progress and resume"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_DATA002, OVE_DATA011, OVE_ONB001, OVE_ONB002, OVE_PERM031, OVE_PROV020]
soft_depends_on: []
provides: ["usecase:GetOnboardingState", "usecase:SaveOnboardingProgress", "port:OnboardingStepWriter", "lib:onboarding-machine"]
needs: ["port:OnboardingRepository", "usecase:ListAllowedDirectories", "port:AllowedDirectoryReader", "usecase:ListConnections", "usecase:ListWorkspaces", "port:Clock", "port:UnitOfWork"]
owns: ["packages/domain/src/onboarding/machine.ts", "packages/domain/src/onboarding/resume.ts", "packages/application/src/onboarding/state/**", "apps/engine/src/composition/modules/onboarding.module.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [10, 21]
---

# OVE_ONB003: Implement the onboarding state use cases: first-run detection, progress and resume

## 1. Summary

Implements `GetOnboardingState` (with the first-run rule and self-repair), `SaveOnboardingProgress` (the only way to move between steps, forbidding skipping required steps) and the pure `OnboardingMachine` that defines allowed transitions and derives the resume step from facts in other areas.

## 2. Context

SHELL025's guard asks one question: is this a first run? The answer must not depend on the UI. The wizard may be closed in the middle (quit, crash) and must resume at the right step even if the stored step is stale: for example the Owner finished a CLI login but the app crashed before the row was saved. So the machine derives the resume step from stored progress AND live facts (an Allowed Directory exists, a CLI connection is ready, a Workspace exists). A reinstall with existing data is NOT a first run (completed flag persisted in the database).

## 3. Scope (in)

- `OnboardingMachine` (pure) in `packages/domain/src/onboarding/`: transitions, gate rules, resume derivation.
- `GetOnboardingState` use case: reads the row, reconciles with facts through narrow ports, returns `OnboardingState` plus `needsOnboarding: boolean`.
- `SaveOnboardingProgress` use case: `{ currentStep }` forward and back moves with validation, idempotent.
- Reconciliation ports: `OnboardingFactsReader` with `hasAllowedDirectory()`, `loggedInClis()`, `firstWorkspaceId()` (adapters over PERM031 `AllowedDirectoryReader`, PROV `ListConnections`, DATA `ListWorkspaces`).
- Event emission `onboarding.state_changed` through the outbox.

## 4. Out of scope

- Folder provisioning (ONB005), checks (ONB006), completion (ONB007).
- Routes (ONB009).
- A reset or 're-run wizard' feature (not in MVP).

## 5. Detailed requirements

1. **First-run rule.** `needsOnboarding = !(row exists && status === 'completed')`. No row: `status: 'not_started'`, `currentStep: 1`. A completed row is trusted but re-validated lazily: if completed and the facts say 'no Workspace and no Allowed Directory' (data directory restored on a different machine), the state stays completed (the Owner has Workspaces gone, not a first run) and the UI shows the dashboard empty state; the guard never re-opens the wizard once completed (decision recorded).
2. **Transitions.** Forward from step N to N+1 requires step N done (folder: directory registered; connections: gate passes `evaluateGate`; workspace: Workspace exists and is confirmed; telegram: skipped or done). Back moves are always allowed to a lower step and never delete data. Jumping forward more than one step is refused with `onboarding.step_blocked` and `details.blockedStep`.
3. **Resume derivation.** `deriveResumeStep(row, facts)`: if no Allowed Directory -> 1; else if no CLI logged in or checks failing -> 2 (checks are re-run by the UI on entry, so the machine uses `loggedInClis` and the stored `connections.done`); else if no Workspace marked confirmed -> 3; else if telegram pending -> 4. The stored `currentStep` is used only if it is not beyond the derived step.
4. **Fact reconciliation.** When a fact contradicts the stored done flag (for example the folder step is marked done but the directory was removed in Settings meanwhile) the use case clears that step's done flag and logs an audit-free debug line; the UI then lands on that step.
5. **Progress persistence.** `SaveOnboardingProgress` writes `currentStep`, `updatedAt` (Clock port) and `status: 'in_progress'` (sets `startedAt` once) with optimistic concurrency; repeating the same request is a no-op returning the same state.
6. **Step data writes by other use cases.** ONB005/ONB007 update their own step results through the same repository via `OnboardingStepWriter` (a small port in this task: `markStepDone(stepId, data)`), so only one place writes the row (SRP). The writer enforces the invariants of the contract.
7. **Events.** `onboarding.state_changed { step, status }` after each persisted change (outbox).
8. **Audit.** Not audited as security events except completion (ONB007); progress is UX state.
9. **Concurrency.** Version conflicts retry once after a fresh read; two windows do not both drive the wizard (the tray does not touch it).
10. **Performance.** `GetOnboardingState` p95 < 30 ms (three cheap reads in parallel with 300 ms budget each; a failing facts port falls back to the stored flags and marks `degraded` in the response).

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- Repository (ONB002), `AllowedDirectoryReader` (PERM031), `ListConnections` (PROV020), `ListWorkspaces` (DATA011), Clock and outbox (ARCH007, DATA002).

## 8. Architecture and code placement

`packages/domain/src/onboarding/{machine.ts,resume.ts}`, `packages/application/src/onboarding/state/{get-onboarding-state.ts,save-onboarding-progress.ts,onboarding-step-writer.ts,facts-reader.ts}`, composition in `apps/engine/src/composition/modules/onboarding.module.ts`. Domain pure, application use cases with ports.

## 9. Security and safety

- The first-run flag cannot be forged by the UI: state is written only by engine use cases; the wizard routes are owner scope; the UI cannot mark a step done directly (only `SaveOnboardingProgress` moves the pointer, step results are written by the use cases that verify them).
- Completion cannot be reached by skipping required steps (machine rule, enforced again in ONB007).
- No secrets are read or stored.

## 10. Errors and edge cases

- Row missing but Allowed Directory and CLI exist (data restored without the row): state `not_started` at step 1 with facts shown as already satisfied; ONB005 treats an existing directory as idempotent.
- Stored step 4 but Workspace missing: resume goes to step 3.
- Facts port timeout: stored flags used, response flagged `degraded: true`.
- Back from step 3 to 1 and changing the folder: ONB005 handles replacement; the machine only moves the pointer.
- Clock failure: Clock port is injected; tests use the fake clock.

## 11. Acceptance criteria

- [ ] Given no row then the state is not_started, step 1 and needsOnboarding true.
- [ ] Given completed then needsOnboarding is false even if facts are empty.
- [ ] Given a request to jump from step 1 to 3 then `onboarding.step_blocked` is returned.
- [ ] Given stored step 4 and no CLI logged in then resume is step 2.
- [ ] Given repeated identical progress saves then one persisted change and one event.

## 12. Test plan

- Vitest on the machine with a truth table; use-case tests with fakes for the repository and facts reader; conflict retry test.
- Commands: `pnpm vitest run packages/domain/src/onboarding packages/application/src/onboarding/state`.

## 13. Parallelization notes

After ONB001/002. Parallel with ONB004 and ONB006. ONB005 and ONB007 depend on `OnboardingStepWriter`.

## 14. Open questions and assumptions

- DECISION: once completed the wizard never reopens automatically; a 're-run setup' feature would be a Settings action (not MVP).
- ASSUMPTION: 'confirmed Workspace' (step 3) is a flag written by ONB019's call, not inferred from existence, because step 1 already creates the Workspace.
