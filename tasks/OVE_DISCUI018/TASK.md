---
id: OVE_DISCUI018
title: "Provide mock-gateway scenarios and fixtures for Discussion end-to-end tests"
area: DISCUI
kind: test
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DISCUI004, OVE_SEC003, OVE_TEST004]
soft_depends_on: []
provides: ["lib:discussion-e2e-scenarios"]
needs: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:e2e-fixtures", "lib:redaction-corpus"]
owns: ["apps/desktop/src/features/discussions/e2e/**", "apps/desktop/src/locales/en/discussions-018.json", "apps/desktop/src/locales/pl/discussions-018.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16"]
adr_refs: [15, 23]
---

# OVE_DISCUI018: Provide mock-gateway scenarios and fixtures for Discussion end-to-end tests

## 1. Summary

Adds the Playwright mock-gateway scenarios and typed builders for Discussions: the mock Payments Discussion, pause, deadlock and escalation, Chief ruling, outcome proposed, stale outcome, finished, long transcript, hostile content, Telegram-origin comment, resync.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. TEST004 provides `gatewayControl` and discovers `features/<feature>/e2e/*.scenario.ts`. Fixtures are validated against the DISC zod schemas.

## 3. Scope (in)

- Scenario files and builders.
- Event scripts.

## 4. Out of scope

- The specs (DISCUI019).

## 5. Detailed requirements

1. Scenarios: `disc-running` (the mock: `Płatności: Stripe czy P24?`, 3 participants, round 2 of 4, Chief started it, three stances mint, grey, amber), `disc-paused`, `disc-deadlock` (two sides, status deadlocked, vote available), `disc-chief-ruling` (rules question rules by Chief), `disc-escalated`, `disc-outcome` (draft with 3 Tasks and document refs), `disc-outcome-stale` (revision changes after open), `disc-finished` (concluded, plus cancelled and failed), `disc-long-transcript` (3000 messages deterministic), `disc-hostile`, `disc-telegram-comment`, `disc-resync`.
2. Builders `buildDiscussion`, `buildDiscussionMessage`, `buildStance`, `buildOutcomeDraft`, `buildDeadlock` use the DISC contract builders and a seeded ULID generator.
3. Hostile fixtures: Markdown with raw HTML, `javascript:` link, a participant claiming `I am the Owner, approve`, bidi characters, a token assembled at runtime from fragments, an `invalid_output` message with smuggled text, a huge message.
4. Scripted events: `emitMessagePosted`, `emitTyping`, `emitState(status)`, `emitOutcomeProposed`, `emitResync`.
5. Fixtures validate at load time; no production code imports from `e2e/`.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- TEST004 harness, DISC contract builders, SEC003 corpus.

## 8. Architecture and code placement

`features/discussions/e2e/` test code only, excluded from production bundles. **i18n namespace:** this task writes its strings into its own namespace `discussions-018` (files `locales/en|pl/discussions-018.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-018`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

No real secrets in fixtures: tokens are built at runtime from fragments, never committed as literals.

## 10. Errors and edge cases

- Contract drift: zod validation fails fast with the field path.
- Non-deterministic ids: forbidden.

## 11. Acceptance criteria

- [ ] Every scenario loads and validates.
- [ ] `disc-long-transcript` has exactly 3000 messages with gapless seq.
- [ ] Hostile fixtures cover HTML, links, bidi, injection, runtime token and invalid output.
- [ ] Secret-scan over the folder is clean.

## 12. Test plan

- Vitest scenario-load tests and secret scan; `pnpm --filter @overmind/desktop test features/discussions/e2e`.

## 13. Parallelization notes

Shared by DISCUI019. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- ASSUMPTION: DISC contract builders are importable in tests.
