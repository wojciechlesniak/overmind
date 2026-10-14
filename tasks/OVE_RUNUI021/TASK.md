---
id: OVE_RUNUI021
title: "Accessibility pass for the Activity view: tables, trace, live regions, keyboard map"
area: RUNUI
kind: test
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS012, OVE_DS104, OVE_RUNUI019, OVE_RUNUI020, OVE_TEST004, OVE_TEST010, OVE_WFED087]
soft_depends_on: []
provides: ["feature:runs-a11y"]
needs: ["lib:ui-a11y-test", "lib:keyboard-test-helpers", "lib:playwright-harness", "ui:a11yAudit", "lib:wfed-live-announcer"]
owns: ["apps/desktop/src/features/runs/__a11y__/**", "apps/desktop/src/features/runs/page/keyboard-map.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI021: Accessibility pass for the Activity view: tables, trace, live regions, keyboard map

## 1. Summary

Page-level accessibility verification and fixes for Runs and Activity: roving focus in the Run list, Gantt row navigation and text alternatives, data table semantics, live region policy for streaming events, replay controls, dialogs and drawers, contrast and reduced motion.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. The Gantt is a visual-first component: every bar needs a text equivalent (name, start, end, state, result) and the table of events can stream hundreds of rows, so announcement policy matters. DS104 audited primitives; this audits the composed view.

## 3. Scope (in)

- Keyboard map and help dialog; announcement policy; focus management; axe and keyboard-only scenarios; contrast checks for state colours (done mint, failed error, running magenta, waiting amber on `#140F20`); reduced-motion checks.

## 4. Out of scope

- Kit-level audit (DS104).

## 5. Detailed requirements

1. Keyboard: `Tab` order list -> header -> trace -> events -> usage; list: arrows/Home/End/Enter; trace: arrows between rows, Enter selects, `K` opens row actions; table: arrows move rows, Enter opens details; replay: Space, `,` `.` `[` `]`, slider keys; `?` opens the shortcut dialog; `Esc` closes drawers/dialogs and restores focus.
2. Gantt text alternative: each row exposes `aria-label` 'Developer, iteracja 2, od 14:12 do 14:21, ukończony, 4 pliki'; the card has a visually hidden summary table alternative (same data) reachable by a 'Pokaż jako tabelę' toggle for screen reader users.
3. Live regions: reuse the shared announcer (`lib:wfed-live-announcer`, from the editor a11y task) so both views follow one policy: no per-event announcements while streaming; announce only Run state changes, 'N nowych zdarzeń' count changes (throttled 5 s), failures (assertive only for Run failure).
4. Colour independence: automated check that each trace status and result category has glyph + word.
5. Contrast matrix computed in Playwright for state colours on card backgrounds (4.5:1 text, 3:1 bars/borders).
6. Reduced motion: shimmer, glow animation and live-row highlights disabled.
7. Axe on all page states: default, running, finished, escalated, replay, drawers open, empty, error.
8. 200% text zoom: no clipped controls; columns collapse per layout rules.

## 6. Design notes

N/A, tests and fixes only.

## 7. Reuse

- `lib:ui-a11y-test`, `lib:keyboard-test-helpers`, shared announcer.

## 8. Architecture and code placement

`@RU/__a11y__/` specs, `keyboard-map.ts` data.

## 9. Security and safety

Announcements contain only data already visible; no hidden values.

## 10. Errors and edge cases

- Streaming 100 rows per second: announcer queue capped.
- Gantt with 300 rows: table alternative paged.
- Drawer opened from drawer: focus stack.

## 11. Acceptance criteria

- [ ] axe clean on all listed states.
- [ ] Keyboard-only journey completes: select Run, select trace row, filter events to issues, open tool log, start/stop replay, export dialog open/close.
- [ ] Gantt text alternative exposes the same data as the bars.
- [ ] Contrast matrix and reduced-motion tests pass.

## 12. Test plan

Unit: keyboard-map duplicates, announcer policy with fixtures. Playwright: `a11y-runs.spec.ts`, `keyboard-runs.spec.ts`. `pnpm --filter desktop test:e2e -g a11y-runs`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: the shared announcer from the editor a11y task is reused (capability `lib:wfed-live-announcer`, provided by `OVE_WFED087` as `feature:wfed-a11y`; naming flagged).
