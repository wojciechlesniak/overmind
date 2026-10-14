---
id: OVE_TRAY009
title: "Complete the tray states: loading, engine down, paused, overflow and quit confirmation"
area: TRAY
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS013, OVE_DS032, OVE_DS040, OVE_DS085, OVE_ENGINE004, OVE_PAUSE013, OVE_SHELL019, OVE_TRAY006, OVE_TRAY007, OVE_TRAY008]
soft_depends_on: []
provides: ["lib:tray-states", "lib:tray-engine-gate"]
needs: ["ui:Skeleton", "ui:InfoNote", "ui:Button", "ui:TrayItem", "lib:emergency-pause", "api:system.shutdown", "lib:use-tray-pause-model", "lib:tauri-tray"]
owns: ["apps/desktop/src/features/tray/states/**", "apps/desktop/src/features/tray/__stories__/TrayStates.stories.tsx"]
reads: []
design: design.png
design_source: "Tray#tray/popup baseline (crop 0,0,380,560); the states of this task are not drawn in the mock (derived from DS rules); the footer rows tray/item-open-app..tray/item-quit (25,480,330,80) are the pinned part"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 15]
---

# OVE_TRAY009: Complete the tray states: loading, engine down, paused, overflow and quit confirmation

## 1. Summary

Designs and implements everything the Tray mock does not show: loading skeleton, engine unavailable and incompatible variants, idle and paused headers, the inline resume confirmation, internal scrolling for content taller than the window (the mock overflows by 53 px), hover and focus, and the 'Zakończ Overmind…' confirmation with the choice between quitting only the app and also stopping the engine.

## 2. Context

VIEWS 'States NOT shown' for Tray: nothing running, Global Pause active, engine stopped or error, hover/focus highlight, menu overflow (content 613 px vs 560 px popover) and quit confirmation (running Runs). The popover is the fastest way to stop everything when the window is closed, so these states must be clear and must never hide the Global Pause button. 'Zakończ Overmind…' ends the UI (resident app, ADR 0005); stopping the engine is a separate, explicit choice because it stops all Agents after checkpointing (ENGINE004: `POST /v1/system/shutdown` with header `X-Overmind-Confirm: shutdown`).

## 3. Scope (in)

- `TrayLoading` (skeleton rows with the same heights), `TrayEngineDown`, `TrayIncompatible`, idle and paused header variants (tone via DS), scrolling container, quit confirmation panel.
- Inline resume confirm row for Global Pause ('Wznowić? [Wznów] [Anuluj]') as specified by PAUSE013, rendered here with DS parts.
- Keyboard and hover states verified.
- Stories and snapshots for each state.

## 4. Out of scope

- Content of the normal state (TRAY006).
- The engine start action beyond calling `ensureEngine()` (SHELL020 owns the main-window flow).
- Native confirmation dialogs (none: everything inline).

## 5. Detailed requirements

