---
id: OVE_CHIEF011
title: Implement StartWorkflowFromChief within Budget and concurrency limits
area: CHIEF
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF003, OVE_CHIEF006, OVE_CHIEF015, OVE_PERM010, OVE_VIS002, OVE_WFRT052]
soft_depends_on: [OVE_CHIEF009]
provides: ["usecase:StartWorkflowFromChief", "handler:chief.start_workflow"]
needs: ["usecase:StartRun", "port:WorkflowReader", "port:PauseStateReader", "lib:visibility-rules", "usecase:RaiseEscalation"]
owns: ["packages/application/src/chief/workflow/**"]
reads: ["packages/domain/src/chief/autonomy/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 7", "SPECIFICATION 16.5", "SPECIFICATION 16.14"]
adr_refs: [15, 2, 28]
---

# OVE_CHIEF011: Implement StartWorkflowFromChief within Budget and concurrency limits

## 1. Summary

Let Chief start a Workflow Run for a Workspace when the autonomy policy allows: the Workflow is visible there, a Version is pinned, the estimated cost fits the Budget and Global Pause is off.

## 2. Context

Chief "uruchamia Workflow" (SPEC 4). Runs pin an immutable Workflow Version (ADR 0002); Workflows are public or private (ADR 0028); concurrency defaults to 3 Agents across the installation, enforced by the engine (SPEC 9, criterion 14). Chief cannot bypass Budgets, timeouts or Approvals (ADR 0021).

## 3. Scope (in)

- `StartWorkflowFromChief({ workspaceId, workflowId, versionId?, inputRef?, reason })` and the `start_workflow` handler.
- Pre-flight checks and the result message to the Owner.

## 4. Out of scope

- Run semantics: WFRT `StartRun`. Budget accounting: WFRT/PROV. Cancelling Runs: Owner or WFRT.

## 5. Detailed requirements

1. Pre-flight: Workflow exists and is visible in the Workspace; latest published Version is pinned when `versionId` is absent (drafts are never started); validation report has no errors (`ValidateWorkflow`); Workspace is not paused; Global Pause is off (else `pause.active`).
2. Autonomy: `evaluateAutonomy('workflow_start')` with the Run Budget estimate from the Workflow Version metadata (cost, iterations); `decide_alone` -> start; otherwise `RaiseEscalation(over_budget)` with an option "Start anyway (raises Budget for this Run)" that only the Owner can pick.
3. Inputs: `inputRef` is a typed reference (Task id, Artifact id, Document ref), never free text that becomes a command; it is validated against the Workflow input contract.
4. Duplicate prevention: the same `(workflowId, versionId, inputRef)` already `running` returns the existing Run (idempotent) rather than a second Run; a Run limit per Workspace (default 5 concurrent) escalates.
5. Chief never edits a Workflow Version or its permissions; starting uses the Owner-approved definition as is.
6. The Run is attributed `startedBy: { kind: 'chief', turnId }` and audit `chief.run.started` is written.
7. Owner message: "Started workflow X (version N) for Workspace Y" (template), linking the Run.
8. Failure to start never leaves a Run in a half state (WFRT transaction); Chief receives the error code and reports it.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

WFRT `StartRun`, `ValidateWorkflow` (WFRT010), autonomy policy (CHIEF003), escalation use case (CHIEF015).

## 8. Architecture and code placement

`packages/application/src/chief/workflow/start-workflow-from-chief.usecase.ts`; module `chief-workflow.module.ts`.

## 9. Security and safety

Chief starts only what the Owner built or approved, with permissions fixed by the pinned version and PERM; no inline workflow definitions are accepted from model output (schema has only ids). Budget and Pause checks fail closed. Drafts cannot run.

## 10. Errors and edge cases

- Workflow only private to another Workspace: `chief.outside_autonomy`/visibility error.
- Version unpublished between check and start: WFRT error, reported.
- Validation errors: start refused with the report summary to the Owner.
- Estimate missing: escalate (autonomy fails toward escalation).
- Engine paused: refused with notice.

## 11. Acceptance criteria

- [ ] A valid published Workflow starts and the Run pins the version.
- [ ] A draft or invalid Workflow is refused.
- [ ] Over-budget estimate raises an Escalation and no Run exists.
- [ ] Global Pause refuses the start.
- [ ] Duplicate start returns the existing Run.
- [ ] An action carrying an inline definition is rejected by the parser.

## 12. Test plan

Unit tests with fake WFRT; negative tests; idempotency test. Command: `pnpm vitest run packages/application/src/chief/workflow`.

## 13. Parallelization notes

Parallel with CHIEF009/010. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Workflow versions expose a cost estimate field (WFRT002); until present the estimate is unknown and Chief escalates.
- ASSUMPTION: 5 concurrent Runs per Workspace default.
