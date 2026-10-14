---
id: OVE_AGUI017
title: "Agents view tests: Playwright flows, invariants, accessibility and visual"
area: AGUI
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_AGUI004, OVE_AGUI006, OVE_AGUI007, OVE_AGUI008, OVE_AGUI009, OVE_AGUI010, OVE_AGUI011, OVE_AGUI012, OVE_AGUI013, OVE_AGUI015, OVE_AGUI016, OVE_SETUP012, OVE_TEST002, OVE_TEST004, OVE_TEST005]
soft_depends_on: []
provides: ["suite:agents-ui"]
needs: ["lib:test-utils", "lib:playwright-harness", "lib:visual-test-harness", "lib:mock-gateway"]
owns: ["apps/desktop/e2e/agents/**", "apps/desktop/src/features/agents/__fixtures__/**"]
reads: []
design: design.png
design_source: "Agenci#whole page (agents/list + agents/profile + agents/memory-panel) (crop 72,117,1368,783 CSS px)"
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 16"]
adr_refs: [7, 14, 28]
---

# OVE_AGUI017: Agents view tests: Playwright flows, invariants, accessibility and visual

## 1. Summary

End-to-end, accessibility and visual coverage of the Agents view against the mock gateway, with permanent guards for: no memory editing, visibility never changed by Save, promotion defaults and untrusted text.

## 2. Context

Uses OVE_TEST004/005/010 harnesses. Fixtures reproduce the mock: Developer, Codex, Security (private), PO, Designer, Senior Reviewer, Researcher, dynamic `Analityk cen hoteli`, the three memory entries and the isolated Workspace note.

## 3. Scope (in)

- Fixtures `agents.fixture.ts`.
- Specs: `list`, `config-save`, `conflict`, `visibility`, `skills`, `tools`, `memory-readonly`, `dynamic`, `create`, `keyboard`, `untrusted`, `a11y`, `visual`.

## 4. Out of scope

- Engine-side tests (AGENT/PERM/MEM).

## 5. Detailed requirements

1. `list`: groups, words, states, dynamic card; selecting persists in the URL.
2. `config-save`: edit instructions -> `Zapisz jako v4` -> exactly one PATCH with only `instructions`; saving state; saved; the unsaved guard on row change.
3. `conflict`: 409 keeps the draft and offers reload/rebase.
4. `visibility`: Save never sends `visibility`; choosing PRYWATNY runs the impact call; blockers listed; isolated Workspace disables PUBLICZNY.
5. `skills`: keyboard assignment, rejection reasons, the pre-check.
6. `tools`: fail closed on error; no mutation control.
7. `memory-readonly`: the panel has no button/input; request log contains no non-GET to `/agents/*/memory*` or `/memory*`.
8. `dynamic`: accept defaults to PRYWATNY and posts `{expectedVersion, visibility}`; `Usuń` asks a destructive confirm with Cancel focused.
9. `create`: defaults, idempotency, taken name.
10. `untrusted`: names, instructions, memory text containing HTML/RLO/`javascript:` render inert.
11. `keyboard`: roving focus in the list, tabs, dialogs trap and restore focus.
12. `a11y`: axe on all states; `visual`: whole body vs `design.png` within OVE_TEST005 tolerance, plus the pseudo-locale run.

## 6. Design notes

`design.png` is the whole page body used as the visual baseline.

## 7. Reuse

Harnesses from TEST; fixtures shared with stories.

## 8. Architecture and code placement

Layer: tests only. `apps/desktop/e2e/agents/*.spec.ts`; fixtures typed against contracts.

## 9. Security and safety

The no-memory-edit and visibility-not-in-save guards are permanent regression gates (ADR 0014, ADR 0028). No secrets in fixtures. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Deterministic timing via the harness emitter.
- Separate gateway instance per test.

## 11. Acceptance criteria

- [ ] All specs pass on the mock gateway.
- [ ] The memory read-only guard fails if any non-GET memory call or control appears.
- [ ] Visual and a11y checks pass.

## 12. Test plan

Commands: `pnpm --filter @overmind/desktop e2e agents`, `pnpm --filter @overmind/desktop test:visual agents`.

## 13. Parallelization notes

Written incrementally as features merge.

## 14. Open questions and assumptions

- ASSUMPTION: OVE_TEST005 tolerances apply unchanged.
