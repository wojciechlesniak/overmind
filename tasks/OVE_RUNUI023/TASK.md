---
id: OVE_RUNUI023
title: "Add end-to-end tests of the Activity view against the mock gateway"
area: RUNUI
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_RUNUI009, OVE_RUNUI014, OVE_RUNUI016, OVE_RUNUI017, OVE_RUNUI019, OVE_TEST004]
soft_depends_on: []
provides: ["lib:runs-e2e-suite"]
needs: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:e2e-fixtures"]
owns: ["apps/desktop/src/features/runs/__e2e__/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_RUNUI023: Add end-to-end tests of the Activity view against the mock gateway

## 1. Summary

Playwright scenarios for the Runs and Activity view: list and selection, live trace updates, filters (Run, Agent, only issues), tool log redaction, usage 'wg CLI', replay with pinned versions, export, cancel, and resilience (reconnect, errors).

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). The Activity view ('Runy i Activity' tab, Main nav item Workflow, second tab) is the observability surface of SPEC 15: who did what and when, which Tool was called with what result, usage per Provider, model, Agent, Run and Workspace (CLI limits as the CLI reports them, 'wg CLI'), reproducibility of a Run (graph, Agent, Skill and model versions), live view with filters by Run and Agent, redaction of secrets and personal data, report export. Scenarios use the mock gateway with scripted events and a recorded Run fixture; they map to SPEC 16 criteria 7 (Run continues after the window closes and state is preserved: simulated with reconnect), 12 (limit switch notification shown in usage) and 14 (pause/cancel visible).

## 3. Scope (in)

- Scenarios R1-R10 below.

## 4. Out of scope

- Editor e2e (`OVE_WFED089`).

## 5. Detailed requirements

1. R1 list: Runs show in the mock order with the mock copy; selecting #12 updates header and trace and sets `?run=12`.
2. R2 live: scripted `run.node.*` events extend the Gantt (running bar grows, new row appears) and prepend table rows while at the top; when scrolled down the pill 'N nowych zdarzeń' appears.
3. R3 filters: Agent filter and 'tylko błędy i blokady' reduce rows; URL reflects filters; reload restores them.
4. R4 blocked: the row 'odczyt ~/.ssh/config' reads 'zablokowane · izolacja' with a glyph; the detail drawer shows no unredacted value.
5. R5 tool log: open from a trace row; secret-like strings in the fixture appear as '[ukryto]'; no 'show full output' control exists.
6. R6 usage: limits show '62% · reset za 3 h · wg CLI'; at 95% the error tone and 'blisko limitu' show; Ollama shows 'bez limitu'; null shows 'brak danych wg CLI'.
7. R7 replay: start, play at 4x, seek to a failure marker, assert Gantt and table at the playhead, assert banner text and that no mutation request was sent (network assertion: only GET requests).
8. R8 reproducibility: block shows workflow v7, Agent config v3, Skills, CLI versions; 'Skopiuj' places the text on the clipboard.
9. R9 export: choose JSON, preview shows redaction count, save via the fake native dialog; cancel dialog leaves no file.
10. R10 cancel and resilience: cancel with confirm; drop the event stream and resync; engine unreachable page state recovers automatically.
11.  All assertions use roles/names; no sleeps; suite under 4 minutes; retries disabled.

## 6. Design notes

N/A, tests only.

## 7. Reuse

- Harness and fixtures from TEST004/TEST002; shared fixtures with unit tests.

## 8. Architecture and code placement

`@RU/__e2e__/*.spec.ts` plus `gateway-script.ts`.

## 9. Security and safety

Loopback gateway with a test token; no real CLIs.

## 10. Errors and edge cases

- Event ordering per test isolated by fresh gateway state.

## 11. Acceptance criteria

- [ ] R1-R10 pass in CI without retries.
- [ ] R7 fails if any mutation request is sent during replay.
- [ ] Suite runtime under 4 minutes.

## 12. Test plan

`pnpm --filter desktop test:e2e -g runs`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by other areas or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: mock gateway supports scripted SSE and request-failure injection.
