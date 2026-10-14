---
id: OVE_RUNUI011
title: "Wire the Usage panel: Limity wg CLI, per-Agent time, grouping switch and breakdown"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS025, OVE_DS036, OVE_DS069, OVE_DS077, OVE_RUNUI001, OVE_RUNUI010]
soft_depends_on: []
provides: ["feature:runs-usage"]
needs: ["ui:UsagePanel", "ui:UsageBarRow", "ui:SegmentedControl", "ui:DataTable", "ui:Dialog", "lib:runs-data-hooks", "lib:runs-usage-model", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/usage/UsagePanelContainer.tsx", "apps/desktop/src/features/runs/usage/UsageBreakdownDialog.tsx", "apps/desktop/src/features/runs/usage/index.ts", "apps/desktop/src/locales/en/runs-usage.json", "apps/desktop/src/locales/pl/runs-usage.json"]
reads: []
design: design.png
design_source: "Activity#activity/usage-panel (crop 1140,162,300,738)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI011: Wire the Usage panel: Limity wg CLI, per-Agent time, grouping switch and breakdown

## 1. Summary

The 300 px right panel: 'Limity wg CLI' (live meters), 'Run #14 według Agentów' and the reproducibility block, plus a 'Szczegóły zużycia' dialog that groups usage by Provider, model, Agent, Run or Workspace.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Mock region `activity/usage-panel` (1140,162,300x738): heading 'Limity wg CLI' with Claude Max 62% · reset 3 h, ChatGPT Pro · Codex 38% · reset 5 dni, Ollama · lokalnie bez limitu, the footnote, 'Run #14 według Agentów' with bars, 'Odtwarzalność' key-values (`OVE_RUNUI012`). DS077 `UsagePanel` renders.

## 3. Scope (in)

- Container feeding `UsagePanel` (limits, per-Agent rows for the selected Run, footnote).
- Reproducibility slot filled by `OVE_RUNUI012`.
- 'Szczegóły zużycia' dialog with group-by segmented control and table.
- Live updates on usage events.

## 4. Out of scope

- UsagePanel (DS077).
- Model (`OVE_RUNUI010`), reproducibility (`OVE_RUNUI012`).

## 5. Detailed requirements

1. Heading 'Limity wg CLI' with the footnote 'Wartości raportuje samo CLI. Przy 90% Chief przełącza Agentów na model zapasowy.' (always shown) — the 90% figure comes from config (`provider.fallbackThresholdPercent`, default 90) via the config route so copy and behaviour cannot diverge; if unavailable the sentence omits the number.
2. Limits refresh on `provider.limit_reached|limit_reset|model_switched` and every 60 s while visible (CLI values change slowly); `stale` text 'nieaktualne' when older than 15 min.
3. Per-Agent section heading `Run #14 według Agentów`; rows for the selected Run only; a link 'Szczegóły zużycia' (text link) opens the dialog.
4. Dialog: segmented control Dostawca / Model / Agent / Run / Workspace; table per `breakdown` with the columns from the model; 'Eksportuj CSV' is NOT offered (export lives in the report, `OVE_RUNUI017`); close with Esc.
5. Loading skeleton per section; error per section with retry; the footnote still renders.
6. No-limit sources show 'bez limitu' and a short bar; unknown percent shows an empty track and 'brak danych wg CLI'.
7. The panel scrolls inside itself; its width is fixed 300 and collapses below 1180 px viewport width into a button 'Zużycie' that opens it as a drawer.
8. `aria-label` on each meter with the full sentence 'Claude Max 62 procent, reset za 3 godziny, według CLI'.

## 6. Design notes

`design.png` shows the panel; `design-limits.png` and `design-per-agent.png` zoom into sections. Meter tones: violet below 70, amber 70-89, error from 90 with the words 'blisko limitu'. The grouping dialog and drawer mode are not in the mock (derive from DS036 and DS069).

## 7. Reuse

- `ui:UsagePanel`, `ui:SegmentedControl`, `ui:DataTable`, `ui:Dialog`.

## 8. Architecture and code placement

`@RU/usage/` containers + `UsageBreakdownDialog.tsx`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason.

## 10. Errors and edge cases

- CLI disconnected: its row shows 'niepodłączone' with a link to Połączenia.
- Run selected has no usage yet: 'Brak danych o zużyciu'.
- Fallback threshold config unreadable: copy without the number.

## 11. Acceptance criteria

- [ ] Given the mock data, then the panel equals `design.png`.
- [ ] Given a `provider.limit_reached` event, then the limits refetch.
- [ ] Given group-by Agent in the dialog, then the table groups and totals match the panel.
- [ ] Given 95%, then the meter is in the error tone with the word 'blisko limitu'.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

Component tests, stories, axe, visual crops.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `provider.fallbackThresholdPercent` is exposed by the config route (`api:config.get`); otherwise the number is omitted.
