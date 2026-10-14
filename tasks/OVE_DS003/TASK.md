---
id: OVE_DS003
title: "Colour tokens II: accent families, alpha tints, state and Visibility maps, Agent hues"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS001, OVE_DS039, OVE_DS002]
soft_depends_on: []
provides: [ui:tokens-color-accent]
needs: []
owns: [packages/ui-kit/src/tokens/colors-accent.tokens.ts, packages/ui-kit/src/tokens/colors-alpha.tokens.ts, packages/ui-kit/src/tokens/colors-semantic.tokens.ts, packages/ui-kit/src/tokens/hues.ts, packages/ui-kit/src/tokens/__tests__/colors-accent.test.ts, packages/ui-kit/src/tokens/stories/ColorsAccent.stories.tsx]
reads: []
design: none
design_source: ""
spec_refs: [SPECIFICATION 7, SPECIFICATION 9]
adr_refs: [28]
---

# OVE_DS003: Colour tokens II: accent families, alpha tints, state and Visibility maps, Agent hues

## 1. Summary

Define the seven accent colour families (magenta, violet, mint, amber, blue, cyan, error) with their light-text, dark and tint values, the full set of alpha tints used by the mocks as `color-mix()` tokens (inventory E12), the semantic State map (working, waiting, done, idle, failed, paused...), the Visibility map (public/private/lane/discussion, ADR 0028) and the 8 Agent avatar hues with a deterministic hue picker for dynamic Agents.

## 2. Context

Accents carry meaning, not decoration: magenta = Chief and "working", amber = waiting for the Owner (Approval or Access Request), mint = done/ok, violet = primary action and selection and PRIVATE, blue = PUBLIC, error = failed or blocked (`docs/design/styl-wizualny.md` palette). State colours are always paired with a word or glyph, and Visibility is always a word (ADR 0028), so these tokens never stand alone as the message. The mocks use ~139 distinct colour literals; this task reduces them to named tokens.

## 3. Scope (in)

- `colors-accent.tokens.ts`: family colour steps and dedicated fills/borders (5.1).
- `colors-alpha.tokens.ts`: alpha tint tokens generated from a table through a helper (5.2).
- `colors-semantic.tokens.ts`: State map, Visibility map, node tile fills, severity mapping (5.3-5.4).
- `hues.ts`: Agent hue table (typed, exported) and `hueForId(id: string): AgentHueKey` (5.5), exported also through `@overmind/ui-kit/tokens`.
- Swatch story, unit tests including contrast checks and the hue picker.

## 4. Out of scope

- Neutral surfaces, lines and text colours: OVE_DS002.
- Avatar component and glow rendering: OVE_DS016 (uses `--om-hue-*`); glow shadows: OVE_DS007.
- Re-hue of Designer and Product Owner (inventory E13): not done, kept as in the mock until the Owner decides (open question 1).

## 5. Detailed requirements

**5.1 Family steps (exact).** `--om-color-<family>-<step>`; step numbers follow the inventory (`500` hot, `300` light text, `700` dark/gradient end).
| Family | Variable and value |
|---|---|
| magenta | `-500` `#F25FC4`; `-300` `#FFB3E6` (text); `-200` `#FFD3F1` (only the pause button text); `-400` `#FF9BDD` (only Chief avatar gradient light); `-600` `#E0479F` (QA avatar dark); `-700` `#C23FA0` (Chief avatar dark); `-logo-start` `#FF8AD8` (logo gradient start only) |
| magenta fills | `--om-color-magenta-bg-pause` `#2A1026`; `-border-pause` `#5A2A4F`; `-bg-chief-start` `#2A1130`; `-bg-chief-row-end` `#1A1029`; `-bg-callout` `#1F0F25`; `-bg-wizard-card` `#22102A`; `-bg-login` `#120A18`; `-bg-global-pause` `#1C0B19`; `-track-progress` `#3A1C3A` |
| violet | `-500` `#9B7BFF`; `-300` `#D6C9FF`; `-400` `#C9B8FF`; `-600` `#7A55E8` (Developer avatar dark); `-line` `#5B3E8F` is `--om-color-line-strong` (do not duplicate); canvas violet `#5B4596` is `--om-color-line-canvas` |
| mint | `-500` `#62E3B4`; `-300` `#B8F5DD`; `-250` `#BFF3DF` (canvas frame label only); `-700` `#3FBF8F` (PO avatar dark); `-bg-lane` `#08171A`; `-bg-ok` `#10161A` |
| amber | `-500` `#FFB547`; `-300` `#FFCF85`; `-200` `#FFE2B5` (outline button text); `-700` `#D98A1C` (Security avatar dark); `-600` `#E09A2E` (Designer avatar dark); `-line` `#6B4E22` (outline button border); `-body` `#E9D2AE` (text on amber callouts); `-bg-card-from` `#2A1D0C`; `-bg-card-to` `#170F1A` (Approval card gradient end); `-bg-callout` `#1E160A`; `-bg-pill` `#22180A` |
| blue | `-500` `#6FA8FF`; `-300` `#B9D3FF`; `-700` `#5B7FD6`; `-bg-tile` `#0B1424` |
| cyan | `-500` `#3AA6C8`; `-300` `#C2F0FF` |
| error | `-500` `#FF8FA3`; `-300` `#FFC2CD`; `-line` `#6A2A3A`; `-bg-button` `#2A0F18`; `-bg-card` `#1A0B12`; `-bg-rule` `#1E0E16` |
Node tile fills (one per kind): `--om-color-node-fill-public` `#0B1424`, `-private` `#130C22`, `-lane` `#08171A`, `-discussion` `#140F22`.
Near-duplicates dropped (E11): `#FF8AD8`/`#FF9BDD`/`#FFD3F1` exist ONLY under the restricted names above; `#BFF3DF` only as `mint-250`.

