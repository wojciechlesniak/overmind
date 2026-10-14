---
id: OVE_ONB015
title: "Wire wizard step 2 checks: data, events, row mapping, detection and retry"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOX018, OVE_ONB001, OVE_ONB009, OVE_ONB011, OVE_ONB014, OVE_SHELL005, OVE_SHELL006]
soft_depends_on: []
provides: ["ui:ConnectionsStep", "lib:use-wizard-checks"]
needs: ["api:onboarding.checks", "api:onboarding.checks.run", "lib:evaluate-wizard-gate", "lib:use-gateway-query", "lib:use-invalidate-on-events", "event:onboarding.check_updated", "event:sandbox.image_progress"]
owns: ["apps/desktop/src/features/onboarding/steps/connections/ConnectionsStep.tsx", "apps/desktop/src/features/onboarding/steps/connections/use-wizard-checks.ts", "apps/desktop/src/features/onboarding/steps/connections/use-run-checks.ts", "apps/desktop/src/features/onboarding/steps/connections/to-check-rows.ts", "apps/desktop/src/features/onboarding/steps/connections/to-gate.ts", "apps/desktop/src/features/onboarding/steps/connections/checks-context.tsx"]
reads: []
design: design.png
design_source: "Kreator-Polaczenia#onb2/checklist (crop 416,210,968,410); row statuses ready/waiting/skipped visible in the mock"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [4, 20, 22]
---

# OVE_ONB015: Wire wizard step 2 checks: data, events, row mapping, detection and retry

## 1. Summary

Connects step 2's checklist to the engine: runs the checks on entry, keeps the rows live through events and polling fallback, maps `WizardCheck` to the DS rows with copy and actions ('Wykryj', 'Spróbuj ponownie'), and exposes the gate for the footer.

## 2. Context

ONB006 produces `WizardChecksResult`; ONB009 exposes `GET checks` and `POST checks/run` (202 plus events). The view (ONB014) takes `CheckRowProps[]`. This task is the adapter between the two, including the live announcements for screen readers, partial results and the rule that each row can be re-run on its own without blocking the others. It does not log in to CLIs (ONB017) nor handle container setup actions (ONB016).

## 3. Scope (in)

- `ConnectionsStep.tsx` (wired step) composing `ChecksStepView` with `useWizardChecks()`.
- `useWizardChecks()`: query `onboarding.checks`, invalidated by `onboarding.check_updated`, `sandbox.image_progress`, `provider.login_restored`, `connection.status_changed`; run-on-entry rule; polling fallback every 2 s while `runningAny` and the hub is disconnected.
- `useRunChecks()` mutation (`ids?`).
- Pure mapper `toCheckRows(checks, t)` and `toGate(checks)` (wraps `evaluateGate` from contracts).
- Row actions wiring (detect, retry) and optimistic `running` state.
- Live region announcements.

## 4. Out of scope

- Login terminal and 'Zaloguj' action (ONB017).
- Container setup/image progress UI (ONB016 consumes the same hook).
- Footer gating text (ONB018).

## 5. Detailed requirements

1. **Run on entry.** On mount: `GET checks`; if the result is empty or older than 5 minutes, call `POST checks/run` (all). The first paint shows the six rows as `pending` with spinner on the first (skeleton rows are not used because the list shape is fixed).
2. **Live update.** Each `onboarding.check_updated` event invalidates the query (debounced 150 ms); `sandbox.image_progress` updates the isolation row detail text 'Przygotowuję obraz Agentów… 42%' from the event's phase/percent (no log text). When the hub is disconnected poll `GET checks` every 2 s while `runningAny`.
3. **Mapping.** `toCheckRows`: title and description from `rows.<id>.*` keys with parameters (`version`, `plan` from `detail.versionText/planText`, plain text); status word from `status.<statusKey>`; `status: 'running'` rows show the spinner; `failed` rows carry `detail` = remedy text from `remedy.<reasonCode>`; actions: `skipped` or failed Ollama -> 'Wykryj' (`runChecks({ ids: ['ollama'] })`), other failed rows -> 'Spróbuj ponownie' (single-check run), CLI rows `pending` -> 'Zaloguj' (provided by ONB017 through a prop callback `onLogin(providerId)` supplied via context; absent until then).
4. **Row independence.** Re-running one row sets only that row to `running` optimistically; the engine serialises runs, a click while a global run is active is queued (the button shows busy).
5. **Gate.** `toGate(checks)` returns `{ canContinue, blockedBy }`; exposed through `useChecksGate()` for ONB018.
6. **Announcements.** The DS CheckList live region announces status changes ('Test izolacji: zaliczony'); the step also announces 'Wszystkie wymagane kontrole zaliczone' once when the gate turns true.
7. **Errors.** If `GET checks` itself fails: an inline error card in the list area 'Nie udało się sprawdzić systemu' with 'Spróbuj ponownie'; the footer Next stays disabled.
8. **Leaving the step.** Running checks continue in the engine; on return the first `GET` reflects them. Back to step 1 is allowed and does not cancel image builds.
9. **Telemetry.** None; no check results are written to the browser storage.
10. **Fake scenarios.** The mock gateway (TEST004/SETUP012) gets scenarios `checks-all-ready`, `checks-isolation-failed`, `checks-container-missing`, `checks-codex-waiting` documented in `docs/testing/onboarding-scenarios.md` (owned by ONB023).
11. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

N/A, functionality only (no mock region).

## 7. Reuse

- `useGatewayQuery/useGatewayMutation`, event hub (SHELL005/006), `evaluateGate` (ONB001), `ChecksStepView` and catalogue (ONB014), `api-client-onboarding` (ONB009).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/connections/{ConnectionsStep.tsx,use-wizard-checks.ts,use-run-checks.ts,to-check-rows.ts,to-gate.ts,checks-context.tsx}`. Application/UI layer; the registry's `index.ts` (ONB014) imports `ConnectionsStep`.

## 9. Security and safety

- Version and plan texts from CLIs are plain text, truncated by the contract; never interpreted.
- Check results are not persisted client-side.
- The UI treats the engine's gate as the source of truth; it never decides isolation is fine by itself.

## 10. Errors and edge cases

- Event storm during a build: debounce prevents refetch storms.
- Engine restarts mid-run: query error then recovery; rows reset to the engine's current result.
- A row id unknown to the UI (newer engine): ignored.
- Run requested while a run is active: engine returns the current state; UI shows running rows.
- Both CLIs absent: both failed rows with 'cli_not_installed' remedy; gate blocks.

## 11. Acceptance criteria

- [ ] Given entry with no stored result then a run starts and rows update as events arrive.
- [ ] Given an isolation failure then its row shows the remedy and the gate is blocked.
- [ ] Given Ollama skipped then 'Wykryj' re-runs only that row.
- [ ] Given hub disconnected then polling continues until `runningAny` is false.
- [ ] Given all required ready then the announcement is made once.

## 12. Test plan

- Vitest + Testing Library with fake client and `FakeEventSource`: mapping table (every status and reason), run-on-entry, polling fallback, row independence.
- Playwright with the mock gateway scenarios.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/connections`.

## 13. Parallelization notes

After ONB011/014/009. Parallel with ONB013. ONB016/017/018 build on `use-wizard-checks.ts` (their files separate).

## 14. Open questions and assumptions

- ASSUMPTION: image build progress is exposed as `sandbox.image_progress` events carrying `{phase, percent?}` only.
- OPEN: should entering step 2 automatically start an image build (large download/build)? Default yes after a visible row state 'Przygotowuję obraz…' (the Owner can leave).
