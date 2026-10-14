---
id: OVE_SKUI011
title: "Import dialog: file, paste or URL with client checks and submission"
area: SKUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_DS026, OVE_DS035, OVE_DS036, OVE_DS040, OVE_SKILL011, OVE_SKUI003]
soft_depends_on: []
provides: ["lib:skill-import-dialog"]
needs: ["api:skills.import", "lib:api-client-skills", "ui:Dialog", "ui:Tabs", "ui:TextField", "ui:Textarea", "ui:InfoNote", "lib:use-gateway-mutation", "lib:skills-route"]
owns: ["apps/desktop/src/features/skills/components/ImportSkillDialog.tsx", "apps/desktop/src/features/skills/state/use-skill-import.ts", "apps/desktop/src/locales/en/skills-import.json", "apps/desktop/src/locales/pl/skills-import.json"]
reads: []
design: design.png
design_source: "Skille#skills/header (the `Importuj z pliku lub URL` button, crop 780,176,310,56 CSS px; the dialog is not drawn in the mock) (crop 780,176,310,56 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [12]
---

# OVE_SKUI011: Import dialog: file, paste or URL with client checks and submission

## 1. Summary

`Importuj z pliku lub URL`: a dialog with three sources (file, paste, https URL), client-side pre-checks, a warning that the content is untrusted, and the submit that creates a PENDING private version.

## 2. Context

ADR 0012: Skills from the internet are added only by the Owner, as untrusted pending versions. SKILL007: only an Owner on the desktop; URL imports are fetched by the ENGINE (https only, no credentials, size cap 256 KiB, public IPs only, content types markdown/text), file/paste <= 256 KiB UTF-8 `.md`/`.txt`; the result is version 1 `pending_review`, private in the current Workspace, with a scan; max 20 imports per hour. The UI NEVER fetches the URL itself.

## 3. Scope (in)

- `ImportSkillDialog` with tabs `Plik`, `Wklej`, `URL`.
- `useSkillImport` mutation and the hand-off to the review step (OVE_SKUI012).

## 4. Out of scope

- The review of the imported version (OVE_SKUI012).

## 5. Detailed requirements

1. Tab `Plik`: file input and drop area accepting `.md`/`.txt` only; the file is read in the browser as UTF-8 text with `FileReader` up to 256 KiB (larger or binary: inline error, nothing sent); the file is never executed or rendered.
2. Tab `Wklej`: plain textarea (counter to 256 KiB).
3. Tab `URL`: `TextField type=url` accepting `https://` only (client hint; anything else shows `Tylko adresy https`); the helper text states `Pobierze go silnik, nie ta aplikacja. Treść trafi do przeglądu i nie jest nigdzie używana, dopóki jej nie zaakceptujesz.`.
4. Optional `suggestedName` (slug); front matter is only a hint, the review step confirms name and description.
5. A permanent `InfoNote` (amber tone via `CalloutAmber`): `Zaimportowana treść jest niezaufana. Przejrzysz ją i wynik skanowania przed akceptacją.`
6. Body `{ via:'file'|'url'|'paste', file?|url?|paste?, suggestedName? }`, size <= 300 KiB; header `Idempotency-Key`; submit disabled while pending.
7. Success: close the dialog, show the new Skill pending in the review strip (event refetch) and open the review (`openReview(skillId, 1)`); errors: `skill.import_owner_only` (message `Import jest możliwy tylko przy komputerze, przez Właściciela`), `skill.import_blocked_host` (`Ten adres jest zablokowany`), `skill.import_fetch_failed`, `skill.too_large`, `skill.invalid_instructions`, `gateway.rate_limited` (limit 20/h with the wait).
8. The URL is shown back only as host in results (the engine stores host name only); the UI does not log or toast the full URL with query.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`ui:Dialog`, `ui:Tabs`, `ui:TextField`, `ui:InfoNote`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/skills/` (feature `skills`, route `/skills`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `components/ImportSkillDialog.tsx`, `state/use-skill-import.ts`.

## 9. Security and safety

Skill text is instructions that will later steer an Agent, so it is the most sensitive untrusted text in the product (ADR 0012: Skills from the internet come only from the Owner and are untrusted until accepted). The UI shows it only as plain text (no Markdown-to-HTML, no links made clickable inside the text), never includes it in any prompt or request other than the explicit Owner action, and a Skill chip or `requiredTools` list is metadata, never a permission. The URL is untrusted input sent to the engine, which enforces SSRF protection; the client check is only a convenience. Imported text is never rendered as HTML and never included in a prompt before acceptance. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- File with BOM: stripped by the engine; UI reads as UTF-8.
- A `.zip` dropped: rejected inline (`Obsługujemy tylko pojedynczy plik .md lub .txt`).
- Paste of 300 KiB: rejected by the counter.
- Rate limit hit: submit disabled until the wait ends.

## 11. Acceptance criteria

- [ ] Given a valid `.md` file, Then one POST with `via:'file'` is sent and a pending Skill appears.
- [ ] Given `http://x`, Then the URL tab rejects it locally.
- [ ] Given a binary file, Then nothing is sent.
- [ ] Given `import_blocked_host`, Then a clear message is shown and no Skill is created.
- [ ] Given the dialog, Then the untrusted-content note is always visible.

## 12. Test plan

Vitest + Testing Library with a fake api-client (`lib:test-utils`, `renderWithFakeGateway`): `ImportSkillDialog.test.tsx` (file/paste/URL, size, errors), `use-skill-import.test.tsx`. Axe on every rendered state. Commands: `pnpm --filter @overmind/desktop test skills`, `pnpm --filter @overmind/desktop storybook:test`. End-to-end and visual coverage of the whole view is in OVE_SKUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: route and nav come from the manifest (OVE_SKUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: no drag-and-drop of a whole directory or archive in MVP (SKILL007).