**5.2 Alpha tints (E12: no raw `rgba()` in components).** Variable `--om-color-<family>-a<NN>` = `color-mix(in srgb, var(--om-color-<family>-500) NN%, transparent)` where NN is the percentage with 2 digits. Generated from this table by a local helper `alphaSet(family, [...])`:
| Family | Alphas (percent) |
|---|---|
| magenta | 05, 06, 07, 10, 12, 15, 16, 18, 22, 30, 35, 40, 45, 50, 55 |
| violet | 04, 08, 12, 14, 16, 25, 28 |
| mint | 04 (mock `.035`, normalised), 06, 08, 12, 35, 50 |
| amber | 12, 14, 18, 35, 50 |
| blue | 10 |
| error | 08, 50 |
Plus `--om-color-black-a25` (`rgba(0,0,0,.25)` hatch stripes), `--om-color-black-a60` (popover shadow), `--om-color-violet-a14` etc. are in the table above. Hex-with-alpha forms (`#E0479F66`, `#3AA6C866`) are replaced by `--om-hue-<key>-glow` (5.5). The mapping from each mock usage to a token is documented in the story (for example "selected Skill card ring = `violet-a14`", "working Workspace card border = `magenta-a45`", "drop zone fill = `magenta-a05`", "Approvals button border = `amber-a50`").

**5.3 State map (semantic; used by StatusDot, StatusText, StatusPill, node glow)**
For each state: `--om-state-<state>-color` (dot/glyph/ring), `-text` (light text on dark), `-tint` (fill) and `-border`.
| State | color | text | tint | border | Meaning |
|---|---|---|---|---|---|
| `working` | magenta-500 | magenta-300 | magenta-a12 | magenta-a40 | Agent working, Run running |
| `waiting` | amber-500 | amber-300 | amber-a12 | amber-a35 | waiting for an Approval or Access Request |
| `done` | mint-500 | mint-300 | mint-a12 | mint-a35 | finished, passed, ready |
| `idle` | text-muted `#8C80A6` | text-muted | transparent | line | idle, skipped, unknown, queued |
| `failed` | error-500 | error-300 | error-a08 | error-a50 | failed, blocked, refusal |
| `paused` | text-muted | text-secondary | transparent | line | paused by the Owner (grey, no glow) |
| `reviewing` | violet-500 | violet-300 | violet-a14 | line-strong | Task in Review |
| `needs-login` | amber-500 | amber-300 | amber-a12 | amber-a35 | CLI needs re-login (ASSUMPTION: amber because the Owner must act) |
Dot glow is defined in OVE_DS007 (`--om-glow-dot-<state>`); only `working`, `waiting`, `done`, `failed` glow (inventory A.1.3).

**5.4 Visibility map (ADR 0028)**
`--om-visibility-public-color` blue-500, `-text` blue-500, `-tile` `#0B1424` (node fill public); `--om-visibility-private-color` violet-500; `-lane-color` mint-500; `-discussion-color` violet-400 (`#C9B8FF`). Text on these fills is `--om-color-on-badge`. (E31: colour follows the option everywhere.)

**5.5 Agent hues (8, exact; inventory E13 re-hue NOT applied yet)**
`--om-hue-<key>-light`, `--om-hue-<key>-dark`, `--om-hue-<key>-glow` (= dark at 40%, equals `<dark>66`).
| key | light | dark |
|---|---|---|
| chief | `#FF9BDD` | `#C23FA0` |
| qa | `#FFB3E6` | `#E0479F` |
| security | `#FFD69A` | `#D98A1C` |
| developer | `#C9B8FF` | `#7A55E8` |
| product-owner | `#B8F5DD` | `#3FBF8F` |
| designer | `#FFE0A8` | `#E09A2E` |
| senior-reviewer | `#B9D3FF` | `#5B7FD6` |
| researcher | `#C2F0FF` | `#3AA6C8` |
`hues.ts` exports `agentHues` (the table as typed `as const`), `type AgentHueKey`, and `hueForId(id: string): AgentHueKey`: FNV-1a 32-bit hash of the UTF-8 id, `agentHues` order excluding `chief` (7 candidates: qa, security, developer, product-owner, designer, senior-reviewer, researcher), index = `hash % 7`. Deterministic across sessions and platforms; Chief always maps to `chief` and nothing else may use the chief hue. (The Owner may later override a hue per Agent; storage is not part of ui-kit.)

