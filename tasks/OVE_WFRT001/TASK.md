---
id: OVE_WFRT001
title: Write the workflow-runtime architecture document with shared vocabulary and limits
area: WFRT
kind: docs
size: S
priority: P0
mvp: true
status: todo
depends_on: []
soft_depends_on: []
provides: ["doc:workflow-runtime"]
needs: []
owns: ["docs/architecture/workflow-runtime.md"]
reads: ["docs/architecture/ARCHITECTURE.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 12", "SPECIFICATION 15", "SPECIFICATION 16.5", "SPECIFICATION 16.7", "SPECIFICATION 16.14"]
adr_refs: [2, 5, 7, 15, 19, 28]
---

# OVE_WFRT001: Write the workflow-runtime architecture document with shared vocabulary and limits

## 1. Summary

Write `docs/architecture/workflow-runtime.md`, the single reference for all WFRT tasks: package map, vocabulary (token, scope, execution key, intent, action), the decide/evolve event-sourcing model, the list of consumer-side ports and which area implements each, the default limits table and the determinism rules. Every other WFRT task links to a section of this document instead of repeating it (DRY).

## 2. Context

ADR 0002 (Workflow is an executable program, Versions pinned to Runs), ADR 0019 (own small engine, Run state as an event stream in SQLite), ADR 0005 (engine independent of the window; non-idempotent actions never blindly repeated), ADR 0007 (model/prompt/Skill per Node, never permissions), ADR 0015 (Chief decides within Budget and Documentation; otherwise Escalation), ADR 0028 (Visibility). SPEC 7 defines the node catalogue and semantics; SPEC 12 the background-work rules; SPEC 16 criteria 5, 7, 14. About 55 WFRT tasks are written in parallel by different agents; without one vocabulary they will diverge.

## 3. Scope (in)

The Markdown document with the sections below, diagrams as Mermaid, and a table of contents. No code.

## 4. Out of scope

Implementation of anything described (other WFRT tasks). Architecture of other areas (ARCH001 owns the global layering document).

## 5. Detailed requirements

The document MUST contain these numbered sections, with exactly these decisions (tasks cite them as `WFRT001 §n`):

