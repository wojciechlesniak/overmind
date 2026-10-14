---
id: OVE_ONB038
title: "Wire step 3 extras: documentation link, native file picker and live Chief greeting preview"
area: ONB
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_ONB011, OVE_ONB019, OVE_ONB033, OVE_ONB036, OVE_ONB037, OVE_SHELL003, OVE_SHELL005, OVE_SHELL006]
soft_depends_on: []
provides: ["ui:WorkspaceStepExtras", "lib:use-onboarding-documentation", "lib:use-greeting-preview"]
needs: ["lib:use-gateway-query", "lib:use-gateway-mutation", "lib:use-platform", "lib:use-wizard-step", "lib:use-invalidate-on-events", "lib:api-client-onboarding-documentation", "lib:api-client-onboarding-greeting"]
owns: ["apps/desktop/src/features/onboarding/steps/workspace/extras/index.ts", "apps/desktop/src/features/onboarding/steps/workspace/extras/WorkspaceStepExtras.tsx", "apps/desktop/src/features/onboarding/steps/workspace/extras/use-onboarding-documentation.ts", "apps/desktop/src/features/onboarding/steps/workspace/extras/use-greeting-preview.ts", "apps/desktop/src/features/onboarding/steps/workspace/extras/__tests__/**"]
reads: ["apps/desktop/src/features/onboarding/steps/workspace/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [16, 3]
---

# OVE_ONB038: Wire step 3 extras

## 1. Summary

Connects the views of ONB037 to the engine: loads documentation suggestions, links or unlinks a file, lets the Owner pick a file with the native dialog, and shows the live Chief greeting preview that follows the Workspace name. Exports one `WorkspaceStepExtras` component that ONB019's step renders below its form.

## 2. Context

ONB019 owns `WorkspaceStep.tsx` and the name and isolation form; this task owns only the `extras/` folder to avoid conflicts. The step needs a one-line change in ONB019 to render `<WorkspaceStepExtras workspaceId nameDraft />` (amendment, section 14). There is no mock for step 3; visual follows steps 1-2 (Kreator-Folder.png / Kreator-Polaczenia.png); a design review is needed.

## 3. Scope (in)

- Hooks `useOnboardingDocumentation(workspaceId)` and `useGreetingPreview(workspaceId, nameDraft)`.
- `WorkspaceStepExtras` composing ONB037 views.
- Native file picker through `usePlatform().openFileDialog` restricted to Markdown.
- Tests with a fake api-client.

## 4. Out of scope

- Form for name and isolation (ONB019); backend (ONB033, ONB036); views (ONB037).

## 5. Detailed requirements

1. **Load.** `useGatewayQuery('onboarding.documentation.suggestions', { workspaceId })` and `...linked`; both invalidated after link/unlink. Initial state `loading`; `empty` when suggestions are empty and nothing is linked.
2. **Select = link.** `onSelect(id)` calls `link({ source: { kind: 'suggestion', suggestionId } })` with an idempotency key per click; optimistic UI is NOT used (show `busy` then the linked state). If one is already linked, selecting another first unlinks then links (two calls, UI shows busy once); on failure of the second call the UI re-fetches and shows the real state.
3. **Pick file.** `onPick()` opens the native dialog (default location: the Workspace folder as display path; filter `md, markdown`; single selection). The returned absolute path is sent once as `pathText` and is not stored in state, logs or the cache. `onboarding.doc_rejected` reasons map to messages: outside_workspace 'Ten plik jest poza folderem Workspace.', not_markdown 'To nie jest plik Markdown.', too_large 'Plik jest za duży (maks. 1 MB).', symlink 'Dowiązania symboliczne nie są obsługiwane.', not_found 'Nie znaleziono pliku.', not_allowed 'Brak zgody na ten folder.' (keys `docs.errors.<reason>` added to ONB037's locale file by this task only if missing; otherwise record the gap).
4. **Unlink.** `onUnlink()` calls the DELETE route; confirm is not needed (reversible).
5. **Greeting preview.** `useGreetingPreview` fetches `greeting.preview` (debounced 400 ms after the name draft changes; the server preview uses the saved name, so the hook substitutes `params.workspaceName` with the sanitised draft locally for display only, using the same i18n key and the same sanitiser rules as ONB036: strip control characters and angle brackets, truncate to 80). Refetch after link/unlink.
6. **Next is never blocked** by the extras (optional); a failed suggestions load shows the error row with retry and the Owner can still go on.
7. **Events.** Subscribes through `useInvalidateOnEvents` to `onboarding.state_changed` only.
8. **i18n.** Uses ONB037's namespace; no new visible strings elsewhere.
9. **No data kept after leaving the step:** query cache keys use `gcTime: 0` for suggestions (paths can be private); linked state is re-fetched on return.

## 6. Design notes

N/A beyond ONB037; no new visuals. Visual follows steps 1-2 and a design review is needed (section 14).

## 7. Reuse

ONB037 views, `useGatewayQuery/Mutation` (SHELL), `usePlatform` (SHELL), api-client modules of ONB033 and ONB036, `toUiError`. Do not duplicate the sanitiser: import it from `@overmind/contracts` helper if ONB036 exports one, else keep a 6-line local copy and record the duplication in 14.

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/workspace/extras/` (hooks + container). UI layer; talks only to api-client; no direct engine or filesystem access (the dialog is a platform service).

## 9. Security and safety

- The picked absolute path is untrusted input and is only forwarded; the engine decides (SEC002). The UI never builds paths and never shows canonical paths.
- Path text is not stored (state, cache persistence, logs).
- Titles rendered as text only (ONB037).
- Documentation content is never fetched here (data not instructions; no excerpts).
- Linking grants no permission: the folder was approved in step 1.

## 10. Errors and edge cases

- Dialog cancelled: no call.
- Double click on select: second ignored while busy.
- Engine down mid-way: error row, retry.
- File picked outside the folder: friendly message, nothing linked.
- Workspace deleted: whole step handles it (ONB019).
- Rename typed but not yet saved: preview shows draft, link still uses the saved Workspace.

## 11. Acceptance criteria

- [ ] Given suggestions then selecting one calls link once and shows the linked state.
- [ ] Given a picked path outside the folder then the message shows and no state changes.
- [ ] Given a name draft then the preview text updates within 500 ms without a network call per keystroke.
- [ ] Given the suggestions request fails then retry works and Next is still enabled.
- [ ] Given leaving the step then suggestions are not retained in the cache.
- [ ] Given a picked path then it appears in no log or stored state.

## 12. Test plan

Testing Library with the fake api-client: link, relink, rejection mapping, debounce with fake timers, cache `gcTime`. A log-capture test asserts the picked path never reaches the logger. Command: `pnpm --filter @overmind/desktop test features/onboarding/steps/workspace/extras`.

## 13. Parallelization notes

After ONB037/ONB033/ONB036. Conflict hotspot: ONB019's `WorkspaceStep.tsx` (one-line render, via proposal to ONB019's owner; do not edit it here).

## 14. Open questions and assumptions

- AMENDMENT REQUEST to ONB019: render `WorkspaceStepExtras` below the form and pass the name draft.
- OPEN (design): needs design review of step 3 as a whole (no mock).
- ASSUMPTION: immediate link on selection (not on Next) is acceptable since it is reversible and optional.
