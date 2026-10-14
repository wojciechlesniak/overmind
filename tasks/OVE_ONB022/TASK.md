---
id: OVE_ONB022
title: "Implement wizard completion: final request, caches and hand-off to the dashboard"
area: ONB
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ONB009, OVE_ONB011, OVE_SHELL010, OVE_SHELL011, OVE_SHELL022]
soft_depends_on: ["OVE_ONB020"]
provides: ["lib:use-complete-onboarding"]
needs: ["api:onboarding.complete", "api:onboarding.progress", "lib:use-app-toast", "lib:use-set-current-workspace", "lib:use-navigate-to-route", "lib:use-wizard-step"]
owns: ["apps/desktop/src/features/onboarding/completion/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [10, 21]
---

# OVE_ONB022: Implement wizard completion: final request, caches and hand-off to the dashboard

## 1. Summary

Implements the end of the wizard: the 'Dalej' on the last step (and the skip path) calls `CompleteOnboarding`, handles every `not_ready_to_complete` reason by returning the Owner to the right step, then refreshes the app's caches, selects the new Workspace and lands on the Workspaces dashboard with a short confirmation.

## 2. Context

Completion flips the first-run flag permanently (ONB007/003). The shell guard (SHELL025) then stops redirecting to the wizard. The UI must not assume success: the engine re-verifies folder, isolation, CLI and Workspace and may say the Owner must go back (for example the CLI session expired). The hand-off decides where the Owner lands: the wizard intro promises 'Chief będzie gotowy do pracy', but the Workspaces dashboard is the shell's home (`/`, active rail item Pulpit), so the Owner lands there with the new Workspace selected; the Chief conversation is one click away in the rail.

## 3. Scope (in)

- `useCompleteOnboarding()` hook and the final-step footer wiring (shared by the telegram step's Next and 'Pomiń na razie').
- Mapping of `details.missing` to steps: `folder` -> 1, `isolation|herdr|cli_login` -> 2, `workspace` -> 3, `telegram_decision` -> 4.
- Cache refresh: `queryClient.invalidateQueries()` for all keys, event hub resync.
- `setCurrentWorkspace(workspaceId)` and navigation to `/` (replace).
- Toast 'Gotowe. Chief czeka na Twoje pierwsze polecenie.' (`onboarding:done.toast`, uses `useAppToast`).
- Idempotency and double-click protection.

## 4. Out of scope

- The server rules (ONB007).
- The dashboard empty states (WSPACE).
- Any celebratory animation or tour (not in the mocks).

## 5. Detailed requirements

1. **Request.** `POST /v1/onboarding/complete { telegram: 'skipped' | 'done' }` with an idempotency key stored in memory for the session of the step. `done` only when the Telegram pairing part reports paired (status from `telegram.status`); otherwise `skipped`. Timeout 90 s (the engine may re-run isolation).
2. **Loading.** The Next button shows `loading` with the hint 'Sprawdzam, czy wszystko działa…' (`done.checking`) because the engine may re-run the isolation test (up to a minute); the whole wizard is non-interactive except Cancel? No cancel: the request is short enough; the progress text suffices.
3. **Success.** On success (or `already_completed`): invalidate all queries; wait for the first `onboarding.state` refetch to show completed (so the guard does not bounce back); `setCurrentWorkspace(workspaceId)` from the response; navigate to `/` with `replace`; toast. The focus moves to the dashboard heading via SHELL025.
4. **Not ready.** `onboarding.not_ready_to_complete` with `details.missing`: navigate to the earliest missing step through `SaveOnboardingProgress(step)` and show an inline banner there: 'Kreator wrócił do kroku {{n}}: {{reason}}.' (reason texts reuse the step hints). Never loops: if the same missing item repeats three times the banner suggests 'Spróbuj ponownie później' without auto-navigating again.
5. **Errors.** Network/engine errors show `toUiError` text with 'Spróbuj ponownie' and keep the Owner on the last step; `onboarding.already_completed` is treated as success.
6. **No resets.** There is no 'run wizard again' in the app (not MVP).
7. **Analytics.** None.
8. **Accessibility.** The loading hint is a polite live region; the navigation announcement 'Pulpit' via SHELL025; the toast announces itself.
9. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `api-client-onboarding` (ONB009), `useWizardStep`/host (ONB011), `useAppToast` (SHELL022), `useSetCurrentWorkspace` (SHELL011), `useNavigateToRoute` (SHELL010), `queryClient` (SHELL005).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/completion/{use-complete-onboarding.ts,map-missing-to-step.ts,CompletionGate.tsx}`; the telegram step calls the hook through the step contract (`host.complete()` provided by ONB011's context: ONB011 declares `complete` in `WizardHostContext` as an injected function; this task supplies the implementation file `completion/register-completion.ts` that registers into the context via the extension in `wizard-step-context.tsx`). UI layer.

## 9. Security and safety

- The UI never decides completion; the engine verifies facts again; a tampered client cannot finish the wizard without a folder or isolation.
- No secrets are involved.
- Navigation targets are fixed routes.

## 10. Errors and edge cases

- Double click: idempotent; the second returns the same result.
- Engine restarts during the request: the retry with the same key returns the stored result or re-runs safely.
- User closes the window during the request: the engine completes; reopening shows the dashboard (guard).
- Completion succeeds but the state refetch is slow: the host waits up to 3 s then navigates anyway; the guard re-evaluates.
- `workspaceId` missing in the response: current Workspace remains whatever the list resolves (SHELL011).

## 11. Acceptance criteria

- [ ] Given all conditions then completion succeeds and the app lands on `/` with the new Workspace selected and a toast.
- [ ] Given `missing: ['cli_login']` then the wizard returns to step 2 with the banner.
- [ ] Given a repeated identical failure three times then no further automatic navigation occurs.
- [ ] Given a double click then one completion and one navigation.
- [ ] Given the guard then `/onboarding` redirects to `/` after completion.

## 12. Test plan

- Vitest + Testing Library with fake client/router: success, each missing reason, idempotency, slow refetch.
- Playwright: full wizard to the dashboard (ONB023).
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/completion`.

## 13. Parallelization notes

After ONB011/009/007 and SHELL022/011. Parallel with ONB020/021. The Telegram step and `host.complete()` connect in review.

## 14. Open questions and assumptions

- DECISION proposed: land on the Workspaces dashboard; alternative is the Chief view (`/chief`) to match the intro text 'Chief będzie gotowy do pracy'; the Owner chooses.
- OPEN: `WizardHostContext.complete` injection: confirm with ONB011's implementer so files do not overlap (ONB011 owns `wizard-step-context.tsx`).
