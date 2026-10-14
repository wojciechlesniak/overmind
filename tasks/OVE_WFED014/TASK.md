---
id: OVE_WFED014
title: "Derive tile descriptors: visibility, TOR and DISCUSSION tabs, Skills count and model pill"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS087, OVE_VIS001, OVE_WFED002, OVE_WFED005]
soft_depends_on: []
provides: ["lib:editor-node-descriptor", "lib:editor-agent-info"]
needs: ["lib:editor-document-model", "lib:editor-node-catalog", "contract:Visibility", "ui:CanvasModel"]
owns: ["apps/desktop/src/features/workflow-editor/mappers/describe-node.ts", "apps/desktop/src/features/workflow-editor/mappers/avatar.ts", "apps/desktop/src/features/workflow-editor/mappers/agent-info.ts", "apps/desktop/src/features/workflow-editor/mappers/describe-node.test.ts", "apps/desktop/src/features/workflow-editor/mappers/avatar.test.ts"]
reads: []
design: design.png
design_source: "Main#canvas/node-type-tab (crop 395,425,200,130 CSS px); extra: TOR tiles (360,740,380,150)"
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED014: Derive tile descriptors: visibility, TOR and DISCUSSION tabs, Skills count and model pill

## 1. Summary

A pure function that turns one document node plus what is known about its Agent into a descriptor of how the tile looks: which kit node kind, the word on the type tab (PUBLICZNY, PRYWATNY, TOR · BUILD, DYSKUSJA · GRILL-ME), the Skills count, the model pill, and whether the tile accepts Skill drops. This is the "Visibility tab on tiles" rule in one place.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. ADR 0028: the tab shows Visibility (PUBLICZNY / PRYWATNY); a node bound to a Board Lane shows TOR; a Discussion node shows DYSKUSJA. Visibility is ALWAYS a word, never colour alone (styl-wizualny, VIEWS rules). The mock (`design.png`): "PUBLICZNY" blue on Product Owner and Designer, "PRYWATNY" violet on Security, "TOR · BUILD", "TOR · QA", "TOR · REVIEW" mint, "DYSKUSJA · GRILL-ME" lavender; Skills tab "2 skille", "1 skill"; model pill with avatar initials and model name ("Sonnet 5.5", "gpt-5.5", "Opus 5.5"). The kit tile props are `tabLabel`, `kind`, `skills`, `model`, `stack` (DS088).

## 3. Scope (in)

- `AgentInfo` type (what the editor knows about an Agent) and `avatarFor(name, id)` for initials and hue.
- `describeNode(node, ctx): NodeDescriptor`.
- The precedence rules of the type tab.
- Skill count arithmetic including node overrides.

## 4. Out of scope

- Loading Agents (WFED023).
- Formatting strings with plurals and building the full CanvasModel (WFED015).
- Run state and status text (PART 2 passes `runtime` input).
- Inspector visibility selector (PART 2).

## 5. Detailed requirements

