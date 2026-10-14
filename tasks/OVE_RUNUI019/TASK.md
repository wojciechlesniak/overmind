---
id: OVE_RUNUI019
title: "Compose the Activity page: layout, selection state, deep links and region coordination"
area: RUNUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_DS044, OVE_DS045, OVE_PAUSE010, OVE_RUNUI003, OVE_RUNUI004, OVE_RUNUI006, OVE_RUNUI008, OVE_RUNUI009, OVE_RUNUI011, OVE_RUNUI014, OVE_RUNUI016, OVE_RUNUI017, OVE_RUNUI018, OVE_SHELL027]
soft_depends_on: []
provides: ["feature:runs-page", "feature:runs-manifest"]
needs: ["ui:PageLayout", "ui:SidePanel", "ui:SubTabs", "lib:feature-manifest", "lib:app-navigation", "lib:i18n-ui", "lib:use-pause"]
owns: ["apps/desktop/src/features/runs/page/**", "apps/desktop/src/features/runs/feature.manifest.ts", "apps/desktop/src/locales/en/runs-page.json", "apps/desktop/src/locales/pl/runs-page.json"]
reads: []
design: design.png
design_source: "Activity (crop 72,162,1368,738, whole Activity page below the shell)"
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI019: Compose the Activity page: layout, selection state, deep links and region coordination

## 1. Summary

The `RunsPage` of the 'Runy i Activity' tab: list panel (250), main column (header, outcome banner, trace, events) and usage panel (300), the selected Run in the URL, replay and drawer coordination, and the feature manifest that registers the route under the Workflow rail item.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Activity layout (1440x900): rail 72 + top bar + tab bar, then runs list 250 (x=72..322), main 818 (x=322..1140) with header 90, trace card 397, Activity events 272+ (overflows: scroll), usage panel 300 (x=1140..1440). Shell is provided by SHELL; the Workflow rail item has two tabs 'Canvas' and 'Runy i Activity' (SubTabs); the Canvas tab belongs to WFED.

## 3. Scope (in)

- `RunsPage` composition and layout.
- Page state: selected Run, selected execution, replay, drawers, filters in the URL.
- `feature.manifest.ts` (route `/workflow/runs`, tab 'Runy i Activity', rail item Workflow) discovered by `import.meta.glob`.
- Boundaries: error boundaries per region, document title.

## 4. Out of scope

- Regions' content (their tasks).
- Canvas page (WFED).

## 5. Detailed requirements

1. Layout columns as in the mock; each of the three columns scrolls independently (the Run header scrolls with the main column; the events table has its own sticky head); the page itself never scrolls.
2. Manifest: `{ id:'runs', route:'/workflow/runs', railItem:'workflow', tab:{ key:'runs', label:'Runy i Activity' }, component: lazy(RunsPage) }`; lazy loaded (the trace and replay code are code-split).
3. URL state: `?run=<id>&node=<executionKey>&agent=<id>&issues=1&kind=...&replay=<seq>&tool=<callId>`; unknown params ignored; the page is a pure function of URL + data.
4. Region coordination: selecting a trace row filters the events table and highlights; opening replay suspends live; opening the tool drawer keeps the page state; selecting another Run resets node filter and replay.
5. Keyboard landmarks: `main` (centre), `complementary` for list and usage, `region` for 'Ślad Runu' and 'Activity'; skip links 'Przejdź do śladu', 'Przejdź do zdarzeń'; tab order list -> header -> trace -> events -> usage.
6. Global Pause: no banner here (top bar owns it); Run actions use their own rules.
7. Responsive: below 1180 px the usage panel becomes a drawer ('Zużycie' button in the header); below 900 px the list becomes a select above the content.
8. Document title 'Run #14 · Activity'.
9. Performance: first render under 400 ms after data for 30 Runs and 300 executions; trace and events lazy components.

## 6. Design notes

`design.png` is the Activity page region below the shell (1368x738) as in the mock (clipped at the bottom: the events table continues and scrolls). States not in the mock: replay bar, drawers, narrow layouts, per-region errors.

## 7. Reuse

- `ui:PageLayout`, `ui:SidePanel`; all region containers; `lib:feature-manifest`.

## 8. Architecture and code placement

`@RU/page/` (`RunsPage.tsx`, `use-activity-url-state.ts` pure, `ErrorBoundaries.tsx`), `@RU/feature.manifest.ts`. Only file that knows every region; regions communicate through props and the URL state hook.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Route params are validated (`run_` id format, enum filters); unknown ids show not-found without confirming existence in other Workspaces.

## 10. Errors and edge cases

- No Runs: whole page empty state (`OVE_RUNUI020`).
- Selected Run deleted: falls back to default selection.
- Deep link with `replay=` for a Run too large: replay refused with the explanation.
- Region crash: isolated.

## 11. Acceptance criteria

- [ ] Given the mock fixtures, then the page equals `design.png` for the visible area and each column scrolls internally.
- [ ] Given a URL with `?run=12&issues=1`, then Run #12 is selected and the issues filter is on.
- [ ] Given a region throws, then other regions remain usable.
- [ ] Given a manifest glob run, then the route and tab appear without editing shared files.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`use-activity-url-state.test.ts`, page composition test with fake hooks, stories (`Running`, `Finished`, `Escalated`, `Replay`), manifest test, visual in `OVE_RUNUI022`.

## 13. Parallelization notes

Last composition task of the Activity view. Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: SHELL provides the Workflow rail item with a SubTabs host that reads manifests with `tab` entries (flagged).
