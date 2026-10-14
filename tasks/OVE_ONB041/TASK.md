---
id: OVE_ONB041
title: "Implement navigation rules for wizard steps 3-4: Back, resume, leave cleanup, guards"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOARDUI001, OVE_ONB009, OVE_ONB011, OVE_ONB034, OVE_SHELL010]
soft_depends_on: ["OVE_ONB019", "OVE_ONB020", "OVE_ONB040"]
provides: ["lib:onboarding-navigation-rules", "lib:use-step-leave-cleanup", "doc:onboarding-navigation-rules"]
needs: ["lib:use-wizard-step", "lib:use-onboarding-state", "lib:onboarding-step-registry", "lib:use-navigate-to-route", "api:onboarding.progress", "lib:use-gateway-mutation"]
owns: ["apps/desktop/src/features/onboarding/navigation/**", "docs/onboarding/navigation-rules.md"]
reads: ["apps/desktop/src/features/onboarding/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [6, 10]
---

# OVE_ONB041: Implement navigation rules for wizard steps 3-4: Back, resume, leave cleanup, guards

## 1. Summary

One tested module that decides what Back, Next, direct stepper clicks, restart-resume and window close do on steps 3, 4 and the summary, and a cleanup hook that wipes secrets (token field, pairing code) and transient data whenever the Owner leaves a step. Rules are written down in `docs/onboarding/navigation-rules.md` so UI tasks do not each invent their own.

## 2. Context

ONB011 gives the host (`advance`, `back`, stepper). Steps 3 and 4 add state that must not leak or be lost: typed-but-unsaved Workspace name, a picked documentation link, a bot token being typed, a visible pairing code with an expiry, a connected-but-unpaired bot, a skipped Telegram choice. The engine is the source of truth for progress (ONB003, ONB011 req. 7); the UI keeps nothing durable.

## 3. Scope (in)

- Pure `navigationRules` functions and a table of transitions.
- `useStepLeaveCleanup(registerCleanup)` and a registry of cleanup callbacks that steps register.
- Guard for window close (confirmation only when a token is typed, a code is active, or the Workspace name is dirty).
- The markdown doc of rules.

## 4. Out of scope

- Step content (ONB019..ONB022, ONB037..ONB040); host routing itself (ONB011); the engine's `step_blocked` rule (ONB003).

## 5. Detailed requirements

1. **Transition table (rules).** Back: step 4 -> 3, 3 -> 2, summary -> 4, 2 -> 1 (ONB011); Back never deletes server data: a connected bot stays configured, a linked document stays linked, the Workspace name saved stays. Next from 3 requires `confirmWorkspaceStep` (ONB032) success; from 4 goes to summary in `not_configured`/`bot_connected`/`paired`/`skipped` (ONB039 policy). Direct stepper click: allowed only to steps whose engine result is done (ONB011 req. 3); never forward over a not-done step.
2. **What is kept vs dropped on leaving step 3:** dropped: unsaved name draft is NOT persisted (ONB019 says typed values in memory only; this module offers an optional in-memory `StepDraftStore` keyed by step id that lives until the wizard unmounts, so Back-then-Next in the same session restores text); kept: saved Workspace name and isolation, linked documentation.
3. **Leaving step 4:** always call registered cleanups: clear the token input DOM value and ref, clear the pairing code from memory and DOM (ONB021 requirement 8), cancel the pairing countdown timers, abort in-flight `telegram.connect`/`pairing-code` requests if not yet sent responses are pending (an `AbortController`; an already sent connect request cannot be undone: the next mount reads the real status). The step never stores secrets in the draft store (enforced by a type: `StepDraftStore` accepts only keys from an allowlist `['workspace.nameDraft']`).
4. **Resume after restart:** the UI opens at `state.currentStep` from the engine; draft store is empty; on step 4 the state comes from ONB039; on summary resume (`currentStep: 4` and all steps done) the host opens step 4 first (not the summary) unless the Owner already navigated there: documented choice, simple and safe (ASSUMPTION).
5. **Window close / app quit during the wizard:** no blocking dialog in general (progress is saved by the engine). Exception: while a bot token is typed and not submitted, or a pairing code is displayed, the shell's before-close hook shows a confirm 'Masz niezapisany token / aktywny kod parowania. Zamknąć?' (keys `leave.confirm.*`); closing clears them. If the platform does not expose a close hook (SHELL), skip the confirm and still clear on unmount.
6. **Engine restart or lost connection:** steps show EngineStatusGate (SHELL020); on reconnect, state refetches and the rules re-evaluate; a pairing code is considered lost (ONB021 clears on unmount).
7. **Completed onboarding:** every wizard route redirects to the dashboard (ONB011); Back is impossible after completion (no re-run in the MVP).
8. **Focus and announcements.** On every step change, title focus + live announcement 'Krok N z 4' (ONB011); the summary announces 'Podsumowanie'.
9. The doc `docs/onboarding/navigation-rules.md` contains the transition table, what is kept or dropped per step, and the cleanup registry contract, so ONB019..ONB022 reference it.

## 6. Design notes

N/A, functionality only (the one confirm dialog uses `ui:Dialog` with the standard confirm pattern; the visual follows steps 1-2 and needs design review).

## 7. Reuse

ONB011 host hooks, `ui:Dialog`, the platform close hook from SHELL (via `usePlatform`), `AbortController`. Do not create another store library; a plain `useRef`-backed context is enough.

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/navigation/{navigation-rules.ts, step-draft-store.tsx, use-step-leave-cleanup.ts, use-close-guard.ts, index.ts}`; rules are pure and independent of React; docs in `docs/onboarding/`.

## 9. Security and safety

- The primary purpose here is secret hygiene: tokens and pairing codes are cleared from memory and DOM on leave, close, unmount and success; the draft store type forbids them.
- No browser storage use (spy test).
- Navigation can never skip a step gate or write 'done' (engine decides, ONB003/ONB034).
- A forged URL `/onboarding/telegram` before step 3 is done redirects to the first not-done step (host + engine `step_blocked`).

## 10. Errors and edge cases

- Rapid Back/Next: transitions are serialised, only the last wins.
- Back while a request is in flight: request aborted if abortable, else the result is ignored.
- Navigating away with devtools open: nothing special.
- Draft restore after the wizard unmounted (completion): store is gone.
- Unknown step id in URL: host redirect.

## 11. Acceptance criteria

- [ ] Given the transition table then every row has a unit test.
- [ ] Given a typed token then Back clears the field and no copy remains in state or storage.
- [ ] Given a visible pairing code then leaving clears it and cancels timers.
- [ ] Given Back-then-Next on step 3 then the name draft is restored within the session only.
- [ ] Given a restart on step 4 then no code and no draft exist and the status is read from the engine.
- [ ] Given a forged route then the host redirects to the first not-done step.

## 12. Test plan

Unit: `navigation-rules.test.ts` (table), `step-draft-store.test.tsx` (type-level test that secrets keys do not compile: `// @ts-expect-error`), cleanup registry test with fake timers, storage-spy test. Playwright cases in ONB043. Command: `pnpm --filter @overmind/desktop test features/onboarding/navigation`.

## 13. Parallelization notes

Parallel with ONB037..ONB040. Steps register their cleanups through the exported hook (extension point); nobody edits the module. Hotspot: `docs/onboarding/` (new folder, owned here).

## 14. Open questions and assumptions

- ASSUMPTION: resume never opens the summary directly; it opens step 4.
- OPEN: whether the shell exposes a before-close hook (SHELL); fallback described.
- AMENDMENT: ONB020/ONB021 register their cleanups via `useStepLeaveCleanup`.
