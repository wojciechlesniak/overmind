---
id: OVE_PAUSE010
title: "Wire the top bar Global Pause button with feedback and a resume confirmation"
area: PAUSE
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_DS036, OVE_DS037, OVE_DS042, OVE_DS043, OVE_PAUSE007]
soft_depends_on: []
provides: ["lib:use-pause", "ui:GlobalPauseControl"]
needs: ["ui:GlobalPauseButton", "ui:Dialog", "ui:ConfirmDialog", "ui:Toast", "ui:TopBar", "api:pause.global", "lib:api-client-pause", "lib:feature-manifest"]
owns: ["apps/desktop/src/features/pause/hooks/**", "apps/desktop/src/features/pause/GlobalPauseControl/**", "apps/desktop/src/locales/en/pause.json", "apps/desktop/src/locales/pl/pause.json", "apps/desktop/src/features/pause/feature.manifest.ts"]
reads: []
design: design.png
design_source: "Pulpit#shell/top-bar-global-pause (crop 1150,4,290,58); design-main.png = Main#shell/top-bar-global-pause (crop 82,56,160,56)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 16"]
adr_refs: [5, 6]
---

# OVE_PAUSE010: Wire the top bar Global Pause button with feedback and a resume confirmation

## 1. Summary

Connects the existing design-system `GlobalPauseButton` to the engine: a `usePause()` hook over the api-client and push events, the connected `GlobalPauseControl` (button plus feedback), and the confirmation step for resuming. The top bar composition (SHELL) inserts this control into its `controls` slot.

## 2. Context

The Global Pause button sits at the right end of the top bar in every desktop view (mock: magenta-tinted `Global Pause`, pause icon, 40px high, next to the amber `3 czekają` Approvals button). The pure component and its paused variant are built in OVE_DS042; the gateway API in OVE_PAUSE007. This task is the data wiring and interaction layer only (CONVENTIONS section 4 (c) and (d)). Pausing must be a one-click emergency action (instant effect), resuming deserves one deliberate confirmation.

## 3. Scope (in)

- `usePause()` hook: snapshot state, `pause()`, `resume()`, `pending`, `error`, push subscription with reconnect handling.
- `GlobalPauseControl` component: renders `ui:GlobalPauseButton` from the snapshot and handles clicks.
- Pause feedback toast, resume confirmation dialog, error toast.
- i18n namespace `pause` (EN and PL).
- Feature manifest entry (no routes, exports the slot component).

## 4. Out of scope

- Placing the control inside the TopBar and the banner: SHELL composition and OVE_PAUSE011.
- Composers and approvals while paused: OVE_PAUSE012. Tray: OVE_PAUSE013. Workspace card: OVE_PAUSE014. Settings panel: OVE_PAUSE015.

## 5. Detailed requirements

1. **Hook** (`apps/desktop/src/features/pause/hooks/use-pause.ts`):
   ```ts
   interface UsePause {
     snapshot: PauseSnapshot | null;        // null until the first value (loading)
     view: { paused: boolean; phase: 'running'|'pausing'|'paused'; drain: { inFlightSteps: number; agents: number } };
     status: 'loading' | 'ready' | 'unavailable';   // unavailable = gateway unreachable
     pending: boolean;                       // a mutation is in flight
     pauseAll(): Promise<void>;
     resumeAll(): Promise<void>;
   }
   ```
   Uses `subscribePause` and `getPauseSnapshot` from the api-client; the subscription is shared (one per window) through a small module-level store (`useSyncExternalStore`), so the top bar, banner, tray model and settings panel never open several subscriptions.
2. `GlobalPauseControl` renders `ui:GlobalPauseButton` with `paused = view.paused`, `pending`, labels from i18n. States: running (idle look as in the mock), pausing (button shows the paused look and a `title` with the drain text), paused (resume look from DS042), `status: unavailable` (button disabled with tooltip 'Brak połączenia z silnikiem').
3. **Pause flow (no confirmation, instant):** click -> `pauseAll()`; the button enters `pending`; on success the snapshot arrives through push (or the response) and the UI switches; a toast (`ui:Toast`, polite live region) says 'Wszystko wstrzymane' with an action button 'Wznów' that triggers the resume flow. Double click while pending is ignored.
4. **Resume flow (one confirmation):** click on the resume look opens `ui:ConfirmDialog` titled 'Wznowić pracę?' with the body 'Agenci ruszą dalej od ostatniego kroku. Nic nie jest ponawiane na ślepo.' and, when the snapshot lists individually paused Workspaces, an extra line 'Wstrzymane osobno zostaną: {{names}}.' (names truncated to 3 plus '+N'). Confirm button 'Wznów wszystko' (primary magenta), cancel 'Anuluj'. Confirming calls `resumeAll()`; success toast 'Praca wznowiona'.
5. Errors: `pause.resume_requires_desktop` cannot occur here (desktop channel); `gateway.not_ready` -> retry once after `retryAfterMs`, then error toast 'Silnik jeszcze startuje, spróbuj za chwilę'; any other error -> toast 'Nie udało się wstrzymać. Spróbuj ponownie lub użyj menu w pasku menu.' (for pause) and the button returns to its previous state. NEVER show a paused UI without the engine's confirmation.
6. Keyboard: the button is a native `button`; global shortcut is out of scope (listed in section 14). Focus is not moved after toggling; the confirm dialog traps focus and returns it to the button.
7. Reduced motion: no pulsing animations beyond the DS defaults.
8. i18n keys (namespace `pause`, EN default / PL): `button.pause` 'Global Pause' / 'Global Pause'; `button.resume` 'Resume' / 'Wznów'; `toast.paused` 'Everything paused' / 'Wszystko wstrzymane'; `toast.resumed` 'Work resumed' / 'Praca wznowiona'; `confirm.title`, `confirm.body`, `confirm.confirm`, `confirm.cancel`, `confirm.separately` (plural); `pausing` 'Pausing: {{count}} agents are finishing the current step' / 'Wstrzymywanie: {{count}} Agentów kończy bieżący krok' (Polish plurals); `unavailable`.

