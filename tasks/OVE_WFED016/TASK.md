---
id: OVE_WFED016
title: "Translate kit canvas callbacks and intents into editor commands"
area: WFED
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS095, OVE_DS096, OVE_WFED003, OVE_WFED006, OVE_WFED007, OVE_WFED009, OVE_WFED010, OVE_WFED011]
soft_depends_on: []
provides: ["lib:canvas-intent-translator"]
needs: ["lib:editor-commands", "lib:editor-commands-node", "lib:editor-commands-edge", "lib:editor-commands-group", "lib:editor-connection-rules", "ui:FlowCanvas", "ui:CanvasInteractions"]
owns: ["apps/desktop/src/features/workflow-editor/mappers/intents.ts", "apps/desktop/src/features/workflow-editor/mappers/can-connect.ts", "apps/desktop/src/features/workflow-editor/mappers/intents.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED016: Translate kit canvas callbacks and intents into editor commands

## 1. Summary

The reverse mapping: the kit emits typed callbacks and intents (`onNodesMove`, `onConnect`, `onNodeDelete`, `onEdgeDelete`, `AddNodeIntent`, `AttachSkillIntent`, `ResizeGroupIntent`) and this module turns each into a validated command (or a documented non-document action) using the builders. It also adapts the rules engine to the kit `canConnect` shape.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. DS095 `FlowCanvas` is controlled: it never mutates the model, it emits intents (`onNodesMove(moves)` on drag end, `onConnect`, `onNodeDelete(ids)`, `onEdgeDelete(id)`, `canConnect(intent) -> {ok:true} | {ok:false, reason}`); DS096 adds `AddNodeIntent { kind, position }`, `AttachSkillIntent { nodeId, skill }`, `DeleteIntent`, `ResizeGroupIntent`. Keeping the translation in one pure module means the canvas component has no business logic and the rules are testable without React.

## 3. Scope (in)

- `planFromIntent(intent, doc, deps): Plan`.
- `kindToNodeType(kind)` and its inverse table.
- `makeCanConnect(doc, q, t)` adapter.

## 4. Out of scope

- Snapping and grid (WFED026), palette drop (WFED031), delete confirmation UX (WFED033), skill assignment (WFED043).
- Dispatching the plan (WFED024 wiring calls the session).

## 5. Detailed requirements

1. ```ts
type Plan =
  | { kind: "commands"; label: MessageRef; commands: CommandData[]; transaction: boolean }
  | { kind: "attach-skill"; nodeId: NodeKey; targetAgentId: string; skill: { id: string; version: string } }   // handled by WFED043, NOT a document command
  | { kind: "ignored"; reason: "group_resize_unsupported" | "view_mode" | "unknown_node" | "invalid" }
  | { kind: "refused"; error: CommandError | ConnectionRefusal };
```
2. `onNodesMove(moves)` -> one `node.move` command (coalescing key from the handler); positions are taken as given (snapping already applied by the interaction layer, WFED026) and only clamped.
3. `onConnect({from, to})` -> `buildConnect` (WFED010): returns `commands` with one `edge.add`, or `refused` with the rule verdict. Edge ids come from `IdSource`.
4. `onNodeDelete(ids)` and `DeleteIntent { nodeIds, edgeIds }` -> a single `batch` of `edge.remove` (explicit edges not already covered by the node cascade) and `node.remove`; `onEdgeDelete(id)` -> `edge.remove`. Unknown ids are skipped silently when at least one id is valid, `ignored: unknown_node` otherwise.
5. `AddNodeIntent { kind, position }` -> `buildAddNode` with `type = kindToNodeType(kind)`: `agent-public | agent-private | lane-build | lane-qa | lane-review -> "agent"`, `discussion -> "discussion"`, `join`, `if`, `loop`, `parallel`, `review` -> same name, `quality-gate -> "quality_gate"`, `save-decisions -> "save_decisions"`, `start` -> refused (`type_limit`: Start is created with the Workflow). The table is exported and used by the palette (WFED030) too (DRY).
6. `AttachSkillIntent` -> `attach-skill` plan with `targetAgentId = getAgentRef(node).agentId`; no command, because a Skill assignment changes the Agent (a new Agent configuration version on the server, ADR 0028), not the draft; it is therefore not part of undo/redo of the draft (WFED043 explains and offers its own undo toast). If the node has no Agent: `refused` with `unsupported_target`.
7. `ResizeGroupIntent` -> `ignored: group_resize_unsupported` (frames are computed from members, WFED015); the canvas hides resize handles in edit mode, so this only guards stale events.
8. In `view` mode every plan is `ignored: view_mode` EXCEPT `attach-skill` (it edits the Agent, never the draft, WFED043; second guard, the session also refuses document commands, WFED019).
9. `makeCanConnect(doc, q, t)` returns the kit callback `(c) => ({ok:true}) | ({ok:false, reason: string})`: calls `checkConnection` and renders `t(messageKey, params)` for the reason; memoised on (from, to) per document identity because React Flow calls it on every pointer move over a port.
10. No translator access inside plans: plans carry `MessageRef` values; only `makeCanConnect` formats text because the kit expects a string.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Builders of WFED009..WFED011, `checkConnection` (WFED006), `IdSource` (WFED003); kit callback types from `ui:FlowCanvas` (type-only).

## 8. Architecture and code placement

Layer: pure `mappers/` (type-only kit imports). No React. The canvas wiring (WFED024) calls `planFromIntent` and then `session.dispatch`.

## 9. Security and safety

Intents come from the pointer layer and are re-validated by the builders and the rules (never trusted as authorisation). A forged intent with an unknown kind is `invalid`. Skill attach is not executed here; its checks happen in WFED041 and again on the server.

## 10. Errors and edge cases

- Move of a node that was deleted meanwhile: skipped; plan `ignored: unknown_node` when nothing remains.
- Connect on a node pair where the rules refuse: `refused`, canvas shows the tooltip text (from `makeCanConnect`) and announces.
- Delete of 250 ids: batch limit 500 commands, so split not needed; ids over the document size are ignored.
- `AddNodeIntent` outside the world bounds: clamped by the builder.

## 11. Acceptance criteria

- [ ] Given `onConnect` for a legal pair, Then the plan contains exactly one `edge.add`.
- [ ] Given `AddNodeIntent` kind `lane-qa`, Then the command type is `node.add` with `type: "agent"` (the lane is bound later, WFED036).
- [ ] Given `DeleteIntent` with 2 nodes and 1 extra edge, Then one batch with all three removals.
- [ ] Given `AttachSkillIntent` on an Agent node, Then `attach-skill` with the Agent id and no command.
- [ ] Given view mode, Then `ignored`.
- [ ] `makeCanConnect` returns the reason text for `raw_cycle` including the path.

## 12. Test plan

Unit tests per intent type with fixtures; kit callback shape checked with the type-level test (`expectTypeOf`). Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/mappers/intents`.

## 13. Parallelization notes

Parallel with WFED015 and WFED017. Blocks WFED024, WFED031, WFED032, WFED033.

## 14. Open questions and assumptions

- ASSUMPTION: the exact intent type names of DS096 are used; when DS096 is merged, adjust imports only.
