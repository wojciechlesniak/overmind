---
id: OVE_RUNUI020
title: "Implement empty, loading and error states of the Activity view"
area: RUNUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS013, OVE_DS032, OVE_DS040, OVE_ENGINE007, OVE_RUNUI001, OVE_RUNUI019]
soft_depends_on: []
provides: ["feature:runs-states"]
needs: ["ui:EmptyState", "ui:Skeleton", "ui:InfoNote", "ui:Button", "lib:runs-data-hooks", "lib:compat-handshake", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/runs/states/**", "apps/desktop/src/locales/en/runs-states.json", "apps/desktop/src/locales/pl/runs-states.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI020: Implement empty, loading and error states of the Activity view

## 1. Summary

The states the mock does not draw: no Runs yet, no events for the filters, loading skeletons per region, per-region and page-level errors (engine unreachable, version mismatch), cursor expiry, cancel confirmation outcome and finished-Run header variants.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. VIEWS 'states NOT shown' for Activity: no Runs yet, loading, error loading events, cancel confirmation, replay mode, filter select open, empty filter result, finished Run header variants, hover on trace bars. Error copy is keyed by typed error codes (`wfrt.*`, `engine.unreachable`, `client.contract_mismatch`, `audit.*`).

## 3. Scope (in)

- `PageEmpty` (no Runs), `FilterEmpty`, `RegionSkeleton` family, `RegionError`, `EngineUnreachable`, `VersionMismatch`.
- `error-copy.ts` mapping codes -> copy keys with exhaustive tests.
- Auto-retry policy for unreachable engine.

## 4. Out of scope

- Editor states (`OVE_WFED086`): separate copy file, same patterns.

## 5. Detailed requirements

1. No Runs: 'Brak Runów' + 'Workflow nie był jeszcze uruchomiony. Uruchom go z Canvas albo poproś Chiefa.' buttons 'Przejdź do Canvas', 'Otwórz czat z Chiefem'; the usage panel still shows limits.
2. Filter empty: 'Brak zdarzeń dla tych filtrów' + 'Wyczyść filtry'.
3. Skeletons: list (4 rows 73 px), header, trace (8 rows), table (5 rows), usage (3 meters); no shimmer under reduced motion.
4. Region error: 'Nie udało się wczytać <region>' + code word + 'Spróbuj ponownie'; the rest of the page stays usable.
5. Engine unreachable (page level): 'Silnik nie odpowiada. Zapisane dane Runów są bezpieczne.' with automatic retry every 10 s while visible and a manual button; version mismatch: 'Aplikacja i silnik mają różne wersje.' (no retry loop).
6. Cursor expired: toast 'Starsze zdarzenia zostały usunięte zgodnie z retencją. Pokazuję najnowsze.' and reload from head.
7. Cancel confirmation outcome: success toast 'Anulowanie Runu #14 w toku' (via shared controls), no state here beyond copy keys.
8. Finished-Run header variants are in `OVE_RUNUI004`; this task supplies their copy keys test (exhaustive over `RunStatus`).
9. Error-code exhaustiveness: every `wfrt.run_*` and `audit.*` code in contracts has copy or falls to the generic key (test).

## 6. Design notes

Not in the mock; patterns from `ui:EmptyState`, `ui:Skeleton`, `ui:InfoNote`; error tone `#FF8FA3` with ✗.

## 7. Reuse

- `ui:EmptyState`, `ui:Skeleton`, `ui:InfoNote`.

## 8. Architecture and code placement

`@RU/states/` components and `error-copy.ts`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Error copy is keyed by code; server text is never shown.

## 10. Errors and edge cases

- Unknown code: generic copy with the code in mono.
- Two region errors: independent.
- Retry success: clears without reload.

## 11. Acceptance criteria

- [ ] Given no Runs, then the empty page shows with both actions.
- [ ] Given `engine.unreachable`, then the page error shows and retries every 10 s.
- [ ] Given an unknown code, then generic copy is used (test over contract codes).
- [ ] Given reduced motion, then no shimmer.
- [ ] Storybook stories (or feature-level stories with fixtures) exist for every variant and every state listed in section 6, including states the mock does not draw.
- [ ] All visible strings and aria-labels come from the i18n namespace named in this task (EN and PL files present, key lint from OVE_ARCH011 passes); no hard-coded copy.
- [ ] Fully keyboard operable with a visible focus ring; axe check is clean (`lib:ui-a11y-test`).
- [ ] Visual comparison against `design.png` is within tolerance where a design crop exists (`lib:visual-regression`).

## 12. Test plan

`error-copy.test.ts`, stories per state, axe.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- None.
