---
id: OVE_WFED055
title: "Compute the structured diff between two Workflow definitions (pure logic)"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_WFED002, OVE_WFRT003]
soft_depends_on: []
provides: ["lib:wfed-definition-diff"]
needs: ["contract:WorkflowDefinition", "contract:NodeDef", "contract:EdgeDef", "lib:definition-canonical", "lib:editor-document-model"]
owns: ["apps/desktop/src/features/workflow-editor/publish/diff/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 19.10"]
adr_refs: [2, 19, 28]
---

# OVE_WFED055: Compute the structured diff between two Workflow definitions (pure logic)

## 1. Summary

A pure function `diffDefinitions(base, next)` that yields a human-sized change summary (nodes added/removed/changed, edges, config fields, limits, lanes, groups, Agent and Skill references) used by the publish dialog and the version list. Layout-only changes are reported separately and do not count as a change.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). Publishing creates Version N+1 (immutable). The Owner must see what will change before confirming, particularly changes that alter behaviour of future Runs: a new Loop limit, a different Agent, a new permission-relevant override, a different IF condition. `definitionHash` (WFRT003) ignores positions, so the diff aligns with it: positions-only edits yield `identical: true`.

## 3. Scope (in)

- `diffDefinitions(base, next): DefinitionDiff`.
- Change classification with a `risk` level per entry (`info|behaviour|safety`).
- Summary counters and stable ordering.
- Field-level diff of node `config` using the node type's registered schema labels.

## 4. Out of scope

- Rendering (`OVE_WFED056`).
- Server-side diff validation: the server never trusts this diff; it only recomputes `contentHash`.

## 5. Detailed requirements

1. `DefinitionDiff = { identical: boolean, layoutOnly: boolean, counts: {nodesAdded, nodesRemoved, nodesChanged, edgesAdded, edgesRemoved, edgesChanged}, entries: DiffEntry[], truncated: boolean }`; `DiffEntry = { kind: 'node_added'|'node_removed'|'node_changed'|'edge_added'|'edge_removed'|'edge_changed'|'limits_changed'|'lane_changed'|'group_changed'|'io_schema_changed', target: { nodeKey?, edgeId?, laneId?, groupId? }, fields?: FieldChange[], risk: 'info'|'behaviour'|'safety', labelKey, params }`.
2. Matching: nodes by `key`, edges by `id`; a node whose `type` changes is `removed + added` (types are not editable in place).
3. `FieldChange = { path: string (JSON pointer in config), before: Shown, after: Shown }` where `Shown` is a bounded display value: strings truncated to 200 chars, objects summarised ('3 pól'), secrets-like keys are not special (configs contain none, WFRT036 forbids), expressions shown verbatim (they are Owner-authored).
4. Risk rules: `safety` = change of `overrides.skills.add`, an Agent reference to an Agent with different visibility, removal of a Quality Gate, removal of a Loop limit, raising a Loop `maxIterations`/`maxCost`/`maxDurationMs` by more than 2x; `behaviour` = any condition, policy, route, model, prompt change; `info` = label, description, layout of groups.
5. Order: `safety` first, then `behaviour`, then `info`; inside a class by node key. Cap at 200 entries (`truncated`).
6. Layout: if only `position`/`ui` differ, return `identical: true, layoutOnly: true` and no entries.
7. Deterministic and total: never throws; unknown node types diff as opaque JSON.
8. Performance: 200 nodes / 600 edges in under 50 ms.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `definitionHash`/`canonicalDefinition` (WFRT003) to short-circuit `identical`.
- Node type labels from the registry (`lib:node-registry`) for field names.

## 8. Architecture and code placement

Pure TypeScript in `@WF/publish/diff/` (`diff-definitions.ts`, `risk-rules.ts`, `field-diff.ts`). No React, no I/O.

## 9. Security and safety

A diff is advisory but safety-relevant: the risk rules exist so the Owner cannot publish a widened Loop limit or a removed Quality Gate unnoticed. Display values are bounded so a hostile definition cannot flood the dialog. Nothing in the diff is executed.

## 10. Errors and edge cases

- Both definitions empty: identical.
- Node key reused for a different type: shown as removed + added with a `safety` note when the old one was a Quality Gate.
- Edge re-targeted: `edge_changed` with from/to fields.
- More than 200 changes: truncated flag and counts still exact.

## 11. Acceptance criteria

- [ ] Each risk rule has a test for trigger and non-trigger.
- [ ] Layout-only edits give `identical: true`.
- [ ] Ordering is stable across runs (snapshot test).
- [ ] Property test: `diff(a,a)` is identical and `diff(a,b)` counts mirror `diff(b,a)` (added/removed swapped).
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test` and the boundary check pass; the module imports nothing from React, `api-client` or the DOM (pure logic) unless the task says otherwise.

## 12. Test plan

`diff-definitions.test.ts`, `risk-rules.test.ts`, property tests with fast-check using definition builders (`lib:builders`). Command `pnpm --filter desktop vitest run src/features/workflow-editor/publish/diff`.

## 13. Parallelization notes

Independent of UI; blocks `OVE_WFED056`. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: 2x is the threshold for 'raised limit' risk; configurable constant `LIMIT_RAISE_FACTOR`.
