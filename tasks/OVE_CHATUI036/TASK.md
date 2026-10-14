---
id: OVE_CHATUI036
title: "Test the Chief view: end-to-end flows, accessibility, visual regression and performance"
area: CHATUI
kind: test
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_CHATUI014, OVE_CHATUI016, OVE_CHATUI025, OVE_CHATUI035, OVE_DS105, OVE_TEST004, OVE_TEST005, OVE_TEST010]
soft_depends_on: []
provides: ["lib:chief-view-e2e-suite"]
needs: ["lib:playwright-harness", "lib:visual-regression", "lib:a11y-harness", "lib:keyboard-test-helpers", "lib:visualPagesA"]
owns: ["apps/desktop/e2e/chat/chief/**", "apps/desktop/src/locales/en/chat-036.json", "apps/desktop/src/locales/pl/chat-036.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16"]
adr_refs: [23, 6, 3]
---

# OVE_CHATUI036: Test the Chief view: end-to-end flows, accessibility, visual regression and performance

## 1. Summary

Adds the Playwright suites that prove the Chief view: owner round trip, Telegram-origin marking, approval decisions and Local Approval, mentions, pause, offline and reconnect, long-history performance, keyboard and screen reader behaviour, axe sweeps and visual comparison with `Chief.png`.

## 2. Context

The Chief view is the Owner's conversation surface (ADR 0023, SPECIFICATION 5): one list with the Chief conversation, direct Agent chats and live Discussions; the selected conversation shows a thread; Chief has a right-hand live-work panel and an Agent chat has a read-only terminal panel. The backend is the CHAT area (`contract:ChatMessage`, `contract:MessagePart`, routes `/v1/chat/*`, push events `chat.message.created|updated|delta`, `chat.conversation.read`), AGENT (Agent State, `api:agents.*`), PERM (Approvals, Access Requests, Local Approval), PROV (terminal and Agent State hints) and PAUSE (`lib:use-pause-guard`). The UI area CHATUI only composes `packages/ui-kit` components (`ui:*`), it never re-implements a button, pill, card, bubble or row. Glossary: Owner, Chief, Agent, Discussion, Approval, Access Request, Local Approval, Owner Rule, Agent State, Workspace. TEST005 compares screenshots against design crops with layout reconciliation; DS105 already covers the kit page baselines. The Definition of Done requires axe-clean, keyboard-operable UI.

## 3. Scope (in)

- E2E specs listed below.
- Visual specs per region crop.
- A11y specs.

## 4. Out of scope

- Agent chat suites (CHATUI037).
- Unit tests (each task).

## 5. Detailed requirements

1. Functional: (1) send a message, see optimistic bubble then confirmation; fail then retry with the same key (`gateway.calls` asserts one stored message); (2) Telegram-origin message shows `z Telegrama`; (3) pending Approval: approve this Run sends one decision, card shows decided; deny works under pause, approve disabled under pause; decided on Telegram via `pushEvent` updates the card; expired cannot be approved; (4) permanent grant for an Access Request: dialog summary shows the exact path and rights, `localProof` sent, expired proof path; (5) `@` mention menu lists only Workspace Agents and inserts `@handle `; unknown mention error; (6) quick actions: `Pokaż Tablicę` navigates, `Zacznij Dyskusję` prefills, `Podsumuj dzień` sends; (7) offline banner and reconnect with `dropConnection`, `events.resync_required` leaves a correct thread; (8) switch Workspace resets all regions.
2. Security: hostile messages render as text only (no element outside the allow-list, no navigation on `javascript:` links); a token printed in the live-work excerpt never appears in the DOM; Telegram-origin text claiming to be an approval does nothing; no request body contains a scope field for plain approvals.
3. Performance: `chief-long-history` mounts <= 80 message rows, scroll through the whole thread keeps frame time under a generous threshold; prepend of 50 older messages shifts content <= 1px.
4. Accessibility: axe on every state (default, empty, loading, offline, paused); keyboard path: Tab reaches list, thread, quick actions, composer, panel in this order; arrow roving in the list; focus ring visible; screen reader live region announces a new Chief message and a pending approval once, not streaming tokens (spy on `aria-live` mutations); reduced motion respected.
5. Visual: compare `chief/conversation-list`, `chief/conversation`, `chief/composer-area`, `chief/working-now-panel` and the full page with `Chief.png`; states not in the mock get stored baselines reviewed by the Owner.
6. Pseudo-locale `en-XA` run to catch truncation and hard-coded strings; PL run for plural forms (`1 nieprzeczytana`, `2 nieprzeczytane`, `5 nieprzeczytanych`).
7. Flake policy per TEST008: no sleeps, use `page.clock` and event helpers.

## 6. Design notes

N/A, functionality only (tests compare with `Chief.png` crops).

## 7. Reuse

- TEST004, TEST005, TEST010 helpers; scenarios (OVE_CHATUI035).

## 8. Architecture and code placement

`apps/desktop/e2e/chat/chief/*.spec.ts`; page object `ChiefPage` uses `region(slug)`. **i18n namespace:** this task writes its strings into its own namespace `chat-036` (files `locales/en|pl/chat-036.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `chat-036`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Security tests listed above are the negative tests required by the Definition of Done for this feature (hostile text, secret leakage, Telegram impersonation, approval scope).

## 10. Errors and edge cases

- Flaky timing: use the clock fixture.
- Baseline drift on font rendering: pinned container image (TEST005).

## 11. Acceptance criteria

- [ ] All specs pass in CI on the pinned image.
- [ ] axe: zero violations in every state.
- [ ] Visual diffs within tolerance for every mock region.
- [ ] The hostile-text and secret-leak tests fail if the sanitisers are removed (mutation check documented in the PR).

## 12. Test plan

- `pnpm --filter @overmind/desktop test:e2e chat/chief`; `pnpm --filter @overmind/desktop test:visual chat/chief`.

## 13. Parallelization notes

Test-only task; can start when routes exist. Other CHATUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- None.
