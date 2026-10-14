---
id: OVE_WFRT002
title: Define the Workflow and WorkflowVersion contracts with visibility and drafts
area: WFRT
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH008, OVE_ARCH010, OVE_VIS001, OVE_WFRT003]
soft_depends_on: [OVE_WFRT001]
provides: ["contract:Workflow", "contract:WorkflowVersion", "contract:WorkflowDraft", "event:workflow.published"]
needs: ["contract:Visibility", "contract:EntityId", "lib:define-event", "lib:contract-pipeline"]
owns: ["packages/contracts/src/workflow/**", "packages/contracts/src/workflow-version/**", "packages/contracts/src/events/workflow.published.event.ts", "packages/contracts/src/events/workflow.draft_saved.event.ts", "packages/contracts/src/errors/wfrt-workflow.errors.ts"]
reads: ["packages/contracts/src/kernel/ids.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 14", "SPECIFICATION 19.10"]
adr_refs: [2, 28]
---

# OVE_WFRT002: Define the Workflow and WorkflowVersion contracts with visibility and drafts

## 1. Summary

Zod contracts for the `Workflow` aggregate (mutable metadata and one mutable draft), the immutable `WorkflowVersion` created by publishing, and the DTOs shared by the gateway routes (WFRT047) and the editor (WFED). Visibility and `ownerWorkspaceId` follow ADR 0028.

## 2. Context

The mock shows "v7 · opublikowana" with the button "Edytuj jako v8": versions are immutable, an edit starts a draft based on a version, publishing the draft creates the next version (ADR 0002). A Run pins a version id, so a version row must never change. SPEC 14: `Workflow / WorkflowVersion: id, workspaceId, visibility, nodesJson, edgesJson, schemaVersion`. ADR 0028: new Workflows are private by default; a visibility change creates a new version; in an isolated Workspace everything is private; making a Workflow private is blocked while another Workspace uses it.

## 3. Scope (in)

`Workflow`, `WorkflowDraft`, `WorkflowVersion`, `WorkflowSummary`, request/response DTOs, events `workflow.published` and `workflow.draft_saved`, error codes.

## 4. Out of scope

The definition graph itself (WFRT003). Persistence (WFRT031). Routes (WFRT047). Visibility business rules (VIS area; this task only embeds the `Visibility` contract). Editor UI (WFED).

## 5. Detailed requirements

