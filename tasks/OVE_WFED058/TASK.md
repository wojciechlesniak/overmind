---
id: OVE_WFED058
title: "Implement 'Edytuj jako v8': start a draft from a Version, continue it or discard it"
area: WFED
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS036, OVE_WFED002, OVE_WFED050, OVE_WFED052, OVE_WFRT049]
soft_depends_on: []
provides: ["feature:wfed-edit-as-new"]
needs: ["api:workflows.edit-as-new-version", "api:workflows.draft.get", "lib:wfed-data-hooks", "ui:ConfirmDialog", "lib:editor-document-model", "feature:editor-edit-mode"]
owns: ["apps/desktop/src/features/workflow-editor/edit-mode/**", "apps/desktop/src/locales/en/wfed-edit.json", "apps/desktop/src/locales/pl/wfed-edit.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7"]
adr_refs: [2, 19, 28]
---

# OVE_WFED058: Implement 'Edytuj jako v8': start a draft from a Version, continue it or discard it

## 1. Summary

The transition from the read-only published view to edit mode: 'Edytuj jako v8' creates (or resumes) the single Draft based on a Version; 'Odrzuć' deletes the Draft after a confirmation. Editing never touches the published Version.

## 2. Context

Overmind is a desktop app (Tauri + React + TypeScript) in which one Owner runs teams of AI Agents. A Workflow is an executable program (ADR 0002): the editor only creates and shows the graph, the engine runs it. Every Run pins an immutable Workflow Version; editing creates a new Version and never changes a running Run. Visibility (PUBLICZNY / PRYWATNY, ADR 0028) is always shown as a word. The UI talks only to the engine gateway through `api-client` (CONVENTIONS section 6). UI copy in the mock is Polish; code uses i18n keys with EN default and PL first translation (ARCH011). WFRT002 `EditAsNewVersionRequest { fromVersionNo }`, one Draft per Workflow with `baseVersionNo`. While a Draft exists, the page can show either the published Version (read-only) or the Draft; the header makes the mode obvious.

## 3. Scope (in)

- `useEditMode()` state: `published | draft | viewing_old`, with transitions.
- Edit entry: create or resume Draft, load it into the part 1 document model, switch canvas to edit mode.
- Discard flow with confirm (shows counts of unsaved/ saved changes vs base).
- Leave-page guard when the Draft has unsaved local edits.

## 4. Out of scope

- Publishing (`OVE_WFED057`).
- Editing behaviour on the canvas (part 1).
- Version switching (`OVE_WFED059`).

## 5. Detailed requirements

1. `startEdit(fromVersionNo = published)` calls `api:workflows.edit-as-new-version` (idempotent: if a Draft with the same base exists it returns it). Starting an edit from an older Version when a Draft on a newer base exists asks 'Masz wersję roboczą opartą na v7. Zastąpić ją wersją opartą na v5?' (destructive confirm).
2. Mode is derived from data (`draft` exists AND the URL/state says editing) not from a local boolean only, so a reload returns to the same mode; deep link `?mode=edit`.
3. Canvas read-only flag: `mode !== 'draft'` makes part 1 canvas `mode='view'` (FlowCanvas prop `mode`).
4. Discard: `ConfirmDialog` 'Odrzucić wersję roboczą v8?' body 'Utracisz 5 zapisanych zmian względem v7. Opublikowane Wersje i działające Runy nie zmienią się.' buttons 'Odrzuć' (danger) / 'Wróć'; calls the Draft delete route; success returns to `published`.
5. Leave guard: navigating away (rail, tab change) with `dirty` true opens 'Niezapisane zmiany' with 'Zapisz wersję roboczą' / 'Odrzuć lokalne zmiany' / 'Zostań'. Autosave normally keeps the Draft current, so the guard appears only when autosave failed or is pending.
6. Registers header intents `edit` and `discard`.
7. If the Workflow is archived or the Owner has no edit right (never for the single Owner, but Workflow in an isolated Workspace is editable), `edit` is hidden.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `ui:ConfirmDialog`; part 1 `feature:editor-edit-mode` (canvas read-only toggle) and `lib:editor-document-model`.

## 8. Architecture and code placement

`@WF/edit-mode/use-edit-mode.ts` (reducer + effects), `DiscardDialog.tsx`, `LeaveGuard.tsx`, `register.ts`.

## 9. Security and safety

The UI is a thin client: it never reads files, the database or CLIs, and every mutation goes through the gateway, which re-validates everything server-side (client-side checks are convenience only). Text coming from Agents, Skills, repositories or Run output is data: render it as plain text (no `dangerouslySetInnerHTML`, no Markdown with raw HTML, no link auto-navigation), truncate with a `title`, and never use it as an i18n key, a route or a CSS value. The UI cannot extend permissions: it shows the intersection computed by the engine and offers only narrowing or an Access Request. Mutating calls send an idempotency key and handle `409` and `423` (paused) results as typed errors. Failures fail closed: when a check cannot be performed the control is disabled with a visible reason. Discard is destructive for unpublished work only; published Versions are immutable and unaffected. The guard prevents accidental loss, not a security boundary.

## 10. Errors and edge cases

- Two windows: window B starts editing while A has a Draft: B gets A's Draft (single Draft) and a banner 'Ta wersja robocza jest otwarta w innym oknie' when revisions diverge.
- Discard while a dry-run on the draft is running: the dry-run is cancelled first (confirm text mentions it).
- Edit from an old Version viewed read-only: allowed (creates a Draft based on that Version, version number = latest+1).
- Engine unreachable: edit button disabled with reason.

## 11. Acceptance criteria

- [ ] Given published v7 and no draft, when 'Edytuj jako v8' is clicked, then a Draft with base v7 exists and the canvas is editable.
- [ ] Given an existing Draft, then the button label is 'Kontynuuj wersję roboczą' and no second Draft is created.
- [ ] Given discard confirmed, then the Draft is gone and the page shows v7 read-only.
- [ ] Given unsaved local changes and navigation away, then the guard appears.

## 12. Test plan

Reducer tests, hook tests, dialog tests; e2e covered by `OVE_WFED089`. `pnpm --filter desktop vitest run src/features/workflow-editor/edit-mode`.

## 13. Parallelization notes

Works in its own folder under the owned paths and registers through the extension points (feature manifest, one i18n namespace file per feature area, one component folder per component). Do not edit files owned by part 1 of the editor (`OVE_WFED001..049`) or by DS; write a proposal in `tasks/_proposals/` instead.

## 14. Open questions and assumptions

- ASSUMPTION: `api:workflows.draft.delete` exists (WFRT047) or the discard is `api:workflows.edit-as-new-version` with `discard:true`; flagged to the linker.
