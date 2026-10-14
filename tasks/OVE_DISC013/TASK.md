---
id: OVE_DISC013
title: "Provide redaction, transcript read models, list summaries and export for Discussions"
area: DISC
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_ARCH004, OVE_DATA001, OVE_DATA010, OVE_DISC004, OVE_DISC006]
soft_depends_on: ["OVE_DISC012"]
provides: ["usecase:discussion.list", "usecase:discussion.get", "usecase:discussion.messages", "lib:discussion-redaction", "usecase:discussion.export-transcript"]
needs: ["lib:redactor", "lib:sqlite-core", "lib:result", "port:WorkspaceRepository", "port:AgentDirectory"]
owns: ["packages/application/src/discussion/queries/**", "packages/adapters/sqlite/src/discussion/read-models/**", "packages/application/src/discussion/redaction/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [15, 8]
---

# OVE_DISC013: Provide redaction, transcript read models, list summaries and export for Discussions

## 1. Summary

Implement write-time redaction of messages, the read models the Discussion screen needs (sidebar lists `TRWAJĄ / ZAKOŃCZONE`, header progress, stances panel, outcome draft panel, message pages after a sequence number) and a redacted transcript export.

## 2. Context

SPEC 15: Discussions viewable live with filters by Run and Agent, redaction of secrets and personal data in logs, report export. Mock: left list with `runda 2 z 4 · rozpoczął Chief` and `4 rundy · 3 Decyzje · 5 Zadań`; header agenda, `Runda 2 z 4` segments; right panel `Stanowiska` (per participant latest stance chip) and `Szkic wyniku`.

## 3. Scope (in)

- `redactMessage` used by the engine before persisting; list/detail/message-page queries; stances projection; outcome draft projection; transcript export (Markdown and JSON).

## 4. Out of scope

- Routes: DISC014. UI: DISCUI. Secret pattern library: ARCH004/SEC003.

## 5. Detailed requirements

1. **Redaction at write:** `redactMessage(text, ctx)` calls the shared redactor (ARCH004 patterns: tokens, keys, `sk-ant-` style, private-key blocks, `Authorization:` headers, absolute home paths rewritten to `~`/workspace-relative) and returns `{ text, redaction: { count, kinds[] } }`; applied to Agent, Owner and moderator text and to stored usage metadata; raw text is never persisted (so a secret echoed by an Agent never reaches SQLite, the UI, Telegram or the Decision). The `content_hash` is computed on the redacted text.
2. **List read model:** `list(workspaceId, { section })` -> `DiscussionSummary[]` (contract) ordered running first by `startedAt desc`, finished by `endedAt desc`; `running` = `running|paused|awaiting_outcome_approval|deadlocked|scheduled`; summaries include `startedBy`, round, decision/task counts, resolution label key (`consensus`, `owner_vote`, `chief_decided`, ...) for `rozstrzygnął Chief`.
3. **Detail:** `get(workspaceId, id)` -> `{ discussion, header: { agenda, round, maxRounds, roundSegments: ('done'|'current'|'todo')[], runControlText?: { runLabel, branchLabel, othersContinue: boolean } }, stances: Array<{ participant, latestStance, skillsUsedLatest }>, outcomeDraft?, banner?: { kind: 'started_by_chief', reason }, availableActions: ('pause'|'resume'|'conclude_now'|'approve_outcome'|'reject_outcome'|'cancel'|'vote')[] }` where `availableActions` is computed from status, ownerApprovalRequired and caller kind (so the UI never re-implements rules).
4. **Messages page:** `messages(workspaceId, id, { afterSeq, limit<=100 })` ascending; includes skill chips and stance labels; `redaction.count` flag for a UI marker.
5. **Filters:** by Run (`runId`) and by participant, as SPEC 15 requires.
6. **Export:** `exportTranscript(id, format: 'markdown'|'json')` -> text produced from stored (already redacted) messages, plus header (agenda, participants, skills with versions, outcome, Owner interventions marked); max 5 MB; no new data.
7. **Workspace scoping** on every query; foreign ids not found. Participants' display names come from `AgentDirectory` limited to the Workspace.
8. **Performance:** list uses `(workspace_id, status, created_at)` index; detail loads the last 50 messages only (UI pages older on demand).

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

Shared redactor (ARCH004), DISC004 repositories/indexes, summary builder `summaryOf` (DISC002). No second redaction implementation.

## 8. Architecture and code placement

Application `packages/application/src/discussion/{redaction,queries}/**`; adapter queries `packages/adapters/sqlite/src/discussion/read-models/**`. Read side only.

## 9. Security and safety

Redaction before persistence is the control for "an Agent printed a secret in a Discussion" (SEC003 corpus). Exports are generated from stored redacted data and still pass the redactor as a second line. Queries are Workspace scoped; Agents never call these read models except for their own Discussion summary (gateway rule, DISC014). `availableActions` prevents the UI from offering Owner-only actions to other callers, but authorisation is still enforced by the use cases.

## 10. Errors and edge cases

- Redaction false positive on a legitimate hex string: replaced by `[redacted:hex]`; the Owner sees the marker count.
- Message that is entirely redacted: stored as `[redacted]` with count.
- Discussion without Run (Owner-visible only): header `runControlText` absent.
- Huge Discussion export: truncated with a marker at 5 MB.

## 11. Acceptance criteria

- [ ] Secret fixtures in Agent and Owner messages never appear in SQLite rows, API responses or exports.
- [ ] List, detail and message pages match the mock structure for the payments scenario.
- [ ] `availableActions` is correct for each status/caller combination (table test).
- [ ] Filters by Run and participant work; foreign Workspace ids are not found.
- [ ] Export contains agenda, participants, skills with versions, Owner interventions and outcome.

## 12. Test plan

- `redact-message.test.ts` (SEC003 corpus), `queries.test.ts` on SQLite, `available-actions.test.ts`, `export-transcript.test.ts`. Commands: `pnpm vitest run packages/application/src/discussion packages/adapters/sqlite/src/discussion/read-models`.

## 13. Parallelization notes

DISC014 depends on this. The engine (DISC006) imports `redactMessage` through the exported function; until merged it uses the shared redactor directly.

## 14. Open questions and assumptions

- ASSUMPTION: Owner messages are redacted too (protects against pasted secrets).