1. ```ts
interface AgentInfo { id: string; name: string; found: true; visibility: "public" | "private"; ownerWorkspaceId?: string; providerId: string; modelId: string; modelLabel: string; skillIds: readonly string[]; currentVersion: number; archived: boolean }
type AgentLookup = { found: false; id: string } | AgentInfo
interface DescribeContext { catalog: CatalogQueries; agent(id: string): AgentLookup | "loading" | undefined; lanes: Readonly<Record<LaneKey, EditorLane>>; mode: "view" | "edit"; discussionSkillName?: (node: EditorNode) => string | undefined }
interface NodeDescriptor {
  kind: NodeKind;                       // kit kind (DS087 model)
  tab: { kind: "visibility-public" | "visibility-private" | "lane" | "discussion" | "none" | "attention"; text: string | null /* i18n-free raw parts */; parts: { word: "PUBLIC" | "PRIVATE" | "LANE" | "DISCUSSION" | "PICK_AGENT" | "AGENT_MISSING" | "UNKNOWN_NODE"; detail?: string } };
  titleOverride?: string; icon?: IconName;
  skills?: { count: number; fromAgent: number; added: number; removed: number };
  model?: { label: string; initials: string; hue: AgentHue; overridden: boolean };
  acceptsSkills: boolean; targetAgentId?: string;
  statusKey?: string; stack: 0 | 1 | 2;
  attention?: "no_agent" | "agent_missing" | "agent_archived" | "unknown_type";
}
```
2. Kit kind per node type (single table `KIND_BY_TYPE`, OCP: a type absent from the table falls back to `agent-private`-styled generic with attention `unknown_type`): `start` -> `start`; `end` -> `save-decisions` (ASSUMPTION: the kit has no End kind, the pill is reused; see section 14); `save_decisions` -> `save-decisions`; `join` -> `join`; `quality_gate` -> `quality-gate`; `if` -> `if`; `loop` -> `loop`; `parallel` -> `parallel`; `discussion` -> `discussion`; `agent` and `review` (with an Agent) -> tile kinds below; `review` without `agentRef` -> `review` operator node.
3. Tab precedence for tiles that use an Agent (`usesAgent`): (1) a Lane is bound and exists -> kind `lane-build` | `lane-qa` | `lane-review` chosen by the lane NAME lower-cased (contains `build`, `qa`, `review`; anything else -> `lane-build`), tab word `TOR`, detail = lane name upper-cased (`TOR · BUILD`; `parts.word = "LANE"`); (2) no Lane, Agent found -> `agent-public` with `PUBLICZNY` when `visibility === "public"`, `agent-private` with `PRYWATNY` when private; (3) no `agentRef` -> kind `discussion`-neutral styling with the attention tab `WYBIERZ AGENTA` (`PICK_AGENT`), status "wybierz Agenta w Inspektorze"; (4) `agentRef` set but the Agent is not found in this Workspace (deleted, or private in another Workspace per ADR 0028) -> attention tab `AGENT NIEDOSTĘPNY` (`AGENT_MISSING`), error styling hint; (5) Agent archived -> visibility tab plus attention `agent_archived`. While the directory is still loading (`"loading"`): no tab word change, `statusKey: "loading"` (never flash the attention tab).
4. Where the visibility word and the lane word conflict: the mock shows TOR tiles WITHOUT the visibility word (the Lane wins the tab). The visibility of the Agent remains visible in the Inspector (PART 2) and in the tile `aria-label`; the descriptor therefore also returns `parts.detail2 = "PUBLICZNY" | "PRYWATNY"` for the accessible name (`TOR · BUILD, agent publiczny`). Visibility is never conveyed by colour alone.
5. Discussion tiles: tab `DYSKUSJA` plus ` · <SKILL NAME UPPER>` when a Skill name resolves (`discussionSkillName(node)`, the accessor `getDiscussionSkillRef` lives in `node-fields.ts`; ASSUMPTION: the Discussion config carries `skills: [{ skillId }]` and the first Skill names the Discussion style, mock "GRILL-ME"). No Skills tab on Discussion in the mock: `acceptsSkills = false` for Discussion in MVP.
6. Skills count: `fromAgent = agent.skillIds.length`, `added = overrides.add.length`, `removed = overrides.remove.length` (ids that are present in the Agent list), `count = fromAgent + added - removed` clamped >= 0 (WFRT019 node overrides). `acceptsSkills` is true for Agent-backed tiles in BOTH `edit` and `view` mode when an Agent is found and not archived (a Skill drop changes the Agent, not the draft: the mock shows the drop target on the published v7 view); `targetAgentId` is that Agent id (a Skill dropped on the tile is ALWAYS assigned to the Agent, never to the node: ADR 0012, ADR 0028 and SPEC 8, assignment is permanent across Workflows; node overrides are an Inspector feature of PART 2).
7. Model pill: `overrides.model` of the node wins (`overridden: true`, label `modelId`), otherwise the Agent model; `initials` and `hue` from `avatarFor(name, id)`: initials = first letter of up to two words (`Product Owner` -> `PO`), for a single word the first letter upper + second lower (`Designer` -> `Ds`, `Developer` -> `Dv`, `QA` -> `QA`), `hue` = stable hash of the id modulo the kit `AgentHue` palette size. Same Agent always gets the same colour on every tile and in the strip (PART 2 reuses `avatarFor`).
8. `stack`: 2 for Agent/lane/discussion tiles (as in the mock; inventory E15 recommends stacking only in loops: the constant `DEFAULT_STACK = 2` is one place to change), 0 for operator nodes.
9. Pure and memoisable: the output depends only on the arguments; the canvas mapper (WFED015) caches it per (node identity, agent info identity, lane identity).

