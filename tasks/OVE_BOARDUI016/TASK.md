---
id: OVE_BOARDUI016
title: "Board tests: Playwright flows, accessibility sweep and visual regression"
area: BOARDUI
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI007, OVE_BOARDUI009, OVE_BOARDUI010, OVE_BOARDUI011, OVE_BOARDUI012, OVE_BOARDUI014, OVE_BOARDUI015, OVE_TEST004, OVE_TEST005, OVE_TEST010]
soft_depends_on: []
provides: ["lib:board-ui-e2e"]
needs: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:e2e-fixtures", "lib:visual-regression", "lib:a11y-harness", "lib:keyboard-test-helpers", "lib:design-crop-compare"]
owns: ["apps/desktop/e2e/board/**", "apps/desktop/src/features/board/__fixtures__/**"]
reads: []
design: design.png
design_source: "Tablica#board/main (crop 72,117,1048,783 CSS px)"
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 16"]
adr_refs: [11, 16]
---

# OVE_BOARDUI016: Board tests: Playwright flows, accessibility sweep and visual regression

## 1. Summary

End-to-end, accessibility and visual coverage for the Task Board against the mock gateway: the main flows, keyboard use, untrusted text, live updates and a pixel comparison with the design.

## 2. Context

OVE_TEST004 provides the Playwright harness with a controllable mock gateway; OVE_TEST005 compares screenshots with design crops; OVE_TEST010 provides axe and keyboard helpers. This task assembles the Board suite and owns the shared fixtures (a Workspace `Aplikacja rezerwacji` with the Tasks T-26..T-37 of the mock).

## 3. Scope (in)

- Fixtures `board.fixture.ts` reproducing the mock data (Lanes, Tasks, timeline, evidence).
- Playwright specs: `board-view.spec.ts`, `board-select-detail.spec.ts`, `board-actions.spec.ts`, `board-create.spec.ts`, `board-live.spec.ts`, `board-keyboard.spec.ts`, `board-untrusted.spec.ts`, `board-a11y.spec.ts`, `board-visual.spec.ts`.
- Visual comparison of the whole main area and the detail panel against `design.png` crops.

## 4. Out of scope

- Unit tests of components (in their tasks), engine-side tests (BOARD014).

## 5. Detailed requirements

1. `board-view`: with the fixture, five Lanes render in order with counts 4/2/3/1/7 (Done shows 2 cards plus `Pokaż 5 starszych`); `Wszystkie` selected; the badge reads `Tory z Workflow „board” v3`.
2. `select-detail`: click T-31 -> URL has `task=`, the panel shows `T-31 · tor QA`, the quote, `PRZEBIEG` with 4 rows and 2 evidence chips; Escape clears the selection.
3. `actions`: `Czat z QA` navigates to the QA chat route; `Odłóż` opens the dialog, submit sends `expectedVersion` and an idempotency key (asserted on the mock gateway), card disappears after the pushed event; undo restores; conflict scenario via mock control returns 409 and shows the toast.
4. `create`: invalid form disables submit; doc error path shows the field error; success selects the new Task.
5. `live`: mock emits `task.progress_reported` -> bar changes without a request (asserted via request log); `task.moved` -> card moves lane and a polite announcement appears in the live region; disconnect/reconnect shows the banner and refetches.
6. `keyboard`: Tab reaches the board once, arrows move focus, Enter selects, no draggable cards (DOM assertion), focus ring visible.
7. `untrusted`: Task title, quote, evidence name and reason containing `<img src=x onerror=...>`, RLO characters and a `javascript:` doc anchor render as inert text; no `window.__pwned`; no dialogs opened.
8. `a11y`: axe on loading, ready, selected, empty, error, deferred, create dialog; zero violations; check names `T-31, Koszyk z kodami rabatowymi, pracuje`.
9. `visual`: the main region (72,117,1048,783 CSS px) and the panel at 1440x900 with locale `pl` within the OVE_TEST005 tolerance; pseudo-locale `en-XA` run to catch truncation (no horizontal page scroll).
10. All specs run against `lib:mock-gateway-control` only; none start a real engine (the real-engine slice is a later integration task).

## 6. Design notes

`design.png` is the whole Board main region (lanes, header) for the visual baseline; the detail panel baseline is the crop of OVE_BOARDUI009. Tolerances and review report per OVE_TEST005.

## 7. Reuse

`lib:playwright-harness`, `lib:mock-gateway-control`, `lib:e2e-fixtures`, `lib:visual-regression`, `lib:a11y-harness`, `lib:keyboard-test-helpers`.

## 8. Architecture and code placement

Layer: tests. `apps/desktop/e2e/board/*.spec.ts`; fixtures under `features/board/__fixtures__/` are typed against contracts and are used by stories too. No production code changes.

## 9. Security and safety

Tests include the untrusted-content scenario above as a permanent regression gate; no secrets in fixtures; Workspace isolation scenario: a Task id of another Workspace in the URL shows not found and leaks no title. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Flaky live timing: use the harness's deterministic event emitter, never sleeps.
- Font loading differences: visual runs use the bundled fonts of OVE_DS004.
- Parallel workers: each test uses its own mock gateway instance.

## 11. Acceptance criteria

- [ ] All specs pass in CI on the mock gateway.
- [ ] The visual test of the main region and panel pass within tolerance.
- [ ] The untrusted spec fails if any rendering path interprets HTML or follows an unsafe link.
- [ ] The a11y sweep reports zero serious or critical violations.

## 12. Test plan

Commands: `pnpm --filter @overmind/desktop e2e board`, `pnpm --filter @overmind/desktop test:visual board`.

## 13. Parallelization notes

Runs after the feature tasks; can be written incrementally per spec as each feature merges (soft dependency).

## 14. Open questions and assumptions

- ASSUMPTION: tolerance as defined by OVE_TEST005; no board-specific override.
