---
id: OVE_BOARDUI012
title: "Create Task dialog \"Zadanie z Dokumentacji\" with mandatory Documentation link"
area: BOARDUI
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARD013, OVE_BOARDUI001, OVE_BOARDUI003, OVE_BOARDUI006, OVE_DATA017, OVE_DS013, OVE_DS026, OVE_DS030, OVE_DS036]
soft_depends_on: []
provides: ["lib:board-create-task"]
needs: ["api:board.task.create", "api:project_docs.list", "lib:api-client-board", "ui:Dialog", "ui:Field", "ui:TextField", "ui:Textarea", "ui:Select", "ui:Button", "lib:use-gateway-mutation", "lib:feature-regions"]
owns: ["apps/desktop/src/features/board/dialogs/CreateTaskDialog.tsx", "apps/desktop/src/features/board/dialogs/create-task-form.ts", "apps/desktop/src/features/board/regions/create-task.region.tsx", "apps/desktop/src/locales/en/board-create.json", "apps/desktop/src/locales/pl/board-create.json"]
reads: []
design: design.png
design_source: "Tablica#board/new-task-button (crop 84,183,240,56 CSS px)"
spec_refs: ["SPECIFICATION 6"]
adr_refs: [16, 11]
---

# OVE_BOARDUI012: Create Task dialog "Zadanie z Dokumentacji" with mandatory Documentation link

## 1. Summary

The Owner can add a Task from Documentation: the dialog behind `+ Zadanie z Dokumentacji` collects title, Documentation file and anchor, optional description and acceptance criteria, and creates the Task. A Task without a verified documentation link cannot be created.

## 2. Context

Tasks normally come from Chief and Discussions, but the Owner may add one directly (BOARD013 lists the Owner as a caller of `POST /workspaces/:wid/tasks`). ADR 0016 and SPEC 6: every Task points to the Project Documentation place it follows; the engine verifies the link (`board.doc_ref_required`, `doc_ref_unresolvable`, `doc_ref_outside_documentation`). Project docs are registered per Workspace (`api:project_docs.list`). The mock only shows the trigger button; the dialog is derived from the DS.

## 3. Scope (in)

- `CreateTaskDialog` (ui:Dialog form) and a pure form model `create-task-form.ts` (zod schema derived from `TaskDraft` fields, validation messages by key).
- Documentation picker: Select of registered docs + free `anchor` field.
- Optional acceptance criteria (up to 5 in the dialog), optional lane (default: first `todo` lane), priority `normal|high`.
- Server error mapping to field errors and a Toast on success with a `Pokaż` action selecting the new Task.

## 4. Out of scope

- Editing Tasks, attaching files, creating Tasks in batches (engine only), Documentation editing (only the Owner, outside Overmind: ADR 0016).

## 5. Detailed requirements

1. Fields: `title` (1..140, trimmed, NFC, control characters rejected), `docPath` (required; Select options from `project_docs.list` showing path; the Select supports typing to filter), `anchor` (optional, <= 120, pattern `[A-Za-z0-9_.:-]+` shown as `#anchor` helper), `quote` is NOT entered (the engine reads it from the document), `description` (<= 8000, textarea), `criteria` (0..5 rows of 1..300 chars), `priority` (SegmentedControl `Zwykły`/`Wysoki`).
2. Validation runs on blur and on submit with the shared `isRelativeDocPath` helper (OVE_BOARDUI002) for the manual path case; the submit button stays disabled until the schema is valid and the doc is selected. Error messages are keyed `board-create:errors.*`.
3. Submit: `POST /workspaces/:wid/tasks` with body `{ title, description?, docRef: { path, anchor? }, acceptanceCriteria?, priority?, laneKey? }` (no `workspaceId`, no provenance, no `createdBy`) and header `Idempotency-Key` generated once when the dialog opens (so a double submit cannot duplicate the Task).
4. Server errors: `board.doc_ref_required|doc_ref_unresolvable` -> error under the doc field (`Ten plik nie istnieje w Dokumentacji lub zmienił się`), `board.doc_ref_outside_documentation` -> same field, error tone, text `Plik jest poza Dokumentacją projektu`, `board.duplicate_draft` -> toast `Takie Zadanie już istnieje`, `board.creation_rate_limited` -> toast with retry hint, `validation.invalid_input` -> field errors from `details.issues` (path and code only).
5. On success: close the dialog, toast `Dodano T-<seq>` with action `Pokaż` (selects the Task via `useSelectedTask`), and refetch the board; the new card is expected in the `todo` Lane.
6. `overlay` region `create-task.region.tsx` listens to `useBoardDialogs()` (OVE_BOARDUI006) and mounts the dialog lazily (code split).
7. No documentation registered: the doc field shows an empty-state hint `board-create:noDocs` with a link to Workspace settings (`routes.workspaceSettings()`), submit disabled.
8. Draft safety: the dialog keeps form state in memory only while open; nothing is written to localStorage.
9. Accessibility: dialog labelled by its title, first invalid field focused after a failed submit, errors linked by `aria-describedby`, Escape closes only when not dirty or after a discard confirm (`ConfirmDialog`).

