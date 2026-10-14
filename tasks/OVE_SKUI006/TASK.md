---
id: OVE_SKUI006
title: "Skill inspector: detail hook and panel with Markdown preview, versions and recent uses"
area: SKUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DS032, OVE_DS072, OVE_SKILL011, OVE_SKUI001, OVE_SKUI003]
soft_depends_on: []
provides: ["lib:use-skill-detail", "lib:skill-inspector-region"]
needs: ["api:skills.get", "lib:api-client-skills", "ui:SkillDetail", "ui:MarkdownPreview", "ui:EmptyState", "lib:use-gateway-resource", "lib:skill-view-models", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/state/use-skill-detail.ts", "apps/desktop/src/features/skills/regions/inspector.region.tsx", "apps/desktop/src/features/skills/components/SkillInspector.tsx", "apps/desktop/src/locales/en/skills-inspector.json", "apps/desktop/src/locales/pl/skills-inspector.json"]
reads: []
design: design.png
design_source: "Skille#skills/inspector (crop 1100,162,340,738 CSS px) (crop 1100,162,340,738 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [12, 28, 16]
---

# OVE_SKUI006: Skill inspector: detail hook and panel with Markdown preview, versions and recent uses

## 1. Summary

The 340px inspector: icon and name, filled visibility tag, version badge and source pills, the Markdown preview of the current accepted version, `WERSJE`, `OSTATNIE UŻYCIA`, and the actions area (filled by OVE_SKUI007 and OVE_SKUI008).

## 2. Context

`GET /v1/skills/{id}` returns the inspector payload (`GetSkillInspector`): current accepted text, version list, scan summary, assigned Agents, 20 most recent uses and counts; pending imports are flagged `untrusted: true`. Mock regions `skills/inspector-header`, `-tags`, `-content-preview`, `-versions`, `-recent-uses`, `-actions`. The preview is the DS `MarkdownPreview` (no Markdown parsing into HTML: prefix colouring only). Skill text is instructions that will later steer an Agent, so it is the most sensitive untrusted text in the product (ADR 0012: Skills from the internet come only from the Owner and are untrusted until accepted). The UI shows it only as plain text (no Markdown-to-HTML, no links made clickable inside the text), never includes it in any prompt or request other than the explicit Owner action, and a Skill chip or `requiredTools` list is metadata, never a permission.

## 3. Scope (in)

- `useSkillDetail(id)` with a selected-version state.
- `inspector.region.tsx` rendering `SkillDetail` or the empty state.
- Version click swaps the preview text.

## 4. Out of scope

- Edit and detach actions (OVE_SKUI007, 008), visibility change (OVE_SKUI010), review of pending versions (OVE_SKUI012).

## 5. Detailed requirements

1. Resource `['skill', id]` invalidated by the Skill events for this id; `selectedVersion` defaults to the current accepted version; clicking a version row requests that version's text (`GET /v1/skills/{id}?version=n`, ASSUMPTION) and the preview shows it with the label `v2 (starsza wersja)`; the current marker `v4 · aktualna` stays on the badge.
2. Text goes to `MarkdownPreview` as `source`; truncated by the component at 40 lines with `… N więcej linii`; control and bidi characters are neutralised by the component helper; this task never post-processes the text into HTML.
3. Imports show the `originNote`; a pending (not yet accepted) latest version shows a notice `Wersja v{n} czeka na Twój przegląd` with a button `Przejrzyj` -> `openReview(skillId, n)`.
4. `system` Skill: both actions absent and `Skill systemowy: tylko do odczytu` (ui-kit via `system`).
5. Recent uses link to the Run through an in-app route link (`routeLinks.run(runId)`), never a URL built from text; uses without a Run (discussion/conversation) show the label without a link.
6. The assigned Agents list is available to the actions (detach) but not displayed here beyond the usage rows in the mock.
7. Loading skeleton blocks; error `Nie udało się wczytać Skilla` with retry; `skill.not_found` clears the selection (private Skill of another Workspace behaves as not found).
8. The inspector is a labelled region (`aria-label` `Szczegóły Skilla`).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:SkillDetail`, `ui:MarkdownPreview` (OVE_DS072).

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `state/use-skill-detail.ts`, `regions/inspector.region.tsx`, `components/SkillInspector.tsx`. Actions are supplied through the slot `inspector-actions` rendered at the bottom (OVE_SKUI007/008 contribute there).

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Very long instructions (20000 chars): preview scrolls; copy is allowed (text selection).
- Version text of a rejected import: shown with the word `odrzucona` and a warning, never offered as current.
- Network error on version fetch: the preview keeps the previous text and shows a toast.
- Skill archived by another session: banner and read-only.

## 11. Acceptance criteria

- [ ] Given `TypeScript` v4, Then the inspector matches `design.png` within tolerance (tags, preview, versions, uses).
- [ ] Given a click on `v3`, Then the preview shows v3 text and the badge stays on v4.
- [ ] Given a pending import, Then the notice and `Przejrzyj` appear and the text is not presented as accepted.
- [ ] Given an `overmind` Skill, Then no action button exists.
- [ ] Given text `<script>alert(1)</script>`, Then it is shown as text.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `use-skill-detail.test.tsx`, `SkillInspector.test.tsx` (versions, system, pending, untrusted text). Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: `GET /v1/skills/{id}` accepts `?version=` to fetch an older accepted version text (SKILL011 lists only `GET /skills/:id`; the inspector payload may already include all version texts: if so, no extra call). Reported to SKILL.
- GAP (reported to WFRT/RUNUI): the Run link route helper `routeLinks.run(runId)` is assumed from SHELL.
