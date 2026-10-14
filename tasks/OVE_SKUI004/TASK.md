---
id: OVE_SKUI004
title: "Library header region: title, count line, Import and Nowy Skill"
area: SKUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS045, OVE_SKUI001, OVE_SKUI002, OVE_SKUI003]
soft_depends_on: []
provides: ["lib:skills-header-region"]
needs: ["ui:PageHeader", "ui:Button", "lib:use-skill-library", "lib:skill-view-models", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/regions/header.region.tsx", "apps/desktop/src/locales/en/skills-header.json", "apps/desktop/src/locales/pl/skills-header.json"]
reads: []
design: design.png
design_source: "Skille#skills/header (crop 88,176,996,56 CSS px) (crop 88,176,996,56 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [12]
---

# OVE_SKUI004: Library header region: title, count line, Import and Nowy Skill

## 1. Summary

The page header of the Skill library: `Skille`, the line `8 zainstalowanych · publiczne działają w każdym Workspace, prywatne tylko w swoim`, and the buttons `Importuj z pliku lub URL` and `Nowy Skill`.

## 2. Context

Mock region `skills/header` (96,184,980,40): title, count line, secondary Import button, primary violet `Nowy Skill`. Import and creation are Owner-only desktop actions (ADR 0012); the dialogs are OVE_SKUI011 and OVE_SKUI009.

## 3. Scope (in)

- Header region with title, subtitle and two buttons wired to the dialogs context.

## 4. Out of scope

- The dialogs themselves.

## 5. Detailed requirements

1. Title from `skills:title`; subtitle `skills:subtitle` with `{count}` = number of accepted library Skills including the system one (mock: 8) and the two-sentence visibility explanation (words PUBLICZNY/PRYWATNY are not repeated here, the sentence is the product text).
2. `Importuj z pliku lub URL` (secondary, `import` icon) -> `openImport()`; `Nowy Skill` (primary violet, `plus` icon) -> `openCreate()`.
3. Both buttons are disabled with a title while the engine is unreachable (shell connection state); they are never rendered for non-desktop transports (the app only runs on the desktop, so no extra branch).
4. The count updates live with the library hook.
5. Headings use the shell page-title level (`h1` once per page).

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:PageHeader`, `ui:Button`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `regions/header.region.tsx`, locale files.

## 9. Security and safety

All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Library loading: subtitle shows `—` instead of a count.
- Zero Skills: `0 zainstalowanych`.

## 11. Acceptance criteria

- [ ] Given the fixture, Then the header matches `design.png` within tolerance.
- [ ] Given a click on each button, Then the corresponding dialog opens.
- [ ] Given the engine offline, Then both buttons are disabled.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `header.region.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: the count includes the system Skill (mock `8 zainstalowanych`).