## 6. Design notes

`design.png` crops the trigger: the violet primary `+ Zadanie z Dokumentacji` (h40, radius 12, plus icon). The dialog is NOT in the mock; derive it from the ui-kit `Dialog` form variant: 520px wide, title 20/700, fields in a column gap 16 with `Field`/`TextField`/`Textarea`, doc Select with mono option text, footer with `Dodaj Zadanie` (primary-violet) and `Anuluj` (secondary). Error text uses the error tone with a glyph, not colour alone.

## 7. Reuse

`ui:Dialog`, `ui:Field`, `ui:TextField`, `ui:Textarea`, `ui:Select`, `ui:SegmentedControl`, `useGatewayMutation`, `isRelativeDocPath`, ULID helper.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `dialogs/create-task-form.ts` (pure schema and mapping to the request, imports zod and contracts types), `dialogs/CreateTaskDialog.tsx`, `regions/create-task.region.tsx`.

## 9. Security and safety

The Documentation link is the discipline of the product (ADR 0016): the UI refuses to submit without one, but the engine is the authority (forged paths, `..`, symlinks). The UI never sends `provenance`, `createdBy` or `workspaceId`. Free-text fields are untrusted input that later appears as agent prompts: no special handling here, the engine sanitises at prompt time (OVE_SEC004). All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Doc file removed after the list loaded: engine error shown under the field.
- Title only whitespace: invalid.
- Description with control characters: stripped by the engine; the UI shows the engine error if rejected.
- Network failure on submit: dialog stays, retry uses the same idempotency key.
- Owner presses Enter in the title field: submits only when valid; Enter in the textarea inserts a newline.
- More than 5 criteria: add button disabled with helper text.

## 11. Acceptance criteria

- [ ] Given no doc selected, Then submit is disabled and the field explains why.
- [ ] Given a valid form, Then `POST /workspaces/:wid/tasks` is sent once with an idempotency key and no forbidden fields, and the success toast offers `Pokaż`.
- [ ] Given `board.doc_ref_unresolvable`, Then the error appears under the doc field and the dialog stays open.
- [ ] Given a double click on submit, Then only one request is sent.
- [ ] Axe clean; focus is trapped and restored to the trigger.

## 12. Test plan

Vitest + Testing Library with a fake api-client from `lib:test-utils`: `create-task-form.test.ts` (schema table, request mapping, forbidden fields absent), `CreateTaskDialog.test.tsx` (flows and errors), story `Board/CreateTaskDialog` (empty, invalid, submitting, server error). Storybook stories only where this task adds a component of its own. Axe on every rendered state (`lib:a11y-harness`). Commands: `pnpm --filter @overmind/desktop test board`, `pnpm --filter @overmind/desktop storybook:test`. Playwright and visual tests for the whole view are in OVE_BOARDUI016.

## 13. Parallelization notes

Owns only the paths in `owns`. Shared files are never edited: routes and nav come from the feature manifest (OVE_BOARDUI015), regions are auto-discovered from `regions/*.region.tsx` (OVE_BOARDUI003), i18n keys live in this task's own namespace file. 

## 14. Open questions and assumptions

- ASSUMPTION: the Owner may add Tasks directly (BOARD013 lists owner as caller).
- OPEN: whether the Owner can choose a Lane: default is the first `todo` Lane; the select is hidden in MVP.
