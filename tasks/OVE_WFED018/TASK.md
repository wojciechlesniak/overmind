---
id: OVE_WFED018
title: "Define the EditorGateway port, its api-client adapter, a fake and the React provider"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ENGINE019, OVE_WFED002, OVE_WFED005, OVE_WFED013, OVE_WFRT002, OVE_WFRT010, OVE_WFRT048, OVE_WFRT049, OVE_WFRT050]
soft_depends_on: []
provides: ["lib:editor-gateway"]
needs: ["lib:api-client-workflows", "api:workflows.get", "api:workflows.versions.get", "api:workflows.draft.get", "api:workflows.draft.save", "api:workflows.draft.from-version", "api:workflows.validate", "api:workflows.node-types", "contract:WorkflowDraft", "contract:WorkflowVersion", "contract:ValidationReport", "lib:result", "lib:api-client"]
owns: ["apps/desktop/src/features/workflow-editor/gateway/types.ts", "apps/desktop/src/features/workflow-editor/gateway/workflows.ts", "apps/desktop/src/features/workflow-editor/gateway/provider.tsx", "apps/desktop/src/features/workflow-editor/gateway/*.test.ts", "apps/desktop/src/features/workflow-editor/testing/fake-gateway.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED018: Define the EditorGateway port, its api-client adapter, a fake and the React provider

## 1. Summary

A small interface (`EditorGateway`) through which the editor core talks to the engine, its adapter over `@overmind/api-client`, an in-memory fake for tests and Storybook, and a React provider. Nothing else in the feature touches the network for workflow data.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The workflow gateway routes (`api:workflows.*`) and the `lib:api-client-workflows` client are referred to by the WFRT tasks (WFRT047) but no WFRT task that provides them exists yet; this task uses the capability names listed in `needs` and the linker must create an owner (see section 14). Contracts available: `WorkflowDraft { workflowId, baseVersionNo, revision, definition, updatedAt, lastValidation? }`, `WorkflowVersion` (immutable, `nodesJson/edgesJson/metaJson`), DTOs `SaveDraftRequest { definition, expectedRevision }`, `EditAsNewVersionRequest { fromVersionNo }`, error codes `wfrt.workflow_not_found`, `wfrt.draft_revision_conflict` (409, `details.currentRevision`), `wfrt.definition_too_large`, `wfrt.workflow_archived`, `wfrt.publish_invalid` (WFRT002). The desktop talks only to the gateway through the api-client (CONVENTIONS 6, ADR 0005): no direct DB or file access.

## 3. Scope (in)

- Interface `EditorGateway` and result/error types.
- `createApiEditorGateway(client)` adapter.
- `createFakeEditorGateway(seed)` in-memory implementation with controllable latency/failures.
- `EditorGatewayProvider` and `useEditorGateway()`.

## 4. Out of scope

- Publish (PART 2 uses `validate` and its own publish call through the same client).
- Loading orchestration (WFED020), autosave policy (WFED022).
- Agents and Skills gateways (WFED023, WFED040, WFED043).

## 5. Detailed requirements

1. ```ts
interface EditorGateway {
  getCatalog(signal?: AbortSignal): Promise<Result<NodeTypeCatalog, GatewayError>>;
  getWorkflow(id: string, signal?): Promise<Result<WorkflowHeader, GatewayError>>;           // name, visibility, latestVersionNo, publishedVersionId, hasUnpublishedDraft, workspaceId
  getVersion(id: string, which: { published: true } | { versionNo: number }, signal?): Promise<Result<WorkflowVersionDto, GatewayError>>;
  getDraft(id: string, signal?): Promise<Result<WorkflowDraftDto | null, GatewayError>>;    // null when no draft exists (404 mapped)
  saveDraft(id: string, definition: WorkflowDefinitionInput, expectedRevision: number, signal?): Promise<Result<{ revision: number; updatedAt: string }, GatewayError>>;
  startDraftFromVersion(id: string, fromVersionNo: number, signal?): Promise<Result<WorkflowDraftDto, GatewayError>>;
  validate(definition: WorkflowDefinitionInput, mode: "edit", signal?): Promise<Result<ValidationReport, GatewayError>>;   // for PART 2; never persists
}
```
2. `GatewayError { code: "not_found" | "revision_conflict" | "definition_too_large" | "archived" | "from_future" | "forbidden" | "network" | "timeout" | "server" | "aborted" | "unknown"; currentRevision?: number; retryable: boolean; messageKey; correlationId? }`. The adapter maps api-client errors and the `wfrt.*` codes above to this union; `retryable` is true only for `network`, `timeout`, `server` with 5xx.
3. Adapter rules: every call forwards `AbortSignal`; timeouts 15 s (reads) and 30 s (`saveDraft`); responses are parsed by the contract zod schemas (a response that fails parsing is `server` with `retryable: false`, logged without content); no automatic retry inside the adapter (policy belongs to autosave, WFED022); `saveDraft` sends the `Idempotency-Key` header only if the route supports it (ENGINE convention: ignore if not).
4. `getDraft` maps HTTP 404 `wfrt.workflow_not_found` for the draft to `null` ONLY when the workflow itself exists (the adapter distinguishes by the error `details.resource`); otherwise `not_found`.
5. The fake gateway: seeded with workflows (published version and optional draft), optional latency (fake clock), injectable failures per method and call count, implements optimistic revisions exactly like the contract (increments `revision`, returns `revision_conflict` with `currentRevision` when stale), size limit 512 KiB check, records calls for assertions. It is the only fake of the gateway; Storybook, unit tests and the Playwright mock gateway (TEST004) use it or the same fixtures.
6. `EditorGatewayProvider` (React context) takes a gateway instance; `useEditorGateway()` throws a clear developer error outside the provider. Default instance is built from the app api-client in PART 2 wiring.
7. Logging: only method name, ids, durations, status codes; never definitions.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:api-client` and the contract error mapper (ARCH003); Result type; contracts for DTO types; no new HTTP code.

## 8. Architecture and code placement

Layer: adapter inside `gateway/` (the only folder allowed to import `@overmind/api-client`, WFED001). The core depends on the `EditorGateway` interface (DIP).

## 9. Security and safety

Requests go to the local engine over the authenticated owner channel (ENGINE); the editor never constructs URLs from user input (ids are validated as `wfl_` ULIDs before use). Server-side checks (visibility, owner, size) are authoritative; client size checks are UX. Errors never echo definition content. A response with unexpected shape is rejected (fail closed). The fake never ships in the production bundle (dev/test entry point, tree-shaken by the import graph test of WFED001).

## 10. Errors and edge cases

- Network loss mid-save: `network`, retryable.
- Engine restart: connection refused -> `network`.
- Draft endpoint returns a draft newer than local: not an error for `getDraft`.
- Abort: `aborted` result, not an exception.
- Response with `definition` larger than 512 KiB: `definition_too_large` treated as non retryable on save.

## 11. Acceptance criteria

- [ ] Given the fake with a draft at revision 3, When `saveDraft(expectedRevision 2)` runs, Then `revision_conflict` with `currentRevision: 3`.
- [ ] Given an api-client error `wfrt.draft_revision_conflict`, Then the adapter returns `revision_conflict` and `currentRevision`.
- [ ] Given an aborted signal, Then `aborted` and no unhandled rejection.
- [ ] Given a response failing zod parsing, Then `server` non retryable.
- [ ] Given a workflow without draft, `getDraft` returns `ok(null)`.

## 12. Test plan

Adapter contract tests against a mocked api-client (typed fakes from `lib:api-client`), fake gateway tests, provider test. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/gateway`.

## 13. Parallelization notes

Parallel with WFED019. Blocks WFED020, WFED022. Conflict hotspot: none.

## 14. Open questions and assumptions

- GAP for the linker: `api:workflows.get`, `api:workflows.versions.get`, `api:workflows.draft.get`, `api:workflows.draft.save`, `api:workflows.draft.from-version`, `api:workflows.validate`, `api:workflows.node-types` and `lib:api-client-workflows` need an owner (WFRT047 is referenced by WFRT002 and WFRT010 but not written). Assumed paths: `GET /v1/workflows/{id}`, `GET /v1/workflows/{id}/versions/{versionNo|published}`, `GET|PUT /v1/workflows/{id}/draft`, `POST /v1/workflows/{id}/draft/from-version`, `POST /v1/workflows/validate`, `GET /v1/workflows/node-types`.
- ASSUMPTION: `from-version` is idempotent: when a draft already exists it returns it (the editor then edits that draft).
