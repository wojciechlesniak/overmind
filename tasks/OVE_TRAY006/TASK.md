---
id: OVE_TRAY006
title: "Compose the tray popover with fixtures: header, Agent rows, pending row, items and footer"
area: TRAY
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS010, OVE_DS029, OVE_DS085, OVE_TRAY002, OVE_TRAY005]
soft_depends_on: ["OVE_TRAY005"]
provides: ["ui:TrayMenuContainer"]
needs: ["ui:TrayMenu", "ui:TrayItem", "ui:TrayAgentRow", "ui:TrayWorkspaceGroup", "ui:LogoTile", "ui:Menu", "lib:use-tray-model"]
owns: ["apps/desktop/src/features/tray/TrayMenuContainer.tsx", "apps/desktop/src/features/tray/tray-frame.tsx", "apps/desktop/src/features/tray/tray.fixtures.ts", "apps/desktop/src/features/tray/register-content.ts", "apps/desktop/src/features/tray/__stories__/TrayMenu.stories.tsx"]
reads: []
design: design.png
design_source: "Tray#tray/popup (whole mock crop 0,0,380,560); design-header.png = tray/header (25,25,330,46); design-agents.png = tray/agent-row-* (25,84,330,130); design-actions.png = tray/item-pending..tray/item-quit (25,227,330,333, clipped by the mock at 560)"
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9]
---

# OVE_TRAY006: Compose the tray popover with fixtures: header, Agent rows, pending row, items and footer

## 1. Summary

Builds the visible popover from `ui:TrayMenu` and its parts with the mock's content: header (logo, 'Overmind', status line), three Agent rows, the amber pending row, 'Napisz do Chiefa…', the pause items, the tinted Global Pause button and the footer actions with the ⌘O hint. It runs on fixtures and on the view model of TRAY005, and registers itself as the tray content.

## 2. Context

The Tray mock (`Tray.png`, 380x560 viewport) shows a 348 px popup card with radius 16 and a large shadow. DS085 provides `TrayMenu`, `TrayItem`, `TrayAgentRow` and `TrayWorkspaceGroup` with exact regions (VIEWS: header 330x46, agent row 330x42, divider 1 px with 6 px side margin, item 40 px, Global Pause 42 px). This task only places them in the 380x560 window, feeds them props and verifies the pixel match. The mock content is 613 px tall and clipped at 560 (the 'Zakończ Overmind…' row is cut off): that is an overflow bug of the mock, solved in TRAY009 by internal scrolling.

## 3. Scope (in)

- `TrayMenuContainer` that calls `useTrayModel()` (TRAY005) and renders `<TrayMenu {...props}/>` inside the 380x560 frame with the 16 px margin.
- Registration into `registerTrayContent` (TRAY002).
- Fixtures reproducing the mock exactly (`tray.fixtures.ts`): QA (working, Aplikacja rezerwacji), Security (waiting Approval), Researcher (working, Strona fundacji), pending 3, items, Global Pause idle.
- Storybook stories: Mock, ThreeWorkspaces, NoAgents.
- Visual comparison with `design.png`.

## 4. Out of scope

- Click behaviour (TRAY008), loading/error/overflow states (TRAY009).
- Window and positioning (Rust).
- Any restyling of DS parts.

## 5. Detailed requirements

