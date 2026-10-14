---
id: OVE_ONB016
title: "Add the step 2 container setup flow: install guidance, kernel setup and image progress"
area: ONB
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_BOX018, OVE_DS021, OVE_DS036, OVE_DS040, OVE_ONB009, OVE_ONB015, OVE_PERM009, OVE_SHELL003]
soft_depends_on: []
provides: ["ui:ContainerSetupPanel"]
needs: ["api:onboarding.checks.setup", "api:perm.local-confirmation.create", "ui:ConfirmDialog", "ui:InfoNote", "ui:ProgressBar", "lib:use-platform", "event:sandbox.image_progress"]
owns: ["apps/desktop/src/features/onboarding/steps/connections/setup/**", "apps/desktop/src/locales/en/onboarding-setup.json", "apps/desktop/src/locales/pl/onboarding-setup.json", "tasks/_proposals/OVE_ONB016-open-external-apple-container.md"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [4, 20, 22]
---

# OVE_ONB016: Add the step 2 container setup flow: install guidance, kernel setup and image progress

## 1. Summary

Implements what the Owner sees and does when the `apple_container` or `isolation_test` row is not ready: guidance to install Apple container, a confirmed 'Skonfiguruj izolację' action (kernel and system start with a Local Approval), the image build progress, and the unsupported-OS dead end, all inside the check rows' detail area.

## 2. Context

BOX004 `ensureReady` needs an Owner approval token bound to `sandbox.system_setup` when the container kernel is missing or the system service is not running; BOX006 builds the Agent image once (local build, needs the network). ONB006 reports these as `failed` rows with reason codes and exposes `POST checks/setup { proof }`. Without these actions a fresh Mac would stop at step 2 with an unexplained error. Isolation is mandatory (SPEC 11): if it cannot be provided, nothing runs, so this step must be explicit and honest.

## 3. Scope (in)

- `ContainerSetupPanel` rendered as the `detail` of the `apple_container` and `isolation_test` rows by the mapper hook `useContainerSetup()`.
- Reasons handled: `container_missing`, `os_unsupported`, `version_unsupported`, `kernel_missing`, `system_not_running`, `image_not_ready` (building), `offline`, `timeout`.
- Confirm dialog 'Skonfigurować izolację?' (DS `ConfirmDialog`) that explains what will be done; Local Approval proof creation; call `onboarding.checks.setup`.
- Image build progress text and determinate bar from `sandbox.image_progress`.
- External link to Apple container releases via `openExternal` (allowlist proposal).
- Copy additions in `onboarding-checks.json`? No: this task owns its own file `onboarding-setup.json` namespace (below).

## 4. Out of scope

- Running the checks and base mapping (ONB015).
- Backend setup logic (ONB006).
- Automatic installation of Apple container (never: needs admin rights and an external package).

## 5. Detailed requirements

1. **container_missing.** Row detail card (`ui:InfoNote`): 'Overmind używa narzędzia Apple container do izolacji Agentów. Zainstaluj je i wybierz Wykryj.' Steps: (1) 'Pobierz instalator' (button, opens `APPLE_CONTAINER_RELEASES_URL` through `openExternal`); (2) 'Zainstaluj pakiet i wróć do tego okna'; (3) 'Wykryj' (re-runs `apple_container`). Overmind does not install or download it itself.
2. **os_unsupported.** Detail: 'Ten Mac nie spełnia wymagań: potrzebny jest macOS 26 i procesor Apple silicon.' No action except 'Skopiuj szczegóły' (version text) and the wizard cannot continue (documented dead end). The detail does not suggest workarounds that weaken isolation.
3. **version_unsupported.** 'Wersja Apple container nie jest obsługiwana ({{version}}). Zainstaluj wersję {{expected}}.' with 'Pobierz instalator' and 'Wykryj'.
4. **kernel_missing / system_not_running.** Detail text 'Apple container wymaga jednorazowej konfiguracji: pobrania jądra Linuksa i uruchomienia usługi systemowej.' with a primary small button 'Skonfiguruj izolację'. Click opens `ConfirmDialog`: title 'Skonfigurować izolację?', body 'Overmind poprosi Apple container o pobranie jądra Linuksa i uruchomienie usługi. Wymaga to połączenia z internetem. Nie zmienia to Twoich plików.', buttons 'Skonfiguruj' (primary) and 'Anuluj'. Confirm = the Local Approval: the UI creates a proof (`perm.local-confirmation.create` for action `sandbox.system_setup`, target `{ kind: 'system', id: 'apple-container' }`) and calls `onboarding.checks.setup { proof }` with an idempotency key. Progress: the row becomes `running` with status 'konfiguracja…' and detail text from events; completion triggers a re-run of `apple_container`.
5. **Image build.** When the engine reports the image is being built: `isolation_test` row `running`, detail 'Przygotowuję obraz Agentów… {{percent}}%' with a `ui:ProgressBar` (determinate if `percent`, else indeterminate) and phase text from closed keys (`checking` 'sprawdzanie', `pulling-base` 'pobieranie obrazu bazowego', `installing` 'instalowanie CLI', `smoke-test` 'test obrazu', `recording` 'zapisywanie'); a muted note 'To jednorazowe. Możesz poczekać w tym oknie.'. No log lines are shown.
6. **offline.** 'Brak połączenia z internetem. Obraz Agentów trzeba zbudować raz, wymaga to sieci.' with 'Spróbuj ponownie'. **timeout.** 'Operacja trwa dłużej niż zwykle.' with 'Spróbuj ponownie'.
7. **Failure of setup.** `box.*` errors map to `remedy.<code>` texts and the Retry action; a generic fallback 'Nie udało się skonfigurować izolacji. Kod: {{code}}.' shows the error code (never raw output).
8. **Dialog behaviour.** Focus on 'Anuluj' by default (the action changes the system), Esc cancels, the dialog is not shown again after success.
9. **Accessibility.** The detail card has `role="group"` with the row title as accessible name; progress has `role="progressbar"` values; status changes are announced by the CheckList live region.
10. **Copy file.** `locales/{en,pl}/onboarding-setup.json` owned here with the keys above (EN equivalents authored; PL as written).
11. **Allowlist proposal.** `tasks/_proposals/OVE_ONB016-open-external-apple-container.md` asks SHELL003 to add the exact constant `APPLE_CONTAINER_RELEASES_URL` (https, host `github.com`, path prefix `/apple/container/releases`) to the `openExternal` allowlist as a path-restricted entry, not the whole host.
12. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

No mock exists for this part (design: none). It is composed only from existing ui-kit components and the wizard layout (`ui:WizardLayout` content area, `ui:Card`, `ui:Button`, `ui:InfoNote`, `ui:Dialog`) with product tokens; no new visual styles. DESIGN GAP recorded in section 14.

## 7. Reuse

- `ConfirmDialog` (DS036), `ui:InfoNote`, `ui:ProgressBar`, `ui:Button`; `useWizardChecks` (ONB015); `api-client-onboarding` `checks.setup` (ONB009); `api:perm.local-confirmation.create` (PERM009/026); `usePlatform().desktopShell.openExternal` (SHELL003).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/connections/setup/{container-setup-panel.tsx,use-container-setup.ts,setup-confirm-dialog.tsx,map-setup-reason.ts}`, `apps/desktop/src/locales/{en,pl}/onboarding-setup.json`, proposal file. UI layer; plugs into ONB015 through the row `detail` extension (a registry `rowDetailProviders` exported by ONB015's `checks-context.tsx`).

## 9. Security and safety

- The setup action requires the Owner's explicit confirmation and a Local Approval proof; it is not available to Telegram or agents (engine matrix).
- The link opens only the allowlisted releases URL; no arbitrary URL from the engine response.
- No raw tool output is shown; only closed reason codes and counters.
- The text promises nothing about files outside Overmind's own container system.

## 10. Errors and edge cases

- Owner closes the dialog: nothing happens.
- Setup started, window closed: the engine continues; on return the first `GET checks` shows the state.
- Setup fails halfway (network): row failed with Retry; engine is idempotent (BOX004).
- `container` installed but a different version from a previous Overmind: `version_unsupported`.
- Disk full during image build: `box.*` code mapped to a generic remedy.
- Two quick clicks on 'Skonfiguruj': dialog is modal; second click ignored (idempotency key).

## 11. Acceptance criteria

- [ ] Given container missing then the install guidance shows and 'Wykryj' re-runs the row.
- [ ] Given kernel missing then the confirm dialog appears and, on confirm, proof creation and the setup call follow and the row shows progress.
- [ ] Given image build progress events then the bar and phase text update without any log text.
- [ ] Given unsupported OS then no workaround is offered and Next remains blocked.
- [ ] Given offline then the offline text and Retry appear.

## 12. Test plan

- Vitest + Testing Library with fake client and events: each reason mapping, dialog flow, proof sequence, progress rendering.
- Storybook stories per reason; axe.
- Playwright with scenarios `checks-container-missing`, `checks-kernel-missing`.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/connections/setup`.

## 13. Parallelization notes

After ONB015 and ONB006/009. Parallel with ONB017/018.

## 14. Open questions and assumptions

- DESIGN GAP: install guidance, confirm dialog and progress layout are derived.
- OPEN: if Apple container later ships through Homebrew or an official installer the guidance text changes (copy only).
- OPEN (cross-area): SHELL003 allowlist change via proposal.
