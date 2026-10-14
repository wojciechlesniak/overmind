---
id: OVE_DS016
title: "Avatar and AvatarStack (blob, 10 sizes, 8 hues, ring, status dot, stack ring)"
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS003, OVE_DS004, OVE_DS007, OVE_DS008, OVE_DS020, OVE_DS038]
soft_depends_on: []
provides: [ui:Avatar, ui:AvatarStack]
needs: []
owns: [packages/ui-kit/src/avatars/Avatar/**, packages/ui-kit/src/avatars/AvatarStack/**, packages/ui-kit/src/avatars/initials.ts]
reads: []
design: design.png
design_source: "Chief#chief/conversation-list (crop 72,117,270,380); design-stack Pulpit#dash/workspace-card-agent-stack (crop 100,440,490,70)"
spec_refs: [SPECIFICATION 4]
adr_refs: [23, 28]
---

# OVE_DS016: Avatar and AvatarStack (blob, 10 sizes, 8 hues, ring, status dot, stack ring)

## 1. Summary

Implement the organic-shape Agent `Avatar` (radial gradient per Agent hue, glow, initials, ring and status-dot variants) in the 10 sizes of the mocks, a deterministic initials helper, and `AvatarStack` with the separating ring fix of inventory E14 and a "+N" overflow chip.

## 2. Context

The avatar blob (`border-radius: 42% 58% 55% 45% / 48% 42% 58% 52%`) is the brand's "cell". There are 8 Agent hues (OVE_DS003); Dynamic Agents have no mock colour and get a deterministic hue from `hueForId` (never `chief`). Initials are `ink` JetBrains Mono 700. The mock stacks avatars with -6px overlap and no separator, so glows merge (E14). Sizes in the mocks: 22, 24, 26, 28, 34, 36, 40, 44, 48, 56 with initial sizes 10 (22-28), 11 (34), 12 (36), 13 (40), 14 (44), 16 (48), 18 (56). Used in 17 of 18 views.

## 3. Scope (in)

- `Avatar`, `AvatarStack`, `initialsFor(name)` helper, stories, tests, visual checks.

## 4. Out of scope

- Dot component itself: OVE_DS020. Model pill (avatar with ring + model name): OVE_DS018. Agent rows and chat bubbles: OVE_DS033 and DS part 2.
- Per-Agent colour override stored by the Owner: not in MVP (open question).

## 5. Detailed requirements

**5.1 API**
```ts
type AvatarSize = 22 | 24 | 26 | 28 | 34 | 36 | 40 | 44 | 48 | 56;
interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  initials: string;                    // 1-2 characters, rendered as given (uppercased by caller / initialsFor)
  hue?: AgentHueKey;                   // explicit hue
  agentId?: string;                    // used when hue is absent: hueForId(agentId)
  size?: AvatarSize;                   // default 34
  ring?: 'public' | 'private' | 'lane' | 'discussion';   // wrapper ring in Visibility colour
  status?: AgentState;                 // overlay StatusDot
  glow?: boolean;                      // default true
  label?: string;                      // role="img" aria-label; otherwise aria-hidden
}
```
1. Exactly one of `hue` / `agentId` is expected; if neither, hue = `chief` is NOT assumed: dev warning and `designer`-free fallback `developer`. Chief avatars are always `hue="chief"` explicitly.
2. Visual (exact): width = height = size; shape `--om-radius-blob`; `background: radial-gradient(circle at 35% 30%, var(--om-hue-<key>-light), var(--om-hue-<key>-dark))`; glow `box-shadow: 0 0 var(--om-glow-avatar-blur, 14px) var(--om-hue-<key>-glow)` (`<dark>66`); initials `color: var(--om-color-ink)`, font mono 700, size by table (10 for 22-28, 11 for 34, 12 for 36, 13 for 40, 14 for 44, 16 for 48, 18 for 56), `line-height: <size>px`, `text-align: center`, `flex-shrink: 0`. `glow={false}` removes the shadow (use inside crowded stacks).
3. `ring`: wrapper `display: inline-flex; border-radius: 50%; border: 2px solid <Visibility colour>` around the avatar (model pill on a node: 26px avatar in a 30px ring); no extra padding.
4. `status`: `StatusDot` (OVE_DS020) at the bottom-right: size 8 for avatars >= 34, 6 below, positioned `right: -1px; bottom: -1px` (the mock places a dot at left/top = avatar size on a 34px avatar, i.e. its top-left corner on the avatar's bottom-right corner; the implementation is inset by half the dot so it stays inside the 34px row), with a 2px separator ring in `--om-avatar-surface` (default `--om-color-bg-app`) added to the dot's box-shadow before its glow.
5. `initialsFor(name: string): string`: (a) trim, collapse spaces; (b) `'Chief'` (case-insensitive) -> `'C'`; (c) two or more words -> first letter of the first two words uppercase (`Product Owner` -> `PO`, `Senior Reviewer` -> `SR`); (d) one word of <= 2 letters -> uppercase (`QA`); (e) one longer word -> first letter uppercase + the first consonant after it lowercase (`Security` -> `Sc`, `Developer` -> `Dv`, `Designer` -> `Ds`, `Researcher` -> `Rs`; if no consonant, the second letter); (f) Unicode-safe (uses `Intl.Segmenter` graphemes; Polish letters count as letters/consonants via a consonant set that includes `ćłńśźż`); empty input -> `?`.
6. A11y: decorative by default (the name is always written next to it). `label` makes it `role="img"`. Contrast: `ink` initials on every hue light stop >= 7 (test over the 8 hues' mid colour).
**5.2 `AvatarStack`**
```ts
interface AvatarStackProps { avatars: Pick<AvatarProps, 'initials' | 'hue' | 'agentId' | 'label'>[]; size?: 22 | 24 | 26 | 28; max?: number /* default 4 */; surface?: 'surface' | 'app' | 'raised' | 'panel'; overflowLabel?: string; label?: string }
```
7. Layout: inline-flex, each avatar after the first has `margin-left: -6px`; each avatar gets a 2px separator ring in the card background colour: `box-shadow: 0 0 0 2px var(--om-stack-surface), <glow>` (`surface` maps to `bg-surface` (default), `bg-app`, `bg-raised`, `bg-panel`); glows are reduced to 8px blur inside stacks to avoid merging (E14). Z-order: later avatars below earlier ones (first on top).
8. Overflow: when `avatars.length > max`, show `max` avatars and a chip of the same size with text `+N` (mono 11/500, `text-secondary` on `bg-raised`, same blob shape without glow, ring as above); the chip has `aria-label={overflowLabel}` (caller formats "3 more agents").
9. Container `role="group"` with `aria-label={label}` when provided; individual avatars use their `label` as `role="img"`.

## 6. Design notes

`design.png`: Chief conversation list: Chief avatar 40px (`C`, hue chief) in the selected Chief row, Agent rows with 34px avatars (QA magenta-pink, Security amber, Developer violet, Product Owner mint) and initials in mono 700 (`QA`, `Sc`, `Dv`, `PO`), status dots at the avatar corner. `design-stack.png`: 26px stack in a Workspace card (the mock collapses/overlaps; implementation uses the E14 ring and +N). Not in mocks: stack ring, `+N` chip, ring variant (visible only on canvas model pill), hover (avatars are not interactive).

## 7. Reuse

Hue tokens and `hueForId` (OVE_DS003); `StatusDot` (OVE_DS020); mono text token for initials (OVE_DS004); radius blob token (OVE_DS006); glows (OVE_DS007); `UiLabels` is not required here (all text is props).

## 8. Architecture and code placement

`packages/ui-kit/src/avatars/` (`Avatar`, `AvatarStack`, `initials.ts`). Pure presentational; hue resolution through tokens, size table through a CSS attribute map (`[data-size='34']`).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Avatar identity must not rely on colour alone (initials present). `agentId` is hashed only; no identifier is rendered into the DOM (no `title` with ids).

## 10. Errors and edge cases

- `initials` longer than 2 characters: truncated to 2 graphemes, dev warning.
- Missing hue and agentId: dev warning, fallback hue `developer`.
- Size not in the union (JS): nearest listed size.
- Stack with 0 avatars: renders nothing; with 1: no negative margin.
- Very long `max`: allowed; container wraps nowhere (`flex-wrap: nowrap`).

## 11. Acceptance criteria

- [ ] Each of the 10 sizes renders a box of that size with initial font sizes per 5.1 item 2 (Playwright computed styles).
- [ ] Gradient and glow use the hue tokens (8 hues, `expectToken` on the gradient end colours).
- [ ] `agentId` picks a hue via `hueForId`, stable across renders; never `chief`.
- [ ] `ring` shows a 2px ring in the Visibility colour around a 26px avatar (30px outer).
- [ ] `status` shows an 8px/6px dot at the corner with a 2px separator.
- [ ] `initialsFor` golden table: Chief->C, QA->QA, Security->Sc, Developer->Dv, Product Owner->PO, Designer->Ds, Senior Reviewer->SR, Researcher->Rs, `Łukasz`->`Łk`, ``->`?`.
- [ ] `AvatarStack`: -6px overlap, 2px separator in the surface colour, `max` and `+N` chip, group label.
- [ ] Stories: `Sizes`, `Hues`, `Ring`, `WithStatus`, `Stack`, `StackOverflow`, `Matrix`; axe clean.
- [ ] Visual: `ChiefList` story (avatars + dots in rows) matches `design.png`, `WorkspaceStack` matches `design-stack.png` (structural).

## 12. Test plan

Vitest: `Avatar.test.tsx`, `AvatarStack.test.tsx`, `initials.test.ts` (golden + Unicode), hue determinism. Playwright: sizes, glow, ring/stack visuals and crops. Commands: `pnpm --filter @overmind/ui-kit test avatars`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Consumers: OVE_DS018 (ModelPill), OVE_DS033 (rows), many DS part 2 tasks.

## 14. Open questions and assumptions

- ASSUMPTION: initials rule (5.1 item 5) reverse-engineered from the 8 mock names; Owner may want explicit initials per Agent (then the caller passes `initials` and ignores the helper).
- Open (inventory E13/question 1): hue palette changes land in OVE_DS003 only.
- ASSUMPTION: stack glows reduced to 8px.
