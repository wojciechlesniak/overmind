---
id: OVE_SHELL018
title: "Complete the top-bar states: loading, error, stale, warning, paused, zero values"
area: SHELL
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS017, OVE_DS028, OVE_DS032, OVE_SHELL016]
soft_depends_on: []
provides: ["lib:top-bar-states"]
needs: ["ui:Pill", "ui:Button", "ui:Tooltip", "ui:Skeleton"]
owns: ["apps/desktop/src/app/topbar/top-bar-states.tsx", "apps/desktop/src/app/topbar/use-top-bar-announcements.ts", "apps/desktop/src/app/topbar/__stories__/**"]
reads: []
design: design.png
design_source: "Pulpit#shell/top-bar (crop 72,0,1368,67): baseline for the ready state; all other states are derived from DS rules (not drawn)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [18]
---

# OVE_SHELL018: Complete the top-bar states: loading, error, stale, warning, paused, zero values

## 1. Summary

Defines and tests every state of the top bar that the mocks do not draw, derived from DS rules: summary error with retry, stale data, limit >= 90% and 100%, Telegram disconnected, 0 of 3 slots, zero approvals, global paused and Workspace paused. The task adds a state matrix story and the missing wiring, not new components.

## 2. Context

VIEWS 'Shell states shown' lists what is drawn; 'Not shown' lists paused, limit >= 90%, Telegram disconnected, 0 slots and zero approvals. The DS already styles most of them (DS042: meter amber at >= 90, error pink at 100, ChannelPill statuses, ApprovalsButton neutral at zero, GlobalPauseButton paused, PausedBanner). What is missing is the mapping from engine data to those states and the bar-level behaviour when data is missing or stale. The Owner must never see a bar that looks healthy while it is not.

## 3. Scope (in)

- State matrix as a Storybook page `TopBar/States` with one story per state and a Playwright screenshot per state.
- Error state: when the summary query fails, controls that depend on it show a compact error pill 'Brak danych' with a retry action; Global Pause stays functional.
- Stale state: data older than 90 s with the hub disconnected is dimmed (opacity token) and carries 'dane sprzed {{age}}' in the tooltip.
- Mapping rules for the warning thresholds from the view model: percent >= 90 amber, 100 or `limit_reached` error tone, `needs_login` text.
- Announcements: entering paused or limit-reached states is announced once via the polite live region (not on every refresh).

## 4. Out of scope

- New visual components or variants (open questions record gaps).
- The engine-down full-screen gate (SHELL020).
- Notification bell or sound.

## 5. Detailed requirements

1. **Error.** `TopBarErrorState` (small composition of `ui:Pill`, `ui:Button` ghost 'Spróbuj ponownie') replaces limit, slots, Telegram and approvals while `vm.status === 'error'`; layout width reserved with the same skeleton widths to avoid shifts; the Global Pause control and the paused banner are NOT replaced (they use PAUSE's own state).
2. **Stale.** `vm.status === 'stale'`: the four data controls get `data-stale="true"` (opacity token `--om-opacity-stale`, falling back to `0.6` if absent) and a tooltip text 'Dane sprzed {{age}}'; no layout change. Staleness ends on the next successful refetch.
3. **Limit warning.** Percent thresholds are applied by the DS from the `percent`; this task only supplies the additional accessible text through `ariaLimit`: >= 90 'Limit prawie wyczerpany: {{cli}} {{percent}} proc.', 100 'Limit wyczerpany'. A polite announcement 'Limit {{cli}} prawie wyczerpany' is made once per crossing (state kept in a ref per connection id).
4. **Telegram.** `disconnected`, `degraded`, `error`, `locked`, `unpaired`, `not_configured` states render through the mapping of SHELL015; the pill links to Settings > Connections (`/settings/connections#telegram`) via `useNavigateToRoute('connections')` when that route exists.
5. **Slots.** `0 z 3` shows 'Agenci 0 z 3 naraz' (no special styling); `active >= limit` sets the DS `data-saturated` hook only.
6. **Approvals zero.** `ApprovalsButton` neutral variant with label 'Brak oczekujących'; still a link to the Approvals view (to see resolved items).
7. **Paused.** Global: PAUSE011 banner above the row and `GlobalPauseControl` in the paused look; data controls stay visible. Workspace paused only: no banner from SHELL; PAUSE011 shows its Workspace scoped note.
8. **State matrix.** Required stories: loading, ready, error, stale, limit 90, limit 100, needs login, Ollama unlimited, two CLIs with `+N`, Telegram each status (8), slots 0/3 and 3/3 with queue, approvals 0/1/3/100, global paused, workspace paused, plain variant. Each story has an axe check.
9. **Reduced motion and contrast.** No pulsing under reduced motion (DS); text contrast for the error pill meets 4.5:1 (token `error` on `bg-panel`).
10. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

N/A, functionality only (no mock region); behaviour is defined by the requirements above.

## 7. Reuse

- `ui:Pill`, `ui:Button`, `ui:Tooltip`, `ui:Skeleton` and DS state styles; mapping functions of SHELL015; slot hooks of SHELL016; live region utility from SHELL011.

## 8. Architecture and code placement

`apps/desktop/src/app/topbar/{top-bar-states.tsx,use-top-bar-announcements.ts}` and `apps/desktop/src/app/topbar/__stories__/states.stories.tsx`. Strings use keys already in the `topbar` catalogue (SHELL016: `error.*`, `stale.hint`, `limits.*`).

## 9. Security and safety

- Never present stale or missing data as current: the bar must make absence visible.
- Error text never includes engine internals; `UiError.code` only in the tooltip for support.
- Announcements contain only the CLI label and percent (plain text), no free text from the CLI limit message.

## 10. Errors and edge cases

- Summary arrives but `limits` is empty because every CLI is unavailable: the meter area shows 'Brak połączonych CLI' (`limits.none`, link to Connections) rather than nothing.
- Retry pressed repeatedly: debounced; spinner on the button; no request storm (SHELL005 retry policy).
- Hub disconnected but the query fresh: not stale.
- Both global pause and error: banner stays, error pill shows.
- Locale with longer strings (DE pseudo `en-XA`): no wrap, ellipsis.

## 11. Acceptance criteria

- [ ] Given the summary endpoint failing then the error pill and retry are visible and Global Pause still works.
- [ ] Given data 2 minutes old with the hub down then the controls are dimmed with the age tooltip.
- [ ] Given percent 91 then the meter is amber and the accessible name carries the warning; given 100 then error tone and 'Limit wyczerpany'.
- [ ] Given Telegram disconnected then the pill label contains the word 'rozłączony' (not colour alone).
- [ ] Given the state matrix stories then each passes axe and a stored screenshot.

## 12. Test plan

- Storybook stories + play tests; visual snapshots for each story; Vitest for the announcement hook (fires once per crossing).
- Playwright: kill the fake gateway, expect the error state and recovery after retry.
- Commands: `pnpm --filter @overmind/desktop storybook:test topbar`.

## 13. Parallelization notes

After SHELL016. Parallel with SHELL017. Pure extension of the topbar folder with distinct files.

## 14. Open questions and assumptions

- OPEN (DS gap): no `unknown percent` meter variant and no stale styling token; this task uses opacity and text. Raise with DS part 1.
- DESIGN GAP: all states here are derived, none is drawn in the mocks.
