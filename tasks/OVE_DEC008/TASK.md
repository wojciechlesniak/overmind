---
id: OVE_DEC008
title: "Implement Chief cross-Workspace Decision search with isolation boundaries"
area: DEC
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DATA010, OVE_DEC007, OVE_MEM002, OVE_PERM008, OVE_PERM020]
soft_depends_on: []
provides: ["usecase:decision.search-for-chief", "lib:decision-search-context"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "lib:memory-scope-policy", "port:WorkspaceRepository"]
owns: ["packages/application/src/decision/search/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 14, 28]
---

# OVE_DEC008: Implement Chief cross-Workspace Decision search with isolation boundaries

## 1. Summary

Let Chief search Decisions across all Workspaces that are not isolated (plus the Workspace it is currently working in), while an isolated Workspace shares nothing outward and agents only see their own Workspace. The boundary is built from a typed authorised set so it cannot be skipped.

## 2. Context

SPEC 10: Chief automatically searches Decisions of all Workspaces; an isolated Workspace (option, default off) shares nothing outside and everything created in it is private. ADR 0008/0014: only Chief reaches other Workspaces' Decisions, except isolated ones. ADR 0028: visibility (public/private) concerns Agents/Skills/Workflows and does not change memory boundaries. Glossary: Memory Scope (conversation, Agent, Team, Workspace, whole installation); cross-Workspace search is the `installation` scope.

## 3. Scope (in)

- `searchForChief(ctx, query)` and the context builder that maps (actor, current Workspace) to an `AuthorisedWorkspaceSet` via the scope policy (MEM002).
- Audit of cross-Workspace reads, result shaping (summaries only), rate limits.

## 4. Out of scope

- The scope policy library: OVE_MEM002. Similar-Decision finder: OVE_DEC009. Chief behaviour: CHIEF.

## 5. Detailed requirements

1. **Caller contexts:** `actor.kind = 'chief'` working in `currentWorkspaceId` -> authorised set = all non-isolated Workspaces + `currentWorkspaceId` (even if isolated: Chief inside an isolated Workspace sees that Workspace's own Decisions plus others' non-isolated ones, ASSUMPTION: inbound knowledge into an isolated Workspace is allowed, only outward sharing is forbidden); `agent` -> only its current Workspace (never cross-Workspace: `dec.search_scope_denied` if requested); `owner` -> all Workspaces (UI use, DEC011); `system` jobs -> only what the job's declared scope says (DEC010: per-Workspace). Telegram `channel` acts via Chief or Owner contexts, never directly.
2. **API:** `searchForChief(input: { query: DecisionQuery, currentWorkspaceId, purpose: 'new_project_lookup'|'similar_problem'|'evidence_review'|'other' }, actor): Result<{ results: DecisionSummary[], searchedWorkspaces: int, excludedIsolated: never }>`. The result MUST NOT disclose how many isolated Workspaces or results were withheld (no `hiddenCount`; type `never` documents it).
3. **Output shaping for Chief:** summaries only (id, seq, title, status, outcome, workspaceName, selected option, short rationale <= 400 chars, evidence count); full details through `get` with the same set. Text returned to Chief is data and goes into prompts through the SEC004 assembler (callers' duty, documented).
4. **Audit:** every call with more than the current Workspace in the set writes `decision.cross_workspace_search` (actor, purpose, number of Workspaces searched, query hash not the text), so the Owner can see how Chief used other projects' knowledge.
5. **Rate limit:** 60 searches/hour per Run (ASSUMPTION).
6. **Visibility change handling:** if the Owner turns a Workspace to isolated, the next search excludes it immediately (the set is computed per call from `WorkspaceRepository`, no caching beyond 5 s); existing Decisions already quoted elsewhere stay (Chief answers in earlier prompts cannot be recalled; documented limitation).
7. **No inference leak:** result ranking uses only authorised rows (scores computed inside the authorised set so absence of an isolated match cannot influence ranking); response timing is not equalised (documented limitation).
8. **Isolation default:** `isolated` flag read from `Workspace.isolated` (DATA); missing/unknown flag value -> treated as isolated (fail closed).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`lib:memory-scope-policy` (OVE_MEM002) is the single place computing authorised sets; this task only calls it with a Decision-specific context. `DecisionReadModel.list` from DEC007.

## 8. Architecture and code placement

`packages/application/src/decision/search/{search-for-chief.ts,search-context.ts,shaping.ts}`. Depends on the policy library and read model.

## 9. Security and safety

This is the privacy boundary for NDA-style projects. Controls: authorised set is typed and required by the read ports; unknown isolation state fails closed; agents cannot widen scope; no hidden-count leak; audit of every cross-Workspace read; the set is computed per call so toggling isolation takes effect immediately; result content is summaries to limit exposure; Chief is not trusted to filter (code filters). Prompt injection could try to make Chief query other Workspaces for exfiltration: the audit trail, rate limit and the fact that Chief's outputs to other Workspaces' Agents are only through prompts built by the assembler limit damage; isolated Workspaces remain unreachable regardless.

## 10. Errors and edge cases

- Chief working in no Workspace (global chat): set = all non-isolated Workspaces.
- Workspace deleted during search: excluded.
- Query hits only isolated Workspace Decisions: returns an empty result indistinguishable from no matches.
- `purpose` unknown value: rejected.

## 11. Acceptance criteria

- [ ] Chief in Workspace A (public) finds Decisions of Workspace B (public) and A, never of isolated C.
- [ ] Chief inside isolated C finds C's own Decisions and public ones.
- [ ] Agent cross-Workspace request is denied and audited; Agent in A cannot see B.
- [ ] No response field reveals the existence or count of hidden results.
- [ ] Isolation toggled -> excluded on the next call.
- [ ] Unknown isolation flag -> excluded (fail closed).
- [ ] Cross-Workspace searches audited without raw query text.

## 12. Test plan

- `search-for-chief.test.ts` (privacy matrix: actor x Workspace isolation x current Workspace), `search-context.test.ts`, `shaping.test.ts`; boundary tests reused by OVE_DEC012. Commands: `pnpm vitest run packages/application/src/decision/search`.

## 13. Parallelization notes

Needs OVE_MEM002 (capability). Parallel with DEC009.

## 14. Open questions and assumptions

- ASSUMPTION: Chief inside an isolated Workspace may use other Workspaces' non-isolated Decisions as input.
- Open: does the Owner want an indicator in the UI when Chief used knowledge from another Workspace? Default: audit entry only.
