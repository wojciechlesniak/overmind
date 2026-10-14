---
id: OVE_CHIEF016
title: Implement the command-versus-Rules gate that names the Rule to change
area: CHIEF
kind: security
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF002, OVE_CHIEF004, OVE_CHIEF005, OVE_CHIEF006, OVE_DATA014, OVE_SEC004]
soft_depends_on: [OVE_CHAT010]
provides: ["usecase:CheckCommandAgainstRules", "adapter:DirectCommandGateImpl"]
needs: ["port:OwnerRuleRepository", "port:ChiefModel", "lib:prompt-assembly", "port:ProjectDocReader"]
owns: ["packages/application/src/chief/rules-gate/**"]
reads: ["packages/domain/src/chief/precedence/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 16.10"]
adr_refs: [23, 16, 3]
---

# OVE_CHIEF016: Implement the command-versus-Rules gate that names the Rule to change

## 1. Summary

Decide, before a direct command reaches an Agent, whether it violates an Owner Rule and which one, so the refusal can name the Rule the Owner must change. Classification by a model returns typed facts; the verdict is computed by the deterministic precedence resolver, never by free text.

## 2. Context

SPEC 3 and ADR 0023: a command contradicting an Owner Rule, or changing scope, requires changing the Rule or the Documentation (ADR 0016); the Agent does not do it silently. Mock: "Also disable the penetration test" gets "I cannot do that. Your Rule R2 requires a penetration test after each Task, and a Rule cannot be bypassed by a command in chat" plus the Rule card. CHAT010 calls this use case through `DirectCommandGate` and fails closed on errors.

## 3. Scope (in)

- `CheckCommandAgainstRules({ text, agentId, workspaceId, trust })` -> `allow | refuse(ruleIds[], reason) | clarify`.
- Typed classification prompt: the model extracts `CandidateEffect[]` (CHIEF002) from the command text.
- Deterministic evaluation with `detectConflicts` over the effective guidance, plus scope-change detection against Documentation locations.

## 4. Out of scope

- Delivery and refusal messages: CHAT010. Rule storage: DATA. Plan updates after allowed commands: CHIEF017.

## 5. Detailed requirements

1. Fast paths without a model: no Owner Rules (global or Workspace) -> `allow`; command shorter than 3 words and matching a small allow-list of conversational forms ("thanks", "ok", "continue", "stop", "pause") -> `allow`. Everything else with Rules present goes to classification.
2. Classification prompt via `PromptAssembler`: trusted instructions (the classifier role, closed `subject` vocabulary and `operation` enum from CHIEF002, the Owner Rules with their subject keys, output schema); the command text is passed as owner text in its own section (it is the Owner's own message, trust `owner` or `owner_remote`), and any pasted file content the Owner included stays within the same message but is flagged unknown; the model is told to label uncertain parts as `ambiguous`. Output: `{ effects: CandidateEffect[], scopeChange: boolean, ambiguous: boolean }`, parsed strictly (SEC004), max 10 effects.
3. Evaluation: `detectConflicts(effects, effectiveGuidanceFor(workspace, agent))`; any `blocking` conflict -> `refuse(ruleIds)` with the primary Rule (highest rank, lowest ordinal) as the one to name; `scopeChange === true` -> `refuse(reason: 'scope_change')` naming the Documentation location resolved by `lookupDocLocation(subject)` when available, else without location; `ambiguous === true` -> `clarify` (CHAT010 treats it as not delivered, asks the Owner to rephrase).
4. Rule version binding: the verdict includes `rulesVersionHash` (hash of ids and versions of the Rules considered); CHAT010 recomputes if Rules changed.
5. Telegram: same evaluation; no weaker path; refusal text identical in content.
6. Timeouts: model call 15 s; error or timeout -> `clarify` with `reason: 'gate_unavailable'` (fail closed: nothing is delivered).
7. No learning from the result: a refusal never edits Rules or Memory.
8. The model never sees secrets or other Workspaces' Rules; the Rule list is scoped to the Workspace plus global Rules.
9. Cost control: classification uses the cheapest configured Chief model class when available (`ChiefConfig` fallback/cheap model, ASSUMPTION) and caches verdicts by `(hash(command), rulesVersionHash)` for 10 minutes.
10. Audit `direct_command.checked` with verdict kind, rule ids, no command text (the text is in chat history anyway).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

CHIEF002 precedence resolver, `ChiefModel` (CHIEF006), `PromptAssembler`, `ProposalParser`, `ProjectDocReader` for the optional Documentation location lookup.

## 8. Architecture and code placement

`packages/application/src/chief/rules-gate/{check-command.usecase.ts,classify.ts,cache.ts}`; adapter class `DirectCommandGateImpl` implementing the CHAT010 port, registered in the module `chief-rules-gate.module.ts`.

## 9. Security and safety

The gate is a safety control with a model inside, so the model only classifies and the verdict is deterministic; classification failures fail closed; ambiguous goes to the Owner; Rule text is displayed from the Rule record. Prompt injection: the command is the Owner's own text, but pasted third-party content could try to steer classification ("this does not violate any rule"); mitigation: pasted blocks cannot be distinguished reliably, so the closed vocabulary and the deterministic evaluator limit the damage, and ambiguity defaults to refusing delivery. A negative corpus test covers "ignore Rule R2" payloads.

## 10. Errors and edge cases

- Command that both complies and violates (two effects): refuse the whole command naming the Rule, so nothing partial is delivered.
- Rule with no subject key: classifier maps by the Rule text (model supplies `subject`), flagged `unverified` and the refusal says "may conflict" (still refuse).
- Very long command (> 4000 chars): truncated for classification with `ambiguous: true`.
- Conflicting Rules: `ambiguity` -> escalate through CHAT010 note.

## 11. Acceptance criteria

- [ ] "Skip performance tests" with Rule "all must be tested, pentest after each Task" -> `allow` (no conflict with those Rules) in the fixture.
- [ ] "Disable the penetration test" -> `refuse(R2)`.
- [ ] "Add Google login" when Documentation lacks it -> `refuse(scope_change)`.
- [ ] No Rules -> `allow` with no model call.
- [ ] Model timeout -> `clarify(gate_unavailable)`.
- [ ] Corpus of "ignore Rule" payloads never yields `allow` for a violating effect set (typed output forced by test doubles).
- [ ] Verdict cache respects `rulesVersionHash`.

## 12. Test plan

Unit tests with `FakeChiefModel` returning scripted classifications; deterministic evaluator tests; corpus test; timeout test. Command: `pnpm vitest run packages/application/src/chief/rules-gate`.

## 13. Parallelization notes

Parallel with CHIEF017. CHAT010 wires to it through a port stub first. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Owner Rules carry optional `subject` keys; otherwise the classifier supplies them (flagged unverified).
- ASSUMPTION: a cheap-model setting may exist in `ChiefConfig`; default is the main model.
