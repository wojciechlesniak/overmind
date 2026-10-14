---
id: OVE_APPRUI015
title: "Approvals view tests: Playwright flows, security invariants, accessibility, visual"
area: APPRUI
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_APPRUI004, OVE_APPRUI006, OVE_APPRUI007, OVE_APPRUI008, OVE_APPRUI009, OVE_APPRUI010, OVE_APPRUI011, OVE_APPRUI012, OVE_APPRUI013, OVE_APPRUI014, OVE_SETUP012, OVE_TEST002, OVE_TEST004, OVE_TEST005, OVE_WSPACE014]
soft_depends_on: []
provides: ["suite:approvals-ui"]
needs: ["lib:test-utils", "lib:playwright-harness", "lib:visual-test-harness", "lib:mock-gateway", "lib:use-local-approval"]
owns: ["apps/desktop/e2e/approvals/**", "apps/desktop/src/features/approvals/__fixtures__/**"]
reads: []
design: design.png
design_source: "Zgody#whole page (appr/list + appr/detail) (crop 72,117,1368,783 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16"]
adr_refs: [3, 6, 21]
---

# OVE_APPRUI015: Approvals view tests: Playwright flows, security invariants, accessibility, visual

## 1. Summary

End-to-end, accessibility and visual coverage of the Approvals view against the mock gateway with permanent security gates: once-only approval body, no broadening, permanent only through Local Approval, Telegram-origin limits, untrusted text.

## 2. Context

Fixtures reproduce the mock: git push (selected), new domain registry.npmjs.org, access request `~/Projects/shared-ui` by Designer, the escalation `Strona fundacji: Quality Gate nie przeszedł 5 razy`, and the three resolved lines.

## 3. Scope (in)

- Fixtures `approvals.fixture.ts`.
- Specs: `inbox`, `approve-once`, `deny`, `permanent-allow`, `access-request`, `escalation`, `conflicts`, `pause`, `telegram-origin`, `untrusted`, `keyboard`, `a11y`, `visual`.

## 4. Out of scope

- Engine-side tests (PERM030).

## 5. Detailed requirements

1. `inbox`: counts, sections, order, deep link `?kind=&id=`, resolved today.
2. `approve-once`: the request body of approve is exactly `{decision:'approve'}`; no scope/duration/remember field is ever present in ANY decision request across all specs (a global request-log assertion); the button is not focused on open; double click sends one request.
3. `deny`: comment sent as `note` only.
4. `permanent-allow`: the outline button never decides the Approval; the Local Approval dialog appears; one mint call and one PUT with `localProof` after confirmation; with the Local Approval dismissed nothing is sent; `payment` has no permanent option; the footnote text is present.
5. `access-request`: rights narrowing (cannot check an unrequested right), default `tylko ten Run`, permanent through Local Approval with `access.grant_permanent` args, Telegram-origin item has the permanent card disabled.
6. `escalation`: no preselected option, destructive confirm, body `{optionKey}`.
7. `conflicts`: 409 -> decided-elsewhere, 410 -> expired, no controls after.
8. `pause`: banner and `wstrzymane`, decisions still possible.
9. `untrusted`: summaries, commit subjects, justification, paths and diff lines with HTML/RLO/`javascript:` are inert; no element is created from them.
10. `keyboard`: list roving focus, dialogs trap and restore focus, Enter never approves from the list.
11. `a11y`: axe on all states; `visual`: whole body vs `design.png` within OVE_TEST005 tolerance, plus pseudo-locale.

## 6. Design notes

`design.png` is the whole page body used as the visual baseline.

## 7. Reuse

Harnesses from TEST; the Local Approval fake from WSPACE tests.

## 8. Architecture and code placement

Layer: tests only. `apps/desktop/e2e/approvals/*.spec.ts`.

## 9. Security and safety

These specs are permanent regression gates for ADR 0003/0021: any decision request containing a scope or permanence field, any permanent effect without a Local Approval, or any decision control rendered for a non-pending item fails the build. No secrets or real tokens in fixtures; proof ids are fake. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Deterministic timing via the harness emitter (expiry is simulated, not slept).
- Separate gateway instance per test.

## 11. Acceptance criteria

- [ ] All specs pass on the mock gateway.
- [ ] The global request-log guard fails if a decision body ever carries a scope field.
- [ ] Visual and a11y pass.

## 12. Test plan

Commands: `pnpm --filter @overmind/desktop e2e approvals`, `pnpm --filter @overmind/desktop test:visual approvals`.

## 13. Parallelization notes

Written incrementally as features merge.

## 14. Open questions and assumptions

- ASSUMPTION: OVE_TEST005 tolerances apply unchanged.
