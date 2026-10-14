---
id: OVE_AGENT014
title: Ingest Agent reports (progress, completion, decisions, access requests) as declarations
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT010, OVE_AGENT013, OVE_AGENT018, OVE_DATA018, OVE_PERM016, OVE_SEC004]
soft_depends_on: [OVE_AGENT012]
provides: ["usecase:ReportProgress", "usecase:ReportCompletion", "usecase:ReportAccessRequest", "usecase:ReportDecision", "contract:AgentReport", "event:agent.report.received"]
needs: ["usecase:CreateAccessRequest", "usecase:RecordDecisionProposal", "lib:prompt-assembly", "port:ArtifactRepository", "port:RunReader"]
owns: ["packages/application/src/agent/report/**", "packages/contracts/src/agent/report.ts", "packages/contracts/src/events/agent.report.received.event.ts", "packages/contracts/src/errors/agent-report.errors.ts"]
reads: ["packages/application/src/agent/scope/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 5", "SPECIFICATION 16.10"]
adr_refs: [27, 3, 26]
---

# OVE_AGENT014: Ingest Agent reports (progress, completion, decisions, access requests) as declarations

## 1. Summary

The server side of the "overmind" Skill protocol: validate and record an Agent's structured reports about progress and completion, forward access requests and Decision proposals to their owners (PERM, DEC), and surface everything to Chief. A report is a declaration, never evidence and never a permission.

## 2. Context

ADR 0027: "Raport Agenta to deklaracja, nie dowód"; the API available to the Skill cannot widen permissions. SPEC 9: a Task moves on only after verifying the effect or a Skill report. Prototype: structured reports are instant and unambiguous, better than reading the screen; the herdr resume command must be a program name, so adapters check replies to reports. This task is the use-case layer; routes are in `OVE_AGENT015`.

## 3. Scope (in)

- Contract `AgentReport` (discriminated by `kind`): `started`, `progress`, `done`, `blocked`, `failed`, `access_request`, `decision`, `command_ack`, `hello`.
- Use cases: `ReportProgress`, `ReportCompletion`, `ReportAccessRequest`, `ReportDecision`, `AcknowledgeCommand`, `RecordHello`.
- Event `agent.report.received` and error codes.

## 4. Out of scope

- Quality Gate evidence checks: WFRT. Creating AccessRequests and their approval: PERM. Decision Register storage: DEC. HTTP routes: `OVE_AGENT015`.

## 5. Detailed requirements

1. Report shapes (strict zod; all strings bounded; `schemaVersion: 1`):
   - `started { taskId?, summary<=200 }`; `progress { taskId?, percent?: 0..100, summary<=400, step?: string<=80 }`.
   - `done { taskId, summary<=1000, artifacts?: Array<{ path: string (relative to /work), kind: 'file'|'report'|'diff'; sha256?: string }> (max 50), claims?: Array<{ name: string<=60, value: 'pass'|'fail'|'n/a' }> (max 20) }`. `claims` such as "tests passed" are stored as declarations tagged `declared: true`.
   - `blocked { reason: 'needs_info'|'waiting_for_agent'|'waiting_for_owner'|'other', summary<=400 }`; `failed { taskId?, summary<=800, retryable?: boolean }`.
   - `access_request { path: string<=1024, access: 'read'|'write'|'execute', reason<=400 }` (no scope field: scope is decided by the Owner, only Owner decides permanence, SPEC 11).
   - `decision { title<=120, problem<=600, alternatives: Array<{ title<=80, pros?, cons? }> (2..6), selectedOption?: string, rationale<=800, evidenceRefs?: string[] (artifact ids) }`.
   - `command_ack { messageId: EntityId<'msg'>, accepted: boolean, note?<=300 }` (the Agent confirms it saw an Owner direct command, `OVE_CHAT010`).
   - `hello { skillVersion: string, cliKind: 'claude'|'codex'|'other', cwd: string }` used by the installer verification (`OVE_SKILL013`).
