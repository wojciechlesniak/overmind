---
id: OVE_SKUI007
title: "Edit as a new version: editor dialog with scan and changeNote"
area: SKUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_BOARDUI002, OVE_DS026, OVE_DS036, OVE_SKILL011, OVE_SKUI003, OVE_SKUI006]
soft_depends_on: []
provides: ["lib:skill-edit-dialog"]
needs: ["api:skills.version", "lib:api-client-skills", "ui:Dialog", "ui:Textarea", "ui:TextField", "ui:SafeLink", "lib:use-gateway-mutation", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/components/EditSkillDialog.tsx", "apps/desktop/src/features/skills/state/use-skill-edit.ts", "apps/desktop/src/locales/en/skills-edit.json", "apps/desktop/src/locales/pl/skills-edit.json"]
reads: []
design: design.png
design_source: "Skille#skills/inspector-actions (crop 1121,830,299,60 CSS px; the dialog is not drawn in the mock) (crop 1121,830,299,60 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [2, 12]
---

# OVE_SKUI007: Edit as a new version: editor dialog with scan and changeNote

## 1. Summary

`Edytuj jako v5`: a dialog with the current text in an editable plain textarea, `requiredTools` metadata and a change note; submit creates a NEW accepted version (`POST /v1/skills/{id}/versions`), never edits in place.

## 2. Context

SKILL004 `AddSkillVersion { skillId, expectedVersion, instructions, requiredTools?, changeNote? }`: version `latest+1`, status `accepted` (the Owner wrote it); stale `expectedVersion` -> `skill.version_conflict`; builtin -> `skill.builtin_immutable`; the scanner runs and `high` findings block with `skill.scan_blocking`; limits 1..20000 chars. Existing Runs keep their pinned version. Editing is a desktop Owner action.

## 3. Scope (in)

- `EditSkillDialog`, `useSkillEdit`.
- Client-side checks (length, control characters).

## 4. Out of scope

- Creating a brand-new Skill (OVE_SKUI009), review of imports (OVE_SKUI012).

## 5. Detailed requirements

1. Open from the inspector button (label `Edytuj jako v{latest+1}` from the detail); for a Skill whose latest version is pending review the button is replaced by `Przejrzyj` (OVE_SKUI006).
2. Fields: instructions textarea (mono, min 12 rows, counter near 20000, plain text only: no preview rendering), `requiredTools` chips input (ids `[a-z0-9_.-]{1,40}`, max 20) with the visible note `To tylko informacja o potrzebnych narzędziach. Uprawnienia nadają Zgody i polityki.`, optional change note (<=200).
3. Submit body `{ expectedVersion: currentVersion, instructions, requiredTools?, changeNote? }`; line endings normalised by the engine; the UI does not strip text except trailing whitespace at the end of the whole text.
4. Results: success closes, selects the new version, toast `Zapisano v5`; `skill.scan_blocking` shows the findings list (severity, rule, line, sanitised excerpt) and keeps the dialog open; `skill.version_conflict` -> `Skill zmieniony gdzie indziej` with `Załaduj nowszą wersję` (the typed text is kept in a read-only collapsible so nothing is lost); `skill.invalid_instructions`, `skill.too_large`, `skill.builtin_immutable` mapped.
5. Dirty-close protection: closing with changes asks `Odrzucić zmiany?`.
6. The dialog title carries the visibility word of the Skill (`Edycja: tdd · PUBLICZNY`) because a public Skill edit affects every Workspace that uses it; for public Skills an `InfoNote` says `Nowa wersja będzie dostępna we wszystkich Workspace'ach. Agenci z przypiętą wersją jej nie zobaczą.`.
7. Medium and lower scan findings returned with the new version are listed after saving as a non-blocking notice.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:Dialog`, `ui:Textarea`, `ui:TextField`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/EditSkillDialog.tsx`, `state/use-skill-edit.ts`; contributes the button to the slot `inspector-actions`.

## 9. Security and safety

Skill text is instructions that will later steer an Agent, so it is the most sensitive untrusted text in the product (ADR 0012: Skills from the internet come only from the Owner and are untrusted until accepted). The UI shows it only as plain text (no Markdown-to-HTML, no links made clickable inside the text), never includes it in any prompt or request other than the explicit Owner action, and a Skill chip or `requiredTools` list is metadata, never a permission. The dialog sends text typed by the Owner only; it never prefills from an untrusted source other than the current accepted version, and never from clipboard automatically. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Builtin Skill: the edit action is not offered.
- Empty instructions: submit disabled.
- Text pasted with bidi controls: the engine strips them; the UI also warns `Usunięto znaki sterujące` when it detects them.
- Offline: submit disabled.

## 11. Acceptance criteria

- [ ] Given an edit, Then exactly one POST creates v5 and the inspector shows `v5 · aktualna`.
- [ ] Given `scan_blocking`, Then findings are listed and nothing is saved.
- [ ] Given a stale version, Then the conflict message appears and the typed text is preserved.
- [ ] Given the dialog closed with changes, Then a confirm appears.
- [ ] Given a public Skill, Then the cross-Workspace note is visible.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `EditSkillDialog.test.tsx`, `use-skill-edit.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: only the Owner can author versions; the UI has no Telegram path.
