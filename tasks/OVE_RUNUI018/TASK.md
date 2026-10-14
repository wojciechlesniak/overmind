---
id: OVE_RUNUI018
title: "Show the failure and escalation detail banner for failed, escalated and cancelled Runs"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS040, OVE_RUNUI001, OVE_RUNUI004, OVE_SHELL027, OVE_WFRT006, OVE_WFRT007]
soft_depends_on: []
provides: ["feature:runs-outcome-banner"]
needs: ["contract:WorkflowRun", "event:run.escalated", "ui:InfoNote", "ui:Button", "ui:RunLink", "lib:app-navigation", "lib:runs-data-hooks", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/outcome/**", "apps/desktop/src/locales/en/runs-outcome.json", "apps/desktop/src/locales/pl/runs-outcome.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 16"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI018: Show the failure and escalation detail banner for failed, escalated and cancelled Runs

## 1. Summary

A banner under the Run header that explains how a Run ended or why it is stuck: escalation (iteration, time or cost limit reached, no fallback model), failure with the failing Node and a safe error code, cancellation with actor and reason, and what the Owner can do next (open Zgody, open the Node on Canvas, open the tool log).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. SPEC 7: a Loop that exhausts its limits exits via `onExhausted` and Chief escalates; SPEC 9: a depleted subscription limit switches to a fallback model or escalates; the mock list shows '#9 Eskalacja — limit 5 iteracji'. The Owner needs one place that states what happened, in plain words, with evidence and the next step. The same outcome texts power the editor's `RunEndBanner`.

## 3. Scope (in)

- `OutcomeBanner` and the pure `outcomeModel(run, escalation)` mapping.
- Escalation kinds: `loop_exhausted`, `budget_exceeded`, `no_fallback_model`, `approval_needed`, `discussion_deadlock`, `action_ambiguous`, `other`.
- Actions per kind.

## 4. Out of scope

- Escalation resolution UI (APPRUI Zgody).
- Editor banner (`OVE_WFED083`) — shares copy keys through a shared i18n namespace `run-outcome` created here and imported there.

## 5. Detailed requirements

1. Escalated: amber banner 'Eskalacja: <reason>'. Reasons: loop_exhausted 'Pętla jakości wyczerpała limit 5 iteracji. Quality Gate nadal nie jest spełniony.'; budget_exceeded 'Run przekroczył budżet: <what>.'; no_fallback_model 'Limit Claude Max wyczerpany, brak modelu zapasowego.'; approval_needed 'Run czeka na decyzję Właściciela.'; discussion_deadlock 'Dyskusja nie doszła do porozumienia w limicie rund.'; action_ambiguous 'Nie wiadomo, czy akcja <name> została wykonana. Chief nie powtórzy jej bez Twojej decyzji.'
2. Failed: error-tone banner 'Run zakończony błędem w Węźle <label>: <code word>' with evidence line when the Quality Gate failed ('testsPassed = 96% · wymagane 100%').
3. Cancelled: grey banner '<Ty|Chief|limit> anulował Run: <reason>'.
4. Succeeded: no banner (the pill and header suffice) except when the Run created Tasks: info line '4 Zadania trafiły na Tablicę' with link to Tablica.
5. Actions (buttons): 'Otwórz w Zgodach' (escalation or approval), 'Pokaż Węzeł na Canvas' (failing/exhausted Node), 'Dziennik narzędzi', 'Pokaż Dyskusję' (deadlock); each only when the target exists.
6. Texts from i18n by `kind`/code with params; unknown code -> generic 'Run zakończył się nieoczekiwanie (kod: x)'; never raw server messages.
7. Resolved escalation (`run.escalation_resolved`): banner turns neutral 'Eskalacja rozwiązana: <outcome>' with the decision link.
8. Banner is a `role=status` region; focus is not stolen.

## 6. Design notes

Not in the mock. `ui:InfoNote` tones: amber for escalation, error for failure, grey for cancelled; each with glyph and word, never colour only.

## 7. Reuse

- `ui:InfoNote`, `ui:Button`, `ui:RunLink`; copy keys shared with `OVE_WFED083`.

## 8. Architecture and code placement

`@RU/outcome/` (`outcome-model.ts` pure, `OutcomeBanner.tsx`).

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Escalation text never executes or interprets any Agent output; evidence values come from the engine's Gate evaluation records.

## 10. Errors and edge cases

- Several escalations: the newest unresolved is shown, '+1' link lists others.
- Failure at the Join (member failed): says which member.
- Missing escalation record: falls back to the Run's `failure`/`pauseReasons`.

## 11. Acceptance criteria

- [ ] Given Run #9 escalated by the 5-iteration limit, then the amber banner reads the loop exhausted text with the Zgody action.
- [ ] Given a failed Quality Gate, then the evidence line shows measured and required values.
- [ ] Given a resolved escalation, then the banner is neutral.
- [ ] Every `kind` has copy and an action set (exhaustive test).
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`outcome-model.test.ts` (table over kinds), component tests, stories per kind, axe.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: escalation records include `kind` and params (WFRT040 `esc_` contract); adjust when written.
