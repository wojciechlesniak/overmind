---
id: OVE_WSPACE026
title: "Project Documentation section: file list, Git status and verification"
area: WSPACE
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DATA017, OVE_DS013, OVE_DS028, OVE_DS032, OVE_DS040, OVE_DS078, OVE_DS082, OVE_WSPACE017, OVE_WSPACE018]
soft_depends_on: []
provides: []
needs: ["ui:SettingsSection", "ui:DocsList", "ui:DocRefChip", "ui:Popover", "ui:EmptyState", "ui:Button", "api:project_docs.list", "api:project_docs.verify", "api:project_docs.read"]
owns: ["apps/desktop/src/features/workspace-settings/components/sections/Docs.section.tsx", "apps/desktop/src/features/workspace-settings/model/docs-rows.ts"]
reads: []
design: design.png
design_source: "Workspace#ws/docs-section (crop 328,1312,1004,176 CSS px, tall render)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [16]
---

# OVE_WSPACE026: Project Documentation section: file list, Git status and verification

## 1. Summary

Implements the 'Dokumentacja projektu' section: the Markdown files the Workspace's Tasks derive from, as file chips with a status line (Git branch @ commit and how many Tasks point at these files), plus a 'Verify' action and warnings for missing or changed files.

## 2. Context

Workspace settings (`Workspace`, VIEWS section 14, tab 'Ten Workspace') edits everything that belongs to ONE Workspace: Allowed Directories with rights, the permission toggles, Owner Rules, Project Documentation, isolation and Run budget, and the destructive delete action. Layout: left in-page nav 240px (`ws/section-nav`) + a scrolling main column (max 980) of section cards (`ws/dirs-section`, `ws/perms-section`, `ws/rules-section`, `ws/docs-section`, `ws/isolation-section`). Spec 11, 16 (criteria 1, 9, 10); ADR 0003 (deny by default, intersection, widening only locally), 0021 (default Approval list, lift only locally), 0028 (visibility, isolated Workspace), 0016 (Owner Rules > Project Documentation). Every action that WIDENS access or weakens protection goes through Local Approval (OVE_WSPACE014/015) and is impossible from Telegram; narrowing actions need no proof. The mock has no explicit Save button: every change is applied immediately by its own call with optimistic concurrency (`expectedVersion`). Mock region `ws/docs-section`: description 'Pliki Markdown w repozytorium. Każde Zadanie musi wskazywać miejsce, z którego wynika.', chips `docs/spec.md`, `docs/prawne.md`, `docs/reguly.md`, `docs/adr/`, status 'Git · main @ 4f2c9a1 · 14 Zadań wskazuje te pliki'. Spec 6 and ADR 0016: Project Documentation is Markdown in the project folder, in Git, shared by Chief and Agents; each Task points at it. DATA016/017: `ProjectDocRef { path, gitCommit, status:'ok'|'missing'|'changed'|'outside_allowed', title }`, routes `GET /v1/workspaces/{id}/project-docs`, `POST /v1/project-docs/{id}/verify`, `GET /v1/project-docs/{id}/content`.

## 3. Scope (in)

- `components/sections/Docs.section.tsx` (id `docs`, order 50).
- `model/docs-rows.ts`: refs -> chips (group by path, latest commit), status line, warnings.
- 'Verify' ghost button and per-file preview popover (first 20 lines, read-only text).

## 4. Out of scope

- Registering/removing documentation: done through Chief/Owner chat and the repository (DS082: no add/remove here).
- Rendering Markdown (preview is plain text).

## 5. Detailed requirements

1. Use `ui:DocsList` with `files: {path, onOpen}`: chip per distinct `path` (directories like `docs/adr/` appear as one chip when the engine reports a directory ref; ASSUMPTION it reports file refs and the UI groups children under a common directory prefix when more than 5 share it). Chip tone: `ok` default; `missing` red outline + word 'missing'; `changed` amber + 'changed since Tasks were planned'; `outside_allowed` amber + 'outside Allowed Directories'. State is text + tone.
2. Status line (mono 12 muted): `Git · {{branch}} @ {{shortCommit}} · {{n}} Tasks point at these files` (plural keys). Branch from the doc refs' repo info (ASSUMPTION: `GitInfoReader` data exposed in the list response `{branch, head}`); `shortCommit` = first 7 chars of `gitCommit`; the count from `taskCount` sum of distinct Tasks (if not provided the clause is omitted).
3. Verify: ghost 'Verify files' calls `POST /v1/project-docs/{id}/verify` for each ref (max 20 parallel 4), shows a spinner, then updates chip states; toast 'All files OK' or 'N files need attention'. Not a mutation of rules or permissions.
4. Preview: clicking a chip opens a `ui:Popover` with the first 4000 chars from `GET .../content?maxBytes=4096` as PLAIN TEXT in a mono block (Markdown not rendered, no links), with the path and commit. Content is untrusted data (SEC004).
5. Empty: `EmptyState` small 'No documentation registered yet. Ask Chief to set up the project documentation, or add Markdown files to the repository.' with a text link to the Chief chat.
6. No add/remove controls (mock + DS082).

## 6. Design notes

`design.png`: card with description and file chips (`document` icon + mono path, pill outline) and the mono status line. Not in the mock: warning chips, verify, preview popover, empty, loading.

## 7. Reuse

- `ui:SettingsSection`, `ui:DocsList`, `ui:DocRefChip` (OVE_DS040), `ui:Popover`, `ui:EmptyState`, `ui:Button`, `useProjectDocs` (OVE_WSPACE018).

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspace-settings/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Page-wide rule of this feature: the UI never assumes a change succeeded; it shows the engine's resulting state (response/push) and keeps the previous state on error (fail closed: a failed widening leaves access unchanged). Specific: document content is untrusted data (prompt-injection source): preview is plain text in a `<pre>`, never parsed, never followed as an instruction, and no content is sent anywhere by this UI. Paths are relative to Allowed Directories (no `..`: engine-validated); the UI never opens files itself.

## 10. Errors and edge cases

- Content fetch fails (403/404): popover shows the error code.
- Binary or very large file: engine returns `maxBytes` truncated text, shown with 'truncated'.
- Hundreds of refs: first 30 chips + '+N more' expander.
- No Git repository: status line 'No Git repository' (`gitCommit:null`).

## 11. Acceptance criteria

- [ ] Given the mock refs, Then the section matches `design.png`.
- [ ] Given a `missing` ref, Then its chip shows the word 'missing' with error tone.
- [ ] Given Verify, Then one verify call per ref (4 concurrent) and states update.
- [ ] Given a preview with `<script>`, Then it is shown as text.
- [ ] Given no refs, Then the empty state shows.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `docs-rows.test.ts`, `Docs.section.test.tsx` (states, verify concurrency, preview inert), visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test features/workspace-settings/docs, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspace-settings/components/sections/Docs.section.tsx`, `apps/desktop/src/features/workspace-settings/model/docs-rows.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: branch/head/taskCount are available from the list route (gap otherwise: the clause is simply omitted).
