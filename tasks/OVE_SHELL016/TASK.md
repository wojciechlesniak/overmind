---
id: OVE_SHELL016
title: "Compose the TopBar: switcher, path, limit meter, slots, Telegram pill and approvals button"
area: SHELL
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS028, OVE_DS032, OVE_DS042, OVE_DS043, OVE_SHELL007, OVE_SHELL012, OVE_SHELL015]
soft_depends_on: []
provides: ["ui:ShellTopBar", "lib:use-top-bar-slots"]
needs: ["ui:TopBar", "ui:WorkspaceSwitcher", "ui:LimitMeter", "ui:SlotsPill", "ui:ChannelPill", "ui:ApprovalsButton", "ui:Skeleton", "ui:Tooltip", "lib:i18n-provider"]
owns: ["apps/desktop/src/app/topbar/top-bar-slot.tsx", "apps/desktop/src/app/topbar/top-bar-content.tsx", "apps/desktop/src/app/topbar/top-bar-skeleton.tsx", "apps/desktop/src/app/topbar/index.ts", "apps/desktop/src/locales/en/topbar.json", "apps/desktop/src/locales/pl/topbar.json"]
reads: []
design: design.png
design_source: "Pulpit#shell/top-bar (crop 72,0,1368,67, the 67 px variant); design-main.png = Main#shell/top-bar 117 px variant for reference (crop 72,0,1368,117)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [18, 23]
---

# OVE_SHELL016: Compose the TopBar: switcher, path, limit meter, slots, Telegram pill and approvals button

## 1. Summary

Registers the top-bar slot: renders `ui:TopBar` with `ui:WorkspaceSwitcher` (name, path), `ui:LimitMeter`, `ui:SlotsPill`, `ui:ChannelPill` and `ui:ApprovalsButton` from the view model of OVE_SHELL015, in the 67 px single-row layout, with the full `topbar` i18n catalogue (EN and PL from the mock). Pause controls and switcher interactions are wired in OVE_SHELL017; error and edge states in OVE_SHELL018.

## 2. Context

