---
id: OVE_DS033
title: "ListRow base, ConversationRow, NotificationItem and StatusRow"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS007, OVE_DS008, OVE_DS012, OVE_DS038, OVE_DS005, OVE_DS009, OVE_DS016, OVE_DS019, OVE_DS020, OVE_DS031]
soft_depends_on: []
provides: [ui:ListRow, ui:ConversationRow, ui:NotificationItem, ui:StatusRow]
needs: [ui:icons]
owns: [packages/ui-kit/src/lists/ListRow/**, packages/ui-kit/src/lists/ConversationRow/**, packages/ui-kit/src/lists/NotificationItem/**, packages/ui-kit/src/lists/StatusRow/**]
reads: []
design: design.png
design_source: "Chief#chief/conversation-list (box 72,117,270,783: Chief row + Agent rows); design-notifications Pulpit#dash/notifications-list (box 1141,122,279,317)"
spec_refs: [SPECIFICATION 9, SPECIFICATION 7]
adr_refs: [23]
---

# OVE_DS033: ListRow base, ConversationRow, NotificationItem and StatusRow

## 1. Summary

Implement the row primitives of conversation and notification lists: generic `ListRow` (leading / title / subtitle / trailing, selected, interactive), `ConversationRow` (Agent, Chief and Discussion rows with avatar, state dot, state line, unread count), `NotificationItem` (five kinds, age, unread) and `StatusRow` (label + value with a dot).

## 2. Context

Inventory B13. In the Chief view the left list shows the Chief row (gradient card, r18, avatar 40, title 15/700, two-line summary) and Agent rows (avatar 34 + state dot, title 14/600, state text 12px; QA "pracuje . testy e2e koszyka" magenta; Security "czeka na Zgode" amber with a count badge "1"; Developer "skonczyl . 4 pliki" grey; Product Owner "bezczynny" grey). Mock vs inventory conflict: the done row's state line is secondary grey `#A79BBF` in the mock (not mint): FOLLOW THE MOCK. The count badge is amber (E10; mock draws magenta). Notifications (Workspaces right panel): five kinds with a coloured 16px icon, title 13/600, subtitle 12px, age mono 11, bottom hairline. The mock does not draw unread/read (open question 6): assumption in 5.4.

## 3. Scope (in)

- Four components + shared `listRow.module.css`, stories (one per variant incl. all state lines), tests, visual checks.
- No data fetching, no routing; `as` accepts a router link.

## 4. Out of scope

- `DecisionRow`, `RunRow`, `ApprovalRow`, `SkillPaletteItem`: OVE_DS034. `SettingRow`: DS part 2 (UI-50). `TrayItem`: `MenuItem` (OVE_DS029).
- `ConversationList` container, sections and search: DS part 2 (UI-32). `NotificationCenter`: DS part 2 (UI-41).

## 5. Detailed requirements

**5.1 `ListRow`**
```ts
interface ListRowProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  leading?: ReactNode; title: ReactNode; subtitle?: ReactNode; trailing?: ReactNode; selected?: boolean; interactive?: boolean; as?: ElementType; href?: string; density?: 'default' | 'compact' }
```
Geometry: `display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 14px; border: 1px solid transparent; width: 100%; text-align: left; box-sizing: border-box`; title Bricolage 14/600 `text-primary` (single-line ellipsis); subtitle 12px/1.3 `text-secondary`; `trailing` aligned right (`margin-left: auto`, `flex-shrink: 0`). `selected`: fill `bg-surface-sel` `#1A1422`, `border-color: line-strong` `#5B3E8F`, `aria-current="true"` (the Direct-chat mock draws the border as `#2A2040`; inventory says `#5B3E8F`: use `#5B3E8F`).
**5.2 `ConversationRow`**
```ts
type ConversationKind = 'chief' | 'agent' | 'discussion';
interface ConversationRowProps extends Omit<ListRowProps, 'leading' | 'title' | 'subtitle' | 'trailing'> {
  kind: ConversationKind; name: string; initials: string; hue?: AgentHue; agentId?: string; state?: AgentState; stateText?: ReactNode; unread?: number; unreadLabel?: string; }
```
- `agent`: `Avatar size=34` (OVE_DS016) with a status dot overlay when state is working/waiting/done (`StatusDot size=8`, ring in `bg-panel`); idle shows no dot. Title `name`; subtitle `stateText` coloured by state: working `magenta-300` `#FFB3E6`, waiting/needs-login `amber-300` `#FFCF85`, failed `error-500`, reviewing `violet-300`; done and idle `text-secondary` (mock). Trailing: `CountBadge` amber (OVE_DS019) when `unread > 0` with `label=unreadLabel`.
- `chief`: renders inside `Card tone="chief-row"` geometry: padding 12, radius 18, gap 12, `Avatar size=40`, title 15/700, subtitle up to two lines 12/1.35 `text-body-soft` `#E3DAF0` (E11 maps `#D9C7EA`); selected state adds `--om-ring-select`.
- `discussion`: leading is a 34px rounded-14 tile `bg-raised` with `discussion` icon 16 `text-lavender-strong`; border style dashed `violet-500` at 50% (mock "Live Discussion" row), subtitle `stateText`.
- Unread: besides the badge, title weight 700 (assumption, 5.4). The whole row is a single `button`/`a` with the accessible name `"{name}. {stateText}. {unreadLabel}"` built by the component from props (no hard-coded words).
**5.3 `NotificationItem`**
```ts
type NotificationKind = 'approval' | 'access' | 'discussion' | 'run' | 'escalation';
interface NotificationItemProps { kind: NotificationKind; title: ReactNode; subtitle?: ReactNode; age: string; unread?: boolean; onSelect?: () => void; href?: string }
```
Row: padding `10px 0`, `border-bottom: 1px solid line-subtle` `#241B36` (last child none), gap 10, align start. Icon 16px by kind: `approval` `shield-check` amber-500, `access` `folder-plus` magenta-500, `discussion` `discussion` `text-lavender-strong`, `run` `check` mint-500, `escalation` `warning` error-500 (pulse, R). Title 13/600, subtitle 12px `text-secondary`, age mono 11 `text-muted` right aligned. Interactive when `onSelect/href` given (hover fill `hover-from-transparent`, ring inset, radius 10 with negative horizontal margin -8 to keep text aligned).
**5.4 Unread/read (assumption, open question 6)**: unread = title 700, a 6px `violet-500` dot after the title, `aria-label` prefix from props; read = title 600, no dot. Kind icon colour never changes.
**5.5 `StatusRow`**: `{ label: ReactNode; value: ReactNode; state?: 'ok' | 'warn' | 'error' | 'off' }`; gap 8, 13px `text-primary`; `StatusDot size=6` (mint for ok, amber, error, neutral) before the label, value right-aligned mono 12/400 `text-secondary`. Dot carries no meaning alone: the `value` text states it (docs).
**5.6 States (all interactive rows)**: hover fill `hover-from-transparent` (selected rows `hover-from-selected`); focus-visible `--om-ring-focus-inset`; active brightness 1.04; disabled opacity .55 `aria-disabled`; loading uses `ConversationRowSkeleton` (OVE_DS032).
**5.7 a11y**: lists are `<ul role="list">` of `<li>` provided by the container; rows are buttons/links (never both); `aria-current` for the open conversation; contrast: state text colours on `#0D0915`/`#1A1422` >= 4.5:1 (unit test); `#8C80A6` age text on panel 5.1:1.

## 6. Design notes

`design.png`: the Chief gradient row (avatar 40, "Security czeka na Twoja Zgode") and four Agent rows with state dots and state lines, the Security row carrying the "1" badge (magenta in the mock, amber by default here; the visual test passes `tone="magenta"` through an internal story arg to compare). `design-notifications.png`: notification items with coloured icons, titles, subtitles and ages. Not drawn: unread/read, discussion row, loading, disabled.

## 7. Reuse

`Avatar` (OVE_DS016), `StatusDot` (OVE_DS020), `CountBadge` (OVE_DS019), `Card chief-row` (OVE_DS031), `Icon` (OVE_DS009), `Text` styles (OVE_DS005).

## 8. Architecture and code placement

`packages/ui-kit/src/lists/<Name>/` with `lists/_shared/listRow.module.css`. Rows are layout and presentation only (no Agent registry knowledge): state colours come from `data-state` and the Agent hue from the Avatar.

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Row text (Agent names, notification titles) is untrusted: rendered as text, ellipsized; `href` goes through `safeHref` (OVE_DS022). The accessible name is composed from props only.

## 10. Errors and edge cases

- `unread` > 99: badge shows 99+. `unread` 0: no badge, no bold.
- Missing `stateText` with a non-idle state: dev warning (colour-only state).
- Long names: ellipsis, trailing never shrinks.
- Row used as link and button: type error (`href` xor `onClick`).

## 11. Acceptance criteria

- [ ] Every variant, size and state in section 5 exists as a story (`ListRow/ConversationRow/NotificationItem/StatusRow` stories: one per variant, a `Matrix` story with `data-visual-state` cells, `Disabled`, `Playground`) and passes the axe sweep (OVE_DS012) with no violations.
- [ ] Computed styles (`expectComputed`) and boxes (`expectBox`) match the exact values of section 5 within 0.5px.
- [ ] No raw colour literal, no `outline: none` without the ring replacement, no `!important`, no hard-coded user-visible string (guards of OVE_DS001 pass).
- [ ] Keyboard and focus behaviour of section 5 is covered by user-event tests; focus ring uses `--om-ring-focus`.
- [ ] Visual test against `design.png` passes the structural tolerance of OVE_DS012.
- [ ] Agent row padding 9/10, r14, gap 10, avatar 34, title 14/600; selected `#1A1422` with `#5B3E8F` border.
- [ ] Chief row r18 padding 12 gradient via tokens, avatar 40, title 15/700.
- [ ] State line colours: working `#FFB3E6`, waiting `#FFCF85`, done/idle `#A79BBF` (mock), failed `#FF8FA3`.
- [ ] Count badge amber by default; NotificationItem kinds map to the five icons/colours; bottom hairline `#241B36`.
- [ ] Accessible names composed from props; no colour-only state.

## 12. Test plan

- Vitest + Testing Library + user-event in `lists/(ListRow|ConversationRow|NotificationItem|StatusRow).test.tsx`: props to attributes/classes, all variants render, keyboard map, disabled and loading do not fire handlers, `jest-axe` has no violations.
- Playwright visual: story `Matrix` screenshot per variant (baselines in Docker, OVE_DS012), `expectBox`/`expectComputed` for the numbers in section 5, structural comparison with `design.png` crop.
- Commands: `pnpm --filter @overmind/ui-kit test lists` and `pnpm --filter @overmind/ui-kit test:visual lists`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. OVE_DS034 imports `listRow.module.css` conventions from `lists/_shared` (created here).

## 14. Open questions and assumptions

- ASSUMPTION (E10): amber count badge; the mock's magenta is a documented deviation.
- ASSUMPTION (open question 6): unread = bold title + 6px violet dot.
- Mock vs inventory: done state text is grey in the mock; followed.
- ASSUMPTION: StatusRow dot is 6px as drawn in the crop (inventory says 8).
