---
id: OVE_AGENT009
title: Implement pure Agent State derivation from evidence
area: AGENT
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001]
soft_depends_on: []
provides: ["lib:agent-state-derivation", "contract:AgentStateHint"]
needs: []
owns: ["packages/domain/src/agent/state/**"]
reads: ["packages/contracts/src/agent/agent-state.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 15"]
adr_refs: [26, 22, 27]
---

# OVE_AGENT009: Implement pure Agent State derivation from evidence

## 1. Summary

A pure, deterministic function `deriveAgentState(signals, now)` turns the raw signals about one Agent (herdr hint, Overmind screen rules, "overmind" Skill reports, pending requests, Run events, Owner actions) into one of five states with evidence. It encodes the rule that a terminal state is a hint and never proof of finished work.

## 2. Context

Prototype findings: herdr reported `done` while Claude showed `401 OAuth access token has expired` and a choice dialog; Codex reached `done` with no command. ADR 0026: Overmind adds its own rules for "needs login" and "CLI choice dialog". Glossary: Agent State = "pracuje, czeka na Zgodę, wymaga ponownego zalogowania, bezczynny albo skończył z nieodebranym wynikiem; zawsze oparte na widocznym dowodzie i nigdy nie jest dowodem wykonania Zadania". The mock list rows show state words and colors ("pracuje", "Zgoda", "wolny", "skończył").

## 3. Scope (in)

- `AgentSignal` union type, `deriveAgentState`, precedence table, staleness (TTL) rules, hysteresis helper.
- Fixtures of the prototype situations as test data.

## 4. Out of scope

- Collecting signals from herdr and screens: PROV adapters. Storing, publishing and serving the state: `OVE_AGENT010`. Screen-rule patterns themselves: PROV (they produce `screen_rule` signals).

## 5. Detailed requirements

1. Input: `signals: AgentSignal[]` where `AgentSignal = { source: 'herdr_hint'|'screen_rule'|'overmind_report'|'run_event'|'pending_request'|'owner_action'; kind: string; observedAt: IsoDateTime; ref?: string; payload?: small struct }`, plus context `{ hasSession: boolean; runActive: boolean; paused: boolean }`.
2. Precedence (first match wins):
   1. `needs_login`: a `screen_rule` signal `login_required` or a provider error `login_expired`, not superseded by a later `owner_action: login_completed` or a later successful report.
   2. `waiting_approval`: an open ApprovalRequest or AccessRequest for this Agent (`pending_request`), or a `herdr_hint: blocked`, or a `screen_rule: cli_choice_dialog` (reason `cli_choice_dialog`; the choice dialog is treated like blocked and is never auto-answered).
   3. `working`: an `overmind_report` of kind `progress` or `started` within `workingTtlSeconds` (default 120), or a `herdr_hint: working` seen within `hintTtlSeconds` (default 30) while a Run is active.
   4. `finished_unread`: a `herdr_hint: done` or `run_event: node.succeeded` PLUS a completion `overmind_report` (kind `done`) or a result message, and no `owner_action: result_seen` after it; reason `unread_result`.
   5. `idle`: everything else. A bare `herdr_hint: done` without a report, effect or result is `idle` with an evidence item whose summary says "done hint without result" (never `finished_unread`).
3. If `context.hasSession` is false the state is `idle` with reason `no_session`. `paused` does not change the state; it is carried separately.
4. Staleness: a signal older than its TTL is ignored. A `working` state with no fresh signal for `stuckSeconds` (default 300) while a Run is active stays `working` but the result carries `stale: true`, so the UI and the watchdog (WFRT) can act. The function never invents a blocked state (blocked only on visible evidence, as in herdr).
5. Output: `AgentStateView` (contract) with `evidence` containing the 1..5 signals that decided the state, newest first, plus `since` = observedAt of the oldest signal that has been continuously consistent with the state.
6. Hysteresis: `applyHysteresis(previous, next, now, minDwellMs = 1500)` returns `previous` when the state flips back within the dwell time and the previous evidence is still fresh (avoids flicker, as herdr does).
7. The function MUST NOT read the clock, a repository or the network; `now` is a parameter. Signals are not trusted text: `payload` is a bounded struct (strings max 160 chars) and is never copied wholesale into evidence (only ids and summaries produced by the signal source).

## 6. Design notes

N/A, functionality only. (The state-to-label/color mapping is a UI concern: AGUI/CHATUI use `agentState.<state>` i18n keys; magenta=working, amber=waiting, mint=finished, none=idle per styl-wizualny; needs_login uses the error color with an icon.)

## 7. Reuse

`AgentStateView`, `AgentStateEvidence` from `OVE_AGENT001`; `AgentStateHint` type from PROV (the herdr adapter's normalised hint: `idle|working|blocked|done|unknown`).

## 8. Architecture and code placement

`packages/domain/src/agent/state/{derive.ts,signals.ts,hysteresis.ts,ttl.ts,index.ts}`; pure, no I/O. Constants exported and configurable by the caller.

## 9. Security and safety

State is displayed to the Owner and used by the engine to decide whether to send a command. The conservative rules (done is not finished, blocked only on evidence, never type into a dialog) prevent a malicious or buggy CLI screen from forcing the engine to send input or mark work complete. Evidence holds ids, not screen text, so secrets on a terminal cannot leak via state.

## 10. Errors and edge cases

- Contradicting signals at the same timestamp: precedence table decides; ties inside a level pick the newest.
- Clock skew (signal from the future): clamped to `now` and flagged in evidence summary.
- Report says `done` but a later herdr `blocked` appears: `waiting_approval` wins.
- Login completed by the Owner (`owner_action`) clears `needs_login` immediately without waiting for a CLI hint.
- No signals at all: `idle`, reason `no_session` or none.

## 11. Acceptance criteria

- [ ] Prototype scenario "401 expired + herdr done" yields `needs_login`.
- [ ] Choice-dialog screen signal yields `waiting_approval` with reason `cli_choice_dialog`.
- [ ] Bare `done` hint yields `idle`, not `finished_unread`.
- [ ] `done` hint plus a completion report yields `finished_unread` until `result_seen`.
- [ ] Stale `working` signals expire after their TTL; stuck sets `stale: true` without changing the state.
- [ ] Hysteresis suppresses a flip-flop within the dwell time.
- [ ] Function output is identical for shuffled signal input order.

## 12. Test plan

Table-driven tests from fixtures (one per prototype situation), property tests for order independence and monotonic `since`. Command: `pnpm vitest run packages/domain/src/agent/state`.

## 13. Parallelization notes

Parallel with AGENT002/003/011. The PROV adapter team can emit `AgentSignal`s without waiting; the type lives in this task's `signals.ts` (merge it early).

## 14. Open questions and assumptions

- ASSUMPTION: TTLs (working 120 s, herdr hint 30 s, stuck 300 s) are defaults, configurable in AppConfig.
- ASSUMPTION: `finished_unread` requires a report or result, deliberately stricter than herdr's `done`.