Every shared-shell view has the same top bar (VIEWS 'Shared shell'). The mocks show a 117 px two-row variant (Global Pause wrapped under the switcher) and a 67 px variant (Pulpit, Ustawienia). DS043 decided one 67 px row everywhere (E1 normalisation), so this task reproduces the 67 px geometry: switcher 201.8x40 at x=92, path mono 14 px high, limit meter 330.9x28, slots pill 152x28, Telegram pill 164x28, approvals button 109.4x42. The plain variant (no switcher) is used by the Workspaces dashboard and App settings (route meta `topBar: 'plain'`, SHELL012). See `design.png` (this task's top bar) and `design-main.png` (the 117 px Main variant for reference, not to be copied).

## 3. Scope (in)

- `TopBarSlot` component registered through `registerShellSlot('topBar', ...)` (SHELL012) with variants `workspace` and `plain`.
- Static composition from the view model (`useTopBarSummary`), including loading skeleton and the default ready state.
- The complete `topbar` namespace files `locales/{en,pl}/topbar.json` (owned here; later tasks consume the keys, see catalogue below).
- Slots for the pause controls and the pause banner (`controls` and `banner` props filled by OVE_SHELL017 via a typed slot hook; until then `null`).
- Storybook stories for variants and widths 1100, 1280, 1440.

## 4. Out of scope

- Pause control behaviour and banner (SHELL017, PAUSE010/011).
- Switcher open menu logic and keyboard (SHELL017).
- Error, offline, stale, >= 90% and 0-slot polish (SHELL018).
- Notification centre or bell (not in the mock).

## 5. Detailed requirements

1. **Render tree.** `<TopBar workspace={ws} workspaces={list} controls={<><LimitMeter .../><SlotsPill/><ChannelPill/><ApprovalsButton/><PauseControlSlot/></>} banner={<PauseBannerSlot/>} labels={...}>`. Controls order (left to right) exactly as the mock: limit meter, slots, Telegram, approvals, Global Pause (last, right edge).
2. **Geometry.** Bar height 67 px at every width >= 1100 (min window width, SHELL008); no wrapping. Behaviour below 1280 and 1100 px comes from the DS container queries; this task must not add media queries. A Playwright check asserts `header.getBoundingClientRect().height === 67` at 1100, 1280 and 1440 widths.
3. **Switcher.** Receives `{ id, name, path, state }` for the current Workspace: `name` = Workspace name ('Aplikacja rezerwacji'), `path` = display path from `useWorkspaceDisplayPath` ('~/Projects/aplikacja-rezerwacji'), `state` = 'working' when any Run of that Workspace is active (hint from `useWorkspaces()` summary), 'paused' when the Workspace is paused, else 'idle'. The `workspaces` list is `useWorkspaces()` mapped; handlers are wired in SHELL017.
4. **Plain variant.** On routes with `topBar: 'plain'` the `workspace` prop is omitted, so the left group is empty and the controls sit right-aligned exactly as in Pulpit/Ustawienia (limit meter x=487.6 ... pause x=1284).
5. **Limit meter.** `entries` from the view model; at most 2 pills inline with `+N` overflow handled by the DS. Text format 'Claude Max 62% · reset 3 h · wg CLI' is composed by the DS from the entries; this task passes the labels `{ source: t('limits.source') ('wg CLI'), unlimited: t('limits.unlimited') ('bez limitu'), ariaLimit }`.
6. **Slots, Telegram, Approvals.** Props straight from the view model (SHELL015). `ApprovalsButton` is a router `Link` to `/approvals` using `useNavigateToRoute('approvals')` (SHELL010) so the nav model resolves the target; when the Approvals route is not registered (feature not installed) the button is disabled with a tooltip, not hidden.
7. **Loading.** While `status === 'loading'` and no cached data: `Skeleton` pills at the same sizes (no layout shift). With cached data the old values stay visible during refetch.
8. **Catalogue of keys in `topbar.json` (EN | PL):** `limits.source` wg CLI | wg CLI; `limits.unlimited` unlimited | bez limitu; `limits.needsLogin` needs login | wymaga logowania; `limits.aria` {{cli}}: {{percent}} percent used | {{cli}}: wykorzystano {{percent}} proc.; `limits.warning90` Limit almost reached | Limit prawie wyczerpany; `limits.reached` Limit reached | Limit wyczerpany; `slots.label` Agents {{active}} of {{max}} at once | Agenci {{active}} z {{max}} naraz; `slots.compact` {{active}}/{{max}}; `slots.queued` {{count}} queued | {{count}} w kolejce; `telegram.*` per status (connected 'Telegram connected' | 'Telegram połączony', connecting, notConfigured, unpaired, disconnected, degraded, error, locked); `approvals.label` (plural), `approvals.zero`, `approvals.aria` 'Approvals and Requests: {{label}}' | 'Zgody i Prośby: {{label}}', `approvals.breakdown`; `switcher.aria` Workspace: {{name}} | Workspace: {{name}}; `switcher.create` New Workspace | Nowy Workspace; `switcher.none` No Workspace | Brak Workspace'u; `switcher.isolated` isolated | izolowany; `statusGroup` Status | Status; `pause.pause` Global Pause | Global Pause; `pause.resume` Resume | Wznów; `pause.paused` Everything paused | Wszystko wstrzymane; `error.title`, `error.retry`, `stale.hint` (used by SHELL018).
9. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` crops the shell top bar (1368x67 at x=72). Reproduce: bar background `bg-panel`, 1px bottom border, left group switcher (neutral `bg-surface` button with a status dot), mono path, flexible gap, then the four status controls and the Global Pause. Approvals is the only amber element. `design-main.png` shows the 117 px variant where Global Pause wraps: do NOT reproduce the wrap (E1). Not in the mock: loading, error, stale, paused banner, >= 90% limit, Telegram disconnected, 0 of 3 slots, zero approvals (SHELL018 and 017 design these from DS rules).

## 7. Reuse

- `ui:TopBar`, `ui:WorkspaceSwitcher`, `ui:LimitMeter`, `ui:SlotsPill`, `ui:ChannelPill`, `ui:ApprovalsButton`, `ui:Skeleton`, `ui:Tooltip` (DS042/043/032).
- Never restyle a DS control; no custom CSS beyond layout wrappers that DS exposes through props.

## 8. Architecture and code placement

`apps/desktop/src/app/topbar/{top-bar-slot.tsx,top-bar-content.tsx,top-bar-skeleton.tsx,index.ts}` and `apps/desktop/src/locales/{en,pl}/topbar.json`. UI composition layer reading the view model; no data fetching inside components except the hook from SHELL015.

## 9. Security and safety

- All strings come from i18n; CLI text is rendered as plain text by the DS.
- The approvals link opens a route only; no action is performed from the bar (Approvals are decided in the Approvals view with Local Approval where required).
- The bar never hides the Global Pause control: if the pause slot fails to render, an error boundary shows a minimal `Global Pause` fallback button (SHELL019 boundary) so the Owner can always stop everything.

## 10. Errors and edge cases

- Workspace name very long: ellipsis at 220 px with `title`.
- Path missing (policy not loaded): the path element is omitted, the switcher stays.
- No Workspaces (first run): the bar is not shown (wizard has its own layout); on the dashboard empty state the plain variant is used.
- Narrow window 1100: DS container rules apply; verified by story.
- Summary loading error: delegated to SHELL018 (this task renders whatever the view model says).

## 11. Acceptance criteria

- [ ] Given the fixture summary of the mock then the bar shows 'Aplikacja rezerwacji', path, 'Claude Max 62% · reset 3 h · wg CLI', 'Agenci 3 z 3 naraz', 'Telegram połączony', '3 czekają' in this order and matches `design.png` within the visual tolerance.
- [ ] Given a `plain` route then no switcher is rendered and controls align as in Pulpit.
- [ ] Given widths 1100/1280/1440 then the bar height stays 67 px and nothing wraps.
- [ ] Given loading then skeletons occupy the same slots (no layout shift).
- [ ] Given PL and EN locales then all strings translate and the pseudo-locale story shows no hard-coded text.

## 12. Test plan

- Storybook stories: `TopBar/Workspace`, `TopBar/Plain`, `TopBar/Loading`, widths 1100/1280/1440; visual comparison with `design.png` (TEST005).
- Vitest + Testing Library for the composition with `FakeWorkspaceProvider` and a fake summary; i18n key coverage test (every key in the catalogue exists in EN and PL).
- Commands: `pnpm --filter @overmind/desktop test topbar`; `pnpm --filter @overmind/desktop storybook:test`.

## 13. Parallelization notes

Needs SHELL012 (slot registry), SHELL015 (view model), DS042/043. Parallel with SHELL013/014. SHELL017/018 extend through the typed slot hooks defined here (`useTopBarSlots()`), not by editing these files.

## 14. Open questions and assumptions

- ASSUMPTION: the full `topbar.json` catalogue is authored here so SHELL017/018 do not edit the same file; they request new keys through a follow-up if the catalogue is insufficient.
- OPEN: the mock draws the switcher dot magenta for 'working'; DS043 defines it; if a Workspace is paused the dot is grey (DS) while the paused banner explains why.
