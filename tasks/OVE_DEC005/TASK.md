---
id: OVE_DEC005
title: "Record, accept, reject and supersede Decisions with evidence and autonomy checks"
area: DEC
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT020, OVE_ARCH003, OVE_ARCH007, OVE_ARCH010, OVE_DATA002, OVE_DATA010, OVE_DATA018, OVE_DEC002, OVE_DEC003, OVE_PAUSE005, OVE_PERM008, OVE_PERM020, OVE_SEC002, OVE_SKILL003]
soft_depends_on: []
provides: ["usecase:decision.record", "usecase:decision.change-status", "usecase:decision.supersede", "usecase:decision.add-evidence", "port:ArtifactEvidenceVerifier", "usecase:RecordDecision"]
needs: ["lib:result", "lib:error-catalogue", "port:Clock", "port:IdGenerator", "port:EventBus", "port:UnitOfWork", "port:AuditLog", "contract:Actor", "port:ArtifactRepository", "port:WorkspaceRepository", "port:AgentDirectory", "port:SkillCatalog", "lib:path-canonicaliser", "port:PauseGate"]
owns: ["packages/application/src/decision/record/**", "packages/application/src/ports/ArtifactEvidenceVerifier.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 3", "SPECIFICATION 10", "SPECIFICATION 14", "SPECIFICATION 16.6"]
adr_refs: [8, 15, 16, 28]
---

# OVE_DEC005: Record, accept, reject and supersede Decisions with evidence and autonomy checks

## 1. Summary

Implement the write use cases of the Register: record a Decision (from Chief, an Agent proposal via the overmind Skill, a Discussion or the Owner), accept or reject proposed Decisions, add evidence, and supersede an old Decision by a new one, each validated, idempotent and written atomically with events.

## 2. Context

ADR 0008/0015/0016: Chief decides "how" gaps and records Decisions; a Discussion ends with Decisions; the Owner can correct anything but only by superseding. ADR 0027: Agents record Decisions through the overmind Skill as proposals. SPEC 16.6: a deadlock is settled by Chief and recorded as a Decision with each side's arguments (DISC011 calls `decision.record`). Mock: `Zastąp nową Decyzją` button; `Zastępuje: D-03 · ... (Strona fundacji)`.

## 3. Scope (in)

- `recordDecision`, `changeStatus` (accept/reject/needs_review/re-accept), `addEvidence`, `supersedeDecision`.
- Evidence verification, Skill version verification, participants validation, defaults (review date), idempotency, authorisation, events and audit.

## 4. Out of scope

- Outcome proposal/verdict: OVE_DEC006. Review reminders: DEC010. Routes: DEC011.

## 5. Detailed requirements

1. **recordDecision(input: DecisionProposal, ctx, actor)** -> `Result<{ decision: DecisionView, duplicate: boolean }>`. Steps: (a) authorise via the DEC002 matrix; (b) validate workspace exists and is active; (c) validate shape (`selectedOption` in alternatives, <= 8 alternatives, bounded strings); (d) verify evidence refs: `artifact` -> `ArtifactRepository` (exists in the SAME Workspace, checksum recorded), `doc` -> relative path via the path canonicaliser and `DocRefVerifier` (BOARD006), `discussion`/`task`/`run`/`decision` -> existence and Workspace match through read ports (a `decision` ref to another Workspace is allowed only when that Workspace is non-isolated; else `dec.evidence_forbidden`, audited), `url` -> structural check (https, no credentials, <= 300 chars) only; (e) verify `skillsUsed` entries exist with those versions (`SkillCatalog.getVersion`); an unknown skill version is rejected with `validation.invalid_input` listing the items; (f) verify participants (Agents visible in the Workspace; Chief; Owner); (g) idempotency: `sourceKey` duplicate returns the existing Decision (`duplicate: true`); (h) assign `initialStatus`: Agent proposals -> `proposed` always; Chief or system with `withinAutonomy: true` and a `how` decision -> `accepted`; else `proposed`; Owner -> any of accepted/proposed; (i) defaults: `confidence` required; `reviewDate` default accepted date + 30 days written as a `review_date_set` event only for accepted Decisions (ASSUMPTION); (j) persist Decision + events + `decision.recorded` outbox row in one transaction; FTS indexing inside the adapter transaction (DEC007).
2. **`supersedes` handling:** when the proposal has `supersedesId`, the use case delegates to `supersedeDecision` (single transaction): validates with `validateSupersede` (DEC002), inserts new Decision, appends `superseded` event + `status_changed accepted|needs_review -> superseded` to the old one, publishes `decision.status.changed`. Cross-Workspace supersede only for owner with both Workspaces non-isolated.
3. **changeStatus(decisionId, to, reason, actor)**: DEC002 table and matrix; `accepted -> needs_review` by system/chief/owner; re-accept `needs_review -> accepted` by owner/chief (resets review date +30 days via event); `proposed -> accepted|rejected`: owner always, chief only for `how` within autonomy (the use case asks `AutonomyChecker.allows(decision)`; if absent -> owner only, fail closed).
4. **addEvidence(decisionId, evidence[], actor)**: chief, owner, system; same verification; appends `evidence_added` events (max 30 refs in total per Decision, `dec.evidence_required`/limit error).
5. **Agent proposals:** the overmind Skill call arrives through AGENT/gateway as actor `agent`; always `proposed`; `participants` forced to include the proposing Agent; the Agent cannot set `origin.kind` other than `agent`; rate limit 10 proposals/hour per Agent (ASSUMPTION).
6. **Never overwrite:** corrections to wording or facts are a new Decision with `supersedesId`; there is no edit API (documented in the use-case README).
7. **Audit:** `decision.recorded`, `decision.superseded`, status changes, refused attempts (forbidden evidence, forbidden supersede) all audited with ids only.
8. **Global Pause:** recording by Chief/system respects `PauseGate` (no new autonomous Decisions while paused); Owner actions allowed.

