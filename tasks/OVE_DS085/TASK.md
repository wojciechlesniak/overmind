---
id: OVE_DS085
title: Build TrayMenu (menu-bar popover) with TrayWorkspaceGroup and TrayItem
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS010, OVE_DS013, OVE_DS016, OVE_DS020, OVE_DS022, OVE_DS029, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:TrayMenu", "ui:TrayItem", "ui:TrayAgentRow", "ui:TrayWorkspaceGroup"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Menu", "ui:LogoTile", "ui:Avatar", "ui:Divider", "ui:Kbd", "ui:Button", "ui:StatusText"]
owns: ["packages/ui-kit/src/tray/TrayMenu/**"]
reads: []
design: design.png
design_source: "Tray#tray/popup (crop 0,0,380,560 CSS px); design-header.png = Tray (crop 16,16,348,110)"
spec_refs: ["SPECIFICATION 12"]
adr_refs: [5, 6, 9]
---

# OVE_DS085: Build TrayMenu (menu-bar popover) with TrayWorkspaceGroup and TrayItem

## 1. Summary

Builds the macOS menu-bar popover: header with overall status, Workspace groups of Agent rows with state, the pending-Approvals line with a `Zgody` action, the action items (chat with Chief, pause/resume a Workspace), the Global Pause button and the footer items (open app with kbd hint, close window, quit). Fixed 380 wide, max 560 high with an internal scroll (E3).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Tray.dc.html` and its 2x render `_design/views/Tray.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C12.1 (TrayMenu), B18, E3, E34. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The engine runs without the window (ADR 0005), so the tray is how the Owner sees Agents and stops everything without opening the app (SPEC 12). It lives in a separate small Tauri window; this component is pure and renders from a snapshot view-model. Quit ends the engine and all Runs, so it is separated and confirmed.

## 3. Scope (in)

- `TrayMenu`, `TrayWorkspaceGroup`, `TrayAgentRow`, `TrayItem` (default, with icon, kbd, muted, pending marker), scroll behaviour, states: working, idle, all-paused, nothing running, engine stopped.

## 4. Out of scope

- The native menu-bar item and popover window (SHELL feature), actions (feature callbacks).

## 5. Detailed requirements

1. `TrayMenuProps`:
   ```ts
   interface TrayAgent { id: string; name: string; hue: AgentHue; initials: string; stateLabel?: string; state: 'working' | 'waiting-approval' | 'idle' | 'done' }
   interface TrayWorkspace { id: string; name: string; agents: TrayAgent[]; pendingApprovals?: { count: number; label: string /* '3 sprawy czekają na Ciebie' */; actionLabel: string; onOpen(): void }; paused?: boolean }
   interface TrayMenuProps {
     status: { label: string /* 'pracuje · 3 z 3 Agentów' */; tone: 'working' | 'idle' | 'paused' | 'error' };
     workspaces: TrayWorkspace[];
     items: TrayItemData[];     // 'Napisz do Chiefa…', 'Wstrzymaj „X”', 'Wznów „Y”'
     globalPause: { label: string; active: boolean; onToggle(): void };
     footer: TrayItemData[];    // open app (kbd ⌘O), close window, quit
     labels: { workspaceHeading: (n: string) => string };
   }
   interface TrayItemData { id: string; label: string; icon?: IconName; kbd?: string; tone?: 'default' | 'muted' | 'danger'; onSelect(): void; disabled?: boolean }
   ```
2. Popover (exact): width 380 viewport, card 348 wide at 16px inset, radius 16, bg `#140F20` + 1px `line-strong`, `shadow-popover` (large), padding 9, max-height 560 total (E3): the scrollable middle (Workspace groups) has `overflow-y: auto` and the header and action lists stay pinned (header at top, footer actions at bottom). Dividers 1px `#241B36` with 6px side margin.
3. Header (height 46): `LogoTile` 28 + `Overmind` 15/700 + status line 12 mono (`pracuje · 3 z 3 Agentów`) with `StatusDot` tone (working magenta, idle grey, paused amber `wstrzymane`, error `silnik zatrzymany`). The status is a word.
4. `TrayWorkspaceGroup`: label mono 11 `text-muted` (workspace name, `PAUSED` word when paused) and `TrayAgentRow`s (height 42): `Avatar` 22, name 13/600, right state word mono 12: `pracuje` magenta, `Zgoda` amber, none for idle. When `pendingApprovals` is set the group shows the amber square marker row (`3 sprawy czekają na Ciebie` + action `Zgody`) as a `TrayItem` (height 40) that calls `onOpen`.
5. `TrayItem`: button row height 40, padding 0 12, radius 10, gap 10, icon 16 + label 13/500 + optional `Kbd` right (`⌘O`); hover bg `rgba(255,255,255,.05)` token, focus-visible ring inset; `muted` = `text-muted` (close window), `danger` = Quit in `text-error` (E: quit is ALWAYS last and separated by a divider). Items use `role="menuitem"` in a `role="menu"`; arrows move, Enter selects, Esc closes (calls `onClose` prop), type-ahead optional.
6. Global Pause button: 42px, radius 12, tinted magenta (`rgba(242,95,196,.14)` + 1px magenta a45), `pause` icon + label (`Global Pause`; active = `Wznów wszystko`), full width minus 2px, pinned above the footer; same semantics as OVE_DS078 `GlobalPausePanel`.
7. Overflow: more than 4 Workspaces -> the middle area scrolls (thin scrollbar); items never clip: the mock's Quit item was clipped at 560 (E3), so the footer is pinned and visible.
8. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
9. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
10. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
11. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
12. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
13. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
14. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the full popover: header `Overmind · pracuje · 3 z 3 Agentów`, working Agent rows, an amber `Zgoda` row, other Workspace `Strona fundacji` with `3 sprawy czekają na Ciebie`, items (`Napisz do Chiefa…`, pause/resume), the tinted Global Pause button, `Otwórz Overmind ⌘O`, `Zamknij okno, pracuj dalej`, `Zakończ Overmind…`. `design-header.png`: header detail. Not drawn: paused/error status, many Workspaces (scroll), disabled items, engine stopped.

## 7. Reuse

Consumes `ui:Menu` (menu semantics), `ui:LogoTile`, `ui:Avatar`, `ui:Divider`, `ui:Kbd`, `ui:StatusDot`/`ui:StatusText`, `ui:Button`; state words from `agentStateTone` (OVE_DS040). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The tray shows data across Workspaces: isolated Workspace names and paths are shown only to the Owner locally, but the snapshot must not include private item content (names only). `Zakończ Overmind…` is destructive (stops the engine and every Run): last, separated, with the confirm in the feature; keyboard `Enter` on it still only emits `onSelect`. Global Pause is idempotent and safe-direction.

## 10. Errors and edge cases

- No workspaces -> text `Brak Workspace’ów` and the items.
- Agent name very long -> ellipsis.
- Snapshot stale (engine stopped) -> status tone error, actions that need the engine disabled with reason.
- `items` empty -> section hidden.

## 11. Acceptance criteria

- [ ] Given the mock fixture, Then every row, divider and button is present with heights 46/42/40/42 and the footer visible at max height 560.
- [ ] Given 6 Workspaces, Then the middle area scrolls while header and footer stay.
- [ ] Given ArrowDown/Enter, Then focus and selection work like a menu; Esc emits `onClose`.
- [ ] Given quit, Then it is last, after a divider, and error-toned.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION E3: popover max 560 with internal scroll.
- OPEN: whether the tray lists Agents of paused Workspaces (default: group label + `wstrzymany`).
