---
id: OVE_DECUI010
title: "Supersede dialog: \"Zastąp nową Decyzją\" with alternatives editor and submit"
area: DECUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_BOARDUI003, OVE_DEC011, OVE_DECUI006, OVE_DECUI009, OVE_DS013, OVE_DS025, OVE_DS026, OVE_DS036, OVE_DS037, OVE_DS065]
soft_depends_on: []
provides: ["lib:decision-supersede-dialog"]
needs: ["ui:Dialog", "ui:Field", "ui:TextField", "ui:Textarea", "ui:RadioCardGroup", "ui:Button", "ui:AlternativeCard", "api:decision.supersede", "lib:api-client-decision", "lib:use-gateway-mutation", "ui:Toast", "lib:feature-regions"]
owns: ["apps/desktop/src/features/decisions/dialogs/SupersedeDialog.tsx", "apps/desktop/src/features/decisions/dialogs/AlternativesEditor.tsx", "apps/desktop/src/features/decisions/regions/supersede.region.tsx", "apps/desktop/src/locales/en/decisions-supersede.json", "apps/desktop/src/locales/pl/decisions-supersede.json"]
reads: []
design: design.png
design_source: "Decyzje#decis/replace-button (crop 1238,131,184,56 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8]
---

# OVE_DECUI010: Supersede dialog: "Zastąp nową Decyzją" with alternatives editor and submit

## 1. Summary

The Owner corrects a Decision by creating a new one: the dialog behind `Zastąp nową Decyzją` shows the prefilled form, the alternatives editor and a required reason, then calls `POST /decisions/:id/supersede` and navigates to the new Decision.

## 2. Context

Mock: the secondary button `Zastąp nową Decyzją` (40px) at the top right of the detail. There is no edit anywhere: this is the only way to change a Decision (ADR 0008). After success the old Decision becomes `superseded` (read-only, with a banner) and the new one links back with `Zastępuje:`. The route returns `409 dec.already_superseded` with the successor ref when someone already replaced it.

## 3. Scope (in)

- Button in the detail header (via `actionsSlot`), `SupersedeDialog` (wide dialog, scroll inside), `AlternativesEditor`.
- Submit, errors, success navigation, discard confirm.

## 4. Out of scope

- Form model (OVE_DECUI009), banner of the superseded Decision (OVE_DECUI011), creating brand-new Owner Decisions unrelated to an old one (not in the mock; open question).

## 5. Detailed requirements

1. The button is shown for statuses `accepted`, `needs_review`, `proposed`, `rejected`? Only `accepted` and `needs_review`, `proposed` (not `superseded`; rejected Decisions cannot be superseded: ASSUMPTION per DEC005 `supersede_target_invalid`); hidden when `supersededBy` exists.
2. Dialog layout (derived): 720px wide, title `Zastąp Decyzję D-14`, an info line `Stara Decyzja zostanie w rejestrze jako zastąpiona.`, fields in order: `Powód zmiany` (required textarea), `Tytuł`, `Problem`, `Alternatywy` (editor), `Uzasadnienie`, `Założenia` and `Ryzyka` (one per line textareas, split on newlines, max 10), `Pewność` (RadioCardGroup `niska 0,3` / `średnia 0,6` / `wysoka 0,9` plus numeric helper; maps to `confidence`), optional `Data przeglądu` (date input).
3. `AlternativesEditor`: list of cards (title text field + summary textarea + `Wybrana` radio), add/remove (min 1, max 8), keyboard operable, removing the chosen one forces choosing another; no drag reordering.
4. Submit: `POST /decisions/:id/supersede { proposal }` with `Idempotency-Key` created at dialog open; disabled until `validateSupersedeDraft` is OK and the draft changed.
5. Success: close, toast `Zapisano nową Decyzję D-17` with `Otwórz`, select the new Decision (URL) and refetch list; the old one shows the banner after refetch.
6. Errors: `dec.already_superseded` -> inline error with a link to the successor (`Zastąpiona już przez D-17`) and the form disabled; `dec.supersede_forbidden`/`dec.workspace_isolated` -> toast; validation issues -> field errors; `dec.duplicate_source_key` n/a.
7. Discard: Escape/close with changes opens `ConfirmDialog` (`Odrzucić zmiany?`).
8. The dialog keeps its draft only in memory; large text fields are not logged.
9. While the mutation is pending all fields are disabled; closing is blocked.
10. `overlay` region listens to `useDecisionDialogs().open('supersede')` and mounts lazily.

## 6. Design notes

`design.png` crops the trigger button `Zastąp nową Decyzją` (secondary, h40, 164px). The dialog is not in the mock; derive from ui:Dialog form with `Field`s; alternatives editor cards use `ui:Card default` with a `Radio` for `Wybrana`. Error and pending states follow DS rules.

## 7. Reuse

`ui:Dialog`, `ui:Field`, `ui:TextField`, `ui:Textarea`, `ui:RadioCardGroup`, `ui:ConfirmDialog`, form model of OVE_DECUI009.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `dialogs/SupersedeDialog.tsx`, `dialogs/AlternativesEditor.tsx`, `regions/supersede.region.tsx`.

## 9. Security and safety

No data in the old Decision is changed or removed (the server appends). The request never carries `supersedesId` (derived from the path) or `origin`. Text entered by the Owner is stored as data and later quoted by Chief as a source: treated as untrusted by the engine prompt builder. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Network failure: retry uses the same idempotency key.
- Owner clears the reason: submit disabled.
- Browser reload while open: draft lost (documented).
- Very long problem text: counter at 4000.
- Decision superseded in another window while the dialog is open: submit returns already_superseded, handled.

## 11. Acceptance criteria

- [ ] Given D-14, Then the dialog opens prefilled and `Zapisz` stays disabled until something differs and the reason is filled.
- [ ] Given a valid submit, Then one POST with an idempotency key is sent and the UI selects the new Decision.
- [ ] Given `dec.already_superseded`, Then the form disables and links to the successor.
- [ ] Given Escape on a dirty form, Then a confirm appears.
- [ ] No `DELETE`, `PUT` or `PATCH` request is ever made by this feature (network-log assertion in tests).

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `SupersedeDialog.test.tsx`, `AlternativesEditor.test.tsx`, story `Decisions/SupersedeDialog`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test decisions`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_DECUI015.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_DECUI014), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: rejected Decisions cannot be superseded from the UI.
- OPEN: creating a new Owner Decision from scratch (`POST /workspaces/:wid/decisions`) is not in the mock and not built.
