---
id: OVE_CHIEF007
title: Build progress summaries and the dashboard Chief summary strip
area: CHIEF
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT010, OVE_AGENT018, OVE_ARCH009, OVE_BOARD003, OVE_CHIEF001, OVE_CHIEF006, OVE_DATA010, OVE_DEC003, OVE_PERM014]
soft_depends_on: []
provides: ["usecase:GetChiefSummary", "usecase:AnswerStatusQuestion", "api:chief.summary", "service:ChiefSummaryProjector"]
needs: ["port:BoardReader", "port:RunReader", "usecase:GetAgentStates", "usecase:ListPendingApprovals", "port:WorkspaceRepository", "port:DecisionReader", "lib:route-module"]
owns: ["packages/application/src/chief/summary/**", "packages/gateway/src/routes/chief/chief-summary.route.ts", "packages/contracts/src/chief/api/summary.ts"]
reads: ["packages/contracts/src/chief/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 3", "SPECIFICATION 16.13"]
adr_refs: [16, 10, 6]
---

# OVE_CHIEF007: Build progress summaries and the dashboard Chief summary strip

## 1. Summary

Two read features from one projector: the status answer (a general question gets one sentence per Workspace, a detailed one only what was asked) and the dashboard "Chief summary" strip. Sentences come from facts and templates; desktop and Telegram show the same counts.

## 2. Context

Mock `Chief.png`: Owner (via Telegram) asks "Jak idą prace?" and Chief answers with one sentence per Workspace (loop iteration 2 of 5 and QA failures; 7 of 9 Tasks done; paused by you yesterday). SPEC 4 states the general/detailed rule. The Dashboard has a "Chief summary" strip. Isolated Workspaces are excluded from Chief's cross-Workspace view (ADR 0014).

## 3. Scope (in)

- `ChiefSummaryProjector` producing `ChiefSummary` (CHIEF001), cached and event-refreshed.
- `AnswerStatusQuestion({ scope: 'general'|'detailed', workspaceId?, topic? })` returning a structured `answer_status`.
- Route `GET /v1/chief/summary?workspaceId=`.
- Deterministic sentence templates (English keys, Polish via i18n) and an optional validated model polish.

## 4. Out of scope

- The dashboard strip UI: WSPACE tasks. Deciding that a message is a status question: Chief model in CHIEF006. Notification texts: NOTIF.

## 5. Detailed requirements

1. `general`: exactly one row per non-isolated Workspace (max 50; order: attention, working, then name), each sentence <= 200 characters. `detailed`: only the asked facet (`topic`: `tasks`, `tests`, `approvals`, `agents`, `decisions`, `blockers`, `cost`, `workflow`) for the named Workspace; other facts omitted.
2. Sentence assembly from storage facts in priority order: pending Approval or Access Request naming the Agent; open Escalation; failing Quality Gate with counts; loop iteration (`x of y`); Task progress (`done of total`); paused by the Owner with since-when; else "no blockers". At most two facts per sentence.
3. Optional polish by a Chief turn is accepted only if <= 200 characters, has no URL, every number appears in the facts and every name is in the fact set; otherwise the template sentence is used. Disabled by default in MVP.
4. Row state: `attention` (waiting for Owner), `working`, `paused`, `ok`, `idle`; colours and icons are UI concerns.
5. Isolated Workspaces are excluded from the cross-Workspace summary; passing an isolated `workspaceId` (Owner inside it) returns just that row.
6. Attention block: counts of pending Approvals, open Escalations, pending Proposals, waiting Discussions (feeds the Chief row in CHAT011 and the top bar item).
7. Cache in memory, invalidated by events (`run.*`, `task.*`, `approval.*`, `access_request.*`, `agent.state.changed` coalesced, `chief.*`, `pause.changed`, `discussion.*`); max staleness 30 s; `generatedAt` returned.
8. Parity: the Telegram "How is it going?" message is routed to Chief (CHAT003) and answered from `AnswerStatusQuestion`; the dashboard reads `GetChiefSummary`; both use the same projector (parity test, criterion 13).
9. Owner-only route; <= 50 rows; names only, no paths.
10. A quiet Workspace gets the template "Nothing is running.", never an empty sentence.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`GetAgentStates` (AGENT010), `ListPendingApprovals` (PERM), board and run readers; `ChiefSummary` contract; i18n templates (ARCH011/015).

## 8. Architecture and code placement

`packages/application/src/chief/summary/{projector.ts,sentences.ts,answer-status.usecase.ts,get-summary.usecase.ts,validate-polish.ts}`; route `packages/gateway/src/routes/chief/chief-summary.route.ts`; schemas `packages/contracts/src/chief/api/summary.ts`.

## 9. Security and safety

Facts come only from storage; polished text is validated against the fact set so a hostile Task title cannot smuggle instructions or links; Agent-authored titles are excluded or shown quoted with length caps. Isolated Workspaces never appear in cross-Workspace output. Telegram output carries names, not paths.

## 10. Errors and edge cases

- More than 50 Workspaces: truncated with an "and N more" row.
- Board reader fails: that row says "Status unavailable", others still appear.
- Zero Workspaces: "No Workspaces yet".
- Unknown Workspace in a detailed question: `data.not_found` rendered as a Chief reply.
- Polish validation fails: template sentence used silently (logged).

## 11. Acceptance criteria

- [ ] General question returns one sentence row per non-isolated Workspace (fixture of three, one isolated).
- [ ] Detailed "tests" question returns only test facts.
- [ ] The mock scenario yields the expected template sentences.
- [ ] Hostile Task title never appears raw in sentences.
- [ ] Polish validation rejects an unknown number or a URL.
- [ ] Desktop summary and Telegram answer agree on counts.

## 12. Test plan

Unit tests with fact fixtures; polish validation tests; parity test; cache invalidation test with fake clock. Command: `pnpm vitest run packages/application/src/chief/summary packages/gateway/src/routes/chief`.

## 13. Parallelization notes

After the CHIEF006 dispatcher contract. Dashboard UI tasks need the route schema (merge `api/summary.ts` first). Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: template-first sentences; model polish optional and off in MVP.
- ASSUMPTION: max staleness 30 s with event-driven invalidation.
