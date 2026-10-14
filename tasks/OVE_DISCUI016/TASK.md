---
id: OVE_DISCUI016
title: "Add finished Discussion read-only view, transcript export and empty states"
area: DISCUI
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DISC014, OVE_DISCUI012, OVE_DISCUI014, OVE_DS013, OVE_DS032, OVE_SHELL003]
soft_depends_on: []
provides: ["ui:DiscussionFinishedView"]
needs: ["api:discussion.export", "ui:EmptyState", "ui:Button", "lib:file-save-dialog"]
owns: ["apps/desktop/src/features/discussions/finished/**", "apps/desktop/src/locales/en/discussions-016.json", "apps/desktop/src/locales/pl/discussions-016.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 6"]
adr_refs: [8, 16, 15]
---

# OVE_DISCUI016: Add finished Discussion read-only view, transcript export and empty states

## 1. Summary

Defines how a concluded, cancelled or failed Discussion looks: read-only thread and result panel, a closing banner with the resolution and counts, an export action (Markdown or JSON) and the empty and not-found states of the Discussion route.

## 2. Context

The live Discussion view (`Dyskusja`, reached from the Chief conversation list, rail item `Chief`) lets the Owner watch a moderated, multi-Agent Discussion with an agenda and a round limit, see each participant's stance and the Skills they used (name and version, ADR 0008), speak in it, cast the deciding vote, approve or end the result, and see how a deadlock was resolved. Discussions start from a Workflow Node or by Chief (the Owner has no create action, ADR 0015, DISC014). Backend: DISC area (`contract:Discussion`, `contract:DiscussionMessage`, `contract:Stance`, `contract:DiscussionOutcome`, `contract:DiscussionSummary`, routes `/api/v1/workspaces/:wid/discussions/...`, events `discussion.*`), PAUSE (`lib:use-pause-guard`), PERM, CHIEF (Escalations). The UI area DISCUI composes `packages/ui-kit` components and shares the chat building blocks (`features/chat/markdown`, `safe`, `thread/virtual`) through their public entry files; it never re-implements a bubble, pill, card or list. Glossary: Discussion, Owner, Chief, Agent, Skill, Decision, Task, Escalation, Run, Workspace. Finished Discussions stay readable (ADR 0008: nothing is deleted). DISC014 export route `GET .../:id/export?format=md|json` returns a redacted transcript; the UI saves it through the desktop file dialog (the browser download is not used in the shell).

## 3. Scope (in)

- Closing banner.
- Read-only mode flags for the composer and controls.
- Export button and file save.
- Empty and not-found states.

## 4. Out of scope

- Deleting Discussions (not allowed).

## 5. Detailed requirements

1. Banner at the thread end: `Dyskusja zakończona · <resolution word> · 4 rundy · 3 Decyzje · 5 Zadań` using `resolutionLabel` and plural keys; failed shows `Dyskusja nie powiodła się` with the server reason code mapped to a word, cancelled shows `Anulowana przez Ownera` with time.
2. Read-only: composer replaced by the disabled reason; header controls hidden; result panel shows approved state and links.
3. Export: `Eksportuj` with a format choice (`Markdown`, `JSON`); the file is fetched as text through the api-client, then saved with the file save dialog (`lib:file-save-dialog`); the default file name is `dyskusja-<slug>-<date>.md`; a toast confirms.
4. The exported content is what the engine returns (already redacted); the UI adds nothing and never builds the export from the DOM.
5. No Discussion selected: the route shows `EmptyState` `Wybierz Dyskusję z listy`; unknown id: `Nie znaleziono Dyskusji` with a link to the list; Discussion of another Workspace: same not-found state (no existence leak).
6. Loading: skeleton rows in the thread and panel.
7. Export size limit: the engine caps it; on `413` show `Transkrypt jest zbyt duży do eksportu`.

## 6. Design notes

N/A, functionality only (states not in the mock).

## 7. Reuse

- `EmptyState`, `Button` (kit); mappers (OVE_DISCUI002); data hooks (OVE_DISCUI003).

## 8. Architecture and code placement

`features/discussions/finished/`: `FinishedBanner`, `useExport` hook, `DiscussionEmptyStates`. **i18n namespace:** this task writes its strings into its own namespace `discussions-016` (files `locales/en|pl/discussions-016.json`, owned here). Key names quoted in this text with the prefixes `chat:`, `chat-cards:`, `chat-agent:`, `chat-errors:` or `discussions:` are logical names: keys defined by this task go into `discussions-016`; shared words (state words, units, origin label, round/participant plurals) live in the area's skeleton namespace and are extended only by a proposal. Where the text says a sibling task owns a namespace file, this rule wins.

## 9. Security and safety

Trust boundaries: everything that arrives from the gateway as message text, card snapshots, terminal lines, Skill names or Telegram content is UNTRUSTED DATA (SEC004). It is rendered only as React text nodes or through the safe Markdown renderer (CHATUI008); no `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no dynamic code, links only through `ui:TextLink` (its `safeHref` allows http, https, mailto, tel and relative paths). Text from an Agent or from Telegram can never trigger an action: no component parses message text for commands, approvals or rule changes; actions come only from typed `parts` and from the Owner's clicks. Secrets never render: redacted markers are shown as received, the UI never tries to reconstruct them, and no secret-like value is placed in logs, test snapshots or i18n files. Fail closed: when a state cannot be established (approval status unknown, isolation unknown, pause unknown) the control is disabled and says why. Discussion messages are Agent output and therefore untrusted; an Agent can claim to speak for the Owner or Chief but authorship and trust come only from the server fields (`author.kind`, `trust`), never from text (SEC004). The export contains Agent output; it is saved only to a path the Owner chooses in the native dialog. The UI never writes to disk without that dialog and never sends the export anywhere.

## 10. Errors and edge cases

- Export fails: toast with Retry.
- Save dialog cancelled: nothing happens.
- Discussion changes to finished while open: banner appears, composer disables.

## 11. Acceptance criteria

- [ ] Finished Discussions are fully read-only.
- [ ] Export saves the engine's text unchanged to the chosen path.
- [ ] Not-found does not reveal whether the id exists in another Workspace.
- [ ] Banner words match the mock style in PL.

## 12. Test plan

- Vitest with fake export; Playwright `disc-finished` (DISCUI018).
- Command: `pnpm --filter @overmind/desktop test features/discussions/finished`.

## 13. Parallelization notes

No hotspot. Other DISCUI tasks run in parallel as long as their `depends_on` are merged. Add translations only to the namespace file this task owns; never edit another task's locale file or `feature.manifest.ts` (propose via `tasks/_proposals/`). New reusable pieces go to the folders named in section 8, not into shared files.

## 14. Open questions and assumptions

- GAP: `api:discussion.export` and `lib:file-save-dialog` need owners (DISC014 mentions export; the Tauri save dialog belongs to a platform area).
- ASSUMPTION: export formats are `md` and `json`.
