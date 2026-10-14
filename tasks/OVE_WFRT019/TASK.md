---
id: OVE_WFRT019
title: Implement the Agent node with structured output, prompt assembly and overrides
area: WFRT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_SEC004, OVE_WFRT004, OVE_WFRT005]
soft_depends_on: [OVE_WFRT014]
provides: ["node:agent", "port:AgentTurnRunner", "lib:agent-turn-step"]
needs: ["lib:prompt-assembly", "lib:untrusted-text", "lib:result"]
owns: ["packages/contracts/src/workflow/nodes/agent.config.ts", "packages/domain/src/wfrt/nodes/agent/**", "packages/workflow-runtime/src/handlers/agent/**", "packages/application/src/ports/AgentTurnRunner.ts"]
reads: ["packages/application/src/security/prompt-assembly/prompt-assembler.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 7", "SPECIFICATION 9", "SPECIFICATION 15"]
adr_refs: [7, 22, 26, 28]
---

# OVE_WFRT019: Implement the Agent node with structured output, prompt assembly and overrides

## 1. Summary

The main work node: run one turn of a configured Agent with a prompt built from the node template and the incoming data, require structured output validated against a schema, apply model/prompt/Skill overrides (never permissions), and report usage. The Agent is invoked through a consumer-side port `AgentTurnRunner` (implemented by the AGENT/PROV areas on top of herdr and the CLIs).

## 2. Context

Canvas tiles for Product Owner, Designer, Developer, QA, Security, Senior Reviewer (mock) are Agent nodes; the tile pill shows Agent avatar and model, the tabs show visibility/TOR and Skill count. ADR 0007: a Node may override model, prompt and Skills but not permissions; ADR 0026: herdr Agent State is a hint, the Task proceeds only after real effect/report is verified; SEC004: Agent output is untrusted; decisions depend only on validated structured fields. SPEC 15: record Agent/Skill/model versions per Run.

## 3. Scope (in)

Config schema, definition (ports, expression sites none), handler, `AgentTurnRunner` port, shared helper `runAgentTurnStep` reused by Review (WFRT025), output parsing and repair, dry-run output.

## 4. Out of scope

The adapter implementing `AgentTurnRunner` (AGENT/PROV/BOX). Effective permissions (WFRT036). Retry/backoff and dead-letter (WFRT038). Parallelism slots (WFRT034). Lane binding (WFRT029).

## 5. Detailed requirements