## 6. Design notes

`design.png` (Pulpit one-row top bar, right end) shows the amber Approvals button and the Global Pause button: height 40, padding 0 14, radius 12, 1px border `#5A2A4F`, fill `#2A1026`, text `#FFD3F1` 13/600, 16px `pause` icon. `design-main.png` shows the same button where the wrapped 117px top bar of the Workflow view drops it to the second row; after normalisation E1 the button is always in the single row at the right end, so only the one-row crop is the visual target. Both are rendered by `ui:GlobalPauseButton` (OVE_DS042); this task adds NO new styling.

States NOT in the mock and how to derive them: **paused** and **pausing** use the DS042 variants (magenta tint stronger, `aria-pressed=true`, label 'Wznów'); **pending** uses the Button `loading` state; **disabled/unavailable** uses the standard disabled rule (opacity .5, no pointer events, tooltip); hover/focus/pressed follow the Button rules (2px violet focus ring, offset 2px). The toast and dialog use the standard `ui:Toast` and `ui:ConfirmDialog` appearance; the dialog's confirm button is the magenta primary, matching the pause family.

## 7. Reuse

- `ui:GlobalPauseButton` and `PausedBanner` (OVE_DS042), `ui:Dialog`/`ui:ConfirmDialog`, `ui:Toast`/`useToast`, `api-client` pause module (OVE_PAUSE007), feature manifest convention (ARCH009), i18n infrastructure (ARCH011). `selectPauseView` from the api-client. Do not restyle or re-implement the button.

## 8. Architecture and code placement

Feature folder `apps/desktop/src/features/pause/` (new): `hooks/` (store + `usePause`), `GlobalPauseControl/` (component, stories, tests), `feature.manifest.ts` exporting `slots: { topBar.controls: GlobalPauseControl }`, locales `pause.json`. Depends only on `ui-kit`, `api-client`, `contracts`. SHELL imports the exported control through the manifest slot mechanism, never the reverse.

## 9. Security and safety

- All pause state comes from the gateway; the UI never stores 'paused' in localStorage or decides authority itself (the engine enforces; the UI only reflects).
- All strings are rendered as React text nodes; no HTML injection; labels come from i18n keys with only numeric and Workspace-name params (Workspace names are untrusted text, truncated with ellipsis).
- A failed pause call is shown as an error and the button returns to its previous state; the UI never shows 'paused' before the engine confirmed (no optimistic state), because a false sense of safety is worse than a delay.
- The button never sends a channel or actor; the gateway derives it from the local app token.
- The resume confirmation lists Workspace names as plain text (untrusted) with ellipsis; no markup.

## 10. Errors and edge cases

- Gateway unreachable at start: `status: unavailable`, button disabled; state refreshes on reconnect from the initial snapshot event.
- Pause pressed in two windows: both show the same state from push; the second call returns `changed:false` and shows no second toast (the toast is driven by the snapshot transition, not by the call).
- Resume succeeds but Workspace A stays paused: toast 'Praca wznowiona' plus the banner remains for A (OVE_PAUSE011).
- Pause during resume pending: ignored while `pending`.
- Telegram paused the system: the button switches to the paused look via push; the toast text is the same.

## 11. Acceptance criteria

- [ ] Given running, When the Owner clicks Global Pause, Then `PUT /v1/pause/global {paused:true}` is called once, the button shows pending, then paused after the push, and the toast 'Wszystko wstrzymane' appears with a 'Wznów' action.
- [ ] Given paused, When the Owner clicks Wznów, Then a confirmation dialog opens; Cancel changes nothing; Confirm resumes and shows 'Praca wznowiona'.
- [ ] Given individually paused Workspaces, Then the dialog names them.
- [ ] Given the gateway returns an error, Then no paused UI is shown and an error toast appears.
- [ ] Given Telegram pauses the system, Then the control switches to paused without a click.
- [ ] Axe has no violations; the dialog traps and restores focus; the button has an accessible name and `aria-pressed`.
- [ ] Visual test of the running state matches `design.png` within the OVE_TEST005 tolerance.

## 12. Test plan

Unit tests (Vitest + Testing Library) with a fake api-client: `use-pause.test.ts`, `GlobalPauseControl.test.tsx` (flows above), a11y test with axe, Storybook stories for running, pausing, paused, pending, unavailable, confirm open; visual test against `design.png` (OVE_TEST005) and Playwright smoke against the mock gateway (OVE_TEST004): `pause-topbar.spec.ts`. Commands: `pnpm --filter desktop test pause`, `pnpm --filter desktop storybook:test`.

## 13. Parallelization notes

Starts when the api-client contract (PAUSE007) is merged (can use the mock gateway earlier). OVE_PAUSE011 to 015 depend on `lib:use-pause` from this task. SHELL's TopBar task consumes `ui:GlobalPauseControl` through the manifest slot, so no shared file is edited here.

## 14. Open questions and assumptions

- ASSUMPTION: pausing needs no confirmation (instant effect, trivially reversible); resuming needs one. If the Owner prefers a confirmation on pause as the DS042 note suggests, only `GlobalPauseControl` changes.
- OPEN: a global keyboard shortcut for Global Pause (for example Cmd+Shift+P) is not specified in the mocks; not built.
- DESIGN GAP: top bar paused state is not drawn in any mock (E33); the DS042 design is used.
