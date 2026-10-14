---
id: OVE_ONB018
title: "Implement step 2 gating, footer hint and failure states"
area: ONB
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS040, OVE_ONB001, OVE_ONB009, OVE_ONB011, OVE_ONB015]
soft_depends_on: ["OVE_ONB017"]
provides: ["lib:use-step2-footer"]
needs: ["lib:use-wizard-step", "lib:evaluate-wizard-gate", "ui:InfoNote", "api:onboarding.progress"]
owns: ["apps/desktop/src/features/onboarding/steps/connections/use-step2-footer.ts", "apps/desktop/src/features/onboarding/steps/connections/step2-banners.tsx", "apps/desktop/src/features/onboarding/steps/connections/map-blocked-reason.ts"]
reads: []
design: design.png
design_source: "Kreator-Polaczenia#onb2/footer-actions + onb2/footer-hint (crop 416,840,968,60)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 16.1"]
adr_refs: [4, 20, 22]
---

# OVE_ONB018: Implement step 2 gating, footer hint and failure states

## 1. Summary

Connects the step 2 footer to the checks gate: Next enabled only when isolation, herdr and Apple container are ready and at least one of Claude Code or Codex CLI is logged in; disabled reasons as visible hints; the Back behaviour; progress saving on Next; and the failure states of the whole step (isolation failed, no CLI, engine/stream loss, everything failing).

## 2. Context

VIEWS Onboarding 2: footer hint 'Wystarczy jedno zalogowane CLI, żeby przejść dalej.' with Back (link-button) and Next (magenta 46 px CTA). States not drawn: Next disabled with a reason, isolation test failed (blocks Next, error row), no CLI logged in, detection failures. The rule (ONB001 `evaluateGate`) is engine-defined; the UI only presents it. Isolation unavailable = nothing runs (SPEC 11), so no bypass or 'skip' exists.

## 3. Scope (in)

- `useStep2Footer()` hook registering Next/Back/hint through `useWizardStep` (ONB011).
- Disabled reason texts mapped from `gate.blockedBy`.
- Next action: `SaveOnboardingProgress(3)` via host `advance()`, after a final `GET checks` freshness check (if the last result is older than 2 minutes, re-run quickly before advancing).
- Back to step 1 (always allowed), cancelling any active login.
- Step-level failure banner for the combinations: isolation failed, no CLI, all rows failed, engine events lost.

## 4. Out of scope

- Row details and actions (ONB015/016/017).
- Completion (ONB022).
- Any way to bypass isolation (none by design).

## 5. Detailed requirements

1. **Hint line (left of the buttons).** Default `hint.default` 'Wystarczy jedno zalogowane CLI, żeby przejść dalej.' When blocked it is replaced by the reason with `role="status"`: `isolation` -> 'Izolacja nie działa. Bez niej Agenci nie ruszą.' (`hint.isolationFailed`), `container_missing` -> 'Najpierw zainstaluj Apple container.', `herdr` -> 'Brakuje warstwy terminali herdr. Zainstaluj ponownie Overmind.', `no_cli_logged_in` -> 'Zaloguj się w Claude Code albo Codex CLI.' (`hint.noCli`). Priority order: container, isolation, herdr, CLI.
2. **Next.** Label 'Dalej'; `disabled` with `disabledReason` (the same hint text through `aria-describedby`) when `!gate.canContinue` or a check run is in progress; `loading` while saving progress. Click: if the last checks result is older than 2 minutes, run `checks/run` for the required rows and wait up to 10 s for events; if the gate is still true, `advance()`.
3. **Back.** 'Wstecz' link-button returns to step 1 (host `back()`), cancels an active login terminal (ONB017 cleanup), keeps check results.
4. **Isolation failed banner.** When `isolation_test` is `failed` due to a probe failure (not a missing prerequisite): the row detail (ONB015) states the failed probe ids as words ('odczyt ~/.ssh', 'sieć') and the banner above the list (error tone via `ui:InfoNote`) says 'Test izolacji nie przeszedł. Overmind nie uruchomi Agentów, dopóki izolacja nie zadziała.' with 'Spróbuj ponownie' and 'Skopiuj szczegóły'. This is a security stop: no 'continue anyway'.
5. **No CLI.** Both CLIs not logged in: banner (info tone) 'Nie ma jeszcze zalogowanego CLI.' pointing to the 'Zaloguj' actions; if both are not installed in the image: 'Obraz Agentów nie zawiera CLI. Spróbuj ponownie zbudować obraz.' with retry (re-runs image check).
6. **All failed / engine problems.** If `GET checks` fails or the hub drops, the footer keeps Next disabled with 'Nie można sprawdzić systemu.'; `EngineStatusGate` (SHELL020) handles full outages.
7. **Ollama.** Never contributes to the gate; its row can stay skipped; hint mentions 'Ollama jest opcjonalna' only when it is the only ready provider ('Ollama nie wystarczy. Potrzebne jest jedno zalogowane CLI.' `hint.ollamaOnly`).
8. **Announcements.** When the gate turns true: polite 'Możesz przejść dalej'; when it turns false after being true (CLI logged out): polite 'Krok 2 nie jest już kompletny'.
9. **Telemetry/storage.** None.
10. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` crops the footer row of the mock: hint text (13 px muted) left, 'Wstecz' link-button, magenta 'Dalej' CTA (46 px). The disabled Next (DS `aria-disabled` look), the blocked hint wording and the banners are not drawn (DESIGN GAP; DS074/073 rules).

## 7. Reuse

- `useWizardStep` (ONB011), `useChecksGate` (ONB015), `ui:InfoNote`, `ui:WizardFooter` (host), `evaluateGate` (ONB001).

## 8. Architecture and code placement

`apps/desktop/src/features/onboarding/steps/connections/{use-step2-footer.ts,step2-banners.tsx,map-blocked-reason.ts}`. UI layer.

## 9. Security and safety

- The UI reflects the engine's gate; a modified client cannot skip the step because `SaveOnboardingProgress` and `CompleteOnboarding` re-verify (ONB003/007).
- No option to continue with failed isolation.
- Texts do not reveal paths.

## 10. Errors and edge cases

- Gate flips false while the Owner presses Next: the final freshness check blocks and shows the hint.
- The Owner logs out of the CLI in another window: next check marks it not ready; hint updates.
- Two required rows running: Next stays disabled with 'Sprawdzam…'.
- Engine restarts: gate unknown -> disabled.
- Skip of image build offline: blocked with the offline remedy.

## 11. Acceptance criteria

- [ ] Given all required rows ready then Next is enabled and advances to step 3.
- [ ] Given isolation failed then Next is disabled, the banner shows, and there is no bypass control.
- [ ] Given only Ollama ready then the Ollama-only hint shows and Next stays disabled.
- [ ] Given Back then the login session is cancelled and step 1 shows.
- [ ] Given a stale result then Next re-checks before advancing.

## 12. Test plan

- Vitest + Testing Library with fake checks context: gate truth table to hints and disabled state; freshness logic; announcements.
- Playwright scenarios `checks-isolation-failed`, `checks-no-cli`.
- Commands: `pnpm --filter @overmind/desktop test features/onboarding/steps/connections/footer`.

## 13. Parallelization notes

After ONB015 (context) and ONB017 (cancel hook). Parallel with ONB016.

## 14. Open questions and assumptions

- DESIGN GAP: disabled Next reasons and banners are derived.
- OPEN: whether to offer 'Pomiń CLI na razie' (continue with Ollama only) in a later version; not in MVP (spec requires one subscription CLI).