## 6. Design notes

N/A, functionality only. (The Owner-facing screen that consumes this is specified by the UI area tasks; this task only supplies data and behaviour.)

## 7. Reuse

DEC002 rules; BOARD006 `DocRefVerifier`; `ArtifactRepository`, `SkillCatalog`, `AgentDirectory` (other areas); outbox. One evidence verifier (`ArtifactEvidenceVerifier` port in this task) reused by DEC006.

## 8. Architecture and code placement

`packages/application/src/decision/record/{record-decision.ts,supersede-decision.ts,change-status.ts,add-evidence.ts,evidence-verifier.ts,autonomy.ts}`, port file `ArtifactEvidenceVerifier.ts`. Depends on ports.

## 9. Security and safety

Decisions steer future work (Chief reuses them), so poisoning the Register is an attack: Agents can only propose; evidence must be real Artifacts/docs of the same Workspace (no fabricated "evidence"); `url` evidence is opaque and does not count as outcome evidence; Skill versions are verified so the audit trail is true; cross-Workspace links never touch isolated Workspaces; supersede cannot be used to hide history (old row stays); no content from model output is interpreted as instruction; rate limits stop Register flooding; Telegram cannot record or change anything. Fail closed when the autonomy checker or verifier is unavailable.

## 10. Errors and edge cases

- Two concurrent supersedes of the same Decision: first wins, second `dec.already_superseded`.
- Evidence artifact deleted later: reference remains, UI shows unavailable.
- Duplicate `sourceKey` with different content: `dec.duplicate_source_key` (`details.conflict: true`), no write.
- Supersede target is `rejected`: `dec.supersede_target_invalid`.
- Chief records `accepted` for a `what` question: downgraded to `proposed` (Owner needed).

## 11. Acceptance criteria

- [ ] Agent proposals are always `proposed`; Chief `how` within autonomy -> `accepted`; `what` -> `proposed`.
- [ ] Evidence from another Workspace or non-existent artifacts is rejected; skills with unknown versions rejected.
- [ ] Supersede creates the new Decision and marks the old one in one transaction; the old row is unchanged.
- [ ] Cross-Workspace supersede only by owner, never for isolated Workspaces.
- [ ] Duplicate `sourceKey` is idempotent.
- [ ] Every refusal is audited; autonomy/verifier outage fails closed.
- [ ] No API edits a Decision (static check on exports).

## 12. Test plan

- `record-decision.test.ts`, `supersede-decision.test.ts`, `change-status.test.ts`, `add-evidence.test.ts`, `evidence-verifier.test.ts` on fakes with failure injection. Commands: `pnpm vitest run packages/application/src/decision/record`.

## 13. Parallelization notes

DISC011/012 and CHIEF consume `usecase:decision.record`. Parallel with DEC006.

## 14. Open questions and assumptions

- ASSUMPTION: 30-day default review date; 10 agent proposals/hour; `AutonomyChecker` port provided by CHIEF (`withinAutonomy` flag may initially come from the caller).