1. **Frame.** Root `div` 380x560 with `padding: 16px`, containing `<TrayMenu/>`; the card is the DS popup (radius 16, 1px border `line`, fill `bg-panel`, shadow token `shadow-lg`); because the window is opaque (TRAY001) the margin area uses `bg-app`. The card height is `min(content, 528px)` and scrolls internally (TRAY009).
2. **Content order (top to bottom), exactly as the mock:** header; divider; Agent rows (working magenta word, waiting amber word); divider; pending row (amber 8 px square marker with glow + text + right hint 'Zgody'); 'Napisz do Chiefa…' with message icon; divider; pause items ('Wstrzymaj „Aplikacja rezerwacji”' pause icon, 'Wznów „Research rynku”' activity icon); divider; Global Pause button (42 px, tinted magenta, pause icon, label 'Global Pause'); divider; 'Otwórz Overmind' with `⌘O`; 'Zamknij okno, pracuj dalej'; 'Zakończ Overmind…' muted.
3. **Header.** Logo tile 28 px (hex-cell mark, `ui:LogoTile` size sm), title 'Overmind' 15/700 and status line in mono 12 magenta 'pracuje · 3 z 3 Agentów' (tone working magenta; idle muted; paused amber with the word; error `#FF8FA3` family via token). The status is always words.
4. **Agent rows.** `TrayAgentRow`: 30 px avatar with gradient hue and mono initials ('QA', 'Sc', 'Rs'), name 14/600, subtitle workspace name 13 `text-muted`, right state word (mono 13): 'pracuje' magenta, 'Zgoda' amber. Note: the mock's initials 'QA', 'Sc', 'Rs' are fixture data and cannot be derived by a rule (Security -> 'Sc'); the live value comes from the engine (`TrayAgent.initials`, rule in TRAY004) and the story fixtures pass the mock values explicitly, so the pixel comparison is unaffected.
5. **Items.** `TrayItem` 40 px, padding 0 12, radius 10, hover and keyboard focus fill `bg-hover`, icon 16 `text-muted`, label 14; `kbd` in mono muted. Focus ring visible (2 px).
6. **Keyboard.** Items are one tab stop group with arrow-key navigation (DS029 menu pattern); `Home/End`; Enter/Space activate. `role="menu"` on the container with `aria-label` = `tray:a11y.menu`; rows are `menuitem`; Agent rows are informational (`role="presentation"`, not focusable) and the pending row is a `menuitem` (opens Approvals).
7. **Fixtures vs live.** The container accepts a `model` prop for stories; the app passes the hook result. No data fetching in presentational pieces.
8. **Dark only.** The product is dark-first; no light variant (styl-wizualny).
9. **Pixel check.** In Storybook the story `Tray/Mock` at 380x560 is compared with `design.png`; accepted diff only in the clipped bottom row (the mock cuts it, the implementation scrolls).
10. **Sizes in tokens.** Row heights 40/42, gaps and radii come from the DS parts; this task adds no CSS values except the 16 px frame padding (token `space-4`).
11. Standard UI rules (CONVENTIONS section 8, DS global rules G1-G7): every visible string and aria-label is an i18n key in the feature namespace (EN default, PL translation copied from the mock, ARCH011); no hard-coded colours, sizes or radii, only `--om-*` tokens through ui-kit components; visible 2px focus ring on every interactive element; `prefers-reduced-motion` respected; Storybook stories for each state listed here; axe check clean.

## 6. Design notes

`design.png` is the whole mock (380x560). Additional crops: `design-header.png` (header 330x46 at 25,25), `design-agents.png` (three Agent rows at 25,84), `design-actions.png` (pending row to the clipped footer at 25,227). Reproduce them within the DS tolerance. Not in the mock (TRAY009 and open questions): loading, engine error, idle, paused header, quit confirmation, hover/focus, scrolling when content exceeds 528 px.

## 7. Reuse

- `ui:TrayMenu`, `ui:TrayItem`, `ui:TrayAgentRow`, `ui:TrayWorkspaceGroup`, `ui:LogoTile`, `ui:Menu` behaviour (DS085/029/041), `formatShortcut` (SHELL024).
- Never re-implement rows or buttons; use DS props only.

## 8. Architecture and code placement

`apps/desktop/src/features/tray/{TrayMenuContainer.tsx,tray-frame.tsx,tray.fixtures.ts,register-content.ts}` and stories `apps/desktop/src/features/tray/__stories__/TrayMenu.stories.tsx`. UI composition layer.

## 9. Security and safety

- Everything rendered as text nodes; no `dangerouslySetInnerHTML`; Agent and Workspace names truncated.
- The popover offers no destructive or approving control; the only state-changing control is Global Pause (the safe direction), implemented in TRAY008 via PAUSE013.
- No external links.

## 10. Errors and edge cases

- Names that are very long: ellipsis with `title`.
- Zero Agents: the rows block collapses with its divider (no empty gap).
- More than 12 rows: the engine caps at 12; the card scrolls.
- Reduced motion: no hover transitions beyond token durations.
- VoiceOver: state words are read with the name ('QA, Aplikacja rezerwacji, pracuje').

## 11. Acceptance criteria

- [ ] Given the mock fixture then the rendered popover matches `design.png` and the three crops within tolerance (excluding the clipped footer row).
- [ ] Given keyboard use then arrow keys move focus through the menu items and skip Agent rows.
- [ ] Given a hover then the row fill follows the DS token.
- [ ] Given PL and EN then all strings come from `tray.json` (no hard-coded text).
- [ ] Given axe then no violations.

## 12. Test plan

- Storybook stories with play tests (arrow navigation, Esc handler prop) and visual snapshots (TEST005).
- Vitest + Testing Library for the container with a fake `model`.
- Commands: `pnpm --filter @overmind/desktop test features/tray`; `pnpm --filter @overmind/desktop storybook:test tray`.

## 13. Parallelization notes

After TRAY002 and DS085; consumes TRAY005's `TrayMenuProps` type but can start with fixtures. Parallel with TRAY005 and TRAY007.

## 14. Open questions and assumptions

- DESIGN GAP: hover/focus, loading, error, idle, paused states are not drawn (TRAY009).
- OPEN: the clipped bottom row in the mock (content 613 px vs viewport 560) is treated as a mock defect, not a requirement.
