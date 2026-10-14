---
id: OVE_WFRT003
title: Define the workflow definition schema (nodes, edges, ports, groups, limits)
area: WFRT
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH008, OVE_ARCH009, OVE_WFRT004]
soft_depends_on: [OVE_WFRT001]
provides: ["contract:WorkflowDefinition", "contract:NodeDef", "contract:EdgeDef", "lib:define-node-config", "lib:definition-canonical"]
needs: ["contract:EntityId", "lib:contract-pipeline", "lib:extension-generators"]
owns: ["packages/contracts/src/workflow/definition/**", "packages/contracts/src/workflow/nodes/index.ts", "packages/contracts/src/workflow/nodes/define-node-config.ts", "packages/domain/src/wfrt/definition/**"]
reads: ["packages/contracts/src/workflow/index.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 14", "SPECIFICATION 16.5"]
adr_refs: [2, 7, 19, 28]
---

# OVE_WFRT003: Define the workflow definition schema (nodes, edges, ports, groups, limits)

## 1. Summary

The JSON document that is a Workflow: `WorkflowDefinition` with nodes, edges, typed ports, input/output contracts, visual groups, Board lanes and global limits. Node-specific `config` schemas are registered one file per node type through `defineNodeConfig`, so adding a node never edits this file.

## 2. Context

The Workflow is an executable program (ADR 0002); the canvas (WFED) only edits and displays this document. The mock (Main view) shows Start, Agent tiles (public/private/TOR tabs), Join, Discussion, a loop frame "Pętla jakości", a Quality Gate diamond, a labelled dashed return edge, "zapisz Decyzje". SPEC 7: typed ports and input/output contracts; conditions operate on structured data. ADR 0007: a Node may override model, prompt and Skills, never permissions.

## 3. Scope (in)

zod schemas, TypeScript types, canonicalisation and hashing helper, schema upgrade hook, `defineNodeConfig`.

## 4. Out of scope

Individual node config schemas (WFRT018 to WFRT029 and P2 tasks). Port value validation (WFRT004). Graph validation rules (WFRT010 to WFRT014). Editor.

## 5. Detailed requirements

