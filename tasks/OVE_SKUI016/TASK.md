---
id: OVE_SKUI016
title: "Skill library tests: Playwright flows, import and visibility guards, accessibility, visual"
area: SKUI
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_SETUP012, OVE_SKUI005, OVE_SKUI006, OVE_SKUI007, OVE_SKUI008, OVE_SKUI009, OVE_SKUI010, OVE_SKUI011, OVE_SKUI012, OVE_SKUI013, OVE_SKUI014, OVE_SKUI015, OVE_TEST002, OVE_TEST004, OVE_TEST005]
soft_depends_on: []
provides: ["suite:skills-ui"]
needs: ["lib:test-utils", "lib:playwright-harness", "lib:visual-test-harness", "lib:mock-gateway"]
owns: ["apps/desktop/e2e/skills/**", "apps/desktop/src/features/skills/__fixtures__/**"]
reads: []
design: design.png
design_source: "Skille#whole page (skills/main + skills/inspector) (crop 72,117,1368,783 CSS px)"
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 16"]
adr_refs: [12, 28]
---

# OVE_SKUI016: Skill library tests: Playwright flows, import and visibility guards, accessibility, visual

## 1. Summary

End-to-end, accessibility and visual coverage of the Skill library against the mock gateway with permanent guards: imports are untrusted and Owner-only, `high` findings need per-finding confirmation, public needs explicit confirmation, Skill text is inert.

## 2. Context

Fixtures reproduce the mock: grill-me, TypeScript, tdd, security-audit, user-stories, e2e-playwright, ui-review, overmind, the release-checklist proposal, versions v4/v3/v2 and recent uses.

## 3. Scope (in)

- Fixtures `skills.fixture.ts`.
- Specs: `library-filters`, `inspector`, `edit-version`, `detach`, `create`, `visibility`, `import`, `review`, `proposal`, `keyboard`, `untrusted`, `a11y`, `visual`.

## 4. Out of scope

- Engine tests (SKILL014).

## 5. Detailed requirements

1. `library-filters`: counts `Publiczne · 6` etc., combination of visibility and origin, URL round trip.
2. `inspector`: preview, version switch, recent uses, system Skill read-only.
3. `edit-version`: one POST creates v5; scan_blocking and conflict paths.
4. `detach`: per-Agent PATCH sequence with only `skills` changed; partial failure.
5. `visibility`: public needs the checkbox and sends `confirmPublic:true`; blockers listed for private; impact failure blocks.
6. `import`: file/paste/URL; client rejection of http and archives; pending Skill appears in the strip, never in the library as accepted; error mapping.
7. `review`: per-finding gating, reject removes it, `hash_mismatch`.
8. `proposal`: view text, accept -> PRYWATNY, reject cool-down toast.
9. `untrusted`: Skill text, names, descriptions, findings excerpts with HTML/RLO/`javascript:` are inert; no element is created from them.
10. `no-leak` guard: the request log of every spec contains no skill text in URLs or logs, and no call that sends `visibility` outside the dialog.
11. `keyboard`: grid arrows, dialogs trap and restore focus. `a11y`/`visual` as in the other views.

## 6. Design notes

`design.png` is the whole page body used as the visual baseline.

## 7. Reuse

Harnesses from TEST.

## 8. Architecture and code placement

Layer: tests only. `apps/desktop/e2e/skills/*.spec.ts`.

## 9. Security and safety

The untrusted-import and confirmPublic guards are permanent regression gates (ADR 0012, ADR 0028, SEC004). No secrets in fixtures. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Deterministic timing via the harness emitter.

## 11. Acceptance criteria

- [ ] All specs pass on the mock gateway.
- [ ] The guards fail if an import is accepted without per-finding confirmation or a Skill is made public without `confirmPublic`.
- [ ] Visual and a11y pass.

## 12. Test plan

Commands: `pnpm --filter @overmind/desktop e2e skills`, `pnpm --filter @overmind/desktop test:visual skills`.

## 13. Parallelization notes

Written incrementally as features merge.

## 14. Open questions and assumptions

- ASSUMPTION: OVE_TEST005 tolerances apply unchanged.