## 6. Design notes

What `design.png` shows: the Product Owner tile: filled blue type tab `PUBLICZNY` (top-left, 64x14.6 px at -13 px), outlined Skills tab `2 skille` (top-right), input and output ports, avatar plus `Sonnet 5.5` pill overlapping the bottom edge. `design-lane.png`: mint `TOR · BUILD` and `TOR · QA`, selected Developer (violet 4 px ring), QA working glow (state styling is PART 2 / runtime input). Tab copy and tones come from the kit (`NodeTab`, DS088); this task only decides WHICH word. Tokens: `--om-node-public`, `--om-node-private`, `--om-node-lane`, `--om-node-discussion`. States not in the mock: attention tabs `WYBIERZ AGENTA` and `AGENT NIEDOSTĘPNY` (derive: amber attention tone from `ui:CalloutAmber` colours, word always present), `NIEZNANY WĘZEŁ`. Copy keys (`wfc-canvas`, owner WFED024): `tab.public` PUBLICZNY, `tab.private` PRYWATNY, `tab.lane` TOR, `tab.discussion` DYSKUSJA, `tab.pickAgent` WYBIERZ AGENTA, `tab.agentMissing` AGENT NIEDOSTĘPNY, `tab.unknownNode` NIEZNANY WĘZEŁ.

## 7. Reuse

- Kit types `NodeKind`, `AgentHue`, `IconName` (type-only, `ui:CanvasModel`, `ui:Avatar`), `Visibility` contract values, accessors of WFED002, catalogue queries of WFED005. Does not render anything.

## 8. Architecture and code placement

Layer: pure `mappers/` (type-only ui-kit imports allowed here, WFED001). Consumed by WFED015 (canvas mapper), WFED040 (drop rules) and PART 2 (Inspector header).

## 9. Security and safety

The descriptor must never hide a security-relevant fact: a private Agent is labelled PRYWATNY even when the lane tab wins (it stays in the accessible name and Inspector). Agent and Skill names are untrusted display text: the descriptor passes them through unchanged and the mapper clamps lengths; no HTML. Visibility rules are computed by the server (ADR 0028); the descriptor only displays what the directory says.

## 10. Errors and edge cases

- Agent renamed to emoji only: initials fall back to the first code point, hue by id.
- Lane bound but the lane was deleted: treated as no lane (tab falls back to visibility), attention note `lane_missing` in the descriptor.
- Review node without `agentRef`: operator node, no tab word.
- Skills count negative after overrides: 0.
- Discussion without a Skill: tab `DYSKUSJA` only.
- View mode: tiles are not draggable but `acceptsSkills` stays true for Agent tiles (Skill assignment edits the Agent, WFED043).

## 11. Acceptance criteria

- [ ] Given Product Owner (public Agent, 2 Skills), no lane, Then kind `agent-public`, tab PUBLICZNY, skills count 2, initials `PO`, model `Sonnet 5.5`.
- [ ] Given Security (private Agent) in a view without lane, Then `agent-private` and PRYWATNY.
- [ ] Given Developer bound to lane "Build", Then `lane-build`, tab `TOR · BUILD`, accessible detail includes the Agent visibility word.
- [ ] Given a node of type `foo`, Then attention `unknown_type` and the tab word `NIEZNANY WĘZEŁ`.
- [ ] Given `agent("x") === "loading"`, Then no attention tab is produced.
- [ ] Given overrides add 1 remove 1, Then count equals the Agent count.

## 12. Test plan

Table-driven unit tests covering every branch of the precedence list and the avatar rules; snapshot of descriptors for the mock graph. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/mappers/describe-node src/features/workflow-editor/mappers/avatar`.

## 13. Parallelization notes

Parallel with WFED013. WFED015 and WFED023 depend on it (type `AgentInfo`).

## 14. Open questions and assumptions

- ASSUMPTION: the kit has no `end` node kind, so End renders as the pill `save-decisions` with the node label; request an `end` kind from DS (proposal), the table `KIND_BY_TYPE` is the single place to change.
- ASSUMPTION: Discussion config exposes its Skill list (WFRT026 is not written yet); if not, the tab shows `DYSKUSJA` only.
- OPEN (Owner): for a tile in a Lane the visibility word is not on the tab (as in the mock); confirm that this is acceptable or show both words.
