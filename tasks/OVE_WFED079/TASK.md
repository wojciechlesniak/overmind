---
id: OVE_WFED079
title: "Wire the 'Chief nadzoruje' strip with live Agent state chips"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT010, OVE_ARCH011, OVE_DS042, OVE_DS101, OVE_PAUSE010, OVE_WFED025, OVE_WFED050]
soft_depends_on: []
provides: ["feature:wfed-supervision-strip"]
needs: ["ui:AgentStateChipsStrip", "ui:AgentStateChip", "api:agents.states", "lib:wfed-data-hooks", "feature:editor-canvas-controller", "feature:editor-selection", "lib:use-pause", "ui:SlotsPill", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/strip/**", "apps/desktop/src/locales/en/wfed-strip.json", "apps/desktop/src/locales/pl/wfed-strip.json"]
reads: []
design: design.png
design_source: "Main#canvas/chief-supervision-strip (crop 330,280,802,94)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED079: Wire the 'Chief nadzoruje' strip with live Agent state chips

## 1. Summary

The strip above the canvas: a Chief block ('6 agentów · 3 z 3 slotów') and one live chip per Agent used in the Workflow ('Product Owner skończył', 'QA pracuje', 'Security czeka na Zgodę', 'Senior Reviewer czeka'). Clicking a chip selects and centres the Agent's Node.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). SPEC 7 ('Chief nadzoruje' strip) and ADR 0026: states are hints from the terminal layer plus evidence. AGENT010 provides the presence projection (`agent.state.changed`); the slots figure mirrors the top bar pill (PROV019, default 3 parallel Agents). Mock region `canvas/chief-supervision-strip` (330,280,802x94): Chief avatar + label, summary mono, chips for six Agents in two rows.

## 3. Scope (in)

- `SupervisionStrip` container mapping data to DS101 props.
- Chip model: one chip per distinct Agent referenced by Nodes (Agent, Review, Quality Gate reviewers), ordered by Node position (left to right, top to bottom).
- Slots text from provider concurrency state.
- Click-to-focus behaviour and live announcements.

## 4. Out of scope

- `AgentStateChipsStrip` component (DS101).
- Presence derivation (AGENT009/010).

## 5. Detailed requirements

1. Chief block: avatar 'C', label 'Chief nadzoruje', summary `{n} agentów · {used} z {max} slotów` (word units; Polish plural keys 'agent/agenty/agentów'); `used`/`max` from the same source as the top-bar `SlotsPill` (do not recompute).
2. Chips: one per Agent: initials, hue by Agent hue map, name, state word+glyph from `agentStateTone`: 'skończył' mint, 'pracuje' magenta, 'czeka na Zgodę' amber, 'czeka' grey, 'błąd' error, 'wstrzymany' grey, 'wymaga zalogowania' amber.
3. State source: `useAgentStates`; patched live; an Agent without a signal is 'czeka' (idle) with title 'Brak aktywności'.
4. Only Agents visible in the Workspace are shown (scope from the hook); a Node whose Agent is gone shows a chip 'Agent niedostępny' in error tone.
5. Click or Enter on a chip: `selectNode(firstNodeOfAgent)` + `focusNode` through the part 1 controller; repeated click cycles through that Agent's other Nodes.
6. When Global Pause is active every chip shows 'wstrzymany' and the Chief block adds 'Wszystko wstrzymane'.
7. Dry-run: chips show 'dry-run' state words ('symulacja') in grey since no Agent works.
8. Wrapping and '+N' popover are handled by DS101 (max 3 rows).
9. Live region: at most one announcement per 2 s: 'Developer: pracuje'.
10. View-only history (viewing a finished Run or old Version): chips show the states at the end of the Run from NodeExecution data, labelled 'stan z Runu #12'.

## 6. Design notes

`design.png` is the whole strip (two rows, magenta-gradient edge, bg gradient `#1C0B19` to `#120D1C`); `design-chips.png` zooms on the chips. States not in the mock: failed, paused, login needed, dry-run, Agent unavailable, loading (skeleton chips), error (strip shows 'Stan Agentów niedostępny' + retry).

## 7. Reuse

- `ui:AgentStateChipsStrip`, `ui:AgentStateChip`, `stateMaps`, `useAgentStates`, part 1 controller.

## 8. Architecture and code placement

`@WF/strip/SupervisionStrip.tsx`, `strip-model.ts` (pure: nodes + states -> chip props, ordering, plural keys).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. States are hints and are labelled as such in the title attribute ('wg terminala'); nothing here authorises work. Only visible Agents are listed.

## 10. Errors and edge cases

- One Agent in several Nodes: one chip.
- More than 12 Agents: '+N' popover.
- Agent state stale: chip text muted with 'nieaktualne' in title.
- Presence endpoint fails: error state, strip keeps last known chips marked stale.

## 11. Acceptance criteria

- [ ] Given the mock data (six Agents), then the strip equals `design.png`.
- [ ] Given an `agent.state.changed` event, then the chip updates without refetch.
- [ ] Given a chip click, then the Agent's Node is selected and centred.
- [ ] Given Global Pause, then all chips read 'wstrzymany'.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`strip-model.test.ts`, component tests, stories per state, axe, visual crop vs both images.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: slots figures are available through `lib:use-pause`-style shared hook `useAgentSlots` owned by SHELL; if absent the summary omits slots.
