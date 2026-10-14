---
id: OVE_ONB040
title: "Build the wizard completion summary screen and the 'Enter the Dashboard' action"
area: ONB
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS017, OVE_DS018, OVE_DS031, OVE_DS032, OVE_DS040, OVE_DS051, OVE_DS073, OVE_ONB011, OVE_ONB022, OVE_ONB035, OVE_ONB039, OVE_SHELL005]
soft_depends_on: ["OVE_ONB036"]
provides: ["ui:CompletionSummaryView", "ui:CompletionSummary"]
needs: ["ui:WizardLayout", "ui:WizardStepper", "ui:Card", "ui:KeyValueList", "ui:StatusPill", "ui:Pill", "ui:Button", "ui:Skeleton", "ui:EmptyState", "ui:InfoNote", "lib:use-wizard-step", "lib:use-complete-onboarding", "lib:use-gateway-query", "lib:use-onboarding-state"]
owns: ["apps/desktop/src/features/onboarding/summary/**", "apps/desktop/src/locales/en/onboarding-summary.json", "apps/desktop/src/locales/pl/onboarding-summary.json"]
reads: ["apps/desktop/src/features/onboarding/**"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [6, 10]
---

# OVE_ONB040: Completion summary screen

## 1. Summary

After step 4 the wizard shows a short review of what was set up (folder and rights, logged-in CLIs and isolation result, Workspace, documentation, Telegram) with per-row 'Zmień' links back to the owning step, and a primary button 'Wejdź do Pulpitu' that completes onboarding through ONB022's hook and enters the dashboard.

## 2. Context

ONB022 implements the completion request and hand-off but not a review. Steps 3 and 4 have no mock; the summary has none either. Visual follows steps 1-2 (`Kreator-Folder.png`, `Kreator-Polaczenia.png`): same `ui:WizardLayout` column, `ui:Card` surfaces, `ui:CheckRow`-style row anatomy with status marks. A design review is needed (open question). ONB011 keeps four stepper steps; the summary is a fifth route `/onboarding/summary` where all four stepper items show `done`.

## 3. Scope (in)

- Route registration `summary` in the step registry (`lib:onboarding-step-registry`) as a non-numbered final pane.
- `CompletionSummaryView` (props-driven) and the container `CompletionSummary` using `GET /v1/onboarding/summary` (ONB035).
- Footer: Back (to step 4) and primary 'Wejdź do Pulpitu'.

## 4. Out of scope

- The completion request, caches, toast, navigation (ONB022 hook `useCompleteOnboarding`, which this screen calls).
- Greeting posting (ONB036, backend, happens after completion).

## 5. Detailed requirements

1. **Entry.** Step 4's Next (ONB020/021/039) navigates to `/onboarding/summary`; the guard allows it only when steps 1-3 are done (engine decides; otherwise redirect to the first not-done step). Document title 'Podsumowanie · Pierwsze uruchomienie · Overmind'. Eyebrow/steps as ONB011 with every step `done` and counter 'Gotowe'.
2. **Copy (PL proposed).** Title 'Wszystko gotowe' (`title`), lead 'Sprawdź ustawienia. Wszystko możesz później zmienić w Ustawieniach i w Workspace.' (`lead`). Primary 'Wejdź do Pulpitu' (`enter`). Row labels: 'Folder i prawa', 'Logowanie CLI', 'Izolacja', 'Workspace', 'Dokumentacja projektu', 'Telegram'. Values: folder display path + rights ('odczyt · zapis'), CLI names with plan text (verbatim plain text), isolation 'Test izolacji zaliczony' / 'Nie sprawdzono', Workspace name + 'izolowany' pill when isolated, documentation file or 'Brak (dodasz później)', Telegram '@bot sparowany' / 'Pominięto' / 'Bot połączony, bez parowania'.
3. **Row actions.** Each row has a text button 'Zmień' that navigates to the owning step (folder -> 1, CLI and isolation -> 2, Workspace and documentation -> 3, Telegram -> 4). The folder row's 'Zmień' is hidden because the folder is fixed after provisioning (ONB005, `folder_already_provisioned`); show the note 'Folder zmienisz w Workspace po zakończeniu.' as muted helper text under the row (not a tooltip, so it is readable by keyboard and screen readers).
4. **Enter.** Primary button calls `useCompleteOnboarding()` (ONB022) and shows its loading hint 'Sprawdzam, czy wszystko działa…'. Errors and `not_ready_to_complete` follow ONB022 (navigates back to the missing step with banner). The button is disabled while the summary is loading or failed.
5. **Greeting note.** An `ui:InfoNote` 'Chief przywita Cię na Pulpicie.' (`greetingNote`); no preview here (it was shown in step 3).
6. **Back** returns to step 4 (progress saved by the host; no data loss).
7. **Loading/error.** Skeleton rows; error uses `ui:EmptyState` with 'Spróbuj ponownie'; `step_not_active` redirects to the earliest not-done step.
8. **Accessibility.** Heading focus on entry, the list is a `<dl>`; 'Zmień' buttons have accessible names including the row label ('Zmień: Workspace'); status marks have text alternatives; the busy state is announced (polite).
9. Standard UI rules (CONVENTIONS section 9, DS global rules G1-G7): i18n keys only, tokens only, 2px focus ring, reduced motion, stories for each state, axe clean.

## 6. Design notes

No mock; `design: none`. Compose from `ui:WizardLayout` content area, `ui:Card`, `ui:KeyValueList` rows with `ui:StatusPill`/`ui:Pill`. The visual follows steps 1-2 exactly in spacing, card border and row height; derive hover/focus/disabled from DS. A design review by the Owner is required (section 14). Not in any mock: loading skeleton, error, long names (truncate with tooltip), the 'Zmień' text-button style (use `ui:Button` ghost/link tone per inventory).

## 7. Reuse

`ui:WizardLayout`, `ui:WizardStepper` (all done), `ui:Card`, `ui:KeyValueList`, `ui:StatusPill`, `ui:Pill`, `ui:Button`, `ui:InfoNote`, `ui:Skeleton`, `ui:EmptyState`; `useCompleteOnboarding` (ONB022), `useWizardStep` and registry (ONB011), `api:onboarding.summary` (ONB035). Do not re-implement the completion request.

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/summary/{index.ts, CompletionSummaryView.tsx, CompletionSummary.tsx, summary-rows.ts, use-onboarding-summary.ts, *.stories.tsx}`; `summary-rows.ts` maps the contract to row descriptors (pure, unit-tested). UI layer.

## 9. Security and safety

- Renders only the redacted summary (ONB035); no tokens, codes or canonical paths exist in the data.
- `planText`, names, bot username are plain text nodes.
- 'Zmień' only navigates; permission changes still need their own approval flows in the steps.
- Entering the Dashboard performs no permission change and starts no agents (ONB007).
- Summary query is `gcTime: 0` and `no-store`.

## 10. Errors and edge cases

- Telegram skipped, no documentation: both rows show neutral 'later' text, not warnings.
- CLI plan text missing: show only the CLI name.
- Back from summary then Next again: same screen, refetched.
- Double click on enter: ignored while loading (idempotency key from ONB022).
- Engine reports isolation 'unknown': row shows 'Nie sprawdzono' and ONB022 will re-check.

## 11. Acceptance criteria

- [ ] Given all steps done then six rows render with the correct values for each Telegram state.
- [ ] Given 'Zmień' on Workspace then step 3 opens and returning shows the summary refreshed.
- [ ] Given enter pressed then `useCompleteOnboarding` is called once and the loading hint shows.
- [ ] Given `not_ready_to_complete` then ONB022 behaviour (back to the missing step) happens.
- [ ] Given the summary query fails then retry works and enter stays disabled.
- [ ] Given keyboard only then every action is reachable and axe is clean.

## 12. Test plan

Unit: `summary-rows.test.ts` (all Telegram/doc combinations). Component tests with fake client; stories for loading, ready (each Telegram state), error; axe. Playwright covered by ONB043. Command: `pnpm --filter @overmind/desktop test features/onboarding/summary`.

## 13. Parallelization notes

After ONB035/ONB022/ONB039. Hotspots: the step registry (extension point; register the `summary` pane via the registry API, do not edit `lib:onboarding-step-registry` source) and ONB022's trigger (amendment below).

## 14. Open questions and assumptions

- AMENDMENT REQUEST to ONB022: completion is triggered from this summary button (not from step 4's Next); step 4 Next only navigates to `/onboarding/summary`. Until merged, ONB022's trigger on step 4 Next applies and this screen is skipped.
- OPEN (design): no mock for step 3, step 4 or the summary; a design review is needed.
- ASSUMPTION: the summary is a non-numbered fifth pane so the stepper keeps four steps as in the mocks.
