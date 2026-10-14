---
id: OVE_BOARD007
title: "Create Tasks in batches from Discussion outcomes and Chief plans, idempotently"
area: BOARD
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_BOARD001, OVE_BOARD006, OVE_CHIEF015, OVE_DATA002, OVE_DISC001, OVE_PERM008, OVE_PERM020]
soft_depends_on: []
provides: ["usecase:board.create-tasks-from-discussion", "usecase:board.create-tasks-from-plan"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "contract:Discussion", "contract:TaskDraft", "usecase:escalation.raise"]
owns: ["packages/application/src/board/create-from-source/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.4"]
adr_refs: [8, 11, 16]
---

# OVE_BOARD007: Create Tasks in batches from Discussion outcomes and Chief plans, idempotently

## 1. Summary

Provide the two batch use cases that turn a concluded Discussion outcome or a Chief plan into Board Tasks: all-or-nothing validation, per-item idempotency keys, provenance links back to the Discussion and Decision, and a result report. This is how SPEC 6 ("Discussion usually ends with Tasks") and SPEC 16 criteria 4 and 6 are met on the Board side.

## 2. Context

SPEC 6: a Discussion ends with a required outcome, usually Tasks; Chief splits Project Documentation into Tasks, puts them on the Board and assigns them. The Task carries `originDiscussionId` and provenance (which Decision it came from; mock detail `POCHODZENIE: Dyskusja „Zakres MVP” · Decyzja D-12`). In the Discussion mock, `ZADANIA PO ZATWIERDZENIU` lists drafts with their docRef (`Integracja Przelewy24 · spec.md#platnosci`) that become Tasks only after the Owner approves the outcome. Crash safety: the finalisation can be retried after an engine crash, so creating the same draft twice must be impossible.

## 3. Scope (in)

- `createTasksFromDiscussion({ discussionId, workspaceId, decisionId?, drafts[] }, actor)`.
- `createTasksFromPlan({ planId, workspaceId, drafts[], assigneeSuggestions? }, actor)` for Chief's decomposition of Project Documentation.
- Validation of all drafts before any write; partial-failure policy; result report.

## 4. Out of scope

- Single-task rules (docRef, lane, assignee): BOARD006, reused here.
- Producing drafts: DISC (outcome) and CHIEF (planning). Assigning Agents automatically ("Chief rozdziela, gdy zwolni się slot"): CHIEF/WFRT; here only optional `assigneeAgentId` per draft.
- Notifying the Owner that Tasks appeared: NOTIF subscribes to `task.created`.

## 5. Detailed requirements

