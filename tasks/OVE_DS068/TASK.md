---
id: OVE_DS068
title: Build AgentConfigForm (visibility, instructions, models, budget, Skill assignment)
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS019, OVE_DS022, OVE_DS025, OVE_DS026, OVE_DS030, OVE_DS035, OVE_DS039, OVE_DS051, OVE_DS066, OVE_DS067]
soft_depends_on: []
provides: ["ui:AgentConfigForm", "ui:SkillAssignment", "ui:BudgetField"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Tabs", "ui:RadioCardGroup", "ui:Textarea", "ui:ModelPicker", "ui:Pill", "ui:VisibilityBadge", "ui:StatTile", "ui:Button", "ui:SectionLabel"]
owns: ["packages/ui-kit/src/agents/AgentConfigForm/**"]
reads: []
design: design.png
design_source: "Agenci#agents/profile (visibility, instructions, model, budget, skills) (crop 362,162,768,590 CSS px)"
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 8", "SPECIFICATION 9"]
adr_refs: [7, 28, 3, 2]
---

# OVE_DS068: Build AgentConfigForm (visibility, instructions, models, budget, Skill assignment)

## 1. Summary

Builds the Agent configuration form shown in the 'Konfiguracja' tab: visibility radio cards, role/instructions textarea, primary and fallback model pickers, per-Task budget, Skill assignment chips with the drop zone, and slots for the tools table and tab content.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Agenci.dc.html` and its 2x render `_design/views/Agenci.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C6.4 (AgentConfigForm), B8, B10, B11, E5, E31. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Changing any field produces a new Agent configuration version on save (`Zapisz jako v4`, ADR 0002/0028); visibility changes also create a version. Making an Agent private is blocked while it is used in another Workspace (ADR 0028). Instructions must not exceed the Documentation: Agents add nothing on their own (ADR 0016) - but that is engine policy; the form only edits text. Models come from the connected CLIs (`Claude Code · Opus 5.5`), a CLI that is not logged in cannot be chosen.

## 3. Scope (in)

- The form (controlled), `SkillAssignment`, `BudgetField`, profile tabs wiring, validation display, keyboard Skill assignment.

## 4. Out of scope

- Tools table / memory (OVE_DS070), the header (OVE_DS066), saving, tab content for Memory/Runs/Versions (later features).

## 5. Detailed requirements

1. `AgentConfigValue { visibility: Visibility; instructions: string; model: string; fallbackModel?: string; budget: { minutes: number; retries: number }; skills: AssignedSkill[] }`, `AssignedSkill { skillId: string; name: string; version: string; visibility: Visibility; ownerWorkspaceId?: string }`. `AgentConfigFormProps { value: AgentConfigValue; onChange: (next: AgentConfigValue) => void; models: ModelOption[]; visibilityGuard?: { privateBlockedReason?: string }; canAcceptSkill: (p: SkillDragPayload) => { ok: true } | { ok: false; reason: string }; onAssignSkill: (p: SkillDragPayload) => void; onRemoveSkill: (skillId: string) => void; tabs: { items: { id: string; label: string }[]; activeId: string; onChange: (id: string) => void }; children?: ReactNode /* tab content below the form: tools table */; errors?: Partial<Record<'instructions' | 'model' | 'budget', string>>; labels: Record<string, string>; disabled?: boolean }`. The form never mutates `value`.
2. Tabs: `ui:Tabs` variant `profile` rendering `Konfiguracja | Pamięć agenta | Historia Runów | Wersje` with the violet underline (E5), min-height 42, 14/600; only the `Konfiguracja` content is built here (the other tabs render `children`/feature content). Tablist semantics (`role="tablist"`, roving tabindex, arrow keys).
3. Visibility: section label `WIDOCZNOŚĆ`, `ui:RadioCardGroup` with two options (`flex: 1 1 200`, gap 3 inside, padding 10 12, radius 14): `PUBLICZNY` (`dostępny we wszystkich Workspace'ach`, selected = 1.5px `#6FA8FF` + rgba(111,168,255,.1)) and `PRYWATNY` (`tylko w Workspace „Aplikacja rezerwacji”`, selected = 1.5px `#9B7BFF` + violet tint: E31, colour follows the option). Each shows the outline `VisibilityBadge` word + description. Help line 12px `text-muted` (`Pamięć agenta i tak zostaje osobno w każdym Workspace. Publiczny znaczy tylko, że możesz go użyć gdzie indziej.`). `visibilityGuard.privateBlockedReason` disables the private option with the reason visible as text.
4. Instructions: `ROLA I INSTRUKCJE` label, `ui:Textarea` (padding 12 14, radius 14, 14px/1.5, resize vertical, min-height 127px, `maxLength` 20000 with counter within the last 500 chars); accessible label `Instrukcje Agenta`; error text below (`errors.instructions`, `role="alert"`).
5. Models: two `ui:ModelPicker` (labels `MODEL`, `MODEL ZAPASOWY`; value format `Claude Code · Opus 5.5`, second line `Zapasowy: Codex CLI · gpt-5.5` is rendered by the picker); options grouped by CLI; options of a logged-out CLI are listed disabled with `zaloguj w Połączeniach`. Fallback can be `—` (none). Same model as primary in fallback -> inline warning `Model zapasowy jest taki sam`.
6. `BudgetField` (`BUDŻET NA ZADANIE`): read tile via `StatTile`-like display `45 min · 2 ponowienia` with an edit affordance: two number inputs (minutes 1-480, retries 0-5, steppers with `icon-square` buttons, `aria-label`s from labels) shown inline when focused/clicked; validation errors via `errors.budget`.
7. `SkillAssignment` (`SKILLE · 2 · PRZYPISANE NA STAŁE`): assigned `Pill skill-chip` (padding 6 10, 12/500 mono, text `TypeScript v4` + outline `VisibilityBadge` + remove `×` button with `aria-label`), then `SkillDropZone` (OVE_DS067) `upuść tu Skill z biblioteki` and the keyboard `Przypisz Skill…` menu button (`useSkillAssignMenu`). Dropping a Skill calls `onAssignSkill`; the chip appears only when the parent adds it to `value.skills` (no optimistic insert). Rejections show the reason text in the zone for 3s (`aria-live="polite"`).
8. Layout: sections in a column gap 18, padding 24 28; model row = 3 columns (`MODEL`, `MODEL ZAPASOWY`, `BUDŻET`) that wrap below 640px. The whole form is a `<form>` with `onSubmit` prevented (saving is the header button; Enter in the textarea inserts newlines).
9. Disabled (`disabled`): all controls `aria-disabled` and visually dimmed (opacity .45); used while saving. Read-only mode for the system Chief is NOT here (Chief is not an Agent config).
10. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
11. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
12. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
13. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
14. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
15. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
16. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Developer profile from tabs to the Skills drop zone: PUBLICZNY selected card with blue ring, textarea with the instructions, `MODEL Claude Code · Opus 5.5`, `MODEL ZAPASOWY Codex CLI · gpt-5.5`, `BUDŻET NA ZADANIE 45 min · 2 ponowienia`, Skills chips `TypeScript v4` and `tdd v2`, dashed `upuść tu Skill z biblioteki`. Not in the mock: validation errors, drop hover/reject, disabled/saving, private-blocked reason, model options open, logged-out CLI, budget editing, keyboard assignment.

## 7. Reuse

Consumes `ui:Tabs`, `ui:RadioCardGroup`, `ui:Textarea`, `ui:ModelPicker`, `ui:Pill`, `ui:VisibilityBadge`, `ui:Button`; DnD from OVE_DS067; header from OVE_DS066 is placed by the feature above the form.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Instructions are Owner-authored text sent to agents: the form shows no preview rendering. A Skill chip proves only assignment, not tool access (ADR 0003). The `canAcceptSkill` callback enforces ADR 0028 visibility rules; the engine re-validates.

## 10. Errors and edge cases

- Instructions exceed max -> counter error, value truncated at paste.
- Model option removed (CLI logged out) while selected -> value kept, warning chip `niedostępny`.
- Budget minutes outside range -> clamp on blur + error.
- Drop of an already-assigned Skill -> rejected with reason `Już przypisany`.
- Rapid remove/assign -> parent order wins.
- Both models empty -> `errors.model`.

## 11. Acceptance criteria

- [ ] Given the Developer fixture, Then the visual matches `design.png` within tolerance.
- [ ] Given the private option with a guard reason, Then it is disabled and the reason text is visible.
- [ ] Given a rejected Skill drop, Then the reason is announced and `onAssignSkill` is not called.
- [ ] Given keyboard only, Then a Skill can be assigned through the `Przypisz Skill…` menu.
- [ ] Given tab keys, Then ArrowLeft/Right move between profile tabs (roving tabindex).
- [ ] axe clean.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION (E5/E31): violet underline; visibility colours follow the option.
- OPEN: budget editing inline vs dialog; default inline inputs.
