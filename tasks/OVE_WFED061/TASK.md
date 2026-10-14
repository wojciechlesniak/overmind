---
id: OVE_WFED061
title: "Run live validation of the draft (debounced, cancellable) and keep an issue index"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_WFED002, OVE_WFED013, OVE_WFED050, OVE_WFRT010, OVE_WFRT049]
soft_depends_on: []
provides: ["lib:wfed-live-validation"]
needs: ["api:workflows.validate", "lib:workflow-validator", "contract:ValidationReport", "contract:ValidationIssue", "lib:editor-document-model", "lib:workflow-mappers"]
owns: ["apps/desktop/src/features/workflow-editor/validation/model/**", "apps/desktop/src/features/workflow-editor/validation/use-live-validation.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED061: Run live validation of the draft (debounced, cancellable) and keep an issue index

## 1. Summary

A hook that sends the current draft definition to the engine validator after edits (debounce 400 ms, at most one request in flight, stale results dropped) and exposes an issue index keyed by Node, Edge and Port so the canvas, the inspector and the badge show the same errors.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). WFRT010: validation runs in three modes (edit advisory, publish blocking, run start). The mock footer reads 'Walidacja: 0 błędów'. Validation is authoritative on the server (rules WFRT011-017 and node rules); the client must not duplicate rules (DRY). `ValidationIssue = { ruleId, severity, messageKey, params, target:{nodeKey?,edgeId?,portName?,groupId?,path?}, fixHintKey? }`, max 100 issues, `truncated`.

## 3. Scope (in)

- `useLiveValidation(document)` -> `{ status, report, index, revalidate() }`.
- `buildIssueIndex(report)` pure: maps to per-node, per-edge, per-port lists, counts, and the ordered global list.
- Debounce/cancel logic and a small mode switch (`edit` vs `publish`).

## 4. Out of scope

- Badge and panel (`OVE_WFED062`).
- Canvas error styling (`OVE_WFED082` consumes the index for error borders; part 1 for edit affordances).

## 5. Detailed requirements

1. Trigger: any committed document change event from part 1 (`onDocumentChange`) schedules validation after 400 ms of quiet; max one in flight; when a newer revision exists, the older response is discarded (`documentRevision` compare).
2. Request: `{ definition: mapToDefinition(document), mode:'edit', workflowId }` via `useValidateDefinition`; the editor sends only the definition, never ids of other Workspaces.
3. `status`: `checking` (in flight or pending), `valid` (no errors, maybe warnings), `error`, `stale` (last request failed or the engine is unreachable; the badge says 'Walidacja niedostępna'), `idle` (viewing published Version: use the stored report).
4. On request failure keep the previous report marked `stale: true`; never show 'valid' when stale (fail closed: Publish and Dry-run are disabled while stale and mode requires it).
5. `buildIssueIndex`: `byNode: Record<NodeKey, Issue[]>`, `byEdge`, `byPort: Record<'node.port', Issue[]>`, `global: Issue[]` (targets without node), `errorCount`, `warningCount`, `firstErrorNode`.
6. Sort order for the global list: errors first, then by `ruleId`, then by node label; stable.
7. Messages are rendered from `messageKey` + `params` via i18n; unknown keys fall back to `ruleId` and the raw code, never to server prose.
8. Expose `focusIssue(issue)` helper returning the target for the canvas controller (`{ nodeKey | edgeId, openInspector: true }`); the controller call itself is made by the consumer.
9. Revalidate on Workspace switch and when Agent/Skill reference snapshots change (events `agent.updated`, `skill.version_added`): schedule one revalidation.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `useValidateDefinition` from `OVE_WFED050`; contracts from WFRT010; part 1 `lib:workflow-mappers`.

## 8. Architecture and code placement

`@WF/validation/model/build-issue-index.ts` (pure), `use-live-validation.ts` (hook), `scheduler.ts` (debounce/cancel, injectable timers for tests).

## 9. Security and safety

Validation is fail-closed: unknown or failed validation never reads as valid. The hook sends only the definition (no secrets exist in it). Message params are bounded by the server; the UI escapes them as text.

## 10. Errors and edge cases

- Burst of 50 edits: one request after quiet.
- Response for revision 12 arrives after revision 14 was sent: dropped.
- Report truncated (100 issues): `truncated` flag surfaced for the panel.
- Engine unreachable: stale state; recovers automatically on the next change or event.

## 11. Acceptance criteria

- [ ] Given rapid edits, then exactly one request is sent after the quiet period (fake timers).
- [ ] Given an out-of-order response, then it is discarded.
- [ ] Given a failed request, then `status==='stale'` and `valid` is not reported.
- [ ] Given a report, then `byNode` and counts match a golden fixture.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`build-issue-index.test.ts`, `scheduler.test.ts`, hook test with fake gateway. `pnpm --filter desktop vitest run src/features/workflow-editor/validation`.

## 13. Parallelization notes

Parallel with `OVE_WFED062` (agree on `IssueIndex` type in this task; panel can use fixtures). Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: part 1 emits `onDocumentChange(revision)`; if only a store subscription exists, adapt in the hook.
