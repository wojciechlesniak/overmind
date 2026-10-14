---
id: OVE_WFED047
title: "Playwright flows for the editor: build, edit, undo, save, conflict, Skill assignment"
area: WFED
kind: test
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_TEST002, OVE_TEST004, OVE_WFED017, OVE_WFED018, OVE_WFED019, OVE_WFED020, OVE_WFED022, OVE_WFED024, OVE_WFED031, OVE_WFED032, OVE_WFED033, OVE_WFED034, OVE_WFED035, OVE_WFED036, OVE_WFED037, OVE_WFED038, OVE_WFED039, OVE_WFED042, OVE_WFED043, OVE_WFED044]
soft_depends_on: []
provides: ["suite:editor-e2e", "lib:editor-e2e-fixtures"]
needs: ["ui:EditorSideRail", "ui:WorkflowCanvasPane", "lib:editor-provider", "lib:editor-gateway", "lib:editor-session", "lib:workflow-mapper-fixtures", "lib:playwright-harness", "lib:mock-gateway-control", "lib:e2e-fixtures", "lib:test-utils"]
owns: ["apps/desktop/e2e/workflow-editor/**", "apps/desktop/e2e/workflow-editor/support/**", "apps/desktop/src/features/workflow-editor/testing/e2e-scenarios.ts"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED047: Playwright flows for the editor: build, edit, undo, save, conflict, Skill assignment

## 1. Summary

The end-to-end tests of PART 1 behaviour against the mock gateway: build a Workflow from the palette, connect with type checks, edit, undo and redo, copy and paste, group into a Loop, bind a TOR, assign a Skill by drag and by menu, autosave and reload, resolve a save conflict, and confirm that a published version is read-only while Skill assignment still works. It asserts through the data the gateway received, not only through pixels.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. The harness (TEST004) starts the desktop UI against a mock gateway with controllable responses; the editor has its own typed fake (`EditorGateway`, WFED018) used by the scenarios through `lib:mock-gateway-control`. Pointer drags of HTML5 drag-and-drop need a synthetic `DataTransfer` because Playwright cannot start native drags for custom MIME payloads: `support/dnd.ts` dispatches `dragstart`, `dragenter`, `dragover`, `drop`, `dragend` with a shared `DataTransfer` handle and relies on the kit drag store for `dragover` payload reads (DS067). Canvas pointer interactions use `page.mouse` in screen coordinates computed from `data-node-id` boxes and the viewport.

## 3. Scope (in)

- Support helpers: `dnd.ts`, `canvas.ts` (node boxes, port positions, world to screen), `gateway-assertions.ts` (read the saved definition from the mock).
- Scenario files per flow (below).
- The scenario data (`e2e-scenarios.ts`): named starting documents.

## 4. Out of scope

- Performance and a11y audits (WFED045, WFED046).
- Visual comparison (WFED048).
- PART 2 flows (header, Inspector, publish, run overlay).
- Unit-level behaviour (each task has its own tests).

## 5. Detailed requirements

1. `F1 build`: start from an empty draft (Start only); drag chips Agent, Agent, Join onto the canvas at given screen points; assert three new tiles, positions snapped to 22 px in the saved definition; connect Start -> A, A -> Join, B -> Join by dragging from output to input ports; assert edge count and that the Join input shows the multi-input state; wait for autosave (fake clock advance of 2 s) and assert exactly one `saveDraft` whose definition contains 5 nodes (Start, A, B, Join + existing) and 4 edges, with `expectedRevision` equal to the loaded revision.
2. `F2 illegal connections`: drag an output onto an input of the same node, onto an occupied single-input port, from a Join output into a Start input, and create a raw back edge A -> B -> A: each is refused immediately with the reason tooltip text (asserted by the live region and tooltip), no edge is added, the saved definition is unchanged; connecting through a Loop `continue` port is accepted and drawn as a return edge (`state: return` marker).
3. `F3 undo and redo`: perform five edits (add, move, connect, rename through the quick action, delete), press `Cmd+Z` five times and assert the saved draft converges back to the start (after the debounce), `Cmd+Shift+Z` replays; a drag of three selected nodes is one undo step; a nudge series within 800 ms is one step; undo does not undo a Skill assignment.
4. `F4 clipboard`: select two connected nodes, `Cmd+C`, `Cmd+V` twice: copies are offset by +44 cascading, internal edge copied, external edges dropped, keys are new; paste of text copied from outside the app is ignored without error; paste into a view-mode document is refused.
5. `F5 grouping and TOR`: select three nodes, `Cmd+G` choose `Pętla`: a Loop frame appears around them with the label default, moving a member updates the frame, ungroup removes only the frame; bind two Agent nodes to Lane `Build` and `QA` through the context menu: tabs read `TOR · BUILD` and `TOR · QA`, the Agent visibility word stays in the accessible name; deleting the Lane in the Lane manager unbinds the nodes.
6. `F6 Skill assignment`: with the fake Skills list (public `grill-me`, private `security-audit`, system `overmind`) and Agents (public Reviewer with 0 Skills, private Security): drag `grill-me` over the Reviewer tile, assert the tab reads `upuść → 1 skill` and the panel note `przeciągasz na Reviewer`, drop, assert one `PATCH /agents/{id}` with `expectedVersion` and a 1-element `skills`, tile reads `1 skill`, success toast with the permanence line; drop `grill-me` again: refused (`Już przypisany`), no request; drop on a Discussion node: refused with the reason; use `Przypisz do…` for `security-audit` on the public Reviewer: accepted with the workspace-only line; conflict: make the mock return 409 once, assert one refetch and success; undo from the toast sends a removing PATCH.
7. `F7 reload and viewport`: pan and zoom, reload the page: the draft is restored from the gateway, the viewport from `localStorage` (key per workflow), and with storage blocked (`context.addInitScript` making `localStorage` throw) the editor still loads and fits the view.
8. `F8 conflict`: make the mock reject `saveDraft` with `revision_conflict` and `currentRevision: 7`: the conflict dialog (WFED022) appears with the three choices; `Wczytaj wersję z serwera` replaces the document; `Zachowaj moje zmiany` (retry with the new revision) saves again; both paths are asserted through the mock calls; the local history is cleared when the server copy is loaded.
9. `F9 view mode`: open the published version (`v7` fixture with an active Run signalled through PART 2 input stub): tiles cannot be dragged, no connection can start, palette chips are disabled with the reason, `Delete` does nothing, the toolbar has no Cofnij/Ponów, search works, and a Skill CAN be dropped on an Agent tile (assignment) as in the mock; the saved draft is untouched.
10. `F10 keyboard shortcuts`: the shortcuts of WFED038 work on the canvas and do nothing while focus is in the Skills search field; `?` opens the dialog; `Cmd+S` flushes the autosave immediately.
11. `F11 limits`: loading a 200-node definition works; adding the 201st node shows the limit toast and changes nothing; pasting a fragment that would exceed 200 is refused atomically.
12. Conventions: no `waitForTimeout` (advance the fake clock through the mock control or wait for DOM/network conditions), selectors by role, `data-node-id`, `data-edge-id`, test ids defined by the kit; every scenario starts from a named document in `e2e-scenarios.ts`; tests are independent and parallel-safe (each creates its own mock state); failures attach the saved definition JSON and the live-region log as artefacts; `@e2e` tag; the suite runs in under 4 minutes on CI with 2 workers.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `lib:playwright-harness`, `lib:mock-gateway-control`, `lib:e2e-fixtures` (TEST004); `lib:workflow-mapper-fixtures` (WFED017, the mock Workflow of the Main view); the fake gateway (WFED018); builders (WFED002).

## 8. Architecture and code placement

Layer: tests only. Helpers are in `support/` and are the only code that knows the DOM details of the kit (one place to fix when the kit changes, DRY).

## 9. Security and safety

Tests also check the negative security paths of the editor: a forged `AttachSkillIntent`/payload (crafted DataTransfer with a foreign Skill id) assigns nothing; a pasted hostile fragment (prototype-pollution keys, oversize, script strings in labels) changes nothing and renders only as text; a node label containing `<img onerror>` shows as literal text; in `view` mode every document mutation path is refused. No real credentials, no network beyond the mock.

## 10. Errors and edge cases

- Native drag is unsupported by Playwright: only the synthetic path is used and its limits are documented in `dnd.ts`.
- Timing: all waits are condition based; the autosave debounce uses the fake clock.
- Parallel workers: state isolation through per-test mock instances.
- Chromium only for MVP (the Tauri webview on macOS is WebKit; a WebKit smoke project is added when the harness supports it, listed in section 14).
- High-DPI screenshots are not used here.

## 11. Acceptance criteria

- [ ] F1..F11 pass against the mock gateway.
- [ ] Given the forged Skill payload scenario, Then no PATCH is sent.
- [ ] Given the hostile clipboard scenario, Then the saved definition is unchanged.
- [ ] Given a scenario failure, Then the artefacts contain the definition JSON and the live-region log.
- [ ] Given `grep waitForTimeout` over the folder, Then there are no matches (lint rule).
- [ ] Given the suite on CI with 2 workers, Then it finishes in under 4 minutes.

## 12. Test plan

This task is the test suite: `pnpm --filter @overmind/desktop e2e --grep @e2e` against the mock gateway of TEST004. A small meta test checks that every scenario id F1..F11 exists and is tagged.

## 13. Parallelization notes

Starts when most PART 1 tasks are merged; scenarios can be added one by one as their features land (each feature task lists its flow in section 12). Conflict hotspot: `support/` helpers are owned here, other tasks only add scenario files named after their flow.

## 14. Open questions and assumptions

- ASSUMPTION: Playwright runs Chromium only; the desktop shell is a Tauri WebKit webview, so a WebKit project or a Tauri-driver smoke test is a follow-up (TEST area).
- GAP: `lib:mock-gateway-control` must be able to host the editor fake (`EditorGateway`) or route `/v1/workflows/*` and `/v1/agents/*` requests to it; if TEST004 only mocks HTTP, the editor fake is exposed through a small HTTP adapter owned by this task.
- OPEN: whether PART 2 flows (publish, Inspector) live in the same folder; proposed layout `e2e/workflow-editor/part2/`.