1. **Loading.** Until the first summary: header skeleton (logo + two lines), three `ui:Skeleton` agent rows and the real footer items (open app, close window, quit work without data). Global Pause is shown disabled with `aria-busy`; after 3 s of loading the error state appears with retry.
2. **Engine down.** Header status 'silnik nie odpowiada' (tone error, word not colour). Body: one `ui:InfoNote` 'Silnik nie działa. Agenci mogą być zatrzymani.' with the buttons 'Uruchom silnik' (`ensureEngine()`, SHELL003/SHELL020) and 'Spróbuj ponownie'. Items still available: 'Otwórz Overmind', 'Zamknij okno, pracuj dalej', 'Zakończ Overmind…'. The Global Pause button stays visible; because the normal route is unreachable it uses the emergency pause path (`emergencyPause()`, SHELL019) and reports the result inline.
3. **Incompatible.** Header 'wersje się nie zgadzają'; body text 'Aplikacja i silnik mają różne wersje. Otwórz Overmind, aby to naprawić.' and only 'Otwórz Overmind' / 'Zakończ Overmind…'; no pause and no data (the api-client is locked by the connection state, SHELL004).
4. **Idle.** Header 'bezczynny' tone idle (muted); Agent rows block replaced by a muted line 'Żaden Agent nie pracuje' ; the pending row appears only when > 0.
5. **Paused.** Header 'wstrzymane' (amber dot plus word) or 'wstrzymywanie · 2 Agentów' while draining (PAUSE013); Global Pause button in the active look with label 'Wznów wszystko'; per-Workspace items replaced by the muted 'Wszystko wstrzymane' (PAUSE013 rule).
6. **Resume confirmation.** Clicking 'Wznów wszystko' replaces the button with an inline row 'Wznowić? [Wznów] [Anuluj]' (focus on 'Anuluj' by default; Enter on 'Wznów' confirms; Esc cancels first, a second Esc hides the popover). Auto-cancel after 8 s.
7. **Overflow.** The card has `max-height: 528px` and `overflow-y: auto` with the DS scrollbar style; the header stays sticky at the top and the footer actions stay pinned at the bottom (the three footer items are always visible: the mock's clipped 'Zakończ Overmind…' is fixed by pinning); the middle area (rows, pending, items, pause items, Global Pause) scrolls. A top and bottom fade appears only when scrollable. Verified at 12 Agent rows and 6 pause items.
8. **Quit confirmation.** 'Zakończ Overmind…' opens an inline panel replacing the footer: when `summary.activeRuns > 0` text 'Aktywne Runy: {{count}}. Możesz zakończyć samą aplikację (Agenci pracują dalej) albo zatrzymać też silnik (Runy zapiszą punkty kontrolne).' with buttons 'Zakończ aplikację' (primary), 'Zatrzymaj też silnik' (danger look), 'Anuluj'. With no active Runs the text is shorter and the same three choices appear. 'Zatrzymaj też silnik' calls `POST /v1/system/shutdown` with `X-Overmind-Confirm: shutdown` through the api-client method `system.shutdown()` (idempotent key), waits for 202, then calls `quit_app()`. 'Zakończ aplikację' calls `quit_app()` only. Focus starts on 'Anuluj'.
9. **Quit semantic note.** The engine is a launchd service with KeepAlive on crash only (ENGINE004 req. 6): after `shutdown` exit 0 the engine stays stopped until the next app start or login; the text must not promise a restart.
10. **Hover/focus.** DS tokens (bg-hover, 2 px focus ring); `prefers-reduced-motion` removes fades.
11. **Announcements.** State changes (down, paused, recovered) are announced through a polite live region inside the popover when visible.
12. **Stale.** A 60-second-old summary with the hub disconnected shows the header status in muted tone with 'dane sprzed {{age}}' under it (DESIGN GAP, derived).
13. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

No mock exists for these states (design: none beyond the baseline). The baseline look is `design.png`; each state uses DS parts and tokens only (`ui:InfoNote`, `ui:Skeleton`, `ui:Button`, `ui:TrayItem`). DESIGN GAP recorded in section 14; the Owner can review the Storybook page `Tray/States` before merging.

## 7. Reuse

- `ui:Skeleton`, `ui:InfoNote`, `ui:Button`, `ui:TrayItem`, DS scroll styles, `emergencyPause` (SHELL019), `ensureEngine` (SHELL003), pause model (PAUSE013), `api-client system.shutdown` (ENGINE004 route; client function name `system.shutdown`).

## 8. Architecture and code placement

`apps/desktop/src/features/tray/states/{tray-loading.tsx,tray-engine-down.tsx,tray-incompatible.tsx,tray-quit-confirm.tsx,tray-resume-confirm.tsx,tray-scroll-area.tsx,tray-engine-gate.tsx}` and stories `apps/desktop/src/features/tray/__stories__/TrayStates.stories.tsx`. `TrayEngineGate` is the gate used by TRAY002's providers.

## 9. Security and safety

- Quit is a two-step action; stopping the engine requires an explicit second choice and the confirm header; no single click stops Agents by accident.
- `system.shutdown` is an owner-scope route; the tray uses the owner token injected by Rust; the confirm header is added by the api-client method, not by UI code.
- The emergency pause only pauses (safe direction); resume always goes through the confirmation.
- No Run or message content appears in any state text, only counts.

## 10. Errors and edge cases

- `activeRuns` unknown (summary failed): the quit panel uses the generic text without a number.
- Shutdown route fails: inline error 'Nie udało się zatrzymać silnika.' and the app stays open.
- Popover loses focus during the confirmation: the confirmation resets (hidden popover = cancelled).
- Engine recovers while the error state is shown: automatic switch to normal with an announcement.
- Very small display height (< 600): the card max-height uses `min(528px, 100vh - 32px)`.

## 11. Acceptance criteria

- [ ] Given a failing engine then the error state shows with 'Uruchom silnik' and a working emergency Global Pause.
- [ ] Given 12 rows and 6 items then the middle area scrolls and the footer stays visible.
- [ ] Given paused then the header, button label and the muted items match the rules.
- [ ] Given 'Zakończ Overmind…' with 2 active Runs then the panel shows the count and the three choices; 'Zakończ aplikację' calls only `quit_app`.
- [ ] Given 'Zatrzymaj też silnik' then the shutdown route is called with the confirm header before `quit_app`.
- [ ] Given hover and focus then the visible ring and fill appear.

## 12. Test plan

- Storybook stories per state with play tests (confirm flows) and visual snapshots; Vitest for the gate and the quit flow with fake api-client and fake platform.
- Playwright with the mock platform for the quit flow.
- Commands: `pnpm --filter @overmind/desktop test features/tray/states`.

## 13. Parallelization notes

After TRAY006 and TRAY008. Parallel with TRAY010 (tests wait for it).

## 14. Open questions and assumptions

- DESIGN GAP: every state here is derived; the Owner should review the quit wording.
- OPEN: the product does not define whether 'Zakończ Overmind…' stops the engine; this task asks (UI-only default) and offers both; the Owner confirms.
- OPEN: `system.shutdown` api-client function name (ENGINE004 owns the route but its provides list has no `api:system.shutdown`).
