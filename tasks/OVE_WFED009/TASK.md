---
id: OVE_WFED009
title: "Implement node and workflow-meta command handlers and their builders"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_WFED002, OVE_WFED003, OVE_WFED005, OVE_WFED007]
soft_depends_on: []
provides: ["lib:editor-commands-node"]
needs: ["lib:editor-commands", "lib:editor-document-model", "lib:editor-ids", "lib:editor-node-catalog"]
owns: ["apps/desktop/src/features/workflow-editor/commands/handlers/node.*.handler.ts", "apps/desktop/src/features/workflow-editor/commands/handlers/meta.set.handler.ts", "apps/desktop/src/features/workflow-editor/commands/builders/node.ts", "apps/desktop/src/features/workflow-editor/commands/builders/meta.ts", "apps/desktop/src/features/workflow-editor/commands/handlers/node.*.test.ts", "apps/desktop/src/features/workflow-editor/commands/builders/node.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED009: Implement node and workflow-meta command handlers and their builders

## 1. Summary

Handlers and builders for everything that changes nodes: add, remove (with cascade), restore, move, rename, replace config, UI flags, and the workflow-level meta (input/output schema, limits). Inverses restore exact order, edges and group memberships.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The commands are written against the contract of WFED007. The mock needs: dropping a palette chip creates a node at a world position; deleting removes its edges; moving a tile changes `position`. PART 2 (Inspector) will change a node model, prompt and Skill overrides through `node.setConfig`; the builders here give it typed helpers.

## 3. Scope (in)

- Handlers: `node.add`, `node.remove`, `node.restore`, `node.move`, `node.setLabel`, `node.setConfig`, `node.setUi`, `meta.set`.
- Builders: `buildAddNode`, `buildRemoveNodes`, `buildMoveNodes`, `buildSetLabel`, `buildSetConfig`, `buildSetAgentRef`, `buildSetMeta`.
- `examples` exports for the contract test.

## 4. Out of scope

- Edge, group and lane commands (WFED010, WFED011).
- Palette drop, snapping and clamping to the grid (WFED026, WFED031 call the builders).
- Config forms (PART 2).

## 5. Detailed requirements

1. `node.add { node: EditorNode; index?: number }`: preconditions: key free, node count < 200, `maxPerWorkflow` of the type respected (second `start` -> `type_limit`), config within size limit. Inverse: `node.remove { keys: [key] }`.
2. `node.remove { keys: NodeKey[] }`: removes nodes, every edge touching them, and their entry in every group (a group left with zero members is kept: the user decides; empty frames are flagged by the mapper). Inverse: `node.restore { nodes: [{node, index}], edges: [{edge, index}], memberships: [{groupId, nodeKeys}] }` that restores positions in the order arrays and the exact previous membership lists. `node.restore` is an internal command (validated like the others), its inverse is `node.remove`.
3. `node.move { moves: [{ key, to: Point }] }`: positions clamped by `clampPosition`; moves to the identical position are dropped; if all are dropped -> unchanged. Inverse stores the previous positions. `coalesceKey = move:<sorted keys joined>`; `merge` keeps the first inverse and the last targets.
4. `node.setLabel { key, label }`: trim, 1..60 chars, no control characters (stripped). `coalesceKey = label:<key>`.
5. `node.setConfig { key, config: JsonObject }`: replaces the whole config; max 64 KiB encoded, depth <= 20, prototype keys rejected (I7); refused for nodes of an unknown type with the error `unknown_type_readonly` (listed in WFED007). Inverse stores the previous config object (same identity, so structural sharing keeps it cheap). `buildSetConfig(doc, key, patch)` deep-merges a JSON-pointer patch for callers who change one field; the handler itself is replace-only.
6. `buildSetAgentRef(doc, key, ref | undefined)` is the only way to set an Agent: uses `withAgentRef` (WFED002); also clears `lane` bindings that depend on the previous Agent? NO: lanes are independent of the Agent (a lane has its own `agentRef`); do not touch them. Changing the Agent keeps `overrides.skills` unchanged.
7. `node.setUi { key, ui }` for `collapsed`; round-tripped, no visual in MVP.
8. `meta.set { patch: { inputSchema?, outputSchema?, limits? } }`: replace semantics per key (`null` removes `outputSchema` and `limits`), objects bounded as above. Inverse restores the previous values.
9. `buildAddNode(doc, deps, { type, position, label?, config?, agentRef? })`: asks the catalogue for `defaultConfig`, uses `IdSource` for key and label (localised display name passed in), clamps the position, merges `agentRef` through the accessor, returns `Result<CommandData, CommandError>`. It does NOT snap: snapping belongs to the interaction layer (WFED026) so that tests and keyboard adds are exact.
10. Every handler exports `examples` and a `label(c)` that returns a message key with a count; announcements: `announce.node.add` "Dodano Węzeł {label}".
11. Order semantics: new nodes are appended to `nodeOrder` (top of z-order); `restore` honours indexes; moves never reorder.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Update helpers and accessors from WFED002; `IdSource` from WFED003; `defaultConfigFor`, `typeInfo` from WFED005; the engine and error codes of WFED007.

## 8. Architecture and code placement

Layer: pure `commands/handlers` and `commands/builders`. One file per handler (OCP). No React.

## 9. Security and safety

`node.setConfig` is the only config writer; it enforces size, depth and prototype-key rules and never offers a field for permissions (ADR 0003, ADR 0007: a node may override model, prompt and Skills but never permissions; the server rejects anything else, WFRT014). Labels are stripped of control characters. Unknown-type nodes are protected from config edits so the editor cannot corrupt data it does not understand.

## 10. Errors and edge cases

- Removing a node that is the only member of a group: group stays empty (flagged by the mapper).
- Adding a 201st node: `limit_exceeded`.
- Moving a node by 1e9: clamped to 100000.
- `node.setConfig` with 70 KiB: `config_too_large`.
- Removing the Start node: allowed (the validator reports `graph.missing_start`).
- Redo of `node.add` after its key was taken by a later edit: impossible in linear history; defensive `duplicate_key` error.

## 11. Acceptance criteria

- [ ] Given a document with node X connected to Y and Z and member of group G, When `node.remove [X]` then undo, Then the document deep-equals the original including `nodeOrder`, `edgeOrder` and group member order.
- [ ] Given two Start adds, Then the second returns `type_limit`.
- [ ] Given 5 moves of one node within 800 ms through the history, Then one undo restores the first position.
- [ ] Given `buildAddNode` for `agent`, Then the config equals the catalogue default and the key is `agent-1`.
- [ ] Every handler has `examples` and passes the generic round-trip contract test of WFED007.

## 12. Test plan

Handler unit tests with builders, round-trip contract test hook, snapshot of the `examples`. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/commands/handlers/node src/features/workflow-editor/commands/builders/node`.

## 13. Parallelization notes

Parallel with WFED010, WFED011, WFED012 after WFED007 (separate files). Conflict hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: a deleted node that was the only member of a group leaves an empty group; the group is removed by the user or by `Ungroup` (WFED035), never silently.
