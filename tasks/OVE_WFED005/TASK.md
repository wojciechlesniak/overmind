---
id: OVE_WFED005
title: "Model the node-type catalogue: port templates, defaults, palette metadata, port resolution"
area: WFED
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_WFED002, OVE_WFRT004, OVE_WFRT048]
soft_depends_on: []
provides: ["lib:editor-node-catalog"]
needs: ["lib:editor-document-model", "contract:PortSchema", "contract:NodeTypeCatalog", "api:workflows.node-types", "lib:result"]
owns: ["apps/desktop/src/features/workflow-editor/catalog/types.ts", "apps/desktop/src/features/workflow-editor/catalog/resolve-ports.ts", "apps/desktop/src/features/workflow-editor/catalog/catalog.ts", "apps/desktop/src/features/workflow-editor/catalog/later-nodes.ts", "apps/desktop/src/features/workflow-editor/catalog/*.test.ts", "apps/desktop/src/features/workflow-editor/testing/catalog.fixture.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED005: Model the node-type catalogue: port templates, defaults, palette metadata, port resolution

## 1. Summary

Defines what the editor knows about each node type (`NodeTypeInfo`), parses the catalogue the engine serves, and resolves the concrete ports of a node from its type and config. This keeps the editor free of a switch over node types (OCP): a new node type in the engine appears in the palette and on the canvas without editing the editor.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. In the engine each node type is a `NodeTypeDefinition` (WFRT005) with `ports(config)`, `defaultConfig()`, `mvp`, `category`, `displayKey` and the flag `allowsReturnEdges`. The desktop UI cannot import the domain (CONVENTIONS 6), and `ports(config)` is a function, so the engine must serve a serialisable form. The workflow gateway routes (`api:workflows.*`) and the `lib:api-client-workflows` client are referred to by the WFRT tasks (WFRT047) but no WFRT task that provides them exists yet; this task uses the capability names listed in `needs` and the linker must create an owner (see section 14). MVP catalogue (ADR 0024): Start, End, Agent, Parallel, Join, IF, Loop, Discussion, Review (plus Quality Gate and Save Decisions shown in the mock). Later (SPEC 7): Switch, Retry/Fallback, Approval, Memory Read/Write, Subworkflow, Transform, Trigger/Wait, Notification, Model Router.

## 3. Scope (in)

- `NodeTypeInfo` and `PortTemplate` types and their zod schema for parsing the response.
- `resolvePorts(info, node, doc)` returning concrete `ResolvedPort[]`.
- `defaultConfigFor(type)` deep-cloned.
- `LATER_NODE_TYPES` static list for disabled palette entries.
- Fixture catalogue with the MVP node types and their ports as listed below.

## 4. Out of scope

- Fetching the catalogue (WFED018 gateway).
- Palette UI (WFED030).
- The server route itself (gap, linker).

## 5. Detailed requirements

1. ```ts
export interface PortTemplate {
  readonly name: PortName; readonly direction: "in" | "out";
  readonly role: "control" | "data"; readonly multi?: boolean; readonly optional?: boolean; readonly required?: boolean;
  readonly schemaFrom: "workflowInput" | "passthrough" | "any_json" | { config: string } /* JSON pointer, e.g. "/outputSchema" */ | { literal: JsonObject };
  readonly returnPort?: boolean;           // sanctioned return edge target (Loop continue)
  readonly labelKey?: string;              // i18n key for the port tooltip (then/else, pass/fail)
}
export interface DynamicPorts { readonly direction: "out"; readonly configPointer: string; readonly nameField: string; readonly labelField?: string; readonly schemaFrom: "passthrough" }
export interface NodeTypeInfo {
  readonly type: string; readonly displayKey: string; readonly category: "control" | "agent" | "quality" | "integration";
  readonly mvp: boolean; readonly addable: boolean;         // false for start
  readonly maxPerWorkflow?: number;                          // start: 1
  readonly usesAgent: boolean;                               // agent, review, discussion participants: has agentRef
  readonly defaultConfig: JsonObject;
  readonly ports: readonly PortTemplate[]; readonly dynamicPorts?: DynamicPorts;   // parallel branches
  readonly allowsReturnEdges?: boolean; readonly loopPorts?: { body: PortName; continue: PortName; exhausted: PortName };
}
export interface NodeTypeCatalog { readonly version: string; readonly types: readonly NodeTypeInfo[] }
export interface ResolvedPort extends PortTemplate { readonly schema: JsonObject | "any_json" }
```
2. Expected ports of the MVP types (fixture and conformance table; the engine tasks are authoritative, this is the editor assumption): `start`: out `out`; `end`: in `in` required; `agent`: in `in`, out `result` (schema from `/outputSchema`, else `{text:string}`); `parallel`: in `in`, outs from `/branches[].port`; `join`: in `in` multi, out `out`; `if`: in `in`, outs `then` and `else` both required; `loop`: ins `enter` and `continue` (multi, returnPort), outs `body` and `exhausted` (required); `quality_gate`: in `in`, outs `pass` and `fail`; `discussion`: in `in`, out `result`; `review`: in `in`, outs `approved` and `changes_requested`; `save_decisions`: in `in`, out `out`.
3. `resolvePorts(info, node, doc)`: static templates plus dynamic ports from `node.config` at `configPointer` (array of objects, `nameField` must match `^[a-z][a-z0-9_]{0,31}$`, invalid entries skipped, max 16); resolves `schemaFrom` (`workflowInput` -> `doc.meta.inputSchema`; `{config}` -> JSON pointer lookup with fallback `any_json` when absent; `passthrough` -> the schema of the incoming edge when the node has exactly one incoming edge, else `any_json`). Result order: inputs first, then outputs, in template order (stable port order drives the canvas port stacking). Pure and memoised by (node identity, config identity).
4. `isReturnPort(catalog)(ref, doc)` helper returned by `createCatalogQueries(catalog)` together with `portOf(ref, doc)`, `typeInfo(type)`, `defaultConfigFor(type)`, `loopPortsOf(type)`. These are what graph queries and connection rules receive.
5. Parsing: `parseCatalog(raw): Result<NodeTypeCatalog, CatalogError>` with a strict zod schema; unknown extra keys ignored (additive evolution, herdr pattern), unknown `schemaFrom` shapes make that ONE type unusable (marked `unavailable`, shown disabled in the palette with reason `wfc.palette.unsupported`), the rest keeps working. Types with duplicate `type` ids: the first wins, a warning is logged.
6. `LATER_NODE_TYPES`: `switch`, `retry_fallback`, `approval`, `memory_read`, `memory_write`, `subworkflow`, `transform`, `trigger_wait`, `notification`, `model_router` with i18n display keys; the palette lists those that the catalogue does not contain as disabled entries (WFED030).
7. Unknown node type found in a loaded draft (not in the catalogue): the node is kept untouched, rendered with the generic tile and the tab `NIEZNANY WĘZEŁ` (`wfc.node.unknown`), ports resolve to none; commands on it are limited to move and delete (never edit `config` of a type we do not understand).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `PortSchema` type from contracts for `ResolvedPort.schema`. `Result` from `lib:result`.
- No copy of engine port logic: this file is a thin interpreter of a declarative template. If the engine cannot export templates, the fallback is a proposal for a catalogue route returning resolved ports per node (see open questions).

## 8. Architecture and code placement

Layer: pure `catalog/` (parse and resolve). Fetching is in `gateway/` (WFED018). Consumers: rules (WFED006), mappers (WFED015), palette (WFED030), commands (default config on add).

## 9. Security and safety

The catalogue is data from the local engine, still treated as untrusted: strict parse, bounded sizes (200 types, 40 ports per type), JSON pointers are resolved by a safe helper that rejects `__proto__` segments. The editor never executes anything from the catalogue.

## 10. Errors and edge cases

- Catalogue fetch fails: the editor opens read-only with the Fixture-free error state from WFED020 (no guessing of ports).
- A type with `dynamicPorts` whose config array is missing: no dynamic ports, one warning.
- `schemaFrom` pointer resolves to a non object: `any_json`.
- Duplicate dynamic port names: the second is dropped.

## 11. Acceptance criteria

- [ ] Given the fixture catalogue and an Agent node with `outputSchema`, `resolvePorts` returns `result` with that schema; without it, the default `{text}` schema.
- [ ] Given a Parallel node with 3 branches, 3 out ports in order plus `in`.
- [ ] Given a catalogue entry with an unknown `schemaFrom`, only that type is `unavailable`.
- [ ] Given an unknown node type in a document, `portOf` returns `undefined` and nothing throws.

## 12. Test plan

Unit tests with the fixture (`catalog.fixture.ts` mirrors the table in requirement 2) and a contract test that parses a sample JSON captured from the contract schema once `contract:NodeTypeCatalog` exists. Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/catalog`.

## 13. Parallelization notes

Parallel with WFED003 and WFED004. Blocks WFED006, WFED015, WFED030.

## 14. Open questions and assumptions

- GAP for the linker: nobody provides `api:workflows.node-types` / `contract:NodeTypeCatalog`. Requested shape is the declarative `NodeTypeInfo` above; the domain `NodeTypeDefinition` (WFRT005) needs an additive serialisable `portTemplate` next to `ports(config)`.
- OPEN: whether the engine can compute resolved ports for a node instead (a POST route). Default chosen: declarative templates, because connection checks must be synchronous.
- ASSUMPTION: Review and Discussion nodes (WFRT024/025 not yet written) follow the table above; adjust the fixture when they land.
