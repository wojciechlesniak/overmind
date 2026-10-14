---
id: OVE_WSPACE013
title: Dashboard end-to-end, accessibility and visual tests
area: WSPACE
kind: test
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_TEST004, OVE_TEST005, OVE_TEST010, OVE_WSPACE005, OVE_WSPACE006, OVE_WSPACE008, OVE_WSPACE009, OVE_WSPACE010, OVE_WSPACE011]
soft_depends_on: []
provides: []
needs: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:design-crop-compare", "lib:a11y-harness", "lib:keyboard-test-helpers"]
owns: ["apps/desktop/tests/workspaces/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16"]
adr_refs: [28]
---

# OVE_WSPACE013: Dashboard end-to-end, accessibility and visual tests

## 1. Summary

Adds the Playwright, axe, keyboard and visual-regression suites for the whole Workspaces dashboard against the mock gateway, including Global Pause, isolated cards, notification opening without grants and the create flow.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Harnesses: OVE_TEST004 (Playwright + mock gateway control), OVE_TEST005 (design-crop comparison), OVE_TEST010 (axe, keyboard helpers). This task proves acceptance of OVE_WSPACE001..012 as a whole.

## 3. Scope (in)

- `tests/e2e/dashboard.e2e.ts`, `tests/e2e/dashboard.a11y.ts`, `tests/visual/dashboard.visual.ts`.
- Mock-gateway scenarios: four cards, five notifications, health states, Global Pause, push events.

## 4. Out of scope

- Unit tests of mappers/hooks (their own tasks).

## 5. Detailed requirements

1. Scenarios: S1 first load matches `design.png` crops of 003-009 (header, strip, grid top row, bottom row, notifications, system) with tolerance per TEST005; S2 push event moves a task and only that card's caption changes; S3 Global Pause on: all cards paused; S4 isolated card has lock pill + word; S5 opening an access-request notification navigates and sends no decision call (assert on recorded gateway requests); S6 degraded isolation row shows error + danger border; S7 empty state and creating a Workspace; S8 engine restart: sections show loading then data; S9 PL and pseudo-locale `en-XA` (no truncation/hard-coded strings).
2. Accessibility: axe on every state; Tab order as specified in OVE_WSPACE003; focus ring visible; landmarks; live region announces approvals.
3. Security assertions: no request contains `principal`, `channel`, `local` fields; no `localStorage` writes containing Workspace names; no console errors/warnings.
4. Performance: with 50 Workspaces initial render under 1.5 s on the CI runner and only 4 concurrent agents-state requests.

## 6. Design notes

Visual tests compare with the `design.png` files of the tasks that implement each region.

## 7. Reuse

- OVE_TEST004/005/010 harnesses, fixtures of OVE_WSPACE001.

## 8. Architecture and code placement

Test code only under `apps/desktop/tests/workspaces/`. No production code is changed.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Test fixtures use synthetic names/paths only; no real tokens.

## 10. Errors and edge cases

- Flaky timing around the 300 ms debounce: use the fake clock of the harness.
- Font loading differences: fonts are self-hosted (DS004) so visual tolerance is stable.

## 11. Acceptance criteria

- [ ] All scenarios S1..S9 pass in CI; axe reports zero violations; visual diffs within tolerance; the suite fails if a decision call is sent from a notification.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: the scenarios above; run in CI job `desktop-e2e`. Commands: `pnpm --filter @overmind/desktop test:e2e -g workspaces`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/tests/workspaces/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: tolerances are those of TEST005 defaults.
