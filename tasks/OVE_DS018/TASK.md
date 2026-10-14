---
id: OVE_DS018
title: "Domain pills: SkillChip, OriginTag, PositionTag, StatusPill, ValidationPill, ModelPill"
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS017, OVE_DS016, OVE_DS020, OVE_DS012, OVE_DS038, OVE_DS003]
soft_depends_on: []
provides: [ui:SkillChip, ui:SkillUsedChip, ui:OriginTag, ui:PositionTag, ui:StatusPill, ui:ValidationPill, ui:ModelPill]
needs: []
owns: [packages/ui-kit/src/badges/SkillChip/**, packages/ui-kit/src/badges/SkillUsedChip/**, packages/ui-kit/src/badges/OriginTag/**, packages/ui-kit/src/badges/PositionTag/**, packages/ui-kit/src/badges/StatusPill/**, packages/ui-kit/src/badges/ValidationPill/**, packages/ui-kit/src/badges/ModelPill/**]
reads: []
design: design.png
design_source: "Czat-Agent#agentchat/skill-used-chip (crop 366,700,624,75); extra crops design-skill-card, design-stance, design-run-pill"
spec_refs: [SPECIFICATION 8, SPECIFICATION 7]
adr_refs: [28]
---

# OVE_DS018: Domain pills: SkillChip, OriginTag, PositionTag, StatusPill, ValidationPill, ModelPill

## 1. Summary

Build the domain presets on top of `Pill`/`Avatar`: `SkillChip` (assigned Skills), `SkillUsedChip` ("used Skill" in chats), `OriginTag` (Skill origin: import/Owner/Chief), `PositionTag` (Discussion stance), `StatusPill` (the shared dot + word capsule for Run, Agent and Workspace state, E27), `ValidationPill` and `ModelPill` (avatar + model name on a Node). Also the magenta artifact tint (`skill-uses`) as `TintPill` examples.

## 2. Context

Inventory B2 variants `skill-chip`, `skill-used`, `origin`, `position`, `run`, `validation`, `model`, `skill-uses`; E27: one `StatusPill` (dot + word) for Run, Agent and Workspace states so Run/Agent states share shapes; Skills (ADR 0028, SPEC 8): each use records Skill name + version, `skill: X v2`; Skill origin tags tell where a Skill came from (import = amber tint, Owner = violet tint, Chief = magenta tint); Discussion positions (mint = for, grey = no preference, amber = conditional). Crops: "użyto Skilla: e2e-playwright v2" chip; Skill card with origin tag; Discussion stance pills; Workflow header Run pill ("Run #14 · działa · 18 min").

## 3. Scope (in)

- The seven components + a `TintPill` documentation story (not a new component: `Pill appearance="tint"`), stories, tests, visual checks.
- Props and exact values below.

## 4. Out of scope

- Pill base: OVE_DS017. Visibility/Node/Version/Count badges: OVE_DS019. Skill card, palette item, Discussion message composites: DS part 2 (UI-47, UI-52, UI-64).
- Skill name/version formatting ("v2") is the caller's string.

## 5. Detailed requirements

**5.1 `SkillChip`**: `interface SkillChipProps { name: string; version?: string; size?: 'sm' | 'md'; icon?: boolean }`. Violet tint without border: fill `violet-a14`, text `text-lavender`, mono 500; `sm` = 11px, padding 3 8; `md` = 12px, padding 5 10 (tight); optional leading `skill-cube` 12px icon (stroke 2). Renders `name` (+ ` v{version}` in the same chip when given, e.g. "e2e-playwright v2"). Truncates the name with ellipsis (`max-width: 100%`).
**5.2 `SkillUsedChip`**: `{ name: string; version: string }` -> text composed by the caller via `children` ("użyto Skilla: e2e-playwright v2"); `align-self: flex-start`; fill `violet-a14`, text `text-lavender`, mono 11/500, padding 4 9, radius 999. (Tint magenta artifact chip `skill-uses`, e.g. "e2e-trace.zip": use `<Pill appearance="tint" tone="magenta">` with fill `magenta-a10`, border `magenta-a35`, text `magenta-300`, mono 12/400; shown in a story named `ArtifactChip`.)
**5.3 `OriginTag`**: `origin: 'import' | 'owner' | 'chief'`, `children` label (caller i18n: "import", "Właściciel", "Chief"). Pill `appearance="tint"`, `size="xs"` (10px mono 500), padding 3 8: import = amber (`amber-a12`, text `amber-300`), owner = violet (`violet-a14`, `text-lavender`), chief = magenta (`magenta-a12`, `magenta-300`). No border for origin tags (mock shows fill only): `bordered={false}`.
**5.4 `PositionTag`**: `position: 'for' | 'neutral' | 'conditional'`, `children` label. Outline pill, mono 11/500, padding 3 8, border and text same colour: for = `mint-500`, neutral = `text-muted`, conditional = `amber-300`. Includes a glyph for non-colour meaning: for `glyph-check`, neutral `glyph-ring`, conditional `glyph-diamond` (12px) before the text.
**5.5 `StatusPill`** (E27)
```ts
interface StatusPillProps { state: AgentState; children: ReactNode; pulse?: boolean; size?: 'md' | 'sm' }
```
Composition: `Pill appearance="tint" density="tight"` + `StatusDot` (8px, glow per state) + text. Colours from the State map (`tint`, `border`, `text`): working = fill `magenta-a12`, border `magenta-a40`, text `magenta-300` (exactly the mock's Run pill, mono 12/500, padding 5 10); waiting amber; done mint; failed error; reviewing violet; idle and paused = `surface` appearance (no tint) with muted text and grey dot; the working dot pulses. Text is mandatory (caller i18n: "działa · 18 min", "pracuje"). Replaces the separate Run pill, Agent state pill (28px high) and Workspace state words.
**5.6 `ValidationPill`**: `{ valid: boolean; children }` -> valid = mint tint (`mint-a12`, border `mint-a35`, text `mint-300`, glyph-check), invalid = error tint (`error-a08`, border `error-a50`, text `error-300`, glyph-cross, R); mono 12/400, padding 5 10; `role="status"` (it reports the editor's validation).
**5.7 `ModelPill`**: `{ hue/agentId, initials, visibility: 'public'|'private'|'lane'|'discussion', children: model name }`. Pill `padding: 3px 12px 3px 3px`, radius 999, fill `bg-node-model` `#17111F`, border 1px `line`, text `text-primary` Bricolage 12/400, gap 8; leading `Avatar size=26 ring=<visibility>` (OVE_DS016). Sits on a Node's bottom edge (positioning by NodeTile).
**5.8 Common**: all are static (no hover) except they inherit focus rules if rendered as buttons via `as`. Text is rendered as children, uppercase never applied. a11y: StatusPill/PositionTag convey meaning by text; ValidationPill has `role="status"`; no colour-only meaning (glyphs/dots plus words).

## 6. Design notes

`design.png`: "użyto Skilla: e2e-playwright v2" violet chip under an Agent message (mono 11/500, `#D6C9FF` on violet tint). `design-skill-card.png`: Skill cards with version chip, outline visibility badge (OVE_DS019), amber "import" and violet "Właściciel" origin tags, magenta "Chief" tag on the private card, `AvatarStack` footer. `design-stance.png`: Discussion messages with stance pills (mint "za", grey "bez preferencji", amber "warunkowo") and Skill chip "skill: grill-me v2". `design-run-pill.png`: Workflow header with the PRYWATNY filled badge, version badge and the magenta Run pill with a dot. Not in the mock: StatusPill for waiting/done/failed in this exact shape, invalid ValidationPill.

## 7. Reuse

`Pill` (OVE_DS017), `Avatar` (OVE_DS016), `StatusDot`/glyph icons (OVE_DS020/OVE_DS011), tokens (OVE_DS003 State map, hue and tint tokens). Do NOT redefine tint colours.

## 8. Architecture and code placement

Seven small folders in `src/badges/`, each a thin typed wrapper over `Pill`, so a change to the pill base propagates (DRY) and each preset is replaceable (OCP). Domain enums are string unions here only as presentation categories (no import from contracts, ui-kit has no internal dependencies).

## 9. Security and safety

ui-kit is presentation only: no network, filesystem, storage, `eval`, `new Function` or `dangerouslySetInnerHTML` anywhere (lint rule `react/no-danger` set to error in OVE_DS001). Every string arrives as a prop and is rendered as a React text node, never as HTML, so Agent, repository, document or Telegram content that an app shows through this component cannot inject markup. Colour is never the only carrier of meaning (state, Visibility, severity always come with a word or glyph, `docs/design/styl-wizualny.md` rules). The component takes no secrets and logs nothing (`console.*` is a lint error in `src/`). Skill and model names are untrusted text (Skills from the internet, ADR 0012): rendered as text, truncated, no markup. Origin tags make the provenance of a Skill visible (import vs Owner vs Chief), which supports the rule that internet Skills come only from the Owner: the story documents that the tag must never be styled alike for different origins.

## 10. Errors and edge cases

- Unknown `origin`/`position`/`state` (JS): neutral grey fallback, dev warning.
- Very long Skill name: ellipsis; chip max-width 100% of its row.
- `ModelPill` without model name: dev warning (must show the model; "Wybierz model" placeholder is caller's).
- `StatusPill` with `idle` while `pulse` is passed: no pulse (only working).

## 11. Acceptance criteria

- [ ] SkillChip sm/md paddings and fonts match 5.1; violet tint exact (`violet-a14`), no border.
- [ ] SkillUsedChip matches mono 11/500, padding 4/9, `align-self: flex-start`.
- [ ] OriginTag colours for import/owner/chief match 5.3, 10px mono 500, padding 3/8.
- [ ] PositionTag outline colours and glyph pairing match 5.4.
- [ ] StatusPill `working` equals the mock Run pill (fill `rgba(242,95,196,.12)`, border `.4`, text `#FFB3E6`, dot 8px pulsing); other states follow the State map; idle/paused have no tint.
- [ ] ValidationPill valid (mint) and invalid (error) with `role="status"`.
- [ ] ModelPill: 26px avatar in a 30px ring inside a pill with padding 3/12/3/3 and fill `#17111F`.
- [ ] Stories per component with `Matrix`; `ArtifactChip` documentation story; axe clean.
- [ ] Visual: four crop comparisons (`design.png`, `design-skill-card.png` chips region, `design-stance.png`, `design-run-pill.png`) pass structurally.

## 12. Test plan

Vitest: one test file per component (props, a11y, fallbacks). Playwright: computed styles, crops. Commands: `pnpm --filter @overmind/ui-kit test badges`.

## 13. Parallelization notes

After OVE_DS001 and the token tasks are merged, this task can run in parallel with every other primitive task: each owns its own folder under `packages/ui-kit/src/<group>/<Component>/` and nothing else. Conflict hotspots: none, because the barrel `src/index.ts`, `tokens.css` and the Storybook index are generated (OVE_DS039) and must not be edited by hand. If a missing token or icon is needed, write a proposal in `tasks/_proposals/OVE_DS0xx-<name>.md` instead of editing the token or icon files of another task. Each of the seven folders is independent after OVE_DS017, OVE_DS016 and OVE_DS020 merge, so this task can be split between two agents by folder if needed (same task id, separate PRs not allowed: one owner).

## 14. Open questions and assumptions

- ASSUMPTION: origin tags have no border (mock) and `PositionTag` adds glyphs (not in the mock) to satisfy 'never colour alone'.
- ASSUMPTION: `StatusPill` replaces three mock shapes (Run pill 26px, Agent state pill 28px, plain state words); heights 26-28 collapse to the pill's natural 26px.
- Open: wording of states is entirely i18n (Polish "pracuje", "czeka na Zgodę", "bezczynny").
