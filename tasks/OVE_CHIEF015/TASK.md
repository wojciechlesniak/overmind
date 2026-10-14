---
id: OVE_CHIEF015
title: Implement Escalations (raise, notify, resolve) with a cascade participant
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_CHIEF001, OVE_CHIEF006, OVE_DATA002, OVE_DATA012, OVE_NOTIF004, OVE_PERM020, OVE_WFRT053]
soft_depends_on: [OVE_CHIEF014]
provides: ["usecase:RaiseEscalation", "usecase:ResolveEscalation", "usecase:ListEscalations", "port:EscalationRepository", "table:escalations", "api:escalations.list", "api:escalations.resolve", "participant:escalations-cascade", "usecase:escalation.raise", "event:escalation.raised", "event:escalation.resolved"]
needs: ["usecase:Notify", "usecase:AppendAudit", "port:WorkspaceCascadeParticipant", "usecase:ResumeRunBranch", "lib:route-module", "port:UnitOfWork"]
owns: ["packages/application/src/chief/escalation/**", "packages/application/src/ports/EscalationRepository.ts", "packages/adapters/sqlite/src/chief/escalation-repository.ts", "packages/adapters/sqlite/migrations/V202610141420__OVE_CHIEF015__escalations.sql", "packages/gateway/src/routes/chief/escalations.route.ts"]
reads: ["packages/contracts/src/chief/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 12", "SPECIFICATION 16.5", "SPECIFICATION 16.12"]
adr_refs: [15, 16, 22]
---

# OVE_CHIEF015: Implement Escalations (raise, notify, resolve) with a cascade participant

## 1. Summary

Escalation is how Chief says "this needs you": over budget, a Rule or Documentation conflict, a missing "what", no fallback model, a deadlock outside limits, plan drift. This task stores Escalations, notifies the Owner, lets the Owner resolve them with an option, and resumes the blocked work.

## 2. Context

Glossary: Escalation = passing the matter to Chief or the Owner when a Run cannot reach its goal within set limits. ADR 0015: outside Budget, Documentation or Rules Chief escalates. Spec criterion 5: exhausted loop limit leads to Escalation; criterion 12: no fallback model means Escalation. Notifications: completion, error, Access Request, Approval, Escalation, Chief-started Discussion (SPEC 12).

## 3. Scope (in)

- Table, repository, use cases `RaiseEscalation`, `ResolveEscalation`, `ListEscalations`.
- De-duplication, notification, "waiting" linkage to Runs/Tasks.
- Routes `GET /v1/escalations`, `POST /v1/escalations/{id}/resolve`.
- Cascade participant `escalations-cascade`.

## 4. Out of scope

- UI: APPRUI/WSPACE. Notification sound and macOS delivery: NOTIF. Run-level escalation from loop exhaustion: WFRT raises it through `RaiseEscalation`.

## 5. Detailed requirements

1. Table `escalations(id PK, workspace_id NULL, reason, summary, subject_type NULL, subject_id NULL, options_json, status, resolution_json NULL, raised_at, raised_by_json, run_id NULL, task_id NULL, notified_at NULL, dedupe_key TEXT NOT NULL)`; unique partial index on `dedupe_key WHERE status = 'open'`.
2. `RaiseEscalation({ reason, summary, subjectRef?, options?, runId?, taskId?, workspaceId? })`: dedupe key = hash of `(reason, subject, workspace)`; a duplicate open Escalation is updated (`occurrences + 1`, no second notification within 1 h). The summary is composed by Overmind templates from facts when the caller is not Chief; Chief-provided summaries are sanitised plain text <= 400 characters.
3. Notification: `Notify(kind: 'escalation', workspace, summary key)` once; plus a Chief chat message with a card part and the options (buttons are routed to `ResolveEscalation`). Telegram receives a text summary; options that grant anything are not offered on Telegram, and resolutions via Telegram are limited to non-permission options (`retry`, `skip`, `wait`, `dismiss`).
4. `ResolveEscalation(id, { optionKey?, note? })`: Owner only. Option keys come from the stored options (never from the request body beyond selection). Effects by option type: `retry` -> resume the blocked Run/branch (`ResumeRunBranch`); `skip` -> mark Task skipped (BOARD); `answer` -> the Owner's note is stored as a Decision proposal (`missing_what` answers become a documentation task, not auto-edited docs); `raise_budget_for_run` -> asks PERM/WFRT to apply an Owner-approved Budget override for this Run only; `dismiss`. Each effect runs through the owning area's use case which re-checks authority.
5. Blocking: while open, the related Run/branch/Task shows `waiting for Owner` (status events); other Runs and Workspaces continue (ADR 0015).
6. Reasons escalate by priority: `rule_conflict` and `missing_what` appear first in lists; the top bar counter includes open Escalations.
7. Auto-resolution: an Escalation whose subject became moot (Task done, Run cancelled) is marked `dismissed` with `resolution.auto = true`.
8. Chief reminder: open for 24 h without response -> one reminder notification, then daily up to 3.
9. Cascade participant `escalations-cascade` (id `chief-escalations`): deletes Escalations of a deleted Workspace and returns counts for the preview.
10. Audit `chief.escalation.raised/resolved`; events from CHIEF001.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`Notify` (NOTIF), `ResumeRunBranch` (WFRT), BOARD update use cases, `WorkspaceCascadeParticipant` (DATA012), audit.

## 8. Architecture and code placement

`packages/application/src/chief/escalation/*.usecase.ts`, effect executors registered by option type (multi-token); SQLite adapter and migration as owned; routes in `packages/gateway/src/routes/chief/`.

## 9. Security and safety

Escalation options are chosen from a stored list so an injected response cannot invent an effect; resolutions that would widen permissions are not available at all (those are Access Requests handled by PERM); Telegram resolutions are non-permanent only; every resolution audited; reminders capped to avoid notification floods.

## 10. Errors and edge cases

- Resolve on a closed Escalation: `chief.escalation_not_found` or already resolved idempotent success for the same option.
- Option effect fails (WFRT unavailable): Escalation stays open and the error is shown.
- Burst of identical reasons from a looping Run: deduped, occurrences counted.
- Owner resolves from two devices: first wins.
- Workspace deleted: cascade removes them.

## 11. Acceptance criteria

- [ ] Raising twice with the same key creates one Escalation and one notification.
- [ ] Owner resolving with `retry` resumes the Run branch.
- [ ] Telegram cannot select a permission-affecting option.
- [ ] A moot Escalation is auto-dismissed.
- [ ] Reminders follow the 24 h cadence with a cap of 3.
- [ ] Cascade deletes Escalations and reports counts.
- [ ] Criterion 5 and 12 flows produce Escalations (WFRT and CHIEF018 use this task, shared fixtures).

## 12. Test plan

Repository contract tests; use case tests with fakes; reminder timer test with fake clock; cascade test with the DATA012 harness. Command: `pnpm vitest run packages/application/src/chief/escalation packages/adapters/sqlite/src/chief`.

## 13. Parallelization notes

WFRT, CHIEF008/011/013/018 call `RaiseEscalation`; merge the use case signature early. Hotspot: migration file only.

## 14. Open questions and assumptions

- ASSUMPTION: the `raise_budget_for_run` option relies on a WFRT/PERM override capability (`usecase:ApplyRunBudgetOverride`), flagged to the linker.
