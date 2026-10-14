---
id: OVE_WFED013
title: "Implement pure mappers between the persisted WorkflowDefinition and EditorDocument"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFED002, OVE_WFED005, OVE_WFRT003]
soft_depends_on: []
provides: ["lib:workflow-mappers", "lib:workflow-definition-mapper"]
needs: ["lib:editor-document-model", "contract:WorkflowDefinition", "contract:NodeDef", "contract:EdgeDef", "lib:result"]
owns: ["apps/desktop/src/features/workflow-editor/mappers/definition.ts", "apps/desktop/src/features/workflow-editor/mappers/definition-issues.ts", "apps/desktop/src/features/workflow-editor/mappers/normalize.ts", "apps/desktop/src/features/workflow-editor/mappers/definition*.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED013: Implement pure mappers between the persisted WorkflowDefinition and EditorDocument

## 1. Summary

Two pure functions: `documentFromDefinition` (persisted JSON to the editor document, with strict checks and a report of repairs) and `definitionFromDocument` (back to the exact persisted shape, deterministic). Together with the canvas mapper (WFED015) they form `lib:workflow-mappers`; round-trip tests prove nothing is lost.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The engine stores a draft as a `WorkflowDefinition` (WFRT002 `WorkflowDraft.definition`, WFRT003) and a published version as `nodesJson`, `edgesJson` and `metaJson` (WFRT002 requirement 3). The editor loads both and saves only drafts. `schemaVersion` greater than the supported one must be refused (`wfrt.definition_from_future`, fail closed). The document hash on the server ignores `position` and `ui` (WFRT003 requirement 7), so moving a tile never creates a "changed" graph for hashing, but the draft is still saved.

## 3. Scope (in)

- `documentFromDefinition(def): Result<{ doc, repairs }, MapIssue[]>`.
- `documentFromVersion(version)` adapter for the version shape (`nodesJson`, `edgesJson`, `metaJson`).
- `definitionFromDocument(doc): WorkflowDefinitionInput` (the request body for `SaveDraftRequest.definition`).
- `normalizeDefinition` used by tests to compare definitions modulo absent-vs-empty arrays.

## 4. Out of scope

- Mapping to the kit canvas model (WFED015).
- Server-side validation, hashing and canonicalisation (WFRT003).
- Fetching (WFED018).

## 5. Detailed requirements

1. Import (`documentFromDefinition`): checks `schemaVersion === 1` (else `from_future` or `unsupported`), arrays are arrays, counts <= limits, node `key`/edge `id` regexes, `position` finite (clamped and reported), `config` is a JSON object (otherwise error `config_not_object` with the node key: the node cannot be edited safely, the whole draft is then opened read-only by the loader, WFED020), prototype keys rejected (I7), strings trimmed and bounded (reported). Duplicate node keys or edge ids are HARD errors (`duplicate_key`, `duplicate_edge_id`): two tiles with one key cannot be rendered or addressed. Dangling references are REPAIRED and reported in `repairs`: an edge to a missing node is dropped (`dangling_edge`), a group member that does not exist is removed (`group_member_missing`); the loader marks the draft dirty so the repaired document is saved.
2. Defaults on import: absent `groups`, `lanes`, `limits`, `outputSchema` -> empty/absent; absent `inputSchema` -> `{ type: "object", properties: {} }` (WFRT003 default); absent edge `kind` stays absent (the canvas derives return edges, WFED015).
3. Export (`definitionFromDocument`): emits `{ schemaVersion: 1, nodes, edges, inputSchema, outputSchema?, groups?, lanes?, limits? }` with nodes in `nodeOrder`, edges in `edgeOrder`, groups in `groupOrder`, lanes in `laneOrder` (z-order and reading order are preserved; the server canonicalises for hashing); JSON object key order fixed (`key, type, label, config, position, ui`); empty `groups`/`lanes` arrays are OMITTED; `position` coordinates rounded to integers; `undefined` never emitted; no editor-only fields; `config` objects emitted as the same references (no deep copy needed, the result is read-only for the caller).
4. `documentFromVersion({ nodesJson, edgesJson, metaJson, schemaVersion })`: parses the canonical JSON strings (depth/size limited like `parseFragment`) and delegates; the versions are immutable, so the loader always opens them in `view` mode.
5. Unknown node types and unknown `config` content are preserved byte-for-byte semantically (deep equal): the editor must never drop data it does not understand (forward compatibility with node types added later by the engine).
6. `MapIssue { code, path (JSON pointer), params }` with codes `from_future`, `invalid_shape`, `config_not_object`, `duplicate_key`, `duplicate_edge_id`, `too_many_nodes`, `too_many_edges`, `invalid_key`, `invalid_edge_id`; repairs: `dangling_edge`, `group_member_missing`, `position_clamped`, `string_trimmed`. Messages are keys in `wfc-load` (WFED020).
7. Performance: linear time, 200 nodes + 600 edges in under 20 ms on CI hardware (test with slack).
8. Determinism: `definitionFromDocument(documentFromDefinition(x))` equals `normalizeDefinition(x)` for every valid `x` with integer positions; and `documentFromDefinition(definitionFromDocument(d))` deep-equals `d` for every valid document (both properties are tested by WFED017 with the golden fixtures).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Types from contracts (type-level only), `deepFreeze`, invariants and limits (WFED002), safe-JSON helper (WFED012 or contracts).

## 8. Architecture and code placement

Layer: pure `mappers/`. Depends on `document/` and contract TYPES. No React, no ui-kit (that is the other mapper).

## 9. Security and safety

Persisted drafts can be edited by other actors (Chief, imports) and by a damaged database, so import treats them as untrusted: strict shapes, bounds, prototype-key rejection, refusal of future schema versions and of data the editor cannot edit safely (fail closed into read-only). The mapper never evaluates `mapping` expressions or `config` content. Export emits only known fields, so editor internals cannot leak into stored drafts.

## 10. Errors and edge cases

- Draft with an edge to a deleted node: repaired and reported; loader saves the repair.
- Draft with `schemaVersion: 2`: `from_future`, read-only, message "Ta wersja pochodzi z nowszej aplikacji".
- Node `config: null` or an array: `config_not_object`, whole draft read-only, offending node key shown.
- Same key twice: hard error with both indexes.
- Position `null`: `invalid_shape` (position is required).
- Nodes with unknown type: kept as is.

## 11. Acceptance criteria

- [ ] Given every golden definition fixture (WFED017), When mapped to a document and back, Then the result equals `normalizeDefinition(original)`.
- [ ] Given a definition with a dangling edge, Then the document has no such edge and `repairs` contains `dangling_edge` with the edge id.
- [ ] Given `schemaVersion: 2`, Then the result is an error `from_future` and no document.
- [ ] Given a node with an unknown type and an arbitrary `config`, Then export returns the same config (deep equal).
- [ ] Given 200 nodes, 600 edges, Then mapping takes under 20 ms (5x slack).

## 12. Test plan

Unit tests plus round-trip property tests (seeded generator of valid definitions, shuffled optional fields), golden fixtures from WFED017, benchmark. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/mappers/definition`.

## 13. Parallelization notes

Parallel with WFED012 and WFED014. Blocks WFED017, WFED020, WFED022 (save body).

## 14. Open questions and assumptions

- ASSUMPTION: the draft body sent to `PUT draft` is the full definition (WFRT002 `SaveDraftRequest { definition, expectedRevision }`), not a diff.
- OPEN: whether `edges[].kind: "return"` should be written for return edges. Default: kept as stored/created by `edge.add` (the validator derives real back-edges anyway).