1. `WorkflowDefinition` (strict): `schemaVersion: 1`, `nodes: NodeDef[]` (1..200), `edges: EdgeDef[]` (0..600), `inputSchema: PortSchema` (Run input; default `{type:'object', properties:{}}`), `outputSchema?: PortSchema`, `groups?: GroupDef[]`, `lanes?: LaneDef[]`, `limits?: RunLimits`. Encoded size limit 512 KiB (checked by `assertDefinitionSize`).
2. `NodeDef`: `key: NodeKey` (`^[a-z][a-z0-9-]{0,47}$`, unique), `type: NodeType` (string from the registry, e.g. `start`, `end`, `agent`, `parallel`, `join`, `if`, `loop`, `discussion`, `review`, `quality_gate`, `save_decisions`), `label` (1..60), `config: unknown` validated by the registered per-type schema (WFRT005 resolves it), `position: {x,y}` (finite numbers, abs <= 100000), `ui?: { collapsed?: boolean }` (presentation only, ignored by validation and hash? NO: included in the file but excluded from `contentHash`, see 6).
3. `PortRef`: `{ node: NodeKey, port: PortName }`, `PortName` `^[a-z][a-z0-9_]{0,31}$`. `EdgeDef`: `id: EdgeId` (`^e-[a-z0-9-]{1,60}$`, unique), `from: PortRef`, `to: PortRef`, `label?` (max 60, shown on the canvas, for example "nie spełnia → wróć do Developera z raportem"), `kind?: 'flow'|'return'` (presentation hint; the validator derives real back-edges itself, so a `flow` edge that closes a cycle is still an error), `mapping?: Record<string, string>` (target input field -> expression over the source output, evaluated by the safe evaluator, WFRT015 to WFRT017; max 20 entries).
4. `GroupDef`: `{ id, label (max 80), nodeKeys[], kind: 'loop'|'subworkflow'|'lane'|'free', limitLabel? }` — purely visual frames (mock: "Pętla jakości", "limit 90 min · 5 iteracji"); semantics come from Loop nodes, never from groups.
5. `LaneDef`: `{ id: LaneKey, name (max 40), agentRef?: AgentRef, teamRef? }` — Board lanes the Workflow defines (SPEC 6; binding task WFRT029). `AgentRef = { agentId: agt_, pinVersion?: int }`.
6. `RunLimits`: `{ maxDurationMs?, maxCost?: { unit: 'tokens'|'usd', amount }, maxIterationsTotal?, maxEvents? }`; all optional, hard caps from WFRT001 §9 apply when absent.
7. **Canonicalisation:** `canonicalDefinition(def)` returns a deterministic JSON string: keys sorted recursively, arrays of nodes sorted by `key`, edges by `id`, `position` and `ui` stripped, numbers normalised, no insignificant whitespace. `definitionHash(def) = sha256(canonical)`. Two drafts differing only in layout hash equal (publishing an identical graph can be detected).
8. `defineNodeConfig(type, zodSchema)` registers a per-type config schema in a registry module `packages/contracts/src/workflow/nodes/<type>.config.ts` (one file per type, owned by the node's task); the barrel `nodes/registry.generated.ts` is generated (ARCH009). `parseNodeConfig(type, raw)` returns `Result<Config, ValidationIssue[]>`; unknown types give `wfrt.unknown_node_type`.
9. `upgradeDefinition(raw): Result<WorkflowDefinition>`: handles `schemaVersion` < current via registered upgraders (none for v1); `schemaVersion` greater than supported is rejected with `wfrt.definition_from_future` (the engine refuses to run or edit a newer file, fail closed).
10. Strictness: unknown keys anywhere are errors (this is also the first defence against permission fields in `config`, WFRT014). Keys `__proto__`, `constructor`, `prototype` are rejected at any depth by a `safeJson` preprocessing step before zod.
11. Fixtures: `packages/testing/src/builders/definition.builder.ts` is NOT owned here; the golden fixture is WFRT050.

## 6. Design notes

N/A, functionality only. Port positions on the tile (left input, right output) are an editor concern.

## 7. Reuse

`entityId` for `agt_`, `PortSchema` (WFRT004), `defineNodeConfig` is reused by every node task. Canonical JSON helper MUST be a small pure function in `domain/src/wfrt/definition/canonical.ts`; no third-party canonicaliser unless justified in the PR.

## 8. Architecture and code placement

Contracts in `packages/contracts/src/workflow/definition/{definition,node,edge,group,lane,limits}.ts`; pure helpers (canonical, hash, size, safeJson) in `packages/domain/src/wfrt/definition/`. sha256 needs a hash: use a `Hasher` function injected? Hashing is deterministic and pure; use Node `crypto` only in the adapter: define `type Hasher = (s: string) => string` param of `definitionHash`, supplied by application (keeps domain free of Node built-ins).

## 9. Security and safety

A hostile definition (imported file, Chief-generated, forged API call) is parsed with strict schemas, depth and size limits and prototype-key rejection before any use. `mapping` expressions are strings stored as data and are only ever evaluated by the safe evaluator. `config` cannot smuggle permissions because of strict per-type schemas plus WFRT014's deny-list scan. Definition content is never logged; only `contentHash` and counts.

## 10. Errors and edge cases

Duplicate node keys or edge ids are reported by the validator (WFRT011), not by zod (so the editor can show all issues). Empty `nodes` fails (min 1). Edge referencing a missing node parses but fails validation. Extremely deep JSON: depth limit 20 on `config` (preprocessing). NaN/Infinity positions rejected.

## 11. Acceptance criteria

- [ ] A valid definition round-trips parse -> canonical -> parse with the same hash.
- [ ] Layout-only changes keep the hash; a config change changes it.
- [ ] Unknown keys, prototype keys, 201 nodes, 513 KiB payload, and `schemaVersion: 2` are rejected with the specified codes.
- [ ] `defineNodeConfig` registration works from a separate file and is picked up by the generated barrel; duplicate type registration fails the registry test.
- [ ] Types and JSON Schema are emitted by the contract pipeline (ARCH008).

## 12. Test plan

Unit: `definition.test.ts`, `canonical.test.ts` (property test: shuffling nodes/edges/keys keeps hash), `safe-json.test.ts`. Contract snapshot. Command `pnpm vitest run packages/contracts/src/workflow/definition packages/domain/src/wfrt/definition`.

## 13. Parallelization notes

Merge early: WFRT002, 005, 010 and every node task depend on it. After merge nobody edits `definition.ts` (additive proposals only). Node configs go in their own files.

## 14. Open questions and assumptions

- ASSUMPTION: edge `mapping` is the only data-flow wiring; without it the whole source output object becomes the target input (type compatibility enforced by WFRT012).
- ASSUMPTION: `position` is part of the file but excluded from the hash so that moving a tile does not create a "changed" version.