1. **Package map.** `contracts/src/{workflow,workflow-run,node-execution}/`, events `contracts/src/events/<type>.event.ts`, errors `contracts/src/errors/wfrt-<topic>.errors.ts` (several files, all `defineErrors('wfrt', ...)`, codes `wfrt.<snake>`), id prefixes `contracts/src/kernel/id-prefixes/wfrt.ts` adding `act` (Action), `esc` (Escalation), `chk` (Checkpoint) to the ARCH007 registry; `domain/src/wfrt/{definition,validation,expression,state,nodes,evidence}/` (pure); `application/src/wfrt/` use cases + `application/src/ports/<Port>.ts`; `workflow-runtime/src/{engine,scheduler,handlers,recovery}/`; `adapters/sqlite/src/wfrt/`; `gateway/src/routes/wfrt/*.route.ts`.
2. **Vocabulary.** *Definition* (nodes, edges), *Node key* (stable slug `^[a-z][a-z0-9-]{0,47}$`), *Port* (named, typed, `in`/`out`), *Token* (a payload travelling over an edge: `{ edgeId, scope, payload }`), *Scope* (stack of `{loopKey, iteration}`; serialised `quality-loop:2/inner:1`), *Execution key* (`<nodeKey>@<scope>`, one NodeExecution per key, retries are `attempt` increments), *Intent* (what a NodeHandler asks the engine to do: complete, wait, perform action, fail, skip), *Action* (one side-effecting operation with an idempotency class), *Branch* (all executions reachable from one Parallel out port until their Join).
3. **Decide / evolve.** The engine is a pair of pure functions plus an I/O shell: `decide(state, command, now) -> events[]` (domain, deterministic) and `evolve(state, event) -> state` (the reducer, WFRT030). The shell appends events through `port:EventStore` inside `port:UnitOfWork` with optimistic `expectedSeq`, then publishes on the EventBus after commit (ARCH010 outbox rule). One stream per Run (`run:<runId>`); per-run sequence numbers are gapless. State is never stored as a mutable blob; projections (`workflow_run`, `node_execution` tables) are derived read models (WFRT032).
4. **Statuses.** Run: `created, running, paused, escalated, cancelling, succeeded, failed, cancelled`. NodeExecution: `pending, ready, running, waiting, succeeded, failed, skipped, cancelled` (SPEC 7). Terminal: succeeded, failed, skipped, cancelled (Run: succeeded, failed, cancelled). The legal transition tables live in WFRT030; the document links to them and shows the Mermaid diagram.
5. **Consumer-side ports** (defined by WFRT, one file per port in `application/src/ports/`, implemented by the named area; WFRT never imports another area's tables): `AgentTurnRunner` (WFRT019 defines; AGENT/PROV implement), `DiscussionGateway` (WFRT024; DISC), `DecisionRecorder` (WFRT028; DEC), `BoardLaneGateway` (WFRT029; BOARD), `ReferenceCatalog` (WFRT014; AGENT, SKILL, PROV), `PinnedConfigResolver` (WFRT035; AGENT, SKILL, PROV), `EffectivePermissionsGateway` (WFRT036; PERM), `GlobalPauseGate` (WFRT041; PAUSE), `EscalationNotifier` (WFRT040; NOTIF), `EvidenceReader` (WFRT026; DATA Artifact store), `WorkflowRepository`, `WorkflowVersionRepository` (WFRT031; WFRT), `RunReadRepository` (WFRT032; WFRT). Infrastructure ports consumed from other areas: `EventStore`, `UnitOfWork`, `ArtifactStore` (DATA), `Clock`, `IdGenerator` (ARCH007), `EventBus` (ARCH010), `Logger` (ARCH004), `ConfigStore` (ARCH005).
6. **Node extension model.** Each node type = one `NodeTypeDefinition` (config schema, ports, static rules; domain) and one `NodeHandler` (runtime behaviour; runtime), registered through the registry of WFRT005. Adding a node type never edits engine, validator or editor switch statements (OCP).
7. **Idempotency classes** `pure | idempotent | non_idempotent` and the crash rule table (WFRT037). Unknown class is treated as `non_idempotent`.
8. **Time and determinism.** All time from `Clock`; no `Date.now`, `Math.random`, `crypto` in domain/runtime. Timers are persisted as `dueAt` inside events and re-armed from state after restart. Elapsed durations are accumulated from monotonic deltas recorded in events (`elapsedMs`), so wall-clock jumps cannot produce negative or extended timeouts. Retry jitter is derived from a hash of `(executionKey, attempt)` (deterministic). Ids come from `IdGenerator`.
9. **Defaults and hard caps table** (ASSUMPTION unless cited): parallel Agents installation-wide 3 (SPEC 9, config `workflow.maxConcurrentAgents`, min 1, max 16); nodes per Workflow 200; edges 600; definition JSON 512 KiB; Parallel fan-out 16; Loop `maxIterations` default 5, cap 50, `maxDurationMs` default 5 400 000 (90 min as in the mock), cap 86 400 000; Loop nesting depth 3; Agent node timeout default 1 800 000 (30 min), cap 14 400 000; retries default 2, exponential base 5 s factor 2 cap 300 s, jitter plus or minus 20 percent; Join timeout default 3 600 000; Run max duration default 86 400 000; Run max events 100 000; expression length 1 000 chars, 200 AST nodes, depth 20, 10 000 evaluation steps; checkpoint every 50 events and at every node boundary; Agent output max 256 KiB.
10. **Security invariants.** Node config never carries permissions (ADR 0007); Effective Permissions are computed per node execution by PERM and never cached across executions; Agent/Discussion/Review output is untrusted data (SEC004) and only validated structured fields influence control flow; evidence for Quality Gates comes from tool-output Artifacts, never from Agent claims; every pause, cancel, escalation and approval decision is audited.
11. **Event catalogue.** The list of Run event types (names fixed here, schemas in WFRT007 to WFRT009): `run.created, run.started, run.paused, run.resumed, run.cancel_requested, run.cancelled, run.succeeded, run.failed, run.escalated, run.escalation_resolved, run.versions_pinned, run.checkpoint_written, run.budget_updated, node.ready, node.started, node.waiting, node.resumed, node.succeeded, node.failed, node.skipped, node.cancelled, node.retry_scheduled, node.dead_lettered, action.started, action.completed, action.ambiguous, action.resolved, token.emitted, token.dropped, loop.iterated, loop.exhausted, join.resolved, gate.evaluated, branch.paused, branch.resumed`, each prefixed `run.` on the wire (for example `run.node.started`).
12. **Task map.** A table of all WFRT tasks grouped by layer with their dependencies (copy from the INDEX at writing time, mark as informational).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Cite ARCH001 (layers), ARCH003 (Result, defineErrors), ARCH007 (ids, Clock), ARCH010 (events, outbox), SEC004 (untrusted content). Do not restate them.

## 8. Architecture and code placement

`docs/architecture/workflow-runtime.md` only. Diagrams in Mermaid so they render in GitHub.

## 9. Security and safety

Section 10 of the document is normative for all WFRT tasks. A review of the document against ADR 0003, 0007 and 0012 is part of this task.

## 10. Errors and edge cases

If a later WFRT task needs to change a number in section 9, it edits this document through a proposal (`tasks/_proposals/`), never silently.

## 11. Acceptance criteria

- [ ] All 12 sections exist with the exact names and numbers above.
- [ ] Every port in section 5 names its defining task and implementing area.
- [ ] The defaults table lists every number used in WFRT tasks.
- [ ] Mermaid diagrams render (state diagram of Run and NodeExecution, component diagram).
- [ ] A link check passes for relative links.

## 12. Test plan

Docs lint (markdown lint, link check) in CI (SETUP006). Manual review by an author of two other WFRT tasks to confirm the vocabulary is sufficient.

## 13. Parallelization notes

Merge first; it only blocks reading, not coding. Edits after merge go through proposals to avoid conflicts.

## 14. Open questions and assumptions

- ASSUMPTION: defaults in section 9 are starting values; the Owner can change only the parallelism cap in Settings.
- Consumer-side ports are defined by WFRT (dependency inversion); the owning areas must provide adapters. If an area already defined an equivalent port, the linker should map it and WFRT adjusts by proposal.