1. **Config (strict):** `agentRef: { agentId, pinVersion? }`; `promptTemplate: string` (<= 8 000; placeholders `{{input.<path>}}` only; path must exist in the input schema, checked by `agent.prompt_placeholder` rule); `inputSchema?: PortSchema`; `outputSchema?: PortSchema`; `overrides?: { model?: {providerId, modelId, fallback?}, prompt?: string (<= 8 000, appended as node instructions), skills?: { add: SkillRef[], remove: SkillId[] } }` (allow-list, WFRT014); `timeoutMs` (default 1 800 000, cap 14 400 000); `retry?: { maxRetries (0..5, default 2), baseDelayMs (default 5000), factor (default 2), maxDelayMs (default 300000) }`; `onOutputInvalid: 'repair_once'|'fail'` (default `repair_once`); `lane?: LaneKey` (semantics WFRT029); `artifacts?: { kinds: ArtifactKind[] }` (expected produced Artifact kinds, for example `test_report`).
2. **Ports:** in `in` (schema `inputSchema` or `any_json`); out `result` (schema `outputSchema` or the default `{ text: string<=65536 }`).
3. **Prompt assembly:** the handler never concatenates strings itself. It calls the SEC004 `PromptAssembler` with segments: system (Agent instructions and pinned Skills resolved by AGENT, trust `owner`), node prompt template (trust `owner`), input values (trust `untrusted`, fenced with per-call random nonce), output-contract instruction (the JSON Schema from `toJsonSchema(outputSchema)` and the required answer format). Required answer format (ASSUMPTION, agreed with the `overmind` Skill, ADR 0027): the final message contains exactly one fenced block ```` ```json overmind-result ```` with the JSON value; anything outside the block is ignored as commentary.
4. **Action:** `perform { kind: 'agent.run_turn', idempotency: 'non_idempotent', actionKey: 'turn-<attempt>' }`. The driver calls `AgentTurnRunner.run(req): Promise<Result<AgentTurnHandle, AppError>>` with `req = { runId, executionKey, workspaceId, agentId, pinned: {agentVersion, skills, providerId, modelId}, prompt: AssembledPrompt (opaque), expectJson: boolean, timeoutMs, permissionsRef (EffectivePermissions handle from WFRT036), idempotencyKey }`. `AgentTurnHandle = { turnId, events: AsyncIterable<AgentTurnEvent>, cancel(): Promise<void> }`, `AgentTurnEvent = state(working|waiting_approval|login_required|idle) | usage(tokens, usd?) | artifact(artifactId, kind) | completed(finalText) | failed(code, retryable) | limit_reached(resetAt?)`. Port contract suite lives in `packages/testing` (WFRT049).
5. **Signals -> node status:** `waiting_approval` -> `wait {kind:'approval'}` (amber state; the Approval itself is created by PERM/BOX), `login_required` and `limit_reached` -> fallback model if configured (`overrides.model.fallback`, PROV), else `fail` retryable=false with code `wfrt.agent_unavailable` (Escalation by WFRT040). `completed` -> parse.
6. **Output handling:** `parseJsonStrict(block, 262144)` (WFRT004) then `validateValue(outputSchema, value)`. On violation and `repair_once`: one more turn in the same session with a repair prompt that names only violation codes and JSON pointers (no values) and counts as the same attempt (action key `turn-<attempt>-repair`); second failure -> `fail` with `wfrt.agent_output_invalid` (retryable false, schema violations summarised). Valid -> `complete` emits `result` token with `trust: 'untrusted'`.
7. **Overrides:** applied by `PinnedConfigResolver` (WFRT035) when resolving the pinned model/Skills; the handler only forwards `overrides`. A node never changes the Agent's `permissionProfileId`; the strict schema and WFRT014 forbid it.
8. **Evidence rule:** Agent text such as "tests passed" is data. The handler records produced Artifacts reported by the runner with provenance `agent_written` unless the runner marks them `tool_output` (set only by the tool broker, never by the handler).
9. **Dry-run (WFRT044):** the handler returns `exampleValue(outputSchema)` without calling the port (deterministic example generator in `packages/domain/src/wfrt/port-schema/example.ts`, owned by this task).
10. **Usage:** `usage` events are summed into `node.succeeded.usage` and `budget_updated` (WFRT039).
11. `expressionSites`: none. Static rules: `agent.prompt_placeholder`, `agent.timeout_range`, `agent.output_contract_required_for_control_flow` (see WFRT012 for the port-level one; here only the config-level check).

## 6. Design notes

N/A, functionality only. (Tile content is WFED/DS.)

## 7. Reuse

`PromptAssembler`, `UntrustedText` (SEC004), `parseJsonStrict`, `validateValue`, `toJsonSchema` (WFRT004), registry (WFRT005). Review (WFRT025) MUST reuse `runAgentTurnStep`; do not copy.

## 8. Architecture and code placement

Port: `packages/application/src/ports/AgentTurnRunner.ts` (interface + token + types). Domain definition: `packages/domain/src/wfrt/nodes/agent/definition.ts`. Handler: `packages/workflow-runtime/src/handlers/agent/{handler.ts,agent-turn-step.ts,output-parser.ts}`. The handler depends only on the port and ports of SEC004 (via application).

## 9. Security and safety

Output is untrusted: only validated fields influence anything. No raw CLI output is stored in errors (`safeMessage` from codes). The prompt is not logged at info or above. Non-idempotent `agent.run_turn` is never re-sent after a crash without a decision (WFRT037): the herdr session may already have received it (prototype fact). The repair prompt contains no content from the faulty output. Node prompt overrides cannot weaken Owner Rules since Rules are injected by the assembler as a higher-priority segment.

## 10. Errors and edge cases

Final text without the fenced block: treated as invalid output (repair once). Two fenced blocks: invalid. JSON valid but extra properties: violation `unknown_property`. Runner returns `completed` after cancel: ignored (node already cancelled). Output > 256 KiB: `wfrt.agent_output_too_large`. Agent deleted between publish and run: `ref.agent_unknown` re-check at StartRun (WFRT035) fails the Run start.

## 11. Acceptance criteria

- [ ] Valid output yields a `result` token with untrusted trust and validated shape.
- [ ] Invalid output triggers exactly one repair turn then fails with the stated code.
- [ ] `waiting_approval` produces a `wait` with kind approval; completion resumes.
- [ ] Dry-run does not call the port and returns schema-conforming example output.
- [ ] Prompt contains no unfenced input data (checked via assembler fake).
- [ ] Conformance helper passes; no permission fields accepted.

## 12. Test plan

Unit: handler with `ScriptedAgentTurnRunner` fake (WFRT049), parser tests with hostile outputs (prototype keys, duplicate keys, 1 MB text), repair flow, override passthrough. Command `pnpm vitest run packages/workflow-runtime/src/handlers/agent packages/domain/src/wfrt/nodes/agent`.

## 13. Parallelization notes

Parallel with other nodes. WFRT025 depends on this task's helper. The adapter side (AGENT/PROV) can start from the port file.

## 14. Open questions and assumptions

- ASSUMPTION: the `overmind-result` fenced block convention is taught by the `overmind` Skill (SKILL area must include it).
- ASSUMPTION: one repair turn is allowed per attempt.

