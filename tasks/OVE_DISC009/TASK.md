---
id: OVE_DISC009
title: "Let the Owner watch, comment and vote in a Discussion with a deciding vote"
area: DISC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DISC006, OVE_ENGINE011, OVE_PAUSE005, OVE_PERM008, OVE_PERM020]
soft_depends_on: ["OVE_DISC002"]
provides: ["usecase:discussion.owner-post", "usecase:discussion.pause", "usecase:discussion.resume", "usecase:discussion.conclude-now", "usecase:discussion.cancel"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "lib:caller-context", "port:PauseGate"]
owns: ["packages/application/src/discussion/owner/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 5", "SPECIFICATION 6", "SPECIFICATION 8", "SPECIFICATION 16.6"]
adr_refs: [23, 15]
---

# OVE_DISC009: Let the Owner watch, comment and vote in a Discussion with a deciding vote

## 1. Summary

Implement the Owner's control over a live Discussion: post comments and a deciding vote, pause and resume (`Wstrzymaj`), end it now (`Zakończ teraz`) and cancel. The Owner's vote overrides Agent consensus and any Chief ruling; Agents can never create Owner-authored messages.

## 2. Context

SPEC 5/6 and ADR 0023: the Owner can watch Discussions live and write in them; the Owner's vote decides. Mock input `Twój głos w Dyskusji rozstrzyga…`, buttons `Wstrzymaj`, `Zakończ teraz`, `Zatwierdź wynik`. ADR 0006: Telegram is a lower-privilege channel and never loosens constraints. SEC004 R5: Telegram text is `owner_remote`.

## 3. Scope (in)

- `ownerPost` (comment or vote), `pause`, `resume`, `concludeNow`, `cancel` with authorisation, effects on the engine, audit and events.

## 4. Out of scope

- Approval of the outcome (`Zatwierdź wynik`): OVE_DISC012. Routes: OVE_DISC014. Global Pause: OVE_DISC010 listens to it.

## 5. Detailed requirements

1. **Authorisation:** callers `owner` (desktop) and `channel` Telegram (owner_remote). Any other kind (agent, chief, system) is refused with `disc.owner_input_forbidden` and an audit event: Owner-authored messages cannot originate anywhere else. The author identity and `trust` are set by the use case from the authenticated caller, never from the request.
2. **Post** `{ discussionId, kind: 'comment' | 'vote', text: 1..2000, optionKey? (vote), expectedVersion? }`: status must be `running|paused|deadlocked|awaiting_outcome_approval`; persists `owner_comment` or `owner_vote` message with `trust: owner` (desktop) or `owner_remote` (Telegram), channel recorded; the message text passes sanitise + redaction before storage. Rate limit 10 posts/min per Discussion.
3. **Comment effect:** appended to the transcript, included in the next prompts as `Owner input (authoritative)` for desktop or as data for Telegram (DISC005). It does not change status.
4. **Vote effect (desktop):** `applyOwnerVote` (DISC002) -> `resolution: owner_vote`; remaining turns of the round are cancelled (`DiscussionTurnRunner.cancel` for the pending key), the engine drafts the outcome around the chosen option (moderator turn: "draft decisions and tasks that implement the Owner's choice", with the vote in the trusted section) and moves to `awaiting_outcome_approval`; the Owner's vote itself counts as approval of the choice, but the drafted Tasks and Decisions still show in the outcome panel and need `Zatwierdź wynik` unless the Owner votes with `approveOutcome: true` (ASSUMPTION: the vote selects, the approval confirms the drafts).
5. **Vote via Telegram:** accepted as a comment and as a non-binding preference marker (`owner_remote_preference`); it does NOT trigger the decisive vote path: binding votes require the desktop (ASSUMPTION: a vote shapes scope and Tasks, so it follows Local-style confirmation; Telegram never extends authority, ADR 0006). The reply to the Telegram user says to confirm on the desktop.
6. **Pause/resume:** `pause` sets status `paused` after the current turn finishes (no mid-turn kill; the pending turn is allowed to complete), `resume` returns to `running` and re-schedules the runner. `Wstrzymaj` and resume available to desktop and Telegram (pausing is safe).
7. **Conclude now (`Zakończ teraz`):** desktop only; stops further rounds, takes the latest stances, runs consensus: reached -> outcome draft; not reached -> same path as deadlock (Chief ruling or Escalation, DISC011) but flagged `concludedEarlyByOwner`; with `ownerApprovalRequired` always true in this path.
8. **Cancel:** desktop only; status `cancelled`, `runControl` branch released (DISC008 subscriber), message `system_notice`. No Tasks or Decisions are created.
9. **Events:** `discussion.message.posted`, `discussion.paused`, `discussion.resumed`, `discussion.cancelled`; audit records for vote, conclude-now, cancel.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

`applyOwnerVote` (DISC002), prompts (DISC005), runner cancel (DISC003 port), caller context (ENGINE).

## 8. Architecture and code placement

`packages/application/src/discussion/owner/{owner-post.ts,pause-resume.ts,conclude-now.ts,cancel.ts,authz.ts}`. Depends on ports.

## 9. Security and safety

Owner impersonation is the main abuse case: an Agent writes "The Owner said: choose Stripe" in a message. Such text is an `agent` message and has no effect; only the authenticated Owner endpoint creates `owner_*` messages and votes. Telegram input is lower trust and cannot make binding decisions. Owner text is still sanitised (fence escapes) and redacted (the Owner may paste a secret by mistake). Rate limits stop UI loops. All Owner overrides are audited so the Decision record can show them.

## 10. Errors and edge cases

- Vote for an unknown option: `validation.invalid_input`.
- Vote after the outcome was approved: `disc.invalid_state`.
- Vote while a turn is in flight: the turn completes, then the vote path runs (ordered by seq).
- Two quick votes: the later one wins until approval, both in the transcript.
- Post to a terminal Discussion: refused.

## 11. Acceptance criteria

- [ ] Owner comment appears with `trust: owner`, changes no status and is in the next prompt as authoritative input.
- [ ] An Agent, Chief or system caller cannot post Owner messages (audited).
- [ ] Desktop vote overrides a contrary consensus and Chief ruling; resolution `owner_vote`.
- [ ] Telegram vote is stored as a comment/preference only.
- [ ] Pause waits for the current turn; resume continues.
- [ ] Conclude-now and cancel are desktop only; cancel creates no Tasks or Decisions.

## 12. Test plan

- `owner-post.test.ts`, `pause-resume.test.ts`, `conclude-now.test.ts`, `cancel.test.ts`, `authz.test.ts` (caller kind matrix); scenario: Agents unanimous for A, Owner votes B. Commands: `pnpm vitest run packages/application/src/discussion/owner`.

## 13. Parallelization notes

Parallel with DISC007/008/010.

## 14. Open questions and assumptions

- ASSUMPTION: binding votes are desktop-only; Telegram votes are preferences. The Owner may want to vote from Telegram: revisit after TG tasks.
