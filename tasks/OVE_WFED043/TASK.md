---
id: OVE_WFED043
title: "Assign a dropped Skill to the Agent: versioned PATCH, optimistic count, undo toast"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_ARCH011, OVE_DS037, OVE_WFED018, OVE_WFED023, OVE_WFED024, OVE_WFED040, OVE_WFED041]
soft_depends_on: []
provides: ["lib:editor-skill-assignment", "lib:editor-skill-assignment-gateway"]
needs: ["api:agents.update", "api:agents.get", "lib:api-client-agents", "lib:editor-agent-directory", "lib:editor-skill-rules", "lib:editor-skills-data", "lib:editor-announcer", "ui:useToast", "lib:editor-gateway", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/skills/skill-assignment-service.ts", "apps/desktop/src/features/workflow-editor/skills/useSkillAssignment.ts", "apps/desktop/src/features/workflow-editor/skills/pending-assignments.ts", "apps/desktop/src/features/workflow-editor/gateway/agent-skills.ts", "apps/desktop/src/features/workflow-editor/skills/skill-assignment-service.test.ts", "apps/desktop/src/features/workflow-editor/skills/useSkillAssignment.test.tsx", "apps/desktop/src/locales/en/wfc-skillassign.json", "apps/desktop/src/locales/pl/wfc-skillassign.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED043: Assign a dropped Skill to the Agent: versioned PATCH, optimistic count, undo toast

## 1. Summary

Performs the actual Skill assignment when a drop or a menu choice is accepted: it re-checks the rules against fresh data, writes the Skill into the Agent configuration with an optimistic-concurrency PATCH (creating a new Agent version), shows the new count on the tile at once, serialises writes per Agent, handles version conflicts and offers an undo in the toast. It is deliberately NOT part of the draft history.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. Skill assignment belongs to the Agent: `Agent.config.skills[]` (`{ skillId, pinnedVersion? }`, max 32, unique) is written through `PATCH /v1/agents/{id}` with body `{ expectedVersion, patch, changeNote? }` (AGENT005); the response is the new Agent version or `{ unchanged: true }` for a no-op; the api-client does not retry PATCH (non-idempotent). Assignments are permanent across Workflows (ADR 0012, SPEC 8) and the Agent version is immutable history, so a drop changes the Agent for every Workflow that uses it from the next Run (running Runs keep the version they started with). The editor draft is not touched: `Cmd+Z` does not undo an assignment, and the toast says so by offering its own undo.

## 3. Scope (in)

- `SkillAssignmentService.assign(request)` and `.remove(request)` (for the undo).
- `gateway/agent-skills.ts` adapter (the PATCH call and error mapping).
- Per-Agent serial queue and the pending store used for the optimistic count.
- Conflict handling, error mapping, toasts and announcements.

## 4. Out of scope

- Drop UI and menus (WFED042), rules (WFED041), Agent profile editing and its draft (AGUI009 on the Agents page).
- Changing node overrides (`Node.skills add/remove`) which is an Inspector feature of PART 2.
- Visibility changes of Skills or Agents.

## 5. Detailed requirements

1. ```ts
interface AssignRequest { agentId: string; skillId: string; sourceNodeKey: NodeKey; workflowName?: string }
type AssignOutcome = { status: "assigned"; agentVersion: number; scope: "all" | { workspaceId: string } } | { status: "unchanged" } | { status: "refused"; reason: DropReason } | { status: "failed"; error: AgentSkillsError; retryable: boolean }
interface SkillAssignmentService { assign(r: AssignRequest): Promise<AssignOutcome>; remove(r: AssignRequest): Promise<AssignOutcome>; pending: PendingAssignments }
interface AgentSkillsGateway { addSkill(agentId: string, skill: { skillId: string }, expectedVersion: number, changeNote: string, signal?: AbortSignal): Promise<Result<{ version: number } | { unchanged: true }, AgentSkillsError>>; removeSkill(...same shape...) }
```
2. `assign` steps: (1) enqueue on the per-Agent queue (a `Map<agentId, Promise>` chain; at most one PATCH per Agent in flight, different Agents run in parallel); (2) mark `pending.add(agentId, skillId)` (the rules of other drops on the same Agent count it as in flight) and call `directory.applyLocalPatch(agentId, { addSkillId: skillId })` (WFED023) so the tile count shows `n + 1` immediately; the returned revert function is kept with the pending entry; (3) when this entry reaches the head of the queue, fetch fresh Agent detail (`directory.refresh(agentId)` then `lookup(agentId, { withoutLocalPatches: true })`) so `expectedVersion` is the CURRENT server version and the skill list is the server list; (4) re-run `evaluateSkillDrop` with that server data and `pendingSkillIds` = the OTHER pending ids of this Agent (never this request own id, otherwise it would refuse itself): a refusal reverts the optimistic patch and returns `refused` without any request; (5) send the PATCH with `patch: { config: { skills: [...current, { skillId }] } }` (append, never replace unknown fields: the adapter builds the full `skills` array from the fresh detail and sends only that field), `changeNote` = `Dodano Skill {skillName} z edytora Workflow {workflowName}` (clamped to 200 chars); (6) on success `directory.refresh(agentId)`, clear pending, announce and toast.
3. Conflict: error `agent.version_conflict` (409) means another editor, Chief or the Agents page saved the Agent meanwhile: refetch once and retry once with the new version if the Skill is still not assigned and rules still pass; a second conflict returns `failed` with `retryable: true` and the toast offers `Spróbuj ponownie`. If the refetch shows the Skill is now assigned the outcome is `unchanged` (success, quiet toast `Skill już przypisany`).
4. Other errors (`AgentSkillsError`): `forbidden_actor` and `vis.no_common_workspace` (engine refused: toast with the rule text, never retried), `skill_not_found`/`agent_not_found`/`agent_archived` (refresh the directory and skills list, refused toast), `limit_exceeded` (limit text), `validation` (generic), `network`/`timeout`/`server` (retryable, toast with retry that re-enters `assign`), `aborted`. Every failure rolls back the pending count (no stuck optimistic state; a 10 s safety timer clears pending after a network timeout).
5. Success toast (`ui:useToast`, variant `success`, 8 s): `Dodano {skill} do Agenta {agent}` + second line `Skill działa teraz we wszystkich Workflow tego Agenta` (the permanence rule must be visible) + for `scope: { workspaceId }` on a public Agent the extra line `Skill prywatny zadziała tylko w tym Workspace`. The toast action `Cofnij` calls `remove` (a second PATCH removing the Skill, with `changeNote` `Cofnięto dodanie Skilla {skill}`; it creates another Agent version because versions are immutable) and is available until the toast closes; if the Agent version moved on meanwhile, `remove` still removes only that Skill from the CURRENT list (never restores an old list).
6. The history rule: assignments are not commands, are not in the document history and do not mark the draft dirty; `Cmd+Z` after a drop undoes the previous DOCUMENT change (documented in `docs/frontend/workflow-editor.md`). The announcer says `Dodano Skill {skill} do Agenta {agent}`.
7. Request hygiene: bodies contain ids only; the adapter validates `agentId` and `skillId` shapes (`agt_`/`skl_` ULIDs) before building the URL and rejects anything else; `AbortSignal` is cancelled when the editor unmounts (a pending assignment is not cancelled server-side once sent: after unmount the result is applied to the directory cache only).
8. Audit and idempotency: the engine records the Agent version (AGENT005); this task adds no client audit. A repeated drop of the same Skill is stopped by the rules (`already_assigned`) and, if it still reaches the server, the no-op PATCH returns `{ unchanged: true }`.
9. Strings (`wfc-skillassign`): `toast.added`, `toast.permanent`, `toast.workspaceOnly`, `toast.undo`, `toast.removed`, `toast.unchanged`, `toast.failed.<code>`, `toast.retry`, `changeNote.add`, `changeNote.remove`, `announce.added`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:api-client-agents` (AGENT005 typed `updateAgent`) only inside `gateway/agent-skills.ts`; `evaluateSkillDrop` (WFED041); the Agent directory and its `refresh` (WFED023); `ui:useToast`; announcer (WFED024).

## 8. Architecture and code placement

Layer: `skill-assignment-service.ts` and `pending-assignments.ts` are framework-free (queue, retry policy, outcome mapping) with an injected gateway and directory; `useSkillAssignment` is the React binding; `gateway/agent-skills.ts` is the adapter (WFED001 layering).

## 9. Security and safety

The assignment is a privileged change of an Agent (it widens what the Agent can do at the next Run). It is therefore authorised only on the Owner channel (the same authenticated desktop session as every other UI call), never from payload data, and the engine re-checks visibility (ADR 0028) and the limit; the client rules only improve the message. `expectedVersion` prevents blind overwrites of a concurrent edit. The Skill is added by id (the pinned version is left unset so the Agent follows the accepted version of the Skill, SKILL001); Skill review status is enforced by the engine (a Skill version still pending review is not run). No Skill content is read here. Names in toasts are untrusted text rendered as text. Failures never show raw server messages.

## 10. Errors and edge cases

- Agent changed by Chief between the fetch and the PATCH: conflict, one retry.
- Network drops after the server applied the PATCH: the retry sees the Skill already assigned and reports `unchanged`.
- Two drops on one Agent in quick succession: serialised, the second sees the first version.
- Agent archived: refused, directory refreshed, tile shows the archived tab.
- Editor unmounted mid-request: result applied to the directory cache, no toast.
- Drop in `view` mode: identical behaviour (the Agent is not part of the version).
- Undo after another assignment: removes only that Skill from the current list.
- Skill list changed visibility to private-of-other-Workspace mid-way: engine refuses, toast explains.

## 11. Acceptance criteria

- [ ] Given an Agent with 2 Skills at version 4, When a valid Skill is assigned, Then exactly one PATCH is sent with `expectedVersion: 4` and a `skills` array of 3, and the tile count reads 3 before the response arrives.
- [ ] Given a 409 conflict once, Then the service refetches and succeeds with the new version; given two conflicts, Then `failed` retryable with a toast action.
- [ ] Given the Skill is already present after the refetch, Then no PATCH is sent and the outcome is `unchanged`.
- [ ] Given a network error, Then the pending count is rolled back and the toast offers a retry.
- [ ] Given two assignments to the same Agent started together, Then the PATCHes are sent one after the other (queue test).
- [ ] Given Undo in the toast, Then a PATCH removes only that Skill.
- [ ] Given a public Agent and a private Skill, Then the toast includes the workspace-only line.
- [ ] Given `Cmd+Z` after an assignment, Then the document history is unaffected.

## 12. Test plan

Unit tests of the service with a fake gateway and fake directory and a fake clock (queue ordering, conflict retry, rollback, safety timer, undo), adapter tests against the AGENT005 contract fixtures (request shape: only `config.skills`), hook tests, Playwright in WFED047 (drop then assert tile count and toast). Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/skills/skill-assignment src/features/workflow-editor/gateway/agent-skills`.

## 13. Parallelization notes

Parallel with WFED042 (interface injected). Conflict hotspot: `gateway/agent-skills.ts` is owned here; the Agent directory adapter `gateway/agents.ts` belongs to WFED023.

## 14. Open questions and assumptions

- GAP: no endpoint adds or removes a single Skill; the write replaces `config.skills` through the generic `PATCH` (read-modify-write guarded by `expectedVersion`). A dedicated `POST /agents/{id}/skills` would make this cleaner; proposal to AGENT005.
- ASSUMPTION: every assignment creates a new Agent version (AGENT005 immutable versions). If the Owner prefers batching drops into one version, the draft model of the Agents page (AGUI005) would have to be shared, which is out of scope.
- ASSUMPTION: running Runs keep the Agent version they started with (ENGINE); the toast text says "od następnego Runu" only if the Owner confirms.
- OPEN (Owner): should a drop on a PUBLISHED Workflow that has an active Run be allowed? The mock shows the drop target on exactly that view; this task allows it.
