---
id: OVE_PAUSE015
title: "Wire the Settings Global Pause panel with active state and resume"
area: PAUSE
kind: ui
size: XS
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS078, OVE_PAUSE010]
soft_depends_on: []
provides: ["ui:GlobalPauseSettingsPanel"]
needs: ["ui:GlobalPausePanel", "ui:SettingsSection", "lib:use-pause"]
owns: ["apps/desktop/src/features/pause/SettingsPanel/**"]
reads: []
design: design.png
design_source: "Ustawienia#appset/global-pause-section (crop 766,676,646,96)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5]
---

# OVE_PAUSE015: Wire the Settings Global Pause panel with active state and resume

## 1. Summary

Connects the magenta-tinted Global Pause panel of App settings ('Wstrzymaj wszystko') to the pause store, including the active state ('Wznów wszystko' with 'Wszystko wstrzymane od 14:02') and the shared resume confirmation.

## 2. Context

The Ustawienia mock ends with a panel: 'Global Pause', the sentence 'Zatrzymuje wszystkich Agentów we wszystkich Workspace'ach po bieżącym kroku. Nic nie jest ponawiane na ślepo.' and a magenta 44px button 'Wstrzymaj wszystko'. VIEWS lists the active state ('Wznów wszystko'?) and its confirmation as missing. The pure panel is `ui:GlobalPausePanel` (OVE_DS078). SETUI composes the page and imports this connected panel.

## 3. Scope (in)

- `GlobalPauseSettingsPanel` connected component.
- Active/pausing/unavailable states and since-time text.
- Reuse of the pause and resume flows of OVE_PAUSE010.

## 4. Out of scope

- The Settings page and other sections: SETUI. The pure component: OVE_DS078.

## 5. Detailed requirements

1. Props to `ui:GlobalPausePanel`: `title` 'Global Pause', `description` as in the mock, `active = view.paused`, `labels: { pause: 'Wstrzymaj wszystko', resume: 'Wznów wszystko', activeNote: 'Wszystko wstrzymane od {{time}}' }` where `time` is the local `HH:mm` of `snapshot.global.since` (formatted with `Intl.DateTimeFormat`, Owner locale; if the date is not today, `d MMM HH:mm`).
2. `onToggle`: when running -> `pauseAll()` immediately (no dialog, same as the top bar); when paused -> the shared resume confirmation from OVE_PAUSE010 (`requestResume()` exported by the hook).
3. While `phase: 'pausing'` the panel shows `active` plus the note 'Wstrzymywanie: {{count}} Agentów kończy bieżący krok'.
4. `status: unavailable`: CTA disabled with the tooltip 'Brak połączenia z silnikiem'.
5. The panel never renders channel-specific details (who paused). It MAY show 'z Telegrama' next to the time when `snapshot.global.via === 'telegram'` ('Wszystko wstrzymane od 14:02 · z Telegrama') so the Owner knows why work stopped; text only.

## 6. Design notes

`design.png` shows the panel: radius 18, fill `#1C0B19`, 1px border `#5A2A4F`, left column title 'Global Pause' 16/700 plus the 13px description in `#D9C7EA`-class soft text, right column magenta `primary-magenta-lg` button 44px with the pause icon and 'Wstrzymaj wszystko'. Derived states: active = magenta-tinted border strengthened, button label 'Wznów wszystko' (same size, `aria-pressed=true`), note text under the title; pending = Button loading; unavailable = disabled. All from `ui:GlobalPausePanel` (OVE_DS078); no new styling.

## 7. Reuse

- `ui:GlobalPausePanel`, `ui:SettingsSection` variant `global-pause` (OVE_DS078), `usePause` and the resume flow (OVE_PAUSE010).

## 8. Architecture and code placement

`apps/desktop/src/features/pause/SettingsPanel/{GlobalPauseSettingsPanel.tsx,*.stories.tsx,*.test.tsx}`; exported via the barrel; SETUI imports the component into its page.

## 9. Security and safety

- All pause state comes from the gateway; the UI never stores 'paused' in localStorage or decides authority itself (the engine enforces; the UI only reflects).
- All strings are rendered as React text nodes; no HTML injection; labels come from i18n keys with only numeric and Workspace-name params (Workspace names are untrusted text, truncated with ellipsis).
- A failed pause call is shown as an error and the button returns to its previous state; the UI never shows 'paused' before the engine confirmed (no optimistic state), because a false sense of safety is worse than a delay.

## 10. Errors and edge cases

- Panel visible in two windows: both follow push.
- `since` missing (system pause at boot): note reads 'Wszystko wstrzymane' without a time.
- Date in a different day: includes the date.
- Clock skew between engine and UI: time is only displayed, never computed from.

## 11. Acceptance criteria

- [ ] Given running, Then the panel matches `design.png` and the button reads 'Wstrzymaj wszystko'.
- [ ] Given paused since 14:02, Then it reads 'Wznów wszystko' and 'Wszystko wstrzymane od 14:02'.
- [ ] Clicking resume opens the same confirmation dialog as the top bar.
- [ ] Given via telegram, Then ' · z Telegrama' is appended.
- [ ] axe clean; button exposes `aria-pressed`.

## 12. Test plan

Component tests with fake `usePause`: `GlobalPauseSettingsPanel.test.tsx`; Storybook states; visual comparison against `design.png` (running). Commands: `pnpm --filter desktop test pause`.

## 13. Parallelization notes

Tiny; parallel with all other UI tasks after OVE_PAUSE010. SETUI composes it; no edits to their files.

## 14. Open questions and assumptions

- OPEN: Owner asked in VIEWS whether the active CTA says 'Wznów wszystko'; default as written.
- The unspecified 'Wstrzymaj wszystko' confirmation is intentionally absent (see OVE_PAUSE010 assumption).
