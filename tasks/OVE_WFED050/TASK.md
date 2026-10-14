---
id: OVE_WFED050
title: "Build the editor data layer: gateway hooks for Workflow, versions, draft and Run state"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_ENGINE019, OVE_ENGINE027, OVE_PERM026, OVE_SHELL005, OVE_SKILL011, OVE_VIS008, OVE_WFED002, OVE_WFRT002, OVE_WFRT006, OVE_WFRT010, OVE_WFRT050, OVE_WFRT054]
soft_depends_on: []
provides: ["lib:wfed-data-hooks", "lib:wfed-query-keys"]
needs: ["lib:api-client", "lib:api-client-workflows", "lib:api-client-runs", "lib:api-client-events", "lib:api-client-agents", "lib:api-client-skills", "lib:api-client-visibility", "lib:api-client-perm", "lib:desktop-query-layer", "contract:Workflow", "contract:WorkflowVersion", "contract:WorkflowDraft", "contract:WorkflowRun", "contract:NodeExecution", "contract:ValidationReport", "lib:editor-document-model"]
owns: ["apps/desktop/src/features/workflow-editor/data/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 15"]
adr_refs: [2, 19, 28]
---

# OVE_WFED050: Build the editor data layer: gateway hooks for Workflow, versions, draft and Run state

## 1. Summary

One typed set of React hooks that read and mutate everything the Workflow page needs (Workflow, Versions, Draft, active Run, Agent states, validation) through `api-client`, with stable query keys and push-driven invalidation. All other part 2 tasks consume these hooks instead of calling the gateway themselves.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The page shows data from many gateway resources (SPEC 7, 15): the Workflow with its published Version and one mutable Draft (WFRT002), the Run list for this Workflow (WFRT006), Agent presence (AGENT010) and validation reports (WFRT010). Without a single data layer every region would poll and invalidate on its own and the page would show inconsistent states (for example a header saying 'działa' while the canvas shows a finished Run).

## 3. Scope (in)

- Query key factory `wfedKeys` (workflow, versions, version, draft, validation, runs, run, nodeExecutions, agentStates).
- Hooks: `useWorkflow(id)`, `useWorkflowVersions(id)`, `useWorkflowVersion(id, versionNo)`, `useWorkflowDraft(id)`, `useActiveRun(workflowId)`, `useRunDetail(runId)`, `useAgentStates(workspaceId)`.
- Mutation hooks: `useSaveDraft`, `usePublishWorkflow`, `useEditAsNewVersion`, `useDiscardDraft`, `useValidateDefinition` (thin wrappers returning typed `Result`s).
- Event-driven invalidation map (event type -> query keys) subscribed once per page via `lib:api-client-events`.
- Fixtures and a fake gateway adapter for hook tests.

## 4. Out of scope

- Live validation scheduling (`OVE_WFED061`).
- Run overlay projection from events (`OVE_WFED080`).
- Any visual component.

## 5. Detailed requirements

1. Hooks MUST wrap `lib:api-client` calls only; no `fetch`, no Tauri `invoke` here (OVE_ENGINE022 owns transport).
2. Every hook returns `{ status: 'loading'|'ready'|'error'|'empty', data?, error?: AppErrorView, refetch() }` where `AppErrorView = { code, safeMessageKey, retryable, details? }` derived from the typed error body (codes `wfrt.*`).
3. `wfedKeys` are tuples starting with `['wfed', workspaceId, ...]` so a Workspace switch drops every cache entry (Agents and Workflows of another Workspace MUST NOT leak into the page, ADR 0028).
4. Invalidation map (single source `invalidation.ts`): `workflow.published` -> workflow, versions, draft; `workflow.draft_saved` -> draft only when the revision differs from the locally known one; `run.created|started|paused|resumed|cancelled|succeeded|failed|escalated` -> activeRun, runs; `run.node.*`, `run.loop.*`, `run.gate.evaluated` are NOT invalidations: they feed the overlay projection (`OVE_WFED080`) via a separate callback registry `onRunEvent(cb)`; `agent.state.changed` -> agentStates patched in place (no refetch); `pause.changed` -> activeRun and runs.
5. `useSaveDraft` sends `expectedRevision`; on `wfrt.draft_revision_conflict` it resolves with `{ kind: 'conflict', currentRevision }` and never retries silently (the conflict UI is `OVE_WFED057`).
6. Mutations send an idempotency key (`crypto.randomUUID()` per user action, reused on retry of the same action).
7. Subscription lifecycle: opens on first consumer, closes on last; after reconnect the hook set refetches every key that has an active observer (resync, `lib:api-client-events` `resync` signal).
8. Stale-while-revalidate: lists keep previous data while refetching; `status` stays `ready`.
9. Parsing: responses are validated by the contract schemas from `contracts` (zod parse); a parse failure becomes `error.code = 'client.contract_mismatch'` (shown as 'engine and app versions differ', see `lib:compat-handshake`).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:api-client`, `lib:api-client-workflows`, `lib:api-client-runs`, `lib:api-client-events`, `lib:desktop-query-layer` (the app's cache/query library chosen in SHELL).
- Contracts from `contracts` only.

## 8. Architecture and code placement

UI adapter layer inside `@WF/data/`; no React components. Files: `keys.ts`, `invalidation.ts`, `use-workflow.ts`, `use-versions.ts`, `use-draft.ts`, `use-run.ts`, `use-agent-states.ts`, `mutations.ts`, `errors.ts`, `fixtures/`. Depends on api-client and contracts only (boundary lint). Consumers import from `@WF/data` barrel.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Cache keys include the Workspace id so a switch cannot show foreign private Agents or Workflows. Error views carry only `safeMessageKey`, never raw server text.

## 10. Errors and edge cases

- Gateway unreachable: `status:'error'`, `error.code='engine.unreachable'`, retryable; the page shows `OVE_WFED086` error state.
- Draft missing (published Workflow, no draft): `useWorkflowDraft` returns `empty`, not an error.
- Two browser windows edit one draft: second save gets a revision conflict result.
- Event for an unknown Workflow id: ignored.
- Response with unknown extra fields: accepted (additive contracts); missing required field: contract mismatch error.

## 11. Acceptance criteria

- [ ] Given a `workflow.published` event, when it arrives, then versions and draft queries refetch exactly once.
- [ ] Given a `agent.state.changed` event, then the cached state is patched and no HTTP request is made.
- [ ] Given a Workspace switch, then no cached entry of the previous Workspace is returned.
- [ ] Given a revision conflict, then the mutation resolves `{kind:'conflict'}` and no retry happens.
- [ ] Given a response violating the schema, then `client.contract_mismatch` is returned and logged without the payload.

## 12. Test plan

Vitest with a fake gateway (`lib:fake-ports`): `keys.test.ts`, `invalidation.test.ts` (table-driven event -> keys), `mutations.test.ts` (conflict, idempotency key reuse), `workspace-switch.test.ts`, `resync.test.ts`. Command: `pnpm --filter desktop vitest run src/features/workflow-editor/data`.

## 13. Parallelization notes

Parallel with all other part 2 tasks after contracts exist; consumers can code against the hook signatures with the fixtures. Hotspot: none (own folder). Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the query library is whatever SHELL chooses (capability `lib:desktop-query-layer`); hooks are written against a minimal `QueryClient` interface so it can be swapped.
- ASSUMPTION: gateway routes for workflows and runs (`api:workflows.*`, `api:runs.*`) are provided by WFRT (routes WFRT047/WFRT048); names are in `needs` and the linker must resolve them.
