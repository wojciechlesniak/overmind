---
id: OVE_WFED011
title: "Implement group, lane and lane-binding command handlers and builders"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_WFED002, OVE_WFED003, OVE_WFED005, OVE_WFED007]
soft_depends_on: []
provides: ["lib:editor-commands-group"]
needs: ["lib:editor-commands", "lib:editor-document-model", "lib:editor-ids", "lib:editor-node-catalog"]
owns: ["apps/desktop/src/features/workflow-editor/commands/handlers/group.*.handler.ts", "apps/desktop/src/features/workflow-editor/commands/handlers/lane.*.handler.ts", "apps/desktop/src/features/workflow-editor/commands/builders/group.ts", "apps/desktop/src/features/workflow-editor/commands/builders/lane.ts", "apps/desktop/src/features/workflow-editor/commands/handlers/group.*.test.ts", "apps/desktop/src/features/workflow-editor/commands/handlers/lane.*.test.ts", "apps/desktop/src/features/workflow-editor/commands/builders/group.test.ts", "apps/desktop/src/features/workflow-editor/commands/builders/lane.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED011: Implement group, lane and lane-binding command handlers and builders

## 1. Summary

Commands for visual frames (Subworkflow, Loop, Lane, free) and for the Board Lanes (TOR) a Workflow defines, plus the binding of nodes to a Lane. Frames are visual only; semantics come from Loop nodes and from Lane definitions.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The mock shows a mint frame "Pętla jakości · Build → QA → Review · iteracja 2 z 5" with the limit label "limit 90 min · 5 iteracji", and tiles with the tab `TOR · BUILD`, `TOR · QA`, `TOR · REVIEW`. In the definition (WFRT003): `GroupDef { id, label (<=80), nodeKeys[], kind: loop | subworkflow | lane | free, limitLabel? }` is purely visual; `LaneDef { id (LaneKey), name (<=40), agentRef?, teamRef? }` are Board lanes the Workflow defines (SPEC 6, ADR 0011); an Agent node references a lane with `config.lane` (WFRT019). Glossary: Tor = Lane, UI word `TOR`.

## 3. Scope (in)

- Handlers: `group.create`, `group.remove`, `group.restore`, `group.update`, `group.setMembers`, `lane.add`, `lane.update`, `lane.remove`, `lane.restore`, `lane.bind`.
- Builders: `buildGroupFromSelection`, `buildUngroup`, `buildSetGroupMembers`, `buildCreateLane`, `buildRenameLane`, `buildRemoveLane`, `buildBindLane`.

## 4. Out of scope

- Frame geometry (computed in the mapper, WFED015) and drag interactions (WFED035).
- Lane binding UI and Lane list (WFED036).
- Creating Board lanes in the Task Board (BOARD, from the published version, WFRT029).

## 5. Detailed requirements

1. `group.create { group: EditorGroup; index?: number }`: label 1..80 chars, at least 1 member that exists, at most 50 groups; `kind` free choice; default labels by kind (localised): `Grupa N`, `Pętla N`, `Subworkflow N`, `Tory N`. Inverse `group.remove { ids }`.
2. `group.remove { ids }` (ungroup deletes only the frame, never members) with inverse `group.restore { groups: [{ group, index }] }`.
3. `group.update { id, patch: { label?, kind?, limitLabel?: string | null } }` (limitLabel <= 60 chars, free text such as "limit 90 min · 5 iteracji"; it is only a caption, real limits are in the Loop node config). `coalesceKey = groupLabel:<id>`.
4. `group.setMembers { id, nodeKeys }`: replace, dedupe preserving order, every key must exist; an empty list is allowed (the frame then disappears from the canvas but stays in the document until removed; the mapper flags it). Inverse stores the previous list.
5. `lane.add { lane: EditorLane; index?: number }`: key `^[a-z][a-z0-9_]{0,31}$` unique, name 1..40 unique case-insensitively, at most 16 lanes; `lane.update { id, patch: { name?, agentRef?: AgentRef | null, teamRef?: JsonObject | null } }`; `lane.remove { ids }` also unbinds every node whose `config.lane` equals the key (via `withLaneKey(node, undefined)`), inverse `lane.restore { lanes: [{ lane, index, boundNodes: NodeKey[] }] }` rebinding them; a `lane.bind` that targets a missing lane is refused.
6. `lane.bind { nodeKeys, lane: LaneKey | null }`: sets or clears `config.lane` only on nodes whose catalogue entry has `usesAgent: true` (Agent, Review); other node types -> `unsupported_target` for that call (atomic: nothing changes). Inverse stores the previous lane per node.
7. Builders: `buildGroupFromSelection(doc, deps, nodeKeys, kind)` refuses an empty selection, de-duplicates, orders members by node order; `buildUngroup(doc, ids)`; `buildCreateLane(doc, deps, name, agentRef?)` uses `IdSource.laneKey`; `buildBindLane(doc, deps, nodeKeys, laneKey | null)` returns one batch command so a multi-node bind is one undo step.
8. Loop frames are visual: creating a group of kind `loop` does not add a Loop node and does not change limits. A helper `suggestLoopFrame(doc, loopKey)` (uses `computeLoopBodies`, WFED004) returns the member list for the UI to offer "Obramuj pętlę" (used by WFED035).
9. Messages: `announce.group.create` "Utworzono grupę {label}", `announce.lane.bind` "Przypisano {count} Węzłów do Toru {lane}".

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Accessors `getLaneKey`/`withLaneKey` (WFED002), `usesAgent` from the catalogue (WFED005), `computeLoopBodies` (WFED004), engine (WFED007), ids (WFED003).

## 8. Architecture and code placement

Layer: pure `commands/`. One file per handler. Frames carry no geometry (no rectangle in `GroupDef`), so commands never touch coordinates.

## 9. Security and safety

Lane names and frame labels are untrusted display text, bounded and control-character-stripped. Binding is limited to node types that declare an Agent, so a lane cannot be attached to control nodes by a crafted command. Lane definitions never carry permissions (ADR 0003).

## 10. Errors and edge cases

- Removing the only lane bound to 4 nodes then undo: all 4 rebound.
- Binding a Join to a lane: `unsupported_target`.
- Group with a member deleted later: the delete command cascades membership.
- Two lanes named "Build" and "build": `duplicate_key`.
- 17th lane: `limit_exceeded`.
- Same node in two groups: allowed (nested frames).

## 11. Acceptance criteria

- [ ] Given 3 selected nodes, When `buildGroupFromSelection` runs and executes, Then a group with those members exists; undo removes it.
- [ ] Given `lane.remove` on a bound lane then undo, Then `config.lane` is restored on all nodes.
- [ ] Given `lane.bind` with a Join in the list, Then the whole command is refused and the document is unchanged.
- [ ] Given `suggestLoopFrame` on the mock graph, Then it lists Developer, QA, Security, Quality Gate, Senior Reviewer.

## 12. Test plan

Unit tests per handler, round-trip contract via `examples`, builder tests with the mock-like fixture. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/commands/handlers/group src/features/workflow-editor/commands/handlers/lane src/features/workflow-editor/commands/builders`.

## 13. Parallelization notes

Parallel with WFED009, WFED010, WFED012. Blocks WFED035 and WFED036.

## 14. Open questions and assumptions

- ASSUMPTION: the node field is `config.lane` (WFRT019 lists `lane?: LaneKey`; WFRT029 owns semantics and is not written yet). If Review uses another field, only `node-fields.ts` (WFED002) changes.
- OPEN: frame kinds `subworkflow` and `lane` are drawn like `parallel` and `generic` (see WFED015); Subworkflow as a runnable node is a later node type.
