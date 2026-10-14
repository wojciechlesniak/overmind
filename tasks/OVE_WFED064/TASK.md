---
id: OVE_WFED064
title: "Show the Agent State card with evidence in the Inspector (live, hint-aware)"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGENT001, OVE_AGENT009, OVE_AGENT010, OVE_ARCH011, OVE_DS103, OVE_WFED050, OVE_WFED063]
soft_depends_on: []
provides: ["feature:wfed-agent-state-card"]
needs: ["ui:AgentStateCard", "lib:wfed-data-hooks", "api:agents.states", "contract:AgentState", "lib:agent-state-derivation", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/inspector/sections/agent-state.section.tsx", "apps/desktop/src/features/workflow-editor/inspector/sections/agent-state-model.ts"]
reads: []
design: design.png
design_source: "Main#canvas/inspector-agent-state (crop 1160,240,270,120)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED064: Show the Agent State card with evidence in the Inspector (live, hint-aware)

## 1. Summary

Fills the 'STAN AGENTA' card from the live Agent presence (state, reason, evidence) and the Node's execution (iteration 2 of 5). The card states plainly when the state is only a CLI hint, and shows the real evidence (files in the worktree, tests) that backs a 'finished' state.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). ADR 0026: herdr agent state is a hint, not proof; Tasks advance only after the effect or the `overmind` Skill report is verified. AGENT009/010 derive `AgentStateView` from signals and evidence; `finished_unread` and `stale` exist. Mock: 'Skończył · iteracja 2 z 5' (mint) and 'Dowód: 4 pliki w worktree, testy 112 z 112'.

## 3. Scope (in)

- `AgentStateSection` and `buildAgentStateCard(view, execution)` pure mapper.
- Iteration label from the Node's Loop scope (`NodeExecution.scope` `quality-loop:2`, loop limit from Loop config).
- Evidence line from `AgentStateView.evidence` (artifact summaries), hint suffix, stale marker.

## 4. Out of scope

- Chips strip (`OVE_WFED079`).
- Derivation of state (AGENT009).

## 5. Detailed requirements

1. Data: `useAgentStates(workspaceId)` filtered by the Node's `agentRef.agentId`; the Node's latest `NodeExecution` from the active Run for iteration and `waitingFor`.
2. State text by `agentStateTone`: working 'Pracuje', waiting-approval 'Czeka na Zgodę', idle 'Czeka' / 'Bezczynny', finished 'Skończył', failed 'Błąd', paused 'Wstrzymany', login needed 'Wymaga zalogowania'; suffix ` · iteracja 2 z 5` when inside a Loop.
3. Evidence: `Dowód: <summary>` where the summary is built from verified evidence only (artifact kinds and counts reported by the engine). If the state is `finished` but there is no verified evidence, show 'Zgłosił koniec · brak dowodu' in amber (hint-not-proof rule).
4. Hint marker: when `source` is `herdr_hint` without confirmation, append the muted note 'wg herdr' (title: 'Stan z terminala to wskazówka, nie dowód').
5. `stale: true` appends 'nieaktualne' and mutes the text.
6. Idle Agent with no execution: 'Bezczynny' and 'Brak dowodu pracy'.
7. Live updates: re-render on `agent.state.changed` (patched cache); a polite live region announces changes of the Inspected Agent only.
8. Evidence text is plain text, 2 lines clamp with `title` full; selectable.

## 6. Design notes

`design.png`: nested Card r16 padding 14, label 'STAN AGENTA' mono 11, state line 16/700 mint with check glyph, evidence 13/1.45 secondary. Other states use `agentStateTone` colours with their glyphs (working magenta ●, waiting amber ◆, failed error ✗, idle grey ○); state is always glyph + word.

## 7. Reuse

- `ui:AgentStateCard`, `stateMaps` (DS040), `useAgentStates` (`OVE_WFED050`).

## 8. Architecture and code placement

`agent-state-model.ts` (pure) + `agent-state.section.tsx` registered through the section registry.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Evidence is shown from engine-verified records only; Agent-written claims ('tests passed') are never rendered as evidence. Evidence strings are untrusted text.

## 10. Errors and edge cases

- No Run active: shows the Agent's last known state with 'ostatnio: 14:21'.
- Agent works in another Workspace's Run: not visible (scope).
- Evidence list very long: first 2 items + '+N'.
- Conflicting signals: server resolves; the UI shows what it receives.

## 11. Acceptance criteria

- [ ] Given state finished with 4 files and tests 112/112, then the card equals `design.png`.
- [ ] Given finished without evidence, then amber 'Zgłosił koniec · brak dowodu' shows.
- [ ] Given a state change event, then the card updates without refetch and the change is announced.
- [ ] Given stale state, then 'nieaktualne' is appended.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`agent-state-model.test.ts` (table of states x evidence x stale x loop), stories per state, axe, visual crop.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `AgentStateView` includes `evidence: {summary: string, verified: boolean}[]` as defined in AGENT009/010; adjust the mapper if the field is named differently.
