---
id: OVE_WFED057
title: "Wire publishing: save draft, validate, publish a new immutable Version, handle conflicts"
area: WFED
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS037, OVE_SHELL027, OVE_WFED002, OVE_WFED013, OVE_WFED022, OVE_WFED050, OVE_WFED052, OVE_WFED056, OVE_WFED061, OVE_WFRT049]
soft_depends_on: []
provides: ["feature:wfed-publish"]
needs: ["api:workflows.publish", "api:workflows.draft.save", "api:workflows.validate", "lib:wfed-data-hooks", "lib:editor-document-model", "lib:workflow-mappers", "feature:editor-autosave", "ui:useToast", "lib:app-navigation"]
owns: ["apps/desktop/src/features/workflow-editor/publish/use-publish.ts", "apps/desktop/src/features/workflow-editor/publish/PublishContainer.tsx", "apps/desktop/src/features/workflow-editor/publish/conflict/**", "apps/desktop/src/features/workflow-editor/publish/register.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 19.10"]
adr_refs: [2, 19, 28]
---

# OVE_WFED057: Wire publishing: save draft, validate, publish a new immutable Version, handle conflicts

## 1. Summary

The flow behind 'Zapisz jako v8': flush the autosave, compute the diff, open the dialog, publish with `expectedRevision`, then switch the page to the new published Version. Concurrent edits (second window or Chief) are handled by an explicit conflict screen; a published Version is never modified.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). WFRT002: one mutable Draft with `revision`; `PublishRequest { expectedRevision, changeNote? }` creates `WorkflowVersion` N+1 with `contentHash`; server validation is authoritative (`wfrt.publish_invalid`). ADR 0002: Runs keep the pinned Version. Part 1 owns the document model and autosave; this task consumes them.

## 3. Scope (in)

- `usePublish()` state machine: `idle -> flushing -> reviewing -> publishing -> published|failed|conflict`.
- Container binding the dialog to diff, validation and the active Runs list.
- Conflict screen: shows who/when changed (revision numbers, time) and offers 'Wczytaj najnowszą wersję roboczą' (discard local) or 'Zapisz moje zmiany jako kopię' (duplicate Workflow as new draft is out of scope: offers export JSON via part 1).

## 4. Out of scope

- The dialog UI (`OVE_WFED056`).
- Edit-as-new-version and discard (`OVE_WFED058`).
- Visibility change publish (VIS/WSPACE).

## 5. Detailed requirements

1. Flow: (1) click -> `flushAutosave()` from part 1 and wait for the saved revision; failure to save blocks with a toast 'Nie udało się zapisać wersji roboczej' and retry; (2) fetch latest draft and run `useValidateDefinition({mode:'publish'})`; (3) compute `diffDefinitions(baseVersion.definition, draft.definition)`; (4) open the dialog; (5) on confirm call `usePublishWorkflow({expectedRevision, changeNote})` with an idempotency key; (6) on success: close dialog, toast 'Opublikowano v8', switch page mode to `published`, set the viewed Version to the new one, clear the dirty flag, refetch Workflow, Versions and Draft.
2. Immutability: after success the editor document is reloaded from the new Version (read-only); no code path sends an update for an existing Version (there is no such API).
3. Conflict: on `wfrt.draft_revision_conflict` (`details.currentRevision`), state `conflict`; show the conflict screen with both revisions, the base the user edited, and the choices described in Scope; never auto-merge.
4. `wfrt.publish_invalid`: keep the dialog open, replace validation with the server report, focus the first issue.
5. Network failure during publish: state `failed` with 'Nie wiemy, czy publikacja się udała' — the container re-fetches Versions to check whether a Version with the same `contentHash` and `changeNote` now exists before offering retry (prevents double publish); the idempotency key is reused on retry.
6. Registers `registerHeaderIntent('save', openPublish)` and `('discard')` is NOT here.
7. While publishing, the canvas is read-only and navigation guard is active (leaving the page asks 'Publikowanie trwa').
8. Active Runs shown in the dialog come from `useRunsForWorkflow(workflowId, {status:'non_terminal'})` (their `versionNo` stays pinned).
9. Telemetry: none; engine audits the publish (`workflow.published` audit action).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `OVE_WFED056`, `OVE_WFED055`, `OVE_WFED061`, part 1 `lib:editor-document-model`, `feature:editor-autosave`, `lib:workflow-mappers` (definition <-> editor document).

## 8. Architecture and code placement

`@WF/publish/use-publish.ts` (pure reducer + effect wrapper), `PublishContainer.tsx`, `conflict/ConflictScreen.tsx`. Reducer is unit tested without React. Depends on data hooks and part 1 capabilities.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. The server never trusts the client's `valid` flag (it re-validates). The change note is plain text, max 500 chars. Publishing is an Owner desktop action: the request carries no actor field. A hostile second writer cannot cause a silent overwrite because `expectedRevision` is mandatory.

## 10. Errors and edge cases

- User clicks publish twice: second click ignored while state != idle.
- Draft has not changed since base: dialog shows the identical state, no call.
- Publish succeeds but the response is lost: recovery path described above.
- Engine restarts during publish: `failed` with retry; idempotency key makes the retry safe.
- Workflow archived meanwhile: `wfrt.workflow_archived` -> toast and read-only page.

## 11. Acceptance criteria

- [ ] Given a conflicting revision, then the conflict screen appears and the Draft is not overwritten.
- [ ] Given success, then the page shows 'v8 · opublikowana' read-only and the previously pinned Run still reports v7.
- [ ] Given a lost response, then the flow checks Versions before offering retry and does not create v9.
- [ ] Given validation errors from the server, then the dialog stays open with the server's report.

## 12. Test plan

Reducer tests (all transitions), hook tests with fake gateway (conflict, invalid, lost response with idempotency key), e2e in `OVE_WFED089`. `pnpm --filter desktop vitest run src/features/workflow-editor/publish`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: part 1 exposes `feature:editor-autosave` with `flushAutosave(): Promise<Result<{revision}>>` (flagged to the linker).
- ASSUMPTION: 'save as copy' on conflict is replaced by exporting the local definition as JSON via part 1 (no duplicate-Workflow API in MVP).
