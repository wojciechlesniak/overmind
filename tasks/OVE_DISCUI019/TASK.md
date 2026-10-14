---
id: OVE_DISCUI019
title: "Test the Discussion view: flows, accessibility, visual regression and performance"
area: DISCUI
kind: test
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DISCUI017, OVE_DISCUI018, OVE_TEST004, OVE_TEST005, OVE_TEST010]
soft_depends_on: []
provides: ["lib:discussion-view-e2e-suite"]
needs: ["lib:playwright-harness", "lib:visual-regression", "lib:a11y-harness", "lib:keyboard-test-helpers"]
owns: ["apps/desktop/e2e/discussions/**", "apps/desktop/src/locales/en/discussions-019.json", "apps/desktop/src/locales/pl/discussions-019.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16"]
adr_refs: [15, 23, 6]
---

# OVE_DISCUI019: Test the Discussion view: flows, accessibility, visual regression and performance

## 1. Summary

Adds the Playwright suites proving the Discussion view: live messages, typing, pause and resume, Owner comment and vote, deadlock and ruling display, outcome approval with revision binding, finished read-only and export, hostile content, performance, keyboard and screen reader behaviour, axe and visual comparison with `Dyskusja.png`.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. The Definition of Done requires axe-clean, keyboard-operable UI and negative security tests.

## 3. Scope (in)

- Functional, security, a11y, visual and performance specs for `/chief/discussion/:id`.

## 4. Out of scope

- Chat suites (CHATUI036, 037).

## 5. Detailed requirements

1. Functional: (1) open the mock Discussion, header and round bar correct; (2) a new message arrives by event and appears once, typing row shows then clears; (3) Pause then Resume, Resume blocked under Global Pause; (4) Owner comment: optimistic, confirmed, retry with the same key (`gateway.calls` shows one stored message); (5) deadlock: both sides shown, vote mode appears, vote confirmed once; (6) Chief ruling shows labelled as Chief's and still needs approval; (7) outcome approval sends the revision and hash shown, the stale scenario blocks it; (8) finished Discussion is read-only and exports unchanged text; (9) resync after `events.resync_required` leaves a correct state; (10) Workspace switch resets all regions.
2. Security: hostile messages render as text only; a participant claiming to be the Owner changes nothing; `invalid_output` text never appears in the DOM; a runtime-built token in a message never appears; a Telegram-origin comment never offers or counts as a vote; no request carries a scope field.
3. Performance: `disc-long-transcript` mounts <= 80 rows, scroll frame time under the harness threshold, prepend shift <= 1 px.
4. Accessibility: axe on every state; keyboard order list, header, thread, composer, panel; the live region announces new messages once and not typing; dialogs trap focus and restore it; reduced motion respected.
5. Visual: compare `disc/list`, `disc/header`, `disc/thread`, `disc/composer`, `disc/positions-panel` with the crops of tasks 005-009 and the whole view with `Dyskusja.png`.

## 6. Design notes

N/A, functionality only (tests compare with `Dyskusja.png` crops).

## 7. Reuse

- TEST004/005/010 helpers; scenarios (OVE_DISCUI018).

## 8. Architecture and code placement

`apps/desktop/e2e/discussions/*.spec.ts`; page object `DiscussionPage` uses `region(slug)`. **i18n namespace:** this task writes its strings into its own namespace `discussions-019` (files `locales/en|pl/discussions-019.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-019`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

These are the negative tests required by the Definition of Done: hostile text, impersonation, secret leakage, vote through Telegram, stale approval.

## 10. Errors and edge cases

- Flaky timing: use the clock fixture.
- Baseline drift: pinned container image.

## 11. Acceptance criteria

- [ ] All specs pass in CI.
- [ ] axe: zero violations in all states.
- [ ] Visual diffs within tolerance.
- [ ] Security tests fail when the matching guard is removed (mutation check documented in the PR).

## 12. Test plan

- `pnpm --filter @overmind/desktop test:e2e discussions`; `test:visual discussions`.

## 13. Parallelization notes

Test-only task. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- None.
