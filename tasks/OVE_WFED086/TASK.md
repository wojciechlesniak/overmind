---
id: OVE_WFED086
title: "Design and implement empty, loading and error states of the Workflow page"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS032, OVE_DS040, OVE_ENGINE007, OVE_WFED050, OVE_WFED085]
soft_depends_on: []
provides: ["feature:wfed-page-states"]
needs: ["ui:EmptyState", "ui:Skeleton", "ui:Button", "ui:InfoNote", "lib:wfed-data-hooks", "lib:compat-handshake", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/states/**", "apps/desktop/src/locales/en/wfed-states.json", "apps/desktop/src/locales/pl/wfed-states.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED086: Design and implement empty, loading and error states of the Workflow page

## 1. Summary

All the page-level states the mock does not draw: no Workflow yet, empty canvas of a new Workflow, no Node selected, no Run, loading skeletons for each region, engine unreachable, incompatible engine version, Workflow not found, draft conflict banner and per-region load errors with retry.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). VIEWS lists the missing states for Main: empty canvas (new Workflow), Inspector empty state, validation errors, edit vs read-only mode, Run finished/failed/cancelled, plus default hover/focus/disabled/loading/error/empty. Error messages use typed errors (`wfrt.*`, `engine.unreachable`, `client.contract_mismatch`) mapped to i18n copy, never raw server text.

## 3. Scope (in)

- `PageEmpty` (no Workflow in Workspace), `CanvasEmpty` (new Workflow with Start/End hint), `RegionSkeleton` variants, `RegionError`, `EngineUnreachable`, `VersionMismatch`, `NotFound`.
- Error-code to copy mapping table `error-copy.ts`.
- Retry and backoff helpers (manual retry; automatic every 10 s for `engine.unreachable` while the page is visible).

## 4. Out of scope

- Inspector empty state (`OVE_WFED063`).
- Global engine status UI (SHELL).

## 5. Detailed requirements

1. `PageEmpty`: icon, 'Brak Workflow w tym Workspace', text 'Poproś Chiefa o przepływ pracy albo utwórz pierwszy Workflow.', buttons 'Utwórz Workflow' (opens the creation flow from part 1) and 'Otwórz czat z Chiefem'.
2. `CanvasEmpty`: overlay card in the stage: 'Pusty Workflow', 'Przeciągnij Węzeł z palety albo zacznij od szablonu.', 'Start i End zostaną dodane automatycznie.'; palette highlight via part 1 (callback), disappears on the first Node.
3. Skeletons: header (title + badges), strip (3 chips), Inspector (cards), stage (grid with 3 ghost tiles); respect reduced motion (no shimmer).
4. Error states: per-region inline card with 'Nie udało się wczytać <region>' + code word + 'Spróbuj ponownie'; page-level `EngineUnreachable` ('Silnik nie odpowiada. Praca w tle trwa, jeśli silnik działa. Spróbuj ponownie.') with automatic retry every 10 s and a manual button; `VersionMismatch` ('Aplikacja i silnik mają różne wersje. Zaktualizuj aplikację.') with no retry loop; `NotFound`.
5. Draft conflict banner (from `OVE_WFED057` results) and 'Ta wersja robocza jest otwarta w innym oknie' banner.
6. All copy in `wfed-states` namespace; error code -> copy via `error-copy.ts` with exhaustive test (every `wfrt.*` code in contracts has a mapping or the generic fallback key).

## 6. Design notes

Not in the mock. Empty/loading/error patterns come from `ui:EmptyState` and `ui:Skeleton`; error tone `#FF8FA3` with ✗ glyph; no illustrations beyond DS icons.

## 7. Reuse

- `ui:EmptyState`, `ui:Skeleton`, `ui:InfoNote`, `ui:Button`.

## 8. Architecture and code placement

`@WF/states/` components + `error-copy.ts` (pure table). Used by `OVE_WFED085` and regions through props.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Error copy is keyed by code; server messages are never displayed. Auto-retry is bounded (10 s interval, paused when hidden).

## 10. Errors and edge cases

- Unknown error code: generic copy with the code in mono for support.
- Two simultaneous region errors: both shown independently.
- Retry succeeds: state clears without a page reload.

## 11. Acceptance criteria

- [ ] Given a new Workflow, then the canvas empty card shows and vanishes on the first Node.
- [ ] Given `engine.unreachable`, then the page error state shows and retries automatically every 10 s.
- [ ] Given an unknown `wfrt.*` code, then the generic copy is used (test over the contract code list).
- [ ] Given reduced motion, then skeletons do not animate.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`error-copy.test.ts` (exhaustiveness against contracts), stories for each state, axe.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: 'Utwórz Workflow' flow belongs to part 1 or WSPACE; the button calls a handler provided by capability `feature:workflow-create-flow` (flagged).
