---
id: OVE_WFED010
title: "Implement edge command handlers and builders (connect, reconnect, remove, update)"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_WFED002, OVE_WFED003, OVE_WFED006, OVE_WFED007]
soft_depends_on: []
provides: ["lib:editor-commands-edge"]
needs: ["lib:editor-commands", "lib:editor-connection-rules", "lib:editor-document-model", "lib:editor-ids"]
owns: ["apps/desktop/src/features/workflow-editor/commands/handlers/edge.*.handler.ts", "apps/desktop/src/features/workflow-editor/commands/builders/edge.ts", "apps/desktop/src/features/workflow-editor/commands/handlers/edge.*.test.ts", "apps/desktop/src/features/workflow-editor/commands/builders/edge.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED010: Implement edge command handlers and builders (connect, reconnect, remove, update)

## 1. Summary

Handlers and builders for edges: add (always re-checked by the connection rules), remove, restore, update (label, kind hint, mapping text) and a reconnect builder that moves one end of an existing edge as a single undoable step.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The mock shows plain edges, an active (glow) edge and the dashed amber labelled return edge "nie spełnia → wróć do Developera z raportem". In the persisted definition an edge has `id`, `from`, `to`, optional `label`, `kind: flow | return` (presentation hint only) and `mapping` (target field -> expression, evaluated only by the engine safe evaluator, WFRT015..WFRT017). The editor never evaluates expressions.

## 3. Scope (in)

- Handlers `edge.add`, `edge.remove`, `edge.restore`, `edge.update`.
- Builders `buildConnect`, `buildReconnect`, `buildRemoveEdges`, `buildSetEdgeLabel`, `buildSetEdgeMapping`.

## 4. Out of scope

- Drag gesture, tooltips and the keyboard connect mode (WFED032).
- Mapping editor UI (PART 2 Inspector).
- Return-edge label suggestion (PART 2).

## 5. Detailed requirements

1. `edge.add { edge: EditorEdge; index?: number }`: the handler calls `checkConnection(doc, edge.from, edge.to, q)` (WFED006) and refuses with `illegal_connection` when not ok; sets `kind: "return"` when the verdict says `edgeKind: "return"` and the payload has no kind; id must be free; edge count < 600. Inverse `edge.remove { ids: [id] }`.
2. `edge.remove { ids }`: unknown ids -> `edge_not_found`; inverse `edge.restore { edges: [{ edge, index }] }`; `edge.restore` re-inserts at the saved indexes and skips the rule check (it restores a previously valid state) but still checks that both nodes exist (I3).
3. `edge.update { id, patch: { label?: string | null; kind?: "flow" | "return" | null; mapping?: Record<string, string> | null } }`: label trimmed, <= 60 chars; mapping at most 20 entries, keys `^[A-Za-z_][A-Za-z0-9_.]{0,63}$`, values non empty strings <= 500 chars (opaque text, never evaluated, never trimmed inside), `null` removes the field. The inverse is an `edge.update` with the previous values. `coalesceKey = edgeLabel:<id>` for label typing.
4. `buildConnect(doc, deps, a, b): Result<{ command: CommandData; verdict: ConnectionVerdict & {ok:true} }, ConnectionRefusal>`: normalises ends (WFED006), refuses early with the rule verdict, generates the id with `IdSource.edgeId`, returns the command plus warnings (for example `any_json_into_typed`) so the UI can show a non blocking hint.
5. `buildReconnect(doc, deps, edgeId, end: "from" | "to", newRef)`: batch of `edge.remove` and `edge.add`; the rule check runs against the document WITHOUT the old edge (so moving an end to the same node does not collide with itself); one undo step restores the old edge with its old id, label, kind and mapping (the new edge inherits label, kind hint recomputed, mapping dropped when the target port changed and kept otherwise).
6. `buildRemoveEdges(doc, ids)` and `buildSetEdgeLabel(doc, id, label)` trivial builders with precondition checks.
7. Every handler exports `examples`; labels and announcements: `announce.edge.add` "Połączono {from} z {to}", `announce.edge.remove` "Usunięto połączenie".

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `checkConnection` (WFED006) is the single decision point: no rule is duplicated here (DRY).
- `IdSource.edgeId` (WFED003); document helpers (WFED002); engine and error codes (WFED007).

## 8. Architecture and code placement

Layer: pure `commands/`. Depends on `rules/`, `document/`. No React.

## 9. Security and safety

Defence in depth: even though the canvas pre-checks with `canConnect`, `edge.add` re-runs the rules so a pasted fragment, a test hook or a future Chief-authored change cannot create an illegal edge. Mapping text is stored as data only (injection into the safe evaluator is prevented server-side, WFRT017). Strings are bounded.

## 10. Errors and edge cases

- Reconnect to the same port: `unchanged`.
- Add an edge whose target port disappeared (dynamic branch removed): refused with `unknown_port`.
- Update of a missing edge: `edge_not_found`.
- Mapping with 21 entries: `invalid_payload`.
- Undo of `edge.add` after the node was deleted: impossible in linear history (node delete cascades and its inverse restores nodes first).

## 11. Acceptance criteria

- [ ] Given a legal connection, When `buildConnect` then execute and undo, Then the document equals the original.
- [ ] Given a connection into a Loop `continue`, Then the stored edge has `kind: "return"`.
- [ ] Given a reconnect, Then exactly one history entry is produced and undo restores id, label and mapping.
- [ ] Given an illegal connection payload sent directly to `edge.add`, Then `illegal_connection` with the rule code.
- [ ] Mapping values containing `{{`, `$(`, `<script>` are stored verbatim and never interpreted.

## 12. Test plan

Unit tests per handler/builder with `aDocument()`; contract round-trip via `examples`. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/commands/handlers/edge src/features/workflow-editor/commands/builders/edge`.

## 13. Parallelization notes

Parallel with WFED009, WFED011, WFED012. Blocks WFED032.

## 14. Open questions and assumptions

- ASSUMPTION: mapping keys are plain field names or dotted paths; the real grammar is owned by WFRT015, the editor only bounds length and charset and the server validates.