1. `Workflow` (strict): `id: wfl_`, `workspaceId: ws_` (workspace where it was created), `name` (1-80, trimmed, unique per Workspace case-insensitively among non-archived), `description?` (max 500), `visibility: Visibility` (`public|private`), `ownerWorkspaceId?` (required iff private; equals `workspaceId`), `latestVersionNo: int >= 0`, `publishedVersionId?: wfv_` (the version used by default for new Runs), `archivedAt?`, `createdAt`, `updatedAt`, `createdBy: {kind:'owner'|'chief'}`.
2. `WorkflowDraft` (one per Workflow, mutable): `workflowId`, `baseVersionNo: int >= 0` (0 for a brand-new Workflow), `revision: int >= 1` (optimistic concurrency, incremented on every save), `definition: WorkflowDefinition` (WFRT003, unvalidated shape but size-checked), `updatedAt`, `lastValidation?: {valid, errorCount, warningCount, validatedAt}`.
3. `WorkflowVersion` (immutable): `id: wfv_`, `workflowId`, `versionNo: int >= 1` (gapless per Workflow), `schemaVersion: int` (definition schema version), `visibility`, `ownerWorkspaceId?` (snapshot at publish), `nodesJson`/`edgesJson` stored as the canonical JSON of `definition.nodes` and `definition.edges` plus `definition` meta (`inputSchema`, `outputSchema`, `groups`, `lanes`, `limits`) in `metaJson`, `contentHash` (sha256 hex of the canonical JSON, WFRT003 canonicalisation), `validationReport` (summary: valid true, warnings count, `validatorVersion`), `changeNote?` (max 500), `publishedAt`, `publishedBy`, `basedOnVersionNo?`. No update contract exists for versions (type-level: no `Partial<WorkflowVersion>` DTO).
4. Visibility change: DTO `ChangeWorkflowVisibilityRequest { visibility, expectedDraftRevision? }`; semantics documented here: it publishes a new version with identical graph and new visibility (`changeNote: 'visibility changed'`), so pinned Runs are unaffected (ADR 0028).
5. DTOs: `CreateWorkflowRequest { name, description?, visibility? (default private), templateId? }`, `SaveDraftRequest { definition, expectedRevision }`, `PublishRequest { expectedRevision, changeNote? }` (publish always validates server-side; client validity is not trusted), `EditAsNewVersionRequest { fromVersionNo }`, `WorkflowListQuery { workspaceId, includeArchived?, visibility?, q?, cursor, limit<=100 }`, `WorkflowSummary` (id, name, visibility, latestVersionNo, publishedVersionId, hasUnpublishedDraft, updatedAt).
6. Events (`defineEvent`, persisted, scope workspace): `workflow.published { workflowId, versionId, versionNo, contentHash, visibility }`, `workflow.draft_saved { workflowId, revision }` (no definition in payloads, only ids and counters).
7. Errors (file `wfrt-workflow.errors.ts`): `wfrt.workflow_not_found (404)`, `wfrt.workflow_name_taken (409)`, `wfrt.draft_revision_conflict (409, details currentRevision)`, `wfrt.publish_invalid (422, details errorCount)`, `wfrt.version_immutable (409)`, `wfrt.workflow_archived (409)`, `wfrt.visibility_in_use (409, details workspaceCount)`, `wfrt.definition_too_large (422)`.
8. Ids and `Visibility` are imported, never redefined. All schemas `.strict()`; strings bounded.

## 6. Design notes

N/A, functionality only. (The version badge text "v7 · opublikowana" is composed by the UI from `versionNo` and `publishedVersionId`.)

## 7. Reuse

`Visibility`, `entityId` (VIS, ARCH007), `defineEntity`/`defineEvent` (ARCH008/010), `defineErrors` (ARCH003).

## 8. Architecture and code placement

One file per entity under `packages/contracts/src/workflow/` and `.../workflow-version/`; barrels generated (ARCH009). No logic besides schemas and small pure helpers (`isPublished`).

## 9. Security and safety

Strict schemas with size caps prevent oversized drafts. `publishedBy`/`createdBy` come from the authenticated actor in the use case, never from the request body. A request cannot set `ownerWorkspaceId` to another Workspace (superRefine: equals `workspaceId` when private). Event payloads carry no definition content.

## 10. Errors and edge cases

Private Workflow with missing `ownerWorkspaceId` fails parsing. Public Workflow with `ownerWorkspaceId` fails. `versionNo` skipping is an invariant checked by the repository (WFRT031). Name collision with an archived Workflow is allowed.

## 11. Acceptance criteria

- [ ] Every requirement 1-8 has a schema and a type test.
- [ ] Private/public superRefine cases rejected as specified.
- [ ] No schema allows updating a published version.
- [ ] Contract snapshot (ARCH008) generated, additive-only check passes.
- [ ] Events registered; registry naming test passes.

## 12. Test plan

`workflow.contract.test.ts` (valid/invalid fixtures from a `WorkflowBuilder` in `packages/testing`), snapshot test, `pnpm vitest run packages/contracts/src/workflow packages/contracts/src/workflow-version`.

## 13. Parallelization notes

Needs WFRT003 for the `definition` type; can start with a placeholder `z.unknown()` branded type if WFRT003 is in review. Hotspot: none (per-entity files).

## 14. Open questions and assumptions

- ASSUMPTION: one draft per Workflow (no multiple branches); a second editor tab uses `revision` conflicts.
- ASSUMPTION: Workflow names are unique per Workspace but public Workflows from other Workspaces may share a name.