1. **Draft shape** `TaskDraft` from `contract:TaskDraft` (OVE_BOARD001; `draftKey` is unique within the source, `docRef` required). Max 50 drafts per call (cap protects the Board and the Owner's attention).
2. **Authorisation:** `chief` or `owner` or `system` (the Discussion finalisation runs as `system` on behalf of the approved outcome). `agent` and `channel` actors are refused. For discussions, the use case verifies with `DiscussionReader` (via `contract:Discussion` read port from DISC) that the Discussion exists, belongs to `workspaceId`, and has outcome status `approved` or `chief_decided`; drafts that are not part of the stored outcome (compare `draftKey` and content hash) are rejected: a caller cannot mint Tasks "from a Discussion" that the Discussion did not produce (`board.provenance_invalid`).
3. **Two-phase:** phase 1 validates every draft (docRef verification via `DocRefVerifier`, lane, assignee, criteria) without writing; phase 2 inserts all in one `UnitOfWork`. Policy `all_or_nothing` is the default for discussions (the Owner approved a set); for plans a `partial` policy is allowed (`allowPartial: true`): valid drafts are created, invalid ones are returned with their error and one aggregated Escalation `task_without_documentation` is raised for the doc-gap ones.
4. **Idempotency.** `provenance.draftKey` plus source id form the unique key (`draft_source = 'discussion:<id>' | 'plan:<id>'`). A repeated call returns the existing Tasks (`duplicate: true`) and creates only the missing ones, so a crash mid-way followed by retry converges. Content mismatch for an existing key (same key, different title/docRef) returns `board.duplicate_draft` with `details.conflict: true` and creates nothing.
5. **Provenance.** Each Task gets `originDiscussionId`, `provenance = { origin: 'discussion'|'chief_plan', discussionId?, decisionId?, planId?, draftKey, createdBy: actor }`. The Decision id, if present, is validated to belong to the same Workspace (`DecisionReader` check by id only: existence + workspace match, via contract read port; if DEC is unavailable the use case proceeds without `decisionId` only when `decisionId` was not supplied).
6. **Ordering and defaults.** Tasks are inserted in draft order (so `seq` follows the order shown to the Owner); all land in the default `todo` lane unless a draft has a `laneKey`; all `queued`.
7. **Result** `{ created: TaskRef[], duplicates: TaskRef[], rejected: { draftKey, error: AppError }[], escalationId? }`. One `task.created` event per Task, plus the use case writes ONE timeline `note` entry per Task: `Created from Discussion "<title>" (D-12)` using safe templates (titles truncated, no raw text).
8. **Owner directive link (SPEC 16.11).** `createTasksFromPlan` accepts `origin: 'chief_plan'` with `directiveRef?: { messageId }` (an Owner command given directly to an Agent that Chief turned into a plan change); the id is recorded in `provenance.note` as a reference, enabling the audit trail "Owner told Tester -> plan updated -> Tasks changed".
9. **Rate limits.** At most 200 Tasks created per Workspace per hour via these batch paths (ASSUMPTION; protects against runaway Chief loops); exceeding returns `board.creation_rate_limited` [429, retryable], which is registered in OVE_BOARD001.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`createTask` internals from BOARD006 (shared `validateDraft` function exported there; do not re-implement docRef checks), `UnitOfWork`, outbox, `AuditLog`. Discussion and Decision reads only through contracts and read ports provided by DISC/DEC.

## 8. Architecture and code placement

`packages/application/src/board/create-from-source/{create-from-discussion.ts,create-from-plan.ts,batch-policy.ts,result.ts}`. Uses ports only. The Discussion/Decision read ports are minimal interfaces declared by this task in `packages/application/src/ports/DiscussionOutcomeReader.ts` and `DecisionExistenceReader.ts` (ISP) and implemented by adapters over DISC/DEC use cases.

## 9. Security and safety

The outcome of a Discussion is produced by Agents (untrusted) but approved by Owner/Chief within autonomy limits (ADR 0015); the batch use case therefore re-checks provenance against stored data instead of trusting the payload. An Agent cannot slip additional Tasks into an "approved" set (scope discipline, ADR 0016). Titles and descriptions are untrusted data; docRefs are verified; counts are capped and rate-limited (a prompt-injected Chief or Discussion must not flood the Board). Idempotency keys prevent duplicate side effects after crash or retry (SPEC 17 "duplicated side effects"). Audit event `board.tasks_created_batch` with counts and source ids.

## 10. Errors and edge cases

- Discussion not yet approved: `board.provenance_invalid` (details `reason: 'outcome_not_approved'`).
- 51 drafts: `validation.invalid_input`.
- Same `draftKey` twice inside one call: rejected before any write.
- Partial retry after crash where 2 of 5 exist: creates 3, returns 2 duplicates.
- A draft docRef that resolved at approval time but the file was removed later: `rejected` with `doc_ref_unresolvable` (all_or_nothing policy: nothing created, Escalation raised).
- Workspace deleted: not found.

## 11. Acceptance criteria

- [ ] A concluded, approved Discussion with 3 drafts creates exactly 3 Tasks in order with `originDiscussionId` set and provenance recorded.
- [ ] Calling it again (retry) creates nothing new and returns 3 duplicates.
- [ ] A draft not present in the stored outcome is rejected with `board.provenance_invalid`.
- [ ] An unapproved Discussion cannot produce Tasks.
- [ ] Plan path with `allowPartial` creates valid drafts and escalates the doc-gap ones.
- [ ] Agent and Telegram actors are refused; more than 50 drafts refused; hourly cap enforced.
- [ ] Crash injected after 2 inserts rolls everything back (one transaction) in all_or_nothing mode.

## 12. Test plan

- `create-from-discussion.test.ts`, `create-from-plan.test.ts`, `batch-policy.test.ts` using fakes, `FakeDocRefVerifier`, fake outcome reader; failure injection with fake `UnitOfWork`.
- Property test: any interleaving of repeated calls with the same drafts converges to the same set of Tasks.
- Commands: `pnpm vitest run packages/application/src/board/create-from-source`.

## 13. Parallelization notes

DISC012 (outcome finalisation) consumes `usecase:board.create-tasks-from-discussion`; CHIEF planning consumes `usecase:board.create-tasks-from-plan`. Parallel to BOARD008/009.

## 14. Open questions and assumptions

- ASSUMPTION: 200 Tasks per Workspace per hour cap for batch creation.
- Open: whether the Owner should see a confirmation list before Chief-created plan Tasks appear. Default: no (ADR 0016: Chief acts independently within Documentation); the Board is visible anyway.
