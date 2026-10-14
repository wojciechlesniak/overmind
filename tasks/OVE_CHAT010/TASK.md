---
id: OVE_CHAT010
title: Gate direct Agent commands against Owner Rules and relay them to Chief
area: CHAT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT006, OVE_CHAT008, OVE_CHAT009, OVE_CHIEF016, OVE_CHIEF017, OVE_DATA014]
soft_depends_on: [OVE_CHIEF016, OVE_CHIEF017]
provides: ["service:DirectCommandCoordinator", "usecase:RelayDirectCommand", "port:DirectCommandGate"]
needs: ["usecase:HandleDirectCommand", "usecase:CheckCommandAgainstRules", "port:OwnerRuleRepository"]
owns: ["packages/application/src/chat/direct-command/**", "packages/application/src/ports/DirectCommandGate.ts"]
reads: ["packages/application/src/chat/reply/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 5", "SPECIFICATION 16.11", "SPECIFICATION 6"]
adr_refs: [23, 16, 15]
---

# OVE_CHAT010: Gate direct Agent commands against Owner Rules and relay them to Chief

## 1. Summary

When the Owner writes to an Agent directly, the command is binding (ADR 0023) but must not break an Owner Rule, and Chief must learn about it so its plan and the Board stay consistent (criterion 11). This coordinator runs the rule gate before delivery, delivers or refuses, relays to Chief, and posts the matching notices and cards into the thread.

## 2. Context

Mock `Czat-Agent.png`: a notice "Your commands in this chat are binding. QA immediately forwards them to Chief"; "Skip performance tests in this iteration" -> Agent replies "Done... informed Chief" with the chip "Chief updated plan · Task -> Deferred"; then "Also disable penetration test" -> the Agent refuses and shows the Owner Rule card R2 with "Change Rule" and "Leave as is". Spec 3: the Agent does not silently execute a command that violates a Rule and names the rule to change. We do not trust the model to refuse: Overmind decides before delivery, and the refusal text is produced by Overmind from templates.

## 3. Scope (in)

- `DirectCommandCoordinator` consuming `chat.owner_message.routed` for Agent targets (before CHAT008 delivers).
- Port `DirectCommandGate` implemented by CHIEF (`CheckCommandAgainstRules`) returning `allow | refuse(ruleIds[]) | clarify`.
- `RelayDirectCommand`: posts a `relay` message in the Chief conversation and calls `HandleDirectCommand` (CHIEF017).
- The binding notice in new Agent conversations; refusal message with `owner_rule_ref` part; "Leave as is" and "Change Rule" action contracts (the latter only creates a RuleProposal draft for the Owner on desktop; it never edits a Rule).

## 4. Out of scope

- Classification logic: `OVE_CHIEF016`. Plan and Board update logic: `OVE_CHIEF017`. Delivery to CLI: `OVE_CHAT008`. Owner Rule editing UI and storage: DATA/WSPACE.

## 5. Detailed requirements

