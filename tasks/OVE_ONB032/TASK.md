---
id: OVE_ONB032
title: "Implement ConfirmWorkspaceStep: validate, rename, set isolation and mark step 3 done"
area: ONB
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DATA002, OVE_DATA011, OVE_ENGINE016, OVE_ONB003, OVE_ONB031]
soft_depends_on: ["OVE_ONB009"]
provides: ["usecase:ConfirmWorkspaceStep", "api:onboarding.workspace.confirm", "lib:api-client-onboarding-workspace"]
needs: ["usecase:RenameWorkspace", "usecase:SetWorkspaceIsolation", "usecase:GetWorkspace", "port:OnboardingStepWriter", "port:UnitOfWork", "lib:route-module", "port:AuditSink"]
owns: ["packages/application/src/onboarding/confirm-workspace-step/**", "packages/gateway/src/routes/onboarding/workspace-confirm.route.ts", "packages/api-client/src/onboarding/workspace-confirm.ts"]
reads: ["packages/application/src/onboarding/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [10, 28]
---

# OVE_ONB032: ConfirmWorkspaceStep

## 1. Summary

A single use case and route that finishes wizard step 3: it validates the Owner's Workspace name and isolation choice, applies them through the Workspace use cases, and marks `steps.workspace.done` in one unit of work. It gives step 3 a real server-side write path instead of overloading progress saving.

## 2. Context

Step 1 (ONB005) creates a provisional Workspace named after the folder because step 2 needs an Environment. Step 3 only names it and chooses 'Workspace izolowany' (glossary: Decisions and Memory stay inside, everything created is Private; ADR 0028). `OnboardingStepWriter` (ONB003) is the only thing allowed to set step results. DATA owns Workspace mutations (`RenameWorkspace`, `SetWorkspaceIsolation`); onboarding must call them, not touch tables.

## 3. Scope (in)

- Use case `ConfirmWorkspaceStep` in `packages/application/src/onboarding/confirm-workspace-step/`.
- Route module `workspace-confirm.route.ts` (`POST /v1/onboarding/workspace/confirm`).
- api-client function `confirmWorkspaceStep`.

## 4. Out of scope

- UI (ONB019 consumes this; amendment noted in 14).
- Workspace entity/contracts (DATA), docs link (ONB033), greeting (ONB036).

## 5. Detailed requirements

1. Input/Result from ONB031. Owner desktop principal only; Telegram principals get 403.
2. Preconditions: onboarding `status !== 'completed'` (else `onboarding.already_completed` success-with-flag per ONB001); `steps.folder.done` and `steps.connections.done` true and `currentStep >= 3` (else `onboarding.step_not_active`); `workspaceId` equals `state.steps.folder.workspaceId` (never accept another id, `onboarding.workspace_missing` otherwise).
3. Name validation (domain function `validateWorkspaceName`): NFC-normalise, trim, 1..80 code points, reject control characters (Unicode category `Cc` only; `Cf` such as ZWJ is allowed so emoji sequences work), reject strings made only of whitespace/punctuation separators.
4. Diff: load the Workspace (`GetWorkspace`); call `RenameWorkspace` only if the name changed, `SetWorkspaceIsolation` only if `isolated` changed. Uniqueness conflict from DATA is mapped to `onboarding.workspace_name_conflict`.
5. Then `OnboardingStepWriter.markWorkspaceDone(workspaceId)` and `currentStep = 4` in the same unit of work as the Workspace changes where the UoW supports it; if the Workspace calls already committed (separate transactions), the use case is idempotent so a retry converges (second call sees no diff and only writes the step).
6. Idempotency: `Idempotency-Key` honoured (same key returns the stored Result for 10 minutes); calling again with a different name after done is allowed while onboarding is not completed (it re-applies the diff; stays done).
7. Isolation toggle is not a permission change: no Local Approval and no Allowed Directory change (state this in the route docs). Audit: DATA already writes `workspace.updated`; this use case adds `onboarding.workspace_confirmed` with allowlisted details `{ workspaceId, isolated }` (never the name, which can contain private information).
8. Emits `onboarding.state_changed` via the existing event bus (ONB001 event) after commit.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`RenameWorkspace`, `SetWorkspaceIsolation`, `GetWorkspace` (DATA011), `OnboardingStepWriter` (ONB003), error helper (ONB001), route-module pattern and api-client conventions (ENGINE), `AuditSink` (PERM).

## 8. Architecture and code placement

Application layer: `confirm-workspace-step/{confirm-workspace-step.ts, validate-workspace-name.ts, index.ts}` (the validator is pure and also exported for the UI tests as a fixture list; the UI duplicates only the length hint, never the rules). Route module in gateway, api-client function in api-client. Depends only on ports and other use cases (DIP).

## 9. Security and safety

- Only the Workspace created in step 1 can be changed (no arbitrary id: prevents using the wizard as a rename oracle).
- Name is plain text; stored and returned as text; never interpolated into prompts here (the greeting task handles prompt-safe use).
- Fail closed: if `OnboardingStepWriter` fails after Workspace changes the Result is an error and the step stays not done.
- Audit omits the name.

## 10. Errors and edge cases

- Workspace deleted elsewhere: `workspace_missing`; UI sends the Owner to step 1.
- Same name as current: no rename call; still marks done.
- Concurrent rename from the dashboard (not possible before completion, but a second window): DATA version conflict -> one internal retry, then `409`.
- Telegram or agent principal: 403 and audit `denied`.
- Request before step 2 done: `step_not_active`.

## 11. Acceptance criteria

- [ ] Given a changed name and isolation on then DATA use cases are called once each and step 3 is done and `currentStep` is 4.
- [ ] Given an unchanged form then no Workspace mutation occurs and the step is done.
- [ ] Given a name conflict then `workspace_name_conflict` and the step is not done.
- [ ] Given a foreign workspaceId then `workspace_missing`.
- [ ] Given the same idempotency key twice then one set of effects.
- [ ] Given a Telegram principal then 403.

## 12. Test plan

Unit with fakes (`confirm-workspace-step.test.ts`, `validate-workspace-name.test.ts` with Unicode table), route test (`workspace-confirm.route.test.ts`), idempotency test. Command: `pnpm --filter @overmind/application test onboarding/confirm-workspace-step`.

## 13. Parallelization notes

Parallel with ONB033..ONB036. Hotspot: none; the route file is one module. ONB019 (UI) should call this instead of the progress trick.

## 14. Open questions and assumptions

- AMENDMENT REQUEST to ONB019: replace requirement 5 (progress trick) with `confirmWorkspaceStep`; ONB003 then needs no change. The linker resolves via `needs: api:onboarding.workspace.confirm`.
- ASSUMPTION: names equal case-insensitively count as conflicts (DATA011 rule).
