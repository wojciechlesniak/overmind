---
id: OVE_CHAT002
title: Define structured message parts (cards, chips, summaries) and their redaction rules
area: CHAT
kind: contract
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHAT001, OVE_DATA013, OVE_DATA018, OVE_PERM013]
soft_depends_on: []
provides: ["contract:MessagePart", "lib:message-part-builders"]
needs: ["contract:ApprovalRequest", "contract:OwnerRule", "contract:Artifact"]
owns: ["packages/contracts/src/chat/message-part.ts", "packages/domain/src/chat/parts/**"]
reads: ["packages/contracts/src/chat/chat-message.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 8", "SPECIFICATION 16.3", "SPECIFICATION 16.11"]
adr_refs: [23, 12]
---

# OVE_CHAT002: Define structured message parts (cards, chips, summaries) and their redaction rules

## 1. Summary

A message is text plus typed `parts` that render as cards and chips. This task defines the discriminated union and builders so the UI never parses text to find an approval or a rule, and so parts carry ids and display snapshots, not authority.

## 2. Context

Mock elements: Approval card in the Chief thread; per-Workspace "one sentence each" summary table; "QA -> Chief" relay row; green "Chief updated plan · Task X -> Deferred" chip with Board link; "Owner Rule R2" red card with "Change Rule" and "Leave as is"; "used Skill: e2e-playwright v2" chip; binding notice in the Agent chat. Everything that causes an effect (deciding an Approval, changing a Rule) goes through PERM and CHIEF use cases; parts only show state.

## 3. Scope (in)

- `MessagePart` union with schemas and builder helpers; per-part max sizes; i18n parameter conventions (`labelKey`, `params`).
- Pure domain helpers in `packages/domain/src/chat/parts/` to build parts from domain facts and to strip parts for channels with fewer capabilities (Telegram text fallback).

## 4. Out of scope

- Rendering: CHATUI. The actions behind buttons: PERM (approval decisions), CHIEF (`OVE_CHIEF014` rule proposals, `OVE_CHIEF016`). Telegram formatting: TG.

## 5. Detailed requirements

1. Parts (each `{ type, ... }`, strict):
   - `approval_ref { approvalId: EntityId<'apr'> | accessRequestId, kind: 'approval'|'access_request', snapshot: { title<=120, detail<=300, workspaceName, runLabel?, expiresAt? } }` (snapshot is display only; the live status always comes from PERM by id).
   - `owner_rule_ref { ruleId, ordinal: string<=8 (e.g. "R2"), textSnapshot<=300, actions: ['change_rule','keep'] }`.
   - `plan_update { taskId, taskTitle<=120, fromLane?, toLane, boardUrlPath }` (a relative app route, never an external URL).
   - `skill_used { skillId, skillName<=60, skillVersion: int }`.
   - `workspace_summary { rows: Array<{ workspaceId, workspaceName, state: 'working'|'ok'|'paused'|'idle', sentence<=200 }> (max 20) }`.
   - `result_ref { artifactId, label<=80, mediaType, bytes }` (max 5).
   - `relay_note { fromAgentId, summary<=300 }`.
   - `binding_notice { agentId }` (the system line "your commands here are binding; the Agent forwards them to Chief"; text lives in i18n).
   - `delivery_notice { status: 'queued'|'blocked'|'needs_login'|'failed', reason? }`.
2. No part contains URLs other than app-relative paths; no HTML; strings are plain text.
3. `stripForChannel(parts, channel)` returns a text fallback for Telegram: approval cards become a short line plus a callback id handled by TG (never the snapshot detail if it contains absolute paths); Telegram never receives `owner_rule_ref` actions (changing rules is desktop-only).
4. Builders validate input with the schema and return `Result`; they refuse snapshots that contain secrets (redaction run by the caller; the builder asserts the output passes `expectNoSecrets` in tests).
5. `partsVersion: 1` is implicit in each type name; adding a field is additive; an unknown `type` from a newer engine renders as nothing and the text still shows.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ApprovalRequest`, `AccessRequest` (PERM contracts), `OwnerRule` (DATA), `Artifact` (DATA), redaction helper. The UI reuses ui-kit components `ApprovalCard`, `OwnerRuleCard`, chips (DS area) keyed by `part.type`.

## 8. Architecture and code placement

`packages/contracts/src/chat/message-part.ts`, `packages/domain/src/chat/parts/{builders.ts,strip-for-channel.ts}`. Pure code.

## 9. Security and safety

Parts must not become an authority channel: a part cannot approve anything, and snapshots are labelled display-only. Telegram stripping removes rule-change actions and long details. Because Agent output feeds parts like `skill_used`, the builder takes names from the Skill record, not from Agent text.

## 10. Errors and edge cases

- Snapshot longer than the limit: truncated with an ellipsis and `truncated` true.
- Approval already decided when a message is read: UI fetches live status; the snapshot is stale by design.
- Rule deleted after the refusal message: `owner_rule_ref` still renders its text snapshot with "Rule no longer exists".
- More than 8 parts: builder drops lowest-priority parts (chips) first.

## 11. Acceptance criteria

- [ ] All part schemas accept the mock-derived fixtures and reject unknown fields.
- [ ] `stripForChannel('telegram')` removes rule-change actions and contains no absolute path.
- [ ] A URL string in a part snapshot is rejected.
- [ ] Builders refuse input containing a secret-like string (corpus from SEC003).
- [ ] Unknown part type parses to a harmless `unknown` entry for forward compatibility.

## 12. Test plan

Contract and domain unit tests; redaction corpus test. Command: `pnpm vitest run packages/contracts/src/chat packages/domain/src/chat/parts`.

## 13. Parallelization notes

Parallel with CHAT003/004 after CHAT001. CHATUI uses the schemas. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: Board links are app-relative route strings (for example `/board?task=tsk_...`); SHELL defines the route table.
