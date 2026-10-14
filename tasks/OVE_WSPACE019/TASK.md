---
id: OVE_WSPACE019
title: "Allowed Directories section: table rendering with origin, rights and expired grants"
area: WSPACE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS032, OVE_DS078, OVE_DS081, OVE_WSPACE017, OVE_WSPACE018]
soft_depends_on: []
provides: ["lib:directories-actions-context"]
needs: ["ui:SettingsSection", "ui:PermissionMatrix", "ui:EmptyState", "ui:Skeleton", "ui:Button"]
owns: ["apps/desktop/src/features/workspace-settings/components/sections/Directories.section.tsx", "apps/desktop/src/features/workspace-settings/model/directory-rows.ts", "apps/desktop/src/features/workspace-settings/components/directories-actions/context.ts"]
reads: []
design: design.png
design_source: "Workspace#ws/dirs-section (crop 328,172,1004,342 CSS px, from the tall render)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [3, 6, 20]
---

# OVE_WSPACE019: Allowed Directories section: table rendering with origin, rights and expired grants

## 1. Summary

Renders the 'Dozwolone katalogi' section card with the permission matrix: one row per Allowed Directory (path, origin text, read/write/execute checkboxes, added info), run-scoped Telegram grants shown expired or active, and the empty list meaning no access. Interactions are OVE_WSPACE020/021.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock regions `ws/dirs-section` (340,184,980x318), `ws/dirs-table` with columns KATALOG / ODCZYT / ZAPIS / WYKONYWANIE / DODANY, rows '~/Projects/aplikacja-rezerwacji' (all three rights, 'kreator · przy komputerze'), '~/Projects/shared-ui' (read only, 'Prośba Designera · przy komputerze'), '~/Downloads/brief.pdf' (read, 'z Telegrama · tylko Run #13 · wygasło' in amber) and the 'Dodaj katalog' button. Description: 'Tylko te katalogi są zamontowane w kontenerze Agentów. Pusta lista to brak dostępu.'

## 3. Scope (in)

- `components/sections/Directories.section.tsx` (section id `directories`, order 10).
- `model/directory-rows.ts`: policy entries + run grants -> `FolderGrantRow[]`.
- Origin text rules, added column text, expired/locked row flags.

## 4. Out of scope

- Toggling rights, adding and removing (OVE_WSPACE020, 021).

## 5. Detailed requirements

1. `ui:SettingsSection title='Dozwolone katalogi' description=...` containing `ui:PermissionMatrix` with `FolderGrantRow { id, path, origin, read, write, execute, addedLabel, expired?, expiredLabel?, locked?, note? }` (DS081). Props `onChange/onRemove/onAdd` are provided by OVE_WSPACE020/021; in this task they are no-ops wired through a typed context `DirectoriesActions` so that those tasks plug in without editing this file (the section reads actions from `useDirectoriesActions()` which they implement in `components/directories-actions/*.actions.ts` collected by glob).
2. Row sources: (1) `AllowedDirectory` from the Workspace policy: `path` = display path (`~`-relative) with title = canonical path; `rights` -> three booleans; `source` -> origin text: `wizard` -> `directories.origin.wizard` ('wizard · at the computer'), `owner_settings` -> 'added by you · at the computer', `access_grant` -> 'Agent request{{who}} · at the computer' (the requesting Agent name comes from the Access Request linked via `addedDirectoryId`; fallback no name); `addedLabel` = relative date; `primary` -> `locked:true` with lock icon (cannot be removed; rights fixed read ≥) and a hint 'Workspace root (/work)'. (2) Run grants from Telegram: `decision.by==='owner_telegram'` and `status in ('granted_run')` => row with `origin = 'from Telegram · this Run #<n> only'`, rights checkboxes disabled (read-only) and `addedLabel` 'active until the Run ends'; once the Run ended or the grant expired => `expired:true`, `expiredLabel:'expired'`, all checkboxes unchecked and disabled (amber text, word + tone). Run number via run summary if available else the short run id.
3. Rows sorted: primary first, then by `addedAt`; expired Telegram rows last. Maximum shown 64 rows (policy max); more not possible.
4. Empty policy (no entries): `ui:EmptyState` inside the card: 'No folders: Agents have no access to any files.' + the add button (the section header text already says it); no table.
5. Table accessible name `directories.table` ('Allowed Directories'); header cells `scope='col'`; checkbox names `{right} {path}` (kit).
6. The count in the nav is not shown. The summary line 'N folders' is not in the mock and is omitted.
7. Paths longer than the cell: ellipsis in the middle with full path in `title`; `unicode-bidi: plaintext`.

## 6. Design notes

`design.png` = the whole section: header 16/700 + description 12 muted; table in a r16 `#140F20` container with mono 10 column headers, 44px rows, custom 20px checkboxes (violet checked), origin 11px muted under the path (mock puts origin in the last column; follow the mock: DODANY column text 12px, amber for the expired row); 'Dodaj katalog' secondary button with plus icon below the table. Not in the mock: empty list, locked root row, disabled run-grant row, loading skeleton rows, error.

## 7. Reuse

- `ui:SettingsSection`, `ui:PermissionMatrix`, `ui:EmptyState`, `ui:Skeleton`, `ui:Button`.
- `usePolicy`, `useRunGrants` (OVE_WSPACE018).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: the table shows ONLY what the engine reports as effective for this Workspace layer; it never shows a path as granted because of its own state. A Telegram run grant is visibly temporary and read-only (cannot be made permanent from here without Local Approval: the Access Request decision lives in the Approvals view, OVE_APPRUI). Paths are untrusted text (an Agent can influence a label via an Access Request): displayed as text, never as links.

## 10. Errors and edge cases

- Entry whose path no longer exists: engine marks `rootFingerprint` mismatch; ASSUMPTION the row shows a warning pill 'folder missing' (text) when the engine provides a `status`; otherwise normal.
- Policy `maxRights` ceiling lower than a directory's rights: effective rights shown from the entry; the section does not compute intersections (Permissions section explains it).
- Duplicate display paths (two roots with the same display): show canonical tail in title.
- Row removed while viewing: row disappears via push.
- Hundreds of expired Telegram rows: show the last 5 expired, rest under 'Show older' (text button).

## 11. Acceptance criteria

- [ ] Given the three mock rows, Then the table matches `design.png` (checkboxes, origin texts, amber expired text).
- [ ] Given the Telegram grant ended, Then its row is unchecked, disabled and shows 'wygasło' with amber tone and word.
- [ ] Given an empty policy, Then the empty state shows and no table.
- [ ] Given the primary directory, Then it shows a lock and cannot be edited.
- [ ] Paths render as text; a path with `<script>` is inert.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `directory-rows.test.ts` (sources, origin texts, expired, primary, sorting), `Directories.section.test.tsx` (empty, loading, error), stories `Directories/Default|Empty|Expired|Locked|Loading`, visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/directories, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/sections/Directories.section.tsx`, `apps/desktop/src/features/workspace-settings/model/directory-rows.ts`, `apps/desktop/src/features/workspace-settings/components/directories-actions/context.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files. Tasks 020 and 021 add files under `components/directories-actions/` (`add.actions.ts`, `rights.actions.ts`), which the section collects by glob. Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: Telegram run grants appear as rows because the mock shows one; source: Access Requests `granted_run`.
- OPEN: show who approved (desktop/Telegram) in the origin text; default yes.
