---
id: OVE_WFRT006
title: Define WorkflowRun, NodeExecution, token and status contracts
area: WFRT
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH008, OVE_WFRT003]
soft_depends_on: [OVE_WFRT001]
provides: ["contract:WorkflowRun", "contract:NodeExecution", "contract:Token", "contract:RunStatus", "contract:NodeExecutionStatus", "contract:RunTrace"]
needs: ["contract:EntityId", "lib:contract-pipeline"]
owns: ["packages/contracts/src/workflow-run/**", "packages/contracts/src/node-execution/**", "packages/contracts/src/errors/wfrt-run.errors.ts", "packages/contracts/src/kernel/id-prefixes/wfrt.ts"]
reads: ["packages/contracts/src/workflow/definition/definition.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 14", "SPECIFICATION 15", "SPECIFICATION 16.7"]
adr_refs: [2, 5, 19]
---

# OVE_WFRT006: Define WorkflowRun, NodeExecution, token and status contracts

## 1. Summary

The read-side contracts of a Run: `WorkflowRun`, `NodeExecution`, `Token`, status enums, `RunSummary` for lists, and `RunTrace` for the UI. They describe projections of the event stream (WFRT030, WFRT032), not mutable rows that code updates directly.

## 2. Context

SPEC 14: `WorkflowRun / NodeExecution: id, versionId, status, attempt, checkpointRef`. SPEC 7 fixes the node statuses. The mock shows "Run #14 · działa · 18 min", per-Agent state chips, node glow states (working, waiting for Approval, done), "iteracja 2 z 5". Run numbers (#14) are per Workflow.

## 3. Scope (in)

zod contracts and types, id prefixes `act`, `esc`, `chk`, error codes for run operations.

## 4. Out of scope

Events (WFRT007 to WFRT009), transition tables (WFRT030), persistence (WFRT032), routes (WFRT048), UI.

## 5. Detailed requirements

1. `RunStatus`: `created|running|paused|escalated|cancelling|succeeded|failed|cancelled`. `NodeExecutionStatus`: `pending|ready|running|waiting|succeeded|failed|skipped|cancelled`. Helpers `isTerminalRun`, `isTerminalNode`.
2. `WorkflowRun`: `id: run_`, `number: int` (per Workflow, gapless), `workflowId`, `workflowVersionId: wfv_` (pinned), `workspaceId`, `status`, `mode: 'live'|'dry_run'`, `input: JsonValue` (validated against the version's `inputSchema`, max 256 KiB; stored as an Artifact ref when larger: `inputRef?`), `output?`, `startedBy: {kind:'owner'|'chief'|'trigger', channel?: 'desktop'|'telegram'}`, `pauseReasons: PauseReason[]` where `PauseReason = {kind:'owner'|'global_pause'|'chief_discussion'|'escalation', since, ref?}`, `createdAt`, `startedAt?`, `endedAt?`, `elapsedMs` (sum of running time, excludes paused time), `lastEventSeq`, `lastCheckpointRef?: chk_`, `budget: { limits, used: { costTokens, costUsd?, iterations, events } }`, `outcome?: 'success'|'failure'|'escalated'|'cancelled'` and `failure?: { code, nodeKey?, message }` (safe message).
3. `NodeExecution`: `id: nex_`, `runId`, `nodeKey`, `scope: string` (`''` or `quality-loop:2`), `executionKey` (`<nodeKey>@<scope>` or `<nodeKey>` for empty scope), `nodeType`, `status`, `attempt: int >= 1`, `readyAt?`, `startedAt?`, `endedAt?`, `waitingFor?: { kind: 'timer'|'tokens'|'external'|'approval'|'pause'|'slot', ref?, dueAt? }`, `blockedBy?: 'global_pause'|'owner_pause'|'chief_discussion'`, `inputRefs`, `outputRef?` (output is stored in the event or as Artifact ref when > 16 KiB), `error?: { code, retryable, safeMessage }`, `agentId?`, `pinned?: { agentVersion, skills: [{skillId, version}], providerId, modelId }` (SPEC 15 replay), `effectiveBranch?: string`.
4. `Token`: `{ id, edgeId, from: PortRef, to: PortRef, scope, payload: JsonValue | {ref: ArtifactId}, trust: 'trusted'|'untrusted', emittedAt, consumed: boolean }`.
5. `RunSummary` (lists): number, workflow name and version number, status, elapsed, current node labels, counts by NodeExecution status. `RunTrace`: ordered list of `TraceEntry` (`seq`, `at`, `kind`, `nodeKey?`, `scope?`, `summaryKey` (i18n key), `params`, `severity`) — a presentation-neutral rendition built by WFRT045; the UI never parses raw events.
6. Error codes (`wfrt-run.errors.ts`): `wfrt.run_not_found (404)`, `wfrt.run_not_active (409)`, `wfrt.run_already_terminal (409)`, `wfrt.run_input_invalid (422, details violations<=20 paths)`, `wfrt.version_not_published (409)`, `wfrt.run_paused (423)`, `wfrt.escalation_not_found (404)`, `wfrt.action_not_ambiguous (409)`.
7. Id prefixes file `kernel/id-prefixes/wfrt.ts`: `act` Action, `esc` Escalation, `chk` Checkpoint (registry test from ARCH007 must pass).
8. All schemas strict; every free-text field bounded; `safeMessage` fields never contain raw CLI output.

## 6. Design notes

N/A, functionality only. State names map to UI chips defined in DS tasks (for example `waiting` + `waitingFor.kind='approval'` is the amber "czeka na Zgodę" glow).

## 7. Reuse

`entityId`, `IsoDateTime`, `JsonValue` (ARCH007/ARCH008), `PortRef` (WFRT003).

## 8. Architecture and code placement

One file per contract in `packages/contracts/src/workflow-run/` and `node-execution/`. No logic besides type guards.

## 9. Security and safety

Contracts carry no secrets; `input`/payload sizes are bounded; `trust` on tokens makes untrusted provenance explicit to every consumer; `error.safeMessage` is built by WFRT code from codes, not from model text. `pinned` records versions only, not prompts.

## 10. Errors and edge cases

`scope` grammar `^([a-z][a-z0-9-]*:\d+)(/[a-z][a-z0-9-]*:\d+)*$` or empty; nesting beyond 3 rejected. `attempt` 0 rejected. A terminal status with missing `endedAt` is rejected by superRefine.

## 11. Acceptance criteria

- [ ] All statuses match SPEC 7 exactly.
- [ ] Round-trip tests for each contract; superRefine invariants enforced.
- [ ] Contract snapshot additive-only passes; new id prefixes registered.
- [ ] `RunTrace` and `RunSummary` have OpenAPI/JSON Schema output.

## 12. Test plan

`run.contract.test.ts`, `node-execution.contract.test.ts` with builders (`RunBuilder`, `NodeExecutionBuilder` added to `packages/testing` by WFRT049). Command `pnpm vitest run packages/contracts/src/workflow-run packages/contracts/src/node-execution`.

## 13. Parallelization notes

Parallel with WFRT002. Events (WFRT007 to WFRT009) and WFRT030 depend on it. Hotspot: id-prefix file is owned here, other areas have their own.

## 14. Open questions and assumptions

- ASSUMPTION: Run `number` is assigned at creation (`run.created` event) from a per-Workflow counter in the repository.
- ASSUMPTION: outputs above 16 KiB are stored as Artifacts to keep the event log small.
