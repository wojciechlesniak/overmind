---
id: OVE_WFED074
title: "Build the Discussion node form: agenda, rounds, participants, moderator, outcome"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT005, OVE_ARCH011, OVE_DISC001, OVE_DS023, OVE_DS026, OVE_DS030, OVE_DS031, OVE_DS080, OVE_WFED002, OVE_WFED007, OVE_WFED061, OVE_WFED069, OVE_WFRT003, OVE_WFRT005, OVE_WFRT010]
soft_depends_on: []
provides: ["feature:wfed-form-discussion"]
needs: ["lib:node-registry", "lib:define-node-config", "contract:ValidationIssue", "lib:wfed-live-validation", "lib:editor-commands", "lib:editor-document-model", "ui:Field", "ui:TextField", "ui:Select", "ui:Switch", "ui:NumberStepper", "ui:Card", "lib:i18n-ui", "node:discussion", "node:discussion", "api:agents.list", "contract:DiscussionConfig"]
owns: ["apps/desktop/src/features/workflow-editor/forms/discussion/**", "apps/desktop/src/locales/en/wfed-form-discussion.json", "apps/desktop/src/locales/pl/wfed-form-discussion.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED074: Build the Discussion node form: agenda, rounds, participants, moderator, outcome

## 1. Summary

The Inspector form for a Discussion Node (mock tile 'DYSKUSJA · GRILL-ME — Zakres MVP', '4 rundy · 3 decyzje'): title, agenda, question kind, participants (2 to 8 visible Agents), moderator, maximum rounds, outcome requirement and Skill hints.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). DISC007 binding config `{ title, agenda (1..2000), question ('how'|'what'), participantAgentIds[2..8], moderator ('chief'|AgentId), maxRounds (default 4), skillHints?, outcomeRequirement 'tasks'|'decision'|'either' }`. ADR 0028: private foreign Agents are rejected (`disc.participants_invalid`). A 'what' outcome always needs the Owner (ADR 0016). SPEC 6: a Discussion ends with Tasks, not another Skill. The node in the Workflow starts automatically (no Owner gate for 'how').

## 3. Scope (in)

- `DiscussionForm` with fields as above.
- Participant picker listing Agents visible in this Workspace (`api:agents.list`, public + this Workspace's private) with state glyph and visibility word; Chief can be added.
- Moderator select (Chief default).
- Skill hints chips (names from the Skill library; advisory text, not a grant).
- Outcome requirement and question kind radios with explanations.

## 4. Out of scope

- The form framework, registry and shared inputs (`OVE_WFED069`).
- Runtime behaviour of the Node (WFRT).

## 5. Detailed requirements

1. Title 1..80, agenda textarea 1..2000 with counter and the note 'Agenda jest danymi dla uczestników, nie poleceniem zmieniającym uprawnienia'.
2. Participants: multi-select list with search; min 2, max 8 enforced in the UI with message; each row shows avatar, name, `PUBLICZNY/PRYWATNY`; Agents not usable here are not listed; an Agent already in the config but now invisible shows 'niedostępny' in error tone (validator error).
3. Moderator options: 'Chief' (default) or one of the participants.
4. `maxRounds` stepper 1..10 (default 4); help 'Po limicie rund Chief rozstrzyga, jeśli mieści się w Budżecie i Dokumentacji; w innym razie Eskalacja'.
5. Question: 'jak' (how, Chief can finalise) vs 'co' (what, requires Owner approval) with help text; default 'jak'.
6. Outcome requirement: 'Zadania' / 'Decyzja' / 'Dowolny wynik'; text 'Zadania trafią na Tablicę z odnośnikiem do Dokumentacji'.
7. Skill hints: chip input restricted to Skills visible in the Workspace; shown as 'Podpowiedzi dla moderatora'.
8. During a Run the form shows a link 'Otwórz Dyskusję na żywo' to the Discussion view when a `discussionId` exists for the current execution (from the overlay model).
9. Tile summary text ('4 rundy · 3 decyzje') is runtime output shown by the overlay, not configured here.

## 6. Design notes

Not in the mock. Use `ui:Field`, `ui:Textarea`, a participant list with `ui:Checkbox` rows and `ui:AvatarStack` summary; segmented controls for question and outcome.

## 7. Reuse

- Form framework `OVE_WFED069` (`registerNodeForm`, `useNodeConfigForm`, `ConfigFieldRow`).
- `ui` form primitives listed in `needs`; config schema from `contracts` (`parseNodeConfig`).

## 8. Architecture and code placement

One folder `@WF/forms/discussion/` with `discussion.form.tsx` (registered via the glob in `OVE_WFED069`), `discussion-form-model.ts` (pure defaults, normalisation, field-error mapping) and stories. Depends on the framework, ui-kit and contracts.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Forms edit only the Node's `config` object allowed by the strict per-type schema; they have no permission, secret or path fields (WFRT014 forbids permission fields in config, so a hostile or buggy form cannot add one: unknown keys are rejected on parse). Values typed by the Owner (prompts, conditions, agendas) are stored as data and displayed as text.

## 10. Errors and edge cases

- Participant Agent archived: row error.
- Chief as moderator and participant: allowed.
- Participants count drops below 2 after removal: field error.
- Agenda with Markdown/HTML: stored as text, rendered as text.

## 11. Acceptance criteria

- [ ] Given 1 participant, then the field error 'Wybierz od 2 do 8 uczestników' shows and the commit is withheld.
- [ ] Given a private Agent of another Workspace in the config, then the row shows 'niedostępny'.
- [ ] Given question 'co', then the help states the Owner decides.
- [ ] Given a live Discussion, then the link to the live view appears.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Form tests, participant picker tests with visibility fixtures, stories.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `node:discussion` config follows DISC007's `DiscussionNodeBinding` config; the WFRT discussion node task (WFRT024) may rename fields; align via the contract `parseNodeConfig`.
