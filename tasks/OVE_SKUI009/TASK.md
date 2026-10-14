---
id: OVE_SKUI009
title: "New Skill dialog: create a Skill written by the Owner"
area: SKUI
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DS025, OVE_DS026, OVE_DS036, OVE_SKILL011, OVE_SKUI003]
soft_depends_on: []
provides: ["lib:skill-create-dialog"]
needs: ["api:skills.create", "lib:api-client-skills", "ui:Dialog", "ui:TextField", "ui:Textarea", "ui:RadioCardGroup", "lib:use-gateway-mutation", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/components/CreateSkillDialog.tsx", "apps/desktop/src/features/skills/state/use-skill-create.ts", "apps/desktop/src/locales/en/skills-create.json", "apps/desktop/src/locales/pl/skills-create.json"]
reads: []
design: design.png
design_source: "Skille#skills/header (the `Nowy Skill` button, crop 780,176,310,56 CSS px; the dialog is not drawn in the mock) (crop 780,176,310,56 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [28, 12]
---

# OVE_SKUI009: New Skill dialog: create a Skill written by the Owner

## 1. Summary

`Nowy Skill` opens a dialog to write a new Skill: slug name, optional display name, description, instructions, `requiredTools` metadata and visibility (default PRYWATNY in this Workspace).

## 2. Context

SKILL004 `CreateSkill`: Owner only, version 1 is `accepted`; names are slugs `[a-z0-9][a-z0-9-]{0,39}` unique per scope; `overmind` is reserved; `high` scan findings block creation (`skill.scan_blocking`). `ownerWorkspaceId` is required iff private (`skill.private_requires_workspace`).

## 3. Scope (in)

- `CreateSkillDialog`, `useSkillCreate`.

## 4. Out of scope

- Import (OVE_SKUI011).

## 5. Detailed requirements

1. Fields: Name (slug, live validation with the pattern and `overmind` reserved), Display name (<=60, optional), Description (<=200, required), Instructions (plain textarea 1..20000), Required tools (metadata, same note as OVE_SKUI007), Visibility via `RadioCardGroup` with default PRYWATNY `tylko w Workspace „{name}”` and PUBLICZNY with the confirm sentence.
2. Choosing PUBLICZNY adds an explicit checkbox `Rozumiem, że ten Skill będzie widoczny we wszystkich Workspace'ach` that must be ticked before submit (the engine also demands `confirmPublic` on later visibility changes; at creation public is allowed for Owner-written Skills).
3. Body `{ name, displayName?, description, instructions, requiredTools?, visibility, ownerWorkspaceId? }` with `ownerWorkspaceId` = current Workspace id from context when private; header `Idempotency-Key`.
4. Errors: `skill.name_taken` under Name, `skill.scan_blocking` findings list, `skill.invalid_instructions`, `skill.too_large`.
5. Success selects the new Skill in the library; toast `Skill {name} utworzony`.
6. Unsaved-close confirm as in OVE_SKUI007.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:Dialog`, form primitives.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/CreateSkillDialog.tsx`, `state/use-skill-create.ts`.

## 9. Security and safety

Skill text is instructions that will later steer an Agent, so it is the most sensitive untrusted text in the product (ADR 0012: Skills from the internet come only from the Owner and are untrusted until accepted). The UI shows it only as plain text (no Markdown-to-HTML, no links made clickable inside the text), never includes it in any prompt or request other than the explicit Owner action, and a Skill chip or `requiredTools` list is metadata, never a permission. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Name differing only by case: lowercased client-side as a hint; engine decides.
- Isolated Workspace: PUBLICZNY is allowed for Skills only if VIS allows; the engine's refusal is shown (`skill.private_requires_workspace` with the isolated reason).
- Double submit: same idempotency key.

## 11. Acceptance criteria

- [ ] Given valid input, Then one POST creates a private Skill in the current Workspace.
- [ ] Given PUBLICZNY without the checkbox, Then submit is disabled.
- [ ] Given `overmind` as the name, Then it is rejected inline.
- [ ] Given `scan_blocking`, Then findings are shown and nothing is created.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `CreateSkillDialog.test.tsx`, `use-skill-create.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: isolation rules for public Skills are enforced by VIS/SKILL; the UI only displays the refusal.
