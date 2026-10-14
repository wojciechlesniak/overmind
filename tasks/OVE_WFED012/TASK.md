---
id: OVE_WFED012
title: "Implement fragment extraction, safe clipboard format and the insert command"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_WFED002, OVE_WFED003, OVE_WFED007, OVE_WFED009, OVE_WFED010, OVE_WFED011]
soft_depends_on: []
provides: ["lib:editor-commands-fragment", "lib:editor-clipboard-format"]
needs: ["lib:editor-commands", "lib:editor-commands-node", "lib:editor-commands-edge", "lib:editor-commands-group", "lib:editor-ids", "lib:editor-document-model"]
owns: ["apps/desktop/src/features/workflow-editor/commands/fragment/**", "apps/desktop/src/features/workflow-editor/commands/handlers/fragment.insert.handler.ts", "apps/desktop/src/features/workflow-editor/commands/builders/fragment.ts", "apps/desktop/src/features/workflow-editor/commands/fragment/*.test.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED012: Implement fragment extraction, safe clipboard format and the insert command

## 1. Summary

Defines the fragment (a copyable sub-graph), its strict JSON clipboard format and the `fragment.insert` command with full key, id and group remapping. Duplicate is copy plus insert with an offset. All parsing of pasted text is untrusted-input safe.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The Owner copies nodes inside one Workflow or between Workflows (and between Workspaces). The clipboard is a text channel and can contain anything, so parsing is strict and bounded. Start nodes cannot be copied because a Workflow has exactly one Start (WFRT011 `graph.multiple_start`).

## 3. Scope (in)

- `Fragment` type, `extractFragment`, `serializeFragment`, `parseFragment`.
- `fragment.insert` handler and `buildPaste`, `buildDuplicate`.
- Bounding box and placement math (pure).

## 4. Out of scope

- Reading and writing the system clipboard, shortcuts, paste position from the pointer, cross-workspace Agent checks (WFED034).
- Copying Run state (not copied, ever).

## 5. Detailed requirements

1. ```ts
interface Fragment { v: 1; nodes: EditorNode[]; edges: EditorEdge[]; groups: EditorGroup[]; lanes: EditorLane[] }   // all keys local to the fragment
extractFragment(doc, nodeKeys): { fragment: Fragment; skipped: { key: NodeKey; reason: "start" }[] }
serializeFragment(f): string   // JSON.stringify of { "overmindWorkflowFragment": 1, ...f }, no whitespace
parseFragment(text): Result<Fragment, FragmentError>
```
2. `extractFragment`: takes the selected nodes (Start excluded and reported in `skipped`), the edges whose BOTH ends are selected (edges to outside nodes are dropped), the groups whose members are all selected, and the lanes referenced by the selected nodes (`config.lane`). Deep-copies via structured clone of JSON data. Positions are kept absolute; the paste builder normalises them.
3. `parseFragment`: rejects text longer than 256 KiB BEFORE parsing; parses with a depth-limited JSON parser (reuse `safeJson` semantic of WFRT003: reject `__proto__`, `constructor`, `prototype`, depth > 20); requires the marker key and `v === 1`; validates with a strict zod schema (<= 200 nodes, <= 600 edges, <= 50 groups, <= 16 lanes, bounded strings, each node `config` <= 64 KiB); unknown keys rejected; checks internal consistency (edges reference fragment nodes, group members exist). Any failure returns an error code (`not_a_fragment`, `too_large`, `invalid`) and NEVER a partial result. Text that is not JSON at all yields `not_a_fragment` silently (the shortcut then does nothing visible except a polite status message, WFED034).
4. `buildPaste(doc, deps, fragment, at: Point): Result<CommandData, CommandError>`: (1) limit check: `nodeCount + fragment.nodes.length <= 200` and edges likewise, else `limit_exceeded` and nothing changes (all or nothing); (2) type check: every node type must be known to the catalogue, unknown types are refused for the whole paste (`type_limit`-style code `unknown_type_readonly`); `maxPerWorkflow` types are skipped with a warning; (3) remap: new node keys by `IdSource.nodeKey(type, slug(oldKey))`, new edge ids, new group ids, lanes matched by key (if the target document has a lane with that key, reuse; otherwise the lane is created with the same name, key made unique) ; (4) translate positions so the fragment bounding-box top-left becomes `at` (the caller supplies a snapped point); (5) returns one `fragment.insert` command with the fully remapped fragment.
5. `fragment.insert { fragment }` handler: appends nodes to `nodeOrder` in fragment order, edges, groups, lanes; re-checks every edge with `checkConnection` against the grown document (input occupancy cannot be violated because inserted nodes are new; raw cycles cannot appear because fragments are internal); inverse is a batch `[group.remove (new groups), node.remove (new keys)]` and, when lanes were created, `lane.remove`; the effects set `selection` to the inserted nodes so the pasted nodes become selected.
6. `buildDuplicate(doc, deps, keys)`: extract + paste at the selection bounding-box top-left plus offset `(44, 44)` (two grid cells), and repeated duplicates cascade by +44 each time (the builder receives the previous offset count).
7. Labels are kept unchanged on copy (labels need not be unique); keys differ. `ui` flags are copied. Node `config.agentRef` is copied verbatim (the UI layer decides what to do with Agents invisible in the target Workspace, WFED034).
8. Determinism: all new ids come from the `IdSource` instance of the builder; the command contains them so redo is exact.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- Handlers and builders of WFED009..WFED011 for the inverse; `checkConnection` (WFED006); limits (WFED002); safe-JSON semantics from the contract helper `safeJson` if exported (WFRT003) otherwise a local 30-line equivalent with a test (no new dependency).

## 8. Architecture and code placement

Layer: pure `commands/fragment/`. The clipboard I/O lives in WFED034 (React/browser layer). Separation lets the format be unit tested and fuzzed.

## 9. Security and safety

The clipboard is an untrusted channel (any other app or page can place text there, and a malicious Skill or web page could try to inject a workflow). Defences: size cap before parse, prototype-key and depth rejection, strict schema, bounded counts, unknown node types refused, all-or-nothing insert, no execution of anything inside configs, no network. Pasted `agentRef` or `config` may reference things the Owner does not want: the draft is only a draft, and publishing re-validates references server-side (WFRT014). Fuzz and injection tests are part of this task.

## 10. Errors and edge cases

- Paste of 150 nodes into a document with 100: refused whole, message with both numbers.
- Paste text that is valid JSON but a different shape: `not_a_fragment`.
- Fragment whose edges reference a missing node: `invalid`.
- Copy of a selection containing Start only: empty fragment with `skipped`, nothing to paste (the UI shows a note).
- Paste into a document that has a lane with the same key but another name: lane reused, name kept from the target.
- Prototype pollution attempt `{"__proto__":{"x":1}}`: `invalid`.

## 11. Acceptance criteria

- [ ] Given the mock graph, When Developer, QA, Security are copied and pasted, Then 3 new nodes, the internal edges between them and no external edges appear, all selected; undo removes exactly them.
- [ ] Given a 300 KiB clipboard text, Then `parseFragment` returns `too_large` without calling `JSON.parse`.
- [ ] Given 1 000 fuzzed strings (structured and random), `parseFragment` never throws and never returns a partial fragment.
- [ ] Given duplicate pressed 3 times, Then the copies are offset +44, +88, +132 px.
- [ ] Given a paste that would exceed 200 nodes, Then the document is unchanged.

## 12. Test plan

Unit tests, fuzz test with the shared injection corpus (`lib:injection-corpus`, WFRT017) plus a seeded random JSON generator, round-trip `extract -> serialize -> parse -> paste -> undo`, property test (random subgraphs preserve edge count among selected nodes). Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/commands/fragment`.

## 13. Parallelization notes

Needs the handlers of WFED009..WFED011 merged (undo uses them). Parallel with WFED013.

## 14. Open questions and assumptions

- ASSUMPTION: node configs do not embed other node keys in expressions (WFRT015 grammar reads `input.*` of the node itself). If a future node type stores node keys in its config, the type must declare a `keyFields` list in the catalogue so paste can remap them (additive). Until then such a node type is not safe to copy and WFED005 may mark it `copyable: false`.
