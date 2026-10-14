---
id: OVE_WFED034
title: "Wire copy, cut, paste and duplicate with the system clipboard and Agent checks"
area: WFED
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH011, OVE_DS037, OVE_WFED012, OVE_WFED023, OVE_WFED024, OVE_WFED025, OVE_WFED026, OVE_WFED038]
soft_depends_on: []
provides: ["lib:editor-clipboard-wiring"]
needs: ["lib:editor-commands-fragment", "lib:editor-clipboard-format", "lib:editor-selection", "lib:editor-snap", "ui:WorkflowCanvasPane", "lib:editor-agent-directory", "lib:editor-shortcuts", "ui:useToast", "lib:editor-announcer", "lib:i18n-ui"]
owns: ["apps/desktop/src/features/workflow-editor/canvas/useClipboardWiring.ts", "apps/desktop/src/features/workflow-editor/canvas/clipboard-io.ts", "apps/desktop/src/features/workflow-editor/canvas/agent-visibility-filter.ts", "apps/desktop/src/features/workflow-editor/canvas/clipboard.shortcuts.ts", "apps/desktop/src/features/workflow-editor/canvas/useClipboardWiring.test.ts", "apps/desktop/src/features/workflow-editor/canvas/agent-visibility-filter.test.ts", "apps/desktop/src/locales/en/wfc-clip.json", "apps/desktop/src/locales/pl/wfc-clip.json"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 7", "SPECIFICATION 8"]
adr_refs: [2, 18, 19, 28]
---

# OVE_WFED034: Wire copy, cut, paste and duplicate with the system clipboard and Agent checks

## 1. Summary

Connects the fragment commands to the keyboard and the clipboard: Cmd/Ctrl+C, X, V and D, paste at the pointer or the stage centre with snapping, and a filter that removes Agents that are not visible in the target Workspace so pasting between Workflows or Workspaces never silently points at a hidden Agent.

## 2. Context

The workflow editor is written in two parts. PART 1 (`OVE_WFED001`..`OVE_WFED049`, this task) is the editor core and the canvas behaviour. PART 2 (`OVE_WFED050`..`OVE_WFED099`, another author) is the page route and feature manifest, the workflow header, the Agent Inspector, the Chief supervision strip, the run overlay, validation display and the publish flow. PART 2 consumes the capabilities `lib:editor-document-model`, `lib:editor-commands`, `lib:workflow-mappers` and `lib:editor-session` from PART 1. Fragment extraction, the safe clipboard format and the insert command are WFED012. Browser clipboard access: use the DOM `copy`, `cut` and `paste` events of the canvas container (works without a permission prompt in the Tauri webview and in browsers) with a custom MIME `application/x-overmind-fragment+json` plus `text/plain` JSON fallback; never rely on `navigator.clipboard.readText` prompting. ADR 0028: a private Agent is invisible in other Workspaces, so a pasted node must not keep a reference the Owner cannot see.

## 3. Scope (in)

- Event handlers and shortcuts for copy, cut, paste, duplicate.
- Paste placement.
- Agent visibility filter and lane handling on paste.
- Toasts and announcements.

## 4. Out of scope

- Fragment format and commands (WFED012), delete wiring (WFED033), context menu entries (WFED037 calls the hook).

## 5. Detailed requirements

1. Focus rule: handlers are active when the pane container (or an element inside it) has focus and the event target is not an editable control; otherwise the native behaviour is untouched. `preventDefault` is called only when handled.
2. Copy (`mod+c`): `extractFragment(doc, selection.nodes)` (WFED012) -> `serializeFragment` -> `event.clipboardData.setData` for both MIME types; also keep the last fragment in a module-level in-memory slot (`lastFragment`) so paste works even if the OS clipboard was overwritten by an empty write. Empty selection: nothing. If only Start was selected: toast "Start nie podlega kopiowaniu". Allowed in `view` mode (reading).
3. Cut (`mod+x`): copy, then the delete flow of WFED033 in one transaction; disabled in `view` mode.
4. Paste (`mod+v`): read `application/x-overmind-fragment+json` or `text/plain` (size cap 256 KiB checked on the string length BEFORE parsing, WFED012); `parseFragment`; on `not_a_fragment` do nothing and do NOT preventDefault; on `too_large` or `invalid` toast "Schowek nie zawiera poprawnych Węzłów". Target point: last known pointer position over the pane (tracked with a throttled `pointermove`), else the stage centre; snapped; repeated pastes at the same point cascade by `(44, 44)` (a counter reset when the point changes).
5. Agent visibility filter (`agent-visibility-filter.ts`, pure): for every node with `agentRef`, ask `agentDirectory.lookup(id)`: `AgentInfo` -> keep; `{ found: false }` -> remove `agentRef` from the pasted node config and count it; `"loading"` -> wait up to 1.5 s for the directory (`ensure`), then treat as not found. The resulting toast: "Wklejono {n} Węzłów. {m} Agentów nie jest dostępnych w tym Workspace, wybierz ich ponownie." and the nodes show the attention tab `WYBIERZ AGENTA` (WFED014). Lane keys not present are handled by `buildPaste` (WFED012).
6. Duplicate (`mod+d`): `buildDuplicate` (offset +44 cascading); no clipboard involved; works for the current selection; disabled in `view` mode; preventDefault always (the browser bookmarks shortcut).
7. Undo: paste/duplicate/cut are single history entries (transaction); selection after paste = the new nodes.
8. Limits and errors: `limit_exceeded` -> toast "Wklejenie przekroczyłoby limit 200 Węzłów ({current} + {incoming})"; unknown node types in the fragment -> toast "Schowek zawiera Węzły nieznanego typu".
9. Security of the clipboard write: only the fragment JSON is written (no definition meta, no secrets, no Run data); copy never includes `agentRef` details beyond the id.
10. Messages in `wfc-clip`: `startSkipped`, `invalid`, `limit`, `unknownType`, `pasted` (ICU plural), `agentsHidden`, `duplicated`, `cut`.

## 6. Design notes

Not in the mock. Toasts as in WFED033. No visual paste ghost in MVP (the pasted nodes appear selected at the target point).

## 7. Reuse

- `extractFragment`, `parseFragment`, `buildPaste`, `buildDuplicate` (WFED012); `snapPoint` (WFED026); delete flow (WFED033); `agentDirectory.lookup`/`ensure` (WFED023); registry (WFED038); announcer; toast.

## 8. Architecture and code placement

Shortcut wiring (contract of WFED038): the bindings live in the `*.shortcuts.ts` file owned by this task (`ShortcutBinding[]`, labels come from `wfc-keys`); the behaviour is registered with `useEditorAction(actionId, handler, { enabled })`; the registry applies the guards (view mode, editable focus, open dialogs, IME composition). Layer: `canvas/` browser-event wiring (`clipboard-io.ts` is the only place using DOM clipboard events) and a pure filter. No parsing logic duplicated.

## 9. Security and safety

The clipboard is untrusted (WFED012 defences apply; this layer additionally enforces the size cap before parsing and ignores non-matching text silently). Pasted fragments can reference Agents or lanes the Owner does not expect: invisible Agents are stripped, the rest is re-validated server-side on save and publish. The in-memory `lastFragment` is cleared when the Workflow changes. No clipboard reads outside user-initiated paste events.

## 10. Errors and edge cases

- Paste text that is not JSON (user pasting a URL): ignored silently.
- Paste into view mode: nothing, optional hint toast "Otwórz wersję roboczą".
- Paste when focus is in the Inspector field: native paste.
- Cut of a selection containing Start: Start stays, others cut.
- Paste of nodes whose Agent is loading: waits briefly.
- Duplicate with nothing selected: no-op.

## 11. Acceptance criteria

- [ ] Given Developer, QA and Security selected, When Ctrl/Cmd+C then Ctrl/Cmd+V with the pointer at P, Then three new nodes appear with internal edges, selected, and one undo removes them.
- [ ] Given a fragment with an Agent invisible here, Then the pasted node has no `agentRef` and the toast reports the count.
- [ ] Given 300 KiB text, Then the paste is refused before parsing.
- [ ] Given plain text "hello", Then nothing happens and the native paste is not prevented.
- [ ] Given Cmd+D three times, Then copies are offset by 44, 88, 132 px.
- [ ] Given view mode, Then paste and cut do nothing, copy works.

## 12. Test plan

Hook tests with synthetic `ClipboardEvent`s (jsdom `DataTransfer` fake), pure tests for the filter, integration test with the real session; Playwright in WFED047 (copy/paste flow). Command: `pnpm --filter @overmind/desktop vitest run src/features/workflow-editor/canvas/useClipboardWiring src/features/workflow-editor/canvas/agent-visibility-filter`.

## 13. Parallelization notes

Parallel with WFED032, WFED033, WFED035.

## 14. Open questions and assumptions

- OPEN: whether to also copy a human-readable text form (a Markdown outline) for pasting into chat. Default no.
