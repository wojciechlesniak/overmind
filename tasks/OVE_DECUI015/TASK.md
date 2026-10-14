---
id: OVE_DECUI015
title: "Decision Register tests: Playwright flows, append-only invariants, accessibility, visual"
area: DECUI
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DECUI004, OVE_DECUI006, OVE_DECUI007, OVE_DECUI008, OVE_DECUI010, OVE_DECUI011, OVE_DECUI013, OVE_DECUI014, OVE_TEST004, OVE_TEST005, OVE_TEST010]
soft_depends_on: []
provides: ["lib:decisions-ui-e2e"]
needs: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:e2e-fixtures", "lib:visual-regression", "lib:a11y-harness", "lib:keyboard-test-helpers"]
owns: ["apps/desktop/e2e/decisions/**", "apps/desktop/src/features/decisions/__fixtures__/**"]
reads: []
design: design.png
design_source: "Decyzje#decis/list + decis/detail (crop 72,117,1368,783 CSS px)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 16"]
adr_refs: [8, 14]
---

# OVE_DECUI015: Decision Register tests: Playwright flows, append-only invariants, accessibility, visual

## 1. Summary

End-to-end, accessibility and visual coverage for the Decision Register against the mock gateway, with a permanent guard that the UI can never delete or edit a Decision.

## 2. Context

Uses OVE_TEST004/005/010 harnesses. Fixtures reproduce the mock register: D-14, D-13, D-12, D-09, D-07, D-03 with their statuses, outcomes, alternatives and evidence.

## 3. Scope (in)

- Fixtures `decisions.fixture.ts`.
- Specs: `list-search-filter`, `detail`, `verdict`, `accept-reject`, `supersede`, `history`, `append-only`, `untrusted`, `keyboard`, `a11y`, `visual`.

## 4. Out of scope

- Engine-side immutability tests (DEC012).

## 5. Detailed requirements

1. `list-search-filter`: typing `date` filters rows; Workspace/status/outcome chips combine; facets update counts; `Pokaż więcej` loads more.
2. `detail`: D-14 renders all sections with mock strings; `wybrana` on date-fns; Skill chip `TypeScript v4`; `średnia · 0,7`.
3. `verdict`: choosing `mieszany` posts once, shows saving then the value; forbidden response reverts with toast.
4. `accept-reject`: proposed D-13 shows actions; reject requires a reason.
5. `supersede`: dialog prefilled, submit posts `proposal` without forbidden fields, navigates to the new Decision, old one shows the banner; `already_superseded` path.
6. `history`: timeline entries chronological, no interactive controls.
7. `append-only`: across ALL specs the request log contains no `DELETE`, `PUT` or `PATCH` to `/decisions*`, and the DOM never contains a control named delete/remove/edit (EN/PL).
8. `untrusted`: title, rationale, evidence names and a `url` evidence containing HTML, RLO and `javascript:` render inert; clicking a `url` chip opens only after the confirm note and only for http(s).
9. `keyboard`: list roving focus, Enter selects, dialog focus trap/restore.
10. `a11y`: axe on all states; `visual`: whole body vs `design.png` within OVE_TEST005 tolerance, plus pseudo-locale run.

## 6. Design notes

`design.png` is the whole page body (list + detail) used as the visual baseline.

## 7. Reuse

Harnesses from TEST area; fixtures shared with stories.

## 8. Architecture and code placement

Layer: tests only. `apps/desktop/e2e/decisions/*.spec.ts`; fixtures typed against contracts.

## 9. Security and safety

The append-only guard and the untrusted-content spec are permanent regression gates (ADR 0008, SEC004). No secrets in fixtures. Isolated-Workspace fixture checks that a Decision of an isolated Workspace is visible to the Owner with the `izolowany` marker. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Deterministic timing via harness emitter.
- Separate gateway instance per test.

## 11. Acceptance criteria

- [ ] All specs pass on the mock gateway.
- [ ] The append-only guard fails if any delete/edit route or control appears.
- [ ] Visual and a11y checks pass.

## 12. Test plan

Commands: `pnpm --filter @overmind/desktop e2e decisions`, `pnpm --filter @overmind/desktop test:visual decisions`.

## 13. Parallelization notes

Written incrementally as features merge.

## 14. Open questions and assumptions

- ASSUMPTION: OVE_TEST005 tolerances apply unchanged.