1. Flow on `chat.owner_message.routed` (Agent target): (a) if the Workspace has no Owner Rules, verdict `allow` without a model call; (b) else call `DirectCommandGate.check({ text, agentId, workspaceId, rules })` with a timeout of 20 s; (c) `allow` -> deliver (CHAT008) and relay; (d) `refuse` -> do NOT deliver; post `rule_refusal` message authored as `system` on behalf of the Agent (`author: system`, `onBehalfOfAgentId`), text from i18n template "I cannot do that. Your Rule {ordinal} requires: {ruleTextSnapshot}, and a Rule cannot be bypassed by a command in chat." plus the `owner_rule_ref` part; relay a short note to Chief ("Owner command refused: conflicts with Rule R2") so Chief knows; (e) `clarify` or gate failure/timeout -> fail closed: do not deliver, post a system message "I could not check this command against your Rules; try again or rephrase", and do not relay; nothing is typed.
2. Owner Rules take precedence over everything (ADR 0016): the gate never weighs Agent Memory or Project Documentation against a Rule. A command that changes scope (what to build) also requires a Documentation change; the gate returns `refuse` with reason `scope_change` and a `plan_change_required` part, and the refusal names the Documentation location (CHIEF016 supplies it).
3. The coordinator is idempotent per message id (stored verdict `direct_command_verdicts(message_id PK, verdict, rule_ids_json, decided_at)`, table created by this task's migration `V202610141250__OVE_CHAT010__verdicts.sql` in `packages/adapters/sqlite/src/chat-direct-command/`).
4. Relay: after `allow` and a successful `sent` (CHAT008 outcome), post a `relay_note` in the Chief conversation (`type: relay`, text "{Agent} <- Owner: {short summary}") and call `HandleDirectCommand({ messageId, agentId, workspaceId, textRef })`; Chief updates plan and Board and the result is posted into the Agent conversation as a `plan_update` chip when the Board changed. The relay does not depend on the Agent reporting (the Agent also acknowledges via `command_ack`, `OVE_AGENT014`, which is recorded but not required). If Chief's handling fails, retry 3 times with backoff, then raise an Escalation (`OVE_CHIEF015`) so the plan drift is visible (SPEC 17 risk "rozjazd planu Chiefa z poleceniami").
5. `relay` is asynchronous and must not delay delivery; delivery happens right after `allow`.
6. Binding notice: when an Agent conversation is created, post one `system` message with part `binding_notice` (text from i18n); it is not repeated.
7. "Change Rule" action: `RequestRuleChangeFromRefusal(messageId)` creates a `RuleProposal` draft addressed to the Owner (the Owner is already the requester) and opens the Rule editor on desktop via a client route hint; it NEVER modifies the Rule and is unavailable from Telegram. "Leave as is" simply dismisses (message updated with `dismissed: true` in the part).
8. Telegram-origin commands: same gate; refusal text sent to Telegram without rule-change actions (CHAT002 strip).
9. The Agent never sees a refused command (it is not delivered) and the refusal is not shown to the Agent either; Chief is told.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`PostSystemMessage` (CHAT009), `AgentSessionGateway` through CHAT008, `OwnerRuleRepository` (DATA), CHIEF use cases, `Notify` for Escalation.

## 8. Architecture and code placement

`packages/application/src/chat/direct-command/{coordinator.ts,verdict-store.ts,relay.ts}`; port `DirectCommandGate` in `application/ports` (implemented by CHIEF016 through composition). Module `chat-direct-command.module.ts`.

## 9. Security and safety

This is the enforcement point for "no command can weaken a Rule" at the Overmind level rather than relying on model compliance. Fail closed on any gate error. The gate's model output is parsed as a typed verdict (SEC004 proposal parser), never as free text. Rule text shown comes from the Rule record, not from model text. Telegram cannot change rules. Everything is audited (`direct_command.refused`, `direct_command.gate_failed`).

## 10. Errors and edge cases

- Gate timeout: fail closed with the system message.
- Message edited or resent after refusal: gated again.
- Rules changed while a message waits in queue: gate runs again before typing (verdict valid only for the Rule version set it was computed against; `rulesVersionHash` stored).
- Command to Agent in a Workspace without Rules: no model call, no delay.
- Chief unreachable for relay: retries, then Escalation; delivery is not rolled back (the Owner command is binding).

## 11. Acceptance criteria

- [ ] "Skip performance tests" with Rule R2 present -> allowed, delivered, Chief relay posted, plan update chip appears after Chief updates the Board.
- [ ] "Also disable the penetration test" -> refused, nothing delivered (no CLI effect), `rule_refusal` with `owner_rule_ref` R2 posted, Chief told.
- [ ] Gate error or timeout -> nothing delivered, system message posted.
- [ ] Workspace without Rules -> no gate model call.
- [ ] Refusal over Telegram has no rule-change action.
- [ ] A verdict computed for older Rules is recomputed.
- [ ] "Change Rule" creates only a proposal draft; the Rule is unchanged.

## 12. Test plan

Unit tests with a fake `DirectCommandGate` (allow, refuse, clarify, throw, slow); integration test through CHAT006 -> coordinator -> CHAT008 with fake CLI (`happy-path`) asserting the effect log is empty on refuse (TEST006); e2e of criterion 11 jointly with CHIEF020. Command: `pnpm vitest run packages/application/src/chat/direct-command`.

## 13. Parallelization notes

Needs CHIEF016/017 only through ports (stubs first). Parallel with CHAT011/012. Hotspot: i18n keys `chat.directCommand.*` in `packages/application/locales/<lang>/chat.json` (owned by CHAT; one file).

## 14. Open questions and assumptions

- ASSUMPTION: rule classification uses a Chief model call only when Rules exist; latency up to 20 s is acceptable for a rare path.
- Question for Owner: should "ambiguous" commands be delivered with a warning instead of being blocked? Default: blocked (fail closed).