**5.6 Contrast contract (tested; extends OVE_DS002)**: text-300 steps on `bg-surface`: magenta-300 >= 11 (11.48), amber-300 >= 12 (12.97), mint-500 >= 11 (11.77), error-500 >= 8.6 (8.68), violet-300 >= 12 (12.21), blue-500 >= 7.7 (7.79); filled-button text: `ink` on violet-500 >= 6.1, `ink` on magenta-500 >= 6.6, `ink-amber` on amber-500 >= 10.6, `on-badge` on blue-500 >= 8.3, on violet-500 >= 6.3, on mint-500 >= 12.5, on violet-400 >= 11.2; violet-500 and magenta-500 as UI-component colours on `bg-app` >= 6.3 (focus ring 3:1 satisfied).

## 6. Design notes

N/A for crops. The swatch story shows each family as a row: hot, light, dark, fills, alpha ramp, with the mock usage captions. Reference renders: `Pulpit` (Workspace card with magenta border), `Chief` (Approval card amber), `Main` (node tab blue/violet/mint).

## 7. Reuse

`defineTokens` (OVE_DS039); `contrast()` helper from OVE_DS002's tests (import from `src/tokens/__tests__/contrast.ts`, a test-only module owned by OVE_DS002).

## 8. Architecture and code placement

Pure data and one pure function (`hueForId`) in `src/tokens/`. State and Visibility maps are tokens, not TypeScript enums, so components select them through `data-state` / `data-visibility` attribute selectors in CSS (OCP: a new state is a new token block plus a CSS selector, no switch statements).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`).
Specific: the semantic maps encode security-relevant meaning (amber = waiting for the Owner; Visibility words). The unit test asserts that `waiting` and `working` are never the same colour and that public/private colours differ, so a careless palette edit cannot make a Private item look Public. `hueForId` must not leak identifiers (it only hashes) and must not use `Math.random()` or `Date`.

## 10. Errors and edge cases

- `hueForId('')`: returns a valid key (hash of empty string), never throws.
- Unicode ids hash by UTF-8 bytes so two platforms agree.
- A family used by a component but missing a step (for example `cyan-700`): the unresolved-reference check in OVE_DS039 fails the build; add the step through a proposal, do not inline a hex.
- Two Agents hashing to the same hue: expected and allowed (only 7 slots); avatars always carry initials so identity is not colour-only.

## 11. Acceptance criteria

- [ ] All variables in 5.1-5.5 exist with exact values; alpha tokens expand to `color-mix(in srgb, <500> NN%, transparent)`.
- [ ] No raw `rgba()` or `#RRGGBBAA` remains in tokens or components (guard).
- [ ] State map has the 8 states with `color/text/tint/border`; `working` != `waiting` != `done` != `failed` (test).
- [ ] Visibility map: `public` is blue-500 and `private` is violet-500; the lane and discussion colours match 5.4.
- [ ] `hueForId` golden test: ids `agent_01HZX`, `agent_01HZY`, `dyn-qa-2`, `` produce fixed keys listed in the test and never `chief`; distribution over 1000 generated ULIDs uses all 7 hues (each between 8% and 22%).
- [ ] The contrast matrix in 5.6 passes in CI.
- [ ] Swatch story renders all families, alpha ramps and the 8 hue gradients; axe clean.

## 12. Test plan

Vitest: `colors-accent.test.ts` (table-driven values), `alpha.test.ts` (expansion formula), `semantic.test.ts` (state/visibility invariants), `hues.test.ts` (golden + distribution + determinism), `contrast-accent.test.ts`. Story `Foundation/Colours/Accents`. Commands: `pnpm --filter @overmind/ui-kit test tokens`.

## 13. Parallelization notes

Parallel with OVE_DS004/006/007. It reads `tokens.css` variables created by OVE_DS002 only by name; no file overlap. Hotspot: none.

## 14. Open questions and assumptions

- Open 1 (inventory E13): Security and Designer hues are nearly identical, and amber also means "waiting". Default until the Owner decides: keep the mock values above. If re-hued, only the `designer` and `product-owner` rows of the table change (proposal values: designer `#9FE8E0`/`#2FA39A`, PO `#C9F0A0`/`#6FBF4A`).
- Open (inventory open question 6): unread-notification look. Default: bold title plus an 8px magenta-500 dot (decided in OVE_DS033).
- ASSUMPTION: `needs-login` is amber (the Owner must act), not magenta.
- ASSUMPTION: percentage-only alpha names (`a22`) are fine; the mock's `.035` becomes `a04`.
