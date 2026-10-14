---
id: OVE_WFED020
title: "Load a Workflow Version or Draft into the session with loading, error and read-only states"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS032, OVE_DS040, OVE_WFED005, OVE_WFED013, OVE_WFED018, OVE_WFED019]
soft_depends_on: []
provides: ["lib:editor-loader", "ui:EditorLoadGate"]
needs: ["lib:editor-gateway", "lib:editor-session", "lib:workflow-mappers", "lib:editor-node-catalog", "ui:Skeleton", "ui:EmptyState", "ui:Button", "ui:CalloutAmber", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/session/loader.ts", "apps/desktop/src/features/workflow-editor/session/react/useLoadWorkflow.ts", "apps/desktop/src/features/workflow-editor/session/react/EditorLoadGate.tsx", "apps/desktop/src/features/workflow-editor/session/loader*.test.ts", "apps/desktop/src/features/workflow-editor/session/react/EditorLoadGate.test.tsx", "apps/desktop/src/features/workflow-editor/session/react/EditorLoadGate.stories.tsx", "apps/desktop/src/locales/en/wfc-load.json", "apps/desktop/src/locales/pl/wfc-load.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED020: Load a Workflow Version or Draft into the session with loading, error and read-only states

## 1. Summary

The orchestration that fills the session: fetch catalogue and workflow header, then either the published Workflow Version (read-only) or the Draft (editable), map it, initialise the session. It also starts a new draft from a version ("Edytuj jako v8") and renders loading, error, not-found, future-schema and unreadable states.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The mock shows the published state: header "v7 · opublikowana", button "Edytuj jako v8" (PART 2 renders the button and calls `startEditing`). ADR 0002: a version is immutable; an edit creates a draft that becomes the next version when published. A Run pins a version, so loading must never mutate a version. States not in the mock: loading, error, not found, future schema, unreadable data, empty workflow.

## 3. Scope (in)

- `loadWorkflow(deps, { workflowId, target })` with request tokens against races.
- `startEditing(deps, { workflowId, fromVersionNo })`.
- `useLoadWorkflow(workflowId, target)` hook and `EditorLoadGate` component.
- Mapping errors and repairs into session state.

## 4. Out of scope

- The header, version badge and "Edytuj jako" button (PART 2).
- Discard draft, publish (PART 2).
- Autosave (WFED022).

## 5. Detailed requirements

1. ```ts
type LoadTarget = { kind: "published" } | { kind: "version"; versionNo: number } | { kind: "draft" } | { kind: "auto" }   // auto: draft if it exists else published
loadWorkflow(deps: { gateway; session; catalog: CatalogCache }, input: { workflowId: string; target: LoadTarget; signal?: AbortSignal }): Promise<LoadOutcome>
startEditing(deps, { workflowId; fromVersionNo }): Promise<LoadOutcome>   // POST draft/from-version then loads the returned draft
```
2. Sequence for `published`: `getCatalog` (cached for the app session, refreshed when the engine `version` string changes) in parallel with `getWorkflow`, then `getVersion(published)`, then `documentFromVersion` (WFED013), then `session.initialise({ doc, mode: "view", source: { kind: "version", versionNo }, readOnlyReason: "published_version" })`. For `draft`: `getDraft` -> `documentFromDefinition(draft.definition)` -> `initialise({ mode: "edit", source: { kind: "draft", revision, baseVersionNo } })`; when repairs exist, `markDirtyExternally()` so autosave persists the repaired draft. `auto` tries the draft first (null -> published).
3. Race safety: each call takes a monotonically increasing token; a response that arrives after a newer load started (or after unmount: `AbortSignal`) is discarded and never touches the session.
4. Failure mapping to `LoadError { code: "not_found" | "network" | "timeout" | "server" | "forbidden" | "from_future" | "unreadable" | "catalog_unavailable"; details?: MapIssue[]; retryable }`: `from_future` and `unreadable` (mapper hard errors) open nothing editable: the session is `ready` in `view` mode with an EMPTY document and `readOnlyReason` set, plus the `loadError` details, so the gate shows the explanation instead of a broken canvas (fail closed). Catalogue failure: `catalog_unavailable`, retryable; the editor does not open (ports unknown).
5. `EditorLoadGate({ children })` renders: `loading` -> skeleton of the canvas stage (rounded stage with dot grid placeholder, side-panel skeleton rows via `ui:Skeleton`); `error` retryable -> `ui:EmptyState` with message and a `Button` "Spróbuj ponownie" calling the hook `retry`; `not_found` -> EmptyState "Nie znaleziono Workflow" with a link slot supplied by PART 2; `from_future` -> amber callout `ui:CalloutAmber` "Ten Workflow pochodzi z nowszej wersji Overmind i jest otwarty tylko do odczytu"; `unreadable` -> callout with the list of up to 5 problems (node key and code, never values) and the sentence "Draft nie może być bezpiecznie edytowany"; `ready` -> children. Repairs on load show a non blocking note (a `ui:InfoNote`) "Naprawiono {count} elementów przy wczytaniu" that PART 2 may reposition via a render prop.
6. `startEditing`: `gateway.startDraftFromVersion` then the same mapping path; a `forbidden` or `archived` error keeps the session in `view` and surfaces the message through the returned `LoadOutcome` (PART 2 shows a toast).
7. Switching Workflow: `useLoadWorkflow` aborts the previous request and calls `session.initialise` only on success of the new one (no flash of the old graph under the new title).
8. Copy keys in `wfc-load` (EN default, PL): `loading`, `retry`, `notFound`, `fromFuture`, `unreadable`, `unreadableItem` (`{code} · {nodeKey}`), `catalogUnavailable`, `repaired` (`{count, plural, ...}`).

## 6. Design notes

Not in the mock; derive from the design system: stage skeleton = `CanvasStage` container (radius 24, border `line`, bg `#0C0814`, dot grid 22 px) with three `Skeleton` blocks at tile positions; error and not-found use `ui:EmptyState` (icon, title 18/700, text 14 `text-secondary`, primary `Button`); callouts use `ui:CalloutAmber` (amber `#FFB547` on `bg-surface`), never colour alone (icon plus words). Stories: Loading, Error retryable, NotFound, FromFuture, Unreadable, Repaired, Ready.

## 7. Reuse

- `ui:Skeleton`, `ui:EmptyState`, `ui:Button`, `ui:CalloutAmber`, `ui:InfoNote` from the kit; mappers (WFED013); gateway (WFED018); session (WFED019).

## 8. Architecture and code placement

Layer: `session/loader.ts` is framework-free orchestration; `session/react/*` the hook and gate. Depends on the `EditorGateway` interface only.

## 9. Security and safety

Versions are loaded read-only and the session refuses commands, so a published program cannot be altered from the editor (ADR 0002). Data that cannot be edited safely is never partially opened (fail closed). Error details name node keys and codes only, never configs or prompts. The `workflowId` is validated against the ULID format before any call.

## 10. Errors and edge cases

- Workflow has a draft but the user asked for `published`: published is shown (view); PART 2 shows "ma wersję roboczą".
- Draft revision newer than expected on a later save: handled by WFED022.
- User navigates away during loading: aborted, no state change.
- Catalogue changed between loads: refreshed by `version` comparison.
- `from-version` returns 409 (draft exists) and then the draft: handled as the existing draft.
- Empty definition (only Start): opens with the empty-canvas hint (WFED029).

## 11. Acceptance criteria

- [ ] Given a published version, Then the session is `view`, `readOnlyReason: "published_version"`, history empty, `isDirty` false.
- [ ] Given a draft with a dangling edge, Then the session is `edit`, repairs listed and `isDirty` true.
- [ ] Given `schemaVersion: 2`, Then the gate shows the future-schema callout and no tile.
- [ ] Given two quick loads A then B where A resolves last, Then the session shows B.
- [ ] Given a network error, Then the gate shows Retry and Retry reloads.
- [ ] Given `startEditing`, Then the session turns `edit` with the new draft revision.

## 12. Test plan

Unit tests with the fake gateway and fake clock; RTL tests for the gate states; Storybook stories with play functions (retry click); axe on every story. Commands: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/session/loader` and the Storybook test runner.

## 13. Parallelization notes

Parallel with WFED021 and WFED023 after WFED018 and WFED019. Blocks WFED022 and PART 2 route.

## 14. Open questions and assumptions

- ASSUMPTION: the published Version to show by default is `Workflow.publishedVersionId` (WFRT002).
- OPEN: whether opening a Workflow that has a draft should land in the draft. Default: `auto` for the Edit entry points, `published` for the Canvas tab so a running Run is shown with its pinned graph; PART 2 picks the target.
