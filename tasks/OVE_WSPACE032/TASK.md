---
id: OVE_WSPACE032
title: Workspace settings end-to-end, accessibility, visual and security tests
area: WSPACE
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST004, OVE_TEST005, OVE_TEST010, OVE_WSPACE016, OVE_WSPACE019, OVE_WSPACE020, OVE_WSPACE021, OVE_WSPACE022, OVE_WSPACE023, OVE_WSPACE024, OVE_WSPACE025, OVE_WSPACE026, OVE_WSPACE027, OVE_WSPACE028, OVE_WSPACE029, OVE_WSPACE030, OVE_WSPACE031]
soft_depends_on: []
provides: []
needs: ["lib:playwright-harness", "lib:mock-gateway-control", "lib:design-crop-compare", "lib:a11y-harness", "lib:keyboard-test-helpers"]
owns: ["apps/desktop/tests/workspace-settings/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16.1", "SPECIFICATION 16.9", "SPECIFICATION 16.10"]
adr_refs: [3, 6, 28]
---

# OVE_WSPACE032: Workspace settings end-to-end, accessibility, visual and security tests

## 1. Summary

Adds the Playwright, axe, keyboard, visual and abuse-case suites for the whole Workspace settings feature, proving that no widening or destructive action is possible without Local Approval and that isolated-Workspace and private-item rules hold.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Harnesses: OVE_TEST004/005/010 and the Local Approval mock of OVE_WSPACE016. This task proves acceptance of OVE_WSPACE017..031 together (spec criteria 1, 9, 10).

## 3. Scope (in)

- `apps/desktop/tests/workspace-settings/*.e2e.ts|a11y.ts|visual.ts|security.ts`, mock-gateway scenarios (policy, run grants, overrides, rules, proposals, docs, preview).

## 4. Out of scope

- Unit tests (in each task).

## 5. Detailed requirements

1. Visual: compare each section with its `design.png` (019, 022, 023, 024, 025, 026, 027, 028, 029, 030, nav 017).
2. Security matrix (each action x channel): permanent add directory, rights widen, capability widen, host add, lift requirement, isolation OFF, delete Workspace, owner rule edit: assert (a) UI opens Local Approval before the widening call, (b) the call carries `localProof` and identical args, (c) mock engine refuses the same call without proof (403) and the UI shows it, (d) narrowing counterparts need no proof. No request body contains `principal`/`channel`/`local`.
3. Isolation: ON immediate; OFF two-step; isolated Workspace hides Make-public; deleting needs exact name; typed name mismatch blocks.
4. Concurrency: version conflicts in rules and policy keep drafts; quick double clicks send one request.
5. Accessibility: axe on all states; keyboard-only run through each section; scroll-spy and focus return; dialogs trap focus; aria-live for conflicts.
6. i18n: PL and `en-XA` runs; no hard-coded strings; no truncation of rule text.
7. Data hygiene: nothing about Workspace names or paths in localStorage/sessionStorage/console.

## 6. Design notes

Test code only.

## 7. Reuse

- OVE_TEST004/005/010, OVE_WSPACE016 mock of the Local Approval engine.

## 8. Architecture and code placement

Tests under `apps/desktop/tests/workspace-settings/` only.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Fixtures are synthetic.

## 10. Errors and edge cases

- Long-running delete cascade stub: the mock returns after a fake delay using the fake clock.

## 11. Acceptance criteria

- [ ] The security matrix passes for all eight widening/destructive actions; visual diffs are within tolerance for all regions; axe zero violations; PL/pseudo-locale runs pass.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: as listed; CI job `desktop-e2e` and `ui-security`. Commands: `pnpm --filter @overmind/desktop test:e2e -g workspace-settings`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/tests/workspace-settings/**` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: TEST005 tolerance defaults.
