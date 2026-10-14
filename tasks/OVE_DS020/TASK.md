---
id: OVE_DS020
title: "StatusDot, StatusText, StepRing and Port indicators"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS009, OVE_DS011, OVE_DS012, OVE_DS038]
soft_depends_on: []
provides: [ui:StatusDot, ui:StatusText, ui:StepRing, ui:Port]
needs: [ui:icons]
owns: [packages/ui-kit/src/indicators/StatusDot/**, packages/ui-kit/src/indicators/StatusText/**, packages/ui-kit/src/indicators/StepRing/**, packages/ui-kit/src/indicators/Port/**]
reads: []
design: design.png
design_source: "Chief#chief/conversation-list (crop 72,240,270,260); design-checkrows Kreator-Polaczenia#onb2/checklist; design-system-status Pulpit#dash/system-status-list"
spec_refs: [SPECIFICATION 7, SPECIFICATION 9]
adr_refs: [26, 28]
---

# OVE_DS020: StatusDot, StatusText, StepRing and Port indicators

## 1. Summary

Implement the small state indicators: `StatusDot` (6/8/10px, circle or square kind marker, glow, working pulse), `StatusText` (SVG glyph + word replacing the Unicode glyphs `✓ ✗ ● ○ ◆`), `StepRing` (26px check ring for system checks, 28px wizard step dot) and `Port` (14px canvas node port).

## 2. Context

Rule of the product: state colour always comes with an icon or text, never colour alone (`styl-wizualny.md`). The State map is in OVE_DS003 (working = magenta, waiting for Approval = amber, done = mint, idle/paused = grey, failed = error). Inventory B4 and E21 (glyphs as SVG, same shapes), E27 (shared StatusPill: OVE_DS018 composes StatusDot + text). Evidence in crops: 8px dots next to Agent rows (magenta glow working, amber waiting), 8px square amber/magenta/red kind markers in the Approvals list (border-radius 2px, glow 10px), 26px rings in the CLI/isolation check list (mint fill with dark check; magenta ring with `0 0 12px` glow; grey ring), 6px mint dots in the system status list.

## 3. Scope (in)

- `StatusDot`, `StatusText`, `StepRing`, `Port` with CSS modules, stories, tests.
- Glyph mapping table (5.2) and a11y text rules.

## 4. Out of scope

- Avatar overlay positioning of the dot: OVE_DS016. Pills with dot and `StatusPill`: OVE_DS017/OVE_DS018. Node tile glow states and edges: DS part 2 (UI-61).
- Wizard stepper layout and CheckRow: DS part 2 (UI-48).

## 5. Detailed requirements

**5.1 `StatusDot`**
```ts
type DotTone = 'magenta' | 'amber' | 'mint' | 'error' | 'violet' | 'neutral';
type StatusDotProps = ({ state: AgentState; tone?: never } | { tone: DotTone; state?: never }) & {
  size?: 6 | 8 | 10; shape?: 'circle' | 'square'; glow?: boolean; pulse?: boolean; label?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'children'>;
type AgentState = 'working' | 'waiting' | 'done' | 'idle' | 'failed' | 'paused' | 'reviewing' | 'needs-login';
```
1. Colours from the State map (OVE_DS003): `working` magenta-500, `waiting` and `needs-login` amber-500, `done` mint-500, `failed` error-500, `reviewing` violet-500, `idle` and `paused` `text-muted` `#8C80A6`. `tone` uses the family 500 (`neutral` = muted).
2. Glow (OVE_DS007 `--om-glow-dot-*`): default `true` for working, waiting, done, failed, needs-login and for tones magenta/amber/mint/error; `false` for idle, paused, neutral (rule: grey never glows). `glow` prop overrides.
3. Shapes: circle `border-radius: 50%`; square (`shape="square"`) `border-radius: 2px` (kind marker of the Approvals list: 8px, amber for Approval, magenta for Access Request, error for Escalation).
4. `pulse` defaults to `true` only for `working`; implemented with helper class `om-anim-pulse` (OVE_DS007), disabled under reduced motion.
5. Sizes 6, 8 (default), 10; `flex-shrink: 0`. Usage guide in story: 6 in system rows/Telegram status, 8 on Task cards, lists, 10 on cards of Workspaces/Agents.
6. A11y: decorative (`aria-hidden`) unless `label` is provided (`role="img" aria-label`). Docs rule: a dot never stands alone; the adjacent text states the state.
**5.2 `StatusText`**
```ts
interface StatusTextProps extends HTMLAttributes<HTMLSpanElement> { state: AgentState; size?: 'sm' | 'md'; glyph?: boolean /* default true */; children: ReactNode }
```
Renders `<span data-state><svg aria-hidden/> <span>{children}</span></span>`: glyph 12px (sm) / 14px (md) from OVE_DS011 (`glyph-check` done, `glyph-cross` failed, `glyph-dot` working and reviewing, `glyph-diamond` waiting and needs-login, `glyph-ring` idle and paused), gap 6, text style `mono` 12/400 (md) or `mono-sm` 11/400 (sm), colour `--om-state-<state>-text` for text and `--om-state-<state>-color` for the glyph. `children` is mandatory text ("pracuje", "gotowe"), supplied by the caller (i18n). Screen readers read the text; the glyph is hidden.
**5.3 `StepRing`**
```ts
type StepRingProps = ({ kind: 'check'; status: 'done' | 'waiting' | 'skipped' } | { kind: 'step'; status: 'done' | 'active' | 'pending'; number: number }) & HTMLAttributes<HTMLSpanElement>;
```
- `check` 26px circle: `done` fill `mint-500` + `check` icon 14px stroke 2.6 colour `ink`; `waiting` `box-sizing: border-box; border: 2px solid magenta-500; box-shadow: 0 0 12px magenta-500` (`--om-glow-step-sm`); `skipped` border 2px `text-muted`, `box-shadow: 0 0 12px text-muted` (the mock draws this grey glow; kept as drawn, ASSUMPTION).
- `step` 28px circle: `active` fill magenta-500, `--om-glow-step` (`0 0 16px magenta-500`), number `mono-500`-like 12/700 colour `ink`; `pending` `border: 1.5px solid line-strong`, number mono 12/500 colour `text-muted`; `done` (not drawn; derived) fill mint-500 with `check` 14px `ink`.
- Decorative by default; the surrounding row provides the text. `aria-hidden="true"` unless `label` given.
**5.4 `Port`**: `kind: 'public' | 'private' | 'lane' | 'discussion' | 'neutral'`, 14px circle, `border: 2.5px solid <kind colour from Visibility map>` (neutral = `line-canvas`), fill `bg-app`, `box-sizing: border-box`. Positioning (-7px on the node edge) is NodeTile's job; the component only renders the dot. Props: `hovered`, `connecting` (highlight: border `magenta-500` + `--om-glow-edge-active`; R, no mock). Decorative (`aria-hidden`), pointer events enabled for canvas handles.
**5.5 States**: indicators are not interactive (no hover/focus); Port gets hover/connecting highlight only when the canvas sets `data-hovered`/`data-connecting`.

## 6. Design notes

`design.png`: Agent rows with state dots (QA magenta glow dot, Security amber, Developer/PO/Designer grey/none) next to the state words. `design-checkrows.png`: five check rows with `StepRing check` done (mint fill + dark check), waiting (magenta ring + glow) and skipped (grey ring), the mono status words on the right (gotowe, zaliczony, czeka na Ciebie). `design-system-status.png`: 6px mint dots with labels. Not drawn: failed/error ring, working pulse animation (derived from OVE_DS007), Port hover, `needs-login`.

## 7. Reuse

`Icon` (`check`) and glyph icons (OVE_DS011); State map and hue tokens (OVE_DS003); glows and pulse (OVE_DS007); `Text` styles (OVE_DS005) for StatusText.

## 8. Architecture and code placement

`packages/ui-kit/src/indicators/{StatusDot,StatusText,StepRing,Port}/`. Each is one tiny, stateless component (SRP). State -> colour resolution happens only in CSS through `data-state` selectors reading `--om-state-*` tokens (OCP: a new state is a token + selector).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). These components encode the state of Agents and Approvals; the tests assert the pairing rule (StatusText always renders text; StatusDot without `label` is `aria-hidden` and the story documents the required adjacent text), preventing a colour-only 'waiting for approval' signal.

## 10. Errors and edge cases

- Unknown `state` (JS): neutral grey dot, dev warning.
- `glow` on a 6px dot inside overflow-hidden rows: glow clipped; documented, rows use padding.
- Both `state` and `tone`: type error; at runtime `state` wins.
- Long status text: `StatusText` truncates with ellipsis when its container has `min-width: 0`.
- Reduced motion: no pulse, glow remains static.

## 11. Acceptance criteria

- [ ] `StatusDot` sizes 6/8/10 and shapes circle/square (radius 2) measure exactly; colours per state match 5.1 (`expectToken`); idle and paused have no `box-shadow`.
- [ ] Working dot has the pulse class and no animation under reduced motion (Playwright emulation).
- [ ] `StatusText` renders glyph + text for the five mock states; text colours match `--om-state-*-text`; glyph is `aria-hidden`.
- [ ] `StepRing check` done/waiting/skipped and `step` active/pending/done match 5.3 (box sizes 26/28, border widths 2/1.5, glow).
- [ ] `Port` is 14px with a 2.5px border in the Visibility colour; fill `#0A0710`.
- [ ] Stories: one per component and variant, `Matrix` (states x sizes), `ApprovalKindMarkers`; axe clean.
- [ ] Visual: stories reproduce the Agent rows dots (`design.png`), check rows (`design-checkrows.png`) and system status rows (`design-system-status.png`) within structural tolerance.

## 12. Test plan

Vitest: `StatusDot.test.tsx`, `StatusText.test.tsx`, `StepRing.test.tsx`, `Port.test.tsx` (attributes, a11y variants, state mapping table). Playwright: boxes/computed styles/crops. Commands: `pnpm --filter @overmind/ui-kit test indicators`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. OVE_DS016 (Avatar) and OVE_DS018 (StatusPill) depend on this task.

## 14. Open questions and assumptions

- ASSUMPTION: skipped ring keeps the grey glow as drawn (contradicts the 'grey never glows' rule used elsewhere); remove the glow if designers agree.
- ASSUMPTION: `needs-login` renders like `waiting` (amber diamond).
- Open (inventory open question 6): unread-notification dot is a plain `StatusDot tone="magenta" size={8}` (decided in OVE_DS033).
