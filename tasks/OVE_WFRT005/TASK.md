---
id: OVE_WFRT005
title: Define the node type registry, NodeTypeDefinition and NodeHandler interfaces
area: WFRT
kind: contract
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_WFRT003, OVE_WFRT004]
soft_depends_on: [OVE_WFRT001]
provides: ["lib:node-registry", "contract:NodeTypeDefinition", "contract:NodeHandler", "contract:NodeStep", "contract:PortDecl"]
needs: ["lib:result", "contract:AppError", "port:Clock"]
owns: ["packages/domain/src/wfrt/nodes/registry.ts", "packages/domain/src/wfrt/nodes/types.ts", "packages/domain/src/wfrt/nodes/index.ts", "packages/application/src/wfrt/node-handler.ts", "packages/workflow-runtime/src/handlers/registry.ts"]
reads: ["packages/contracts/src/workflow/definition/node.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [2, 7, 19]
---

# OVE_WFRT005: Define the node type registry, NodeTypeDefinition and NodeHandler interfaces

## 1. Summary

The extension point of the workflow engine: each node type is one `NodeTypeDefinition` (static: config schema, ports, validation hooks, idempotency classes) plus one `NodeHandler` (runtime behaviour expressed as intents). The registry resolves both by type. New node types are added by adding files, never by editing a switch.

## 2. Context

SPEC 7 lists MVP nodes and later ones (Switch, Retry/Fallback, Approval, Memory, Subworkflow, Transform, Trigger/Wait, Notification, Model Router). Many agents implement nodes in parallel (WFRT018 to WFRT029 and P2). They need a stable contract first. See WFRT001 §2, §6.

## 3. Scope (in)

Interfaces and types, the registry (register, get, list, duplicate detection), an auto-discovery convention, a conformance test helper `expectNodeConformance(def, handler)`.

## 4. Out of scope

Concrete nodes. The engine that calls handlers (WFRT033, WFRT036). Validation rule runner (WFRT010).

## 5. Detailed requirements

1. `NodeTypeDefinition<C>` (domain, pure): `type: NodeType`; `displayKey` (i18n key for the palette, for example `workflow:node.agent`); `category: 'control'|'agent'|'quality'|'integration'`; `mvp: boolean`; `configSchema: ZodType<C>` (from `defineNodeConfig`, WFRT003); `ports(config: C): { inputs: PortDecl[]; outputs: PortDecl[] }`; `staticRules?: ValidationRule[]` (node-specific rules, same interface as WFRT010); `actions: ActionDecl[]` (the side-effect kinds the handler may request and their idempotency class, WFRT037); `usesAgentSlot: boolean` (counts against the parallelism cap); `defaultConfig(): C`.
2. `PortDecl`: `{ name: PortName, direction: 'in'|'out', schema: PortSchema | 'any_json' , multi?: boolean (accepts several edges, only Join `in` and Loop `continue`), optional?: boolean (input need not be connected), role?: 'control'|'data' }`. `any_json` is allowed only for pass-through ports and is flagged as warning when it feeds a typed port.
3. `NodeHandler<C>` (runtime): `type`; `onActivate(ctx: ActivationContext<C>): Promise<Result<NodeStep, AppError>>`; `onSignal?(ctx, signal: NodeSignal): Promise<Result<NodeStep, AppError>>` for resume after `wait`/`perform`; handlers are stateless: everything needed is in `ctx` (config, input tokens by port, scope, attempt, loop counters, services). Handlers MUST NOT call `Date.now`, random or do I/O except through `ctx.services` ports (`ctx.clock`, `ctx.ids`, and the node-specific port injected via constructor).
4. `ActivationContext<C>`: `{ run: { id, workflowVersionId, workspaceId, dryRun }, execution: { key, nodeKey, scope, attempt, startedAt }, config: C, inputs: Record<PortName, Token[]>, state: NodeLocalState (JSON, persisted by events), now: IsoDateTime, signal: AbortSignal }`.
5. `NodeStep` (discriminated union): `{kind:'complete', emits: Array<{port, payload}>, state?}` | `{kind:'wait', until: WaitSpec, state?}` with `WaitSpec = {kind:'timer', dueAt} | {kind:'tokens', ...} | {kind:'external', ref: ExternalRef, timeoutAt?} | {kind:'approval'}` | `{kind:'perform', action: ActionRequest, state?}` (engine records action.started, performs, calls `onSignal({kind:'action_result'})`) | `{kind:'fail', error: AppError, retryable: boolean}` | `{kind:'skip', reason}`. `ActionRequest = { actionKey (stable within execution, for idempotency), kind: ActionKind, input: JsonValue, idempotency: 'pure'|'idempotent'|'non_idempotent' }`, kind must be declared in `actions`.
6. `NodeSignal`: `action_result {actionKey, outcome}`, `timer_fired`, `tokens_arrived`, `external_resolved {ref, result}`, `branch_resumed`, `cancel_requested` (handler may return cleanup `perform` or `complete`).
7. Registry: `NodeRegistry.register(def, handlerFactory)`; `get(type)`; `list({mvpOnly})`; duplicate type -> startup error `wfrt.node_type_duplicate`; the domain registry holds definitions; the runtime registry (`workflow-runtime/src/handlers/registry.ts`) pairs each type with a handler created from injected services; a boot check asserts every registered definition has a handler and vice versa.
8. Discovery: node types register themselves in `packages/domain/src/wfrt/nodes/<type>/definition.ts` and `packages/workflow-runtime/src/handlers/<type>/handler.ts` (one folder per node, owned by its task); a generated barrel (ARCH009) imports them; no node task edits the registry files.
9. `expectNodeConformance(def, handler)` test helper (in `packages/domain/src/wfrt/nodes/testing.ts`): checks port names unique, schema valid, `defaultConfig` parses with `configSchema`, handler is deterministic for the same context (run twice, deep-equal), handler never reads forbidden globals (runs inside a frozen-globals proxy), every requested action kind is declared.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`defineNodeConfig` (WFRT003), `PortSchema` (WFRT004), `ValidationRule` (WFRT010, referenced as a type only; WFRT010 owns it, so define `staticRules` as `readonly ValidationRule[]` imported from the validation module once merged; until then use a placeholder alias file `validation-rule-ref.ts` replaced by WFRT010).

## 8. Architecture and code placement

Domain: `packages/domain/src/wfrt/nodes/{types,registry}.ts` (no I/O). Application: `packages/application/src/wfrt/node-handler.ts` holds the handler-facing types needing application ports (`ActionRequest` uses contracts only). Runtime: `packages/workflow-runtime/src/handlers/registry.ts`. Dependency direction: runtime -> application -> domain -> contracts.

## 9. Security and safety

Handlers receive `inputs` that may contain untrusted Agent output: the context marks tokens `trust: 'untrusted'`; control-flow handlers may only read fields declared in the port schema. The conformance helper's frozen-globals proxy makes handlers that read the clock or environment directly fail tests. `perform` requests are the only way to cause side effects, so the engine can record intent before effect (crash safety, WFRT037).

## 10. Errors and edge cases

Handler throws: engine converts to `fail` with `internal.unexpected` and logs; nodes must return `Result`. Handler returns an emit on an undeclared port: engine rejects as `wfrt.handler_contract_violation` (node fails, not retried). `perform` with an undeclared action kind: same.

## 11. Acceptance criteria

- [ ] Types compile and a sample no-op node registers and passes `expectNodeConformance`.
- [ ] Duplicate registration, missing handler and missing definition are detected at boot.
- [ ] Discovery works from a separate folder without editing registry files.
- [ ] Handler determinism test fails for a handler that calls `Date.now`.

## 12. Test plan

`registry.test.ts`, `conformance.test.ts` with deliberately bad sample handlers; type-level tests (`expectTypeOf`). Command `pnpm vitest run packages/domain/src/wfrt/nodes packages/workflow-runtime/src/handlers`.

## 13. Parallelization notes

Critical path: merge before any node task starts coding (they can read the draft). Node tasks only add folders. Hotspot: `types.ts` (changes through proposals).

## 14. Open questions and assumptions

- ASSUMPTION: handlers are request/response state machines (no long-lived async function) so recovery can re-create them from persisted state.
- ASSUMPTION: node-local state is small JSON (max 64 KiB) stored in the event that changes it.

