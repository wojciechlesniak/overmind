---
id: OVE_NOTIF009
title: "Decide the Access Request sound signal and notification style with the Owner"
area: NOTIF
kind: decision
size: XS
priority: P2
mvp: false
status: todo
depends_on: []
soft_depends_on: ["OVE_NOTIF008"]
provides: []
needs: []
owns: []
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 18"]
adr_refs: [3]
---

# OVE_NOTIF009: Decide the Access Request sound signal and notification style with the Owner

## 1. Summary

Records the Owner's decision on the OPEN item 'kind of sound signal and notifications for an Access Request' (SPEC 18) so the defaults of OVE_NOTIF008 can be confirmed or replaced.

## 2. Context

SPEC 11 and 18 leave the sound open. The product rule is firm: an Access Request must be noticed (Agent waits). Only the form is open.

## 3. Scope (in)

- A short decision note `docs/adr/` proposal (not accepted by the agent) with options and a recommendation.
- A list of changed defaults for OVE_NOTIF008 if the Owner chooses differently.

## 4. Out of scope

- Implementation: OVE_NOTIF008.

## 5. Detailed requirements

1. Present options: (A) one system sound `Glass` plus banner, no reminders; (B) `Glass` plus up to 3 reminders every 5 minutes (RECOMMENDED, current default); (C) a distinct custom sound bundled with the app (needs a signed audio asset and licence review); (D) repeating sound until answered (rejected: disturbing, accessibility).
2. Cover accessibility (visual banner always accompanies sound; Reduce Motion irrelevant; VoiceOver reads the banner), macOS Focus interaction (Time Sensitive level for critical kinds) and sleep behaviour (nothing sounds while the Mac sleeps, ADR 0005).
3. The Owner's answer is recorded as an ADR (`docs/adr/00NN-sygnal-prosby-o-dostep.md`, Polish source per ADR 0017 rules) and then OVE_NOTIF008 defaults are adjusted by a follow-up edit of that task's owner.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- ADR template (OVE_OSS006), domain-modeling conventions.

## 8. Architecture and code placement

Documentation only; no code.

## 9. Security and safety

Not security relevant except that the decision must not allow silencing Access Requests entirely.

## 10. Errors and edge cases

- Owner wants no sound: map to preference `banner` (still visible).

## 11. Acceptance criteria

- [ ] The decision note lists options A to D with a recommendation.
- [ ] The Owner's answer is recorded and linked from OVE_NOTIF008.

## 12. Test plan

N/A (decision).

## 13. Parallelization notes

No code conflicts.

## 14. Open questions and assumptions

- Whole task is the open question; DEFAULT while undecided: option B.