2. Each use case takes an `AgentCallContext` (`OVE_AGENT013`); no ids of Run, Workspace or Agent in the payload.
3. Storage: the report is appended to the Run event log as `agent.report.received` with a bounded payload (summary and references; long text goes to an Artifact). It also produces the `AgentSignal` consumed by `OVE_AGENT010` (`overmind_report`).
4. `ReportCompletion` does NOT mark the Task done. It emits `agent.report.received(kind: done)` and sets the Task "agent-declared complete" (BOARD field through an application port `TaskDeclarationWriter`, name only). The workflow runtime treats it as input for the Quality Gate; claims are never evidence (SR-19, SR-24). Declared artifact paths are canonicalised and verified to be inside `/work` (SEC002) before being stored as Artifact candidates; invalid paths are dropped with a warning in the response.
5. `ReportAccessRequest` calls `CreateAccessRequest({ agentId, runId, workspaceId, path, access, reason })` (PERM). The response is `{ accessRequestId, status: 'pending' }`. The agent is expected to pause; Overmind sets the Agent State to `waiting_approval` through the pending request signal. The use case never grants anything and never returns a grant that the Agent could treat as permission.
6. `ReportDecision` creates a Decision with `status: 'proposed'` and `participants: [agentId]` through DEC (`RecordDecisionProposal`); acceptance follows DEC/CHIEF rules (`OVE_CHIEF012`). The Agent cannot mark it `accepted`.
7. Idempotency: each report has a `reportId` (client ULID); a repeat returns the stored result.
8. Text fields are redacted for secrets before storage; each report passes `sanitize` (SEC004) for control and bidi characters; `findings` are logged.
9. Reports from an Agent whose Run is paused are refused with `pause.active`; read-only `hello` is allowed.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`AgentCallContext` guard, `sanitize` and redaction (SEC004, ARCH004), `CreateAccessRequest` (PERM), Decision port (DEC), `ArtifactStore` (DATA), path guard (SEC002).

## 8. Architecture and code placement

`packages/application/src/agent/report/{report-progress,report-completion,report-access-request,report-decision,ack-command,record-hello}.usecase.ts`, contract `packages/contracts/src/agent/report.ts`. Module `agent-report.module.ts`.

## 9. Security and safety

Reports come from a possibly compromised model. Therefore: schemas are strict with bounded sizes, no free-form fields that reach commands, paths verified against `/work`, claims labelled as declarations, access requests carry no scope, decisions are proposals only, and nothing here calls a permission mutator except `CreateAccessRequest` (which only creates a request). Content is sanitised and redacted. Floods are rate limited by the guard.

## 10. Errors and edge cases

- `done` for a Task not assigned to this Agent: `agent.report_task_mismatch` (403, audited).
- Unknown `kind`: `validation.invalid_input`.
- Artifact path outside `/work` or via symlink: dropped, `agent.report_path_rejected` warning in response.
- `access_request` for a path already allowed: returns `status: 'already_allowed'` without creating a request.
- Report after the Run finished: guard rejects.
- Oversized payload: 413.

## 11. Acceptance criteria

- [ ] Every report kind validates and invalid shapes are rejected.
- [ ] `done` does not change Task status to finished; it records a declaration and signals the Quality Gate.
- [ ] `access_request` creates a pending AccessRequest and returns no grant.
- [ ] A decision report creates only a `proposed` Decision.
- [ ] Artifact path `/etc/passwd` or `../x` is rejected.
- [ ] Repeated `reportId` returns the stored result with no duplicate event.
- [ ] Injection corpus strings in `summary` are stored as data and never interpreted (deterministic test, SEC004 corpus).

## 12. Test plan

Unit tests per use case; contract tests for schemas; scenario test with `fake-claude` `report-protocol` (TEST006) against the in-process gateway; injection corpus matrix over text fields. Command: `pnpm vitest run packages/application/src/agent/report`.

## 13. Parallelization notes

After AGENT013. AGENT015 (routes) and SKILL011/012 (Skill text and helper) code against the `AgentReport` schema; merge `report.ts` first. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: `percent` is optional and informational only.
- ASSUMPTION: `blocked` from an Agent is a hint the Agent State derivation may display (reason) but never overrides evidence-based states.
- Cross-area: needs `usecase:RecordDecisionProposal` (DEC) and `usecase:CreateAccessRequest` (PERM); names assumed.
