---
id: OVE_DS065
title: Build DecisionDetail, AlternativeCard and OutcomeCard (with Owner verdict)
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS017, OVE_DS019, OVE_DS022, OVE_DS025, OVE_DS031, OVE_DS039, OVE_DS040, OVE_DS063, OVE_DS064]
soft_depends_on: []
provides: ["ui:DecisionDetail", "ui:AlternativeCard", "ui:OutcomeCard"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Pill", "ui:Avatar", "ui:VerdictSelect", "ui:Button", "ui:SectionLabel", "ui:VisibilityBadge"]
owns: ["packages/ui-kit/src/decisions/DecisionDetail/**"]
reads: []
design: design.png
design_source: "Decyzje#decis/detail (crop 472,117,968,783 CSS px)"
spec_refs: ["SPECIFICATION 10"]
adr_refs: [8, 14, 16]
---

# OVE_DS065: Build DecisionDetail, AlternativeCard and OutcomeCard (with Owner verdict)

## 1. Summary

Builds the Decision detail (968px main column): header with id/Workspace/Run/status and 'Zastąp nową Decyzją', title, PROBLEM, ALTERNATYWY cards (chosen one highlighted), UZASADNIENIE, participants/Skills/confidence, assumptions, risks, the outcome card with Chief's proposal, evidence chips and the Owner verdict control, and the 'Zastępuje' link.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Decyzje.dc.html` and its 2x render `_design/views/Decyzje.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C5.5 (DecisionDetail), B8 (VerdictSelect). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Chief proposes an outcome and collects evidence, the Owner gives the verdict and may change it (SPEC 10). Decisions are append-only: the only way to change content is `Zastąp nową Decyzją` (creating a new Decision), and superseded Decisions are read-only (ADR 0008). Confidence is shown as a word + number (`średnia · 0,7`); numbers formatted with `Intl pl-PL` by the caller (E32).

## 3. Scope (in)

- The three components, states: accepted, proposed (awaiting Owner), needs_review, superseded (read-only banner), verdict saving.

## 4. Out of scope

- The list (OVE_DS064), the `VerdictSelect` primitive (part 1), writing the verdict (DEC feature).

## 5. Detailed requirements

1. `DecisionDetailProps`:
   ```ts
   interface AlternativeCardProps { title: string; reason: string; chosen?: boolean; chosenLabel: string }
   interface DecisionDetailProps {
     id: string; workspaceName: string; run?: ReactNode; status: DecisionStatus; statusLabel: string; title: string;
     problem: string;
     alternatives: AlternativeCardProps[];
     rationale: string;
     participants: { name: string; hue: AgentHue; initials: string }[];
     skills: { name: string; version: string }[];
     confidence: { label: string };           // 'średnia · 0,7'
     assumptions: string; risks: string;
     outcome: OutcomeCardProps;
     supersedes?: { label: string; onOpen: () => void; workspace?: string };
     supersededBy?: { label: string; onOpen: () => void };
     onSupersede?: () => void;                 // absent when superseded
     onAccept?: () => void; onReject?: () => void;   // only for status 'proposed'
     labels: { problem: string; alternatives: string; rationale: string; participants: string; skills: string; confidence: string; assumptions: string; risks: string; outcome: string; supersede: string; supersededBanner: string };
   }
   ```
   Every section label is a `SectionLabel` and every section is an `<section aria-labelledby>`.
2. Header row (meta, height 40): id mono 12 + workspace + `RunLink` (mono 12 `text-secondary`, `D-14 · Aplikacja rezerwacji · Run #11`), status `Pill` (tone by status) and right-aligned `Button secondary` `Zastąp nową Decyzją` (hidden when superseded). Title 26/700 `title-page` (E7: -0.52px). For `status=proposed` the header shows `primary-violet` `Zaakceptuj` + `secondary` `Odrzuć` instead (R, not in the mock); accept/reject are Owner-only actions (callbacks).
3. Body: column gap 18, padding 28 (E6: 24 where the page uses `page` padding), `max-width: 912px`. `AlternativeCard`: `ui:Card` default radius 14 padding 14 gap 6; title 14/600; reason 13px `text-secondary` (3-line clamp); `chosen`: 1.5px `#62E3B4` border, fill `rgba(98,227,180,.06)`, and a `Pill` `chosenLabel` (`wybrana`) with a `check` glyph (word + glyph, not colour only). Grid: `repeat(auto-fit, minmax(240px, 1fr))` gap 12 (3 columns at 912px).
4. Meta rows: `UCZESTNICY` (`Avatar` 28 row), `SKILLE` (`Pill skill-chip` `TypeScript v4`: name + version always), `PEWNOŚĆ` (text) in a 3-column flex that wraps; `ZAŁOŻENIA` and `RYZYKA` text 13/1.45 in two columns (stack below 720px).
5. `OutcomeCardProps { proposal: { label: string /* 'Chief proponuje:' */; outcome: DecisionOutcome; outcomeLabel: string; reviewLabel?: string /* '· przegląd 2026-11-10' */ }; evidenceText?: string; evidence: EvidenceItem[]; verdict: { label: string /* 'Twój werdykt:' */; value?: DecisionOutcome; options: { value: DecisionOutcome; label: string }[]; onChange?: (v: DecisionOutcome) => void; saving?: boolean; readOnlyReason?: string } }`: card (`ui:Card` default radius 18, padding 17): Chief proposal line (outcome word coloured), evidence sentence 13px, `EvidenceList` (mint chips `bundle-report.json`, `unit-report.xml`), a divider, then the verdict row: label + `ui:VerdictSelect` (4 buttons h40 padding 0 14 radius 12, 13/600; selected tint per outcome: positive mint, mixed amber, unknown grey, negative error; E-rule: each outcome has its own selected tint). Radio-group semantics: `role="radiogroup"`, arrow keys, `aria-checked`. `saving` disables and shows a spinner; `readOnlyReason` (superseded) disables all with the reason text shown.
6. `supersededBy` renders a banner at the top (`role="note"`, amber callout): `Ta Decyzja została zastąpiona przez D-17` with a link; all controls except navigation links are disabled. `supersedes` row at the bottom: `LinkRow` `Zastępuje: D-03 · Biblioteka dat: moment (Strona fundacji)`; if the superseded Decision is in an isolated/other Workspace the feature decides whether to show it (not here).
7. There are NO delete or edit controls in the component (ADR 0008); the invariant test from OVE_DS064 is extended to this component.
8. Scrolling: the detail column scrolls (`overflow:auto`); the header row is sticky (`position: sticky; top: 0` with `bg-app` fill and a bottom border once scrolled).
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: Decision D-14: header with `Zastąp nową Decyzją`, title `Biblioteka dat: date-fns zamiast moment`, ALTERNATYWY (date-fns chosen mint, moment, Temporal API), UZASADNIENIE, UCZESTNICY avatar, SKILLE `TypeScript v4`, PEWNOŚĆ `średnia · 0,7`, ZAŁOŻENIA, RYZYKA, WYNIK DECYZJI (Chief proposes `pozytywny · przegląd 2026-11-10`, evidence chips, verdict buttons with `pozytywny` selected), `Zastępuje: D-03`. Not in the mock: proposed (accept/reject), superseded read-only, needs_review banner (`do przeglądu`: amber note `Termin przeglądu minął`), saving, empty sections (omitted when the text is empty), very long text.

## 7. Reuse

Consumes OVE_DS040 (`EvidenceList`, `RunLink`, `LinkRow`, tone maps), `ui:VerdictSelect`, `ui:Card`, `ui:Pill`, `ui:Avatar`, `ui:SectionLabel`, `ui:Timeline` is NOT used here.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Decision content is Chief/Agent text: rendered as text. The verdict control writes only through `onChange` (Owner action, audited by the engine). Superseded Decisions are visually and functionally read-only so history cannot be altered through the UI.

## 10. Errors and edge cases

- No alternatives -> section hidden (a Decision always has at least one in the engine; defensive).
- Two alternatives marked chosen -> first wins, dev warning.
- `verdict.value` undefined (no verdict yet) -> no button selected, helper text `Brak werdyktu`.
- Verdict change fails -> feature reverts `value`; component never keeps local selected state.
- Long evidence names -> chips ellipsis.

## 11. Acceptance criteria

- [ ] Given the D-14 fixture, Then the layout and colours match `design.png` within tolerance.
- [ ] Given `supersededBy`, Then the banner is shown and the verdict group and supersede button are disabled/absent.
- [ ] Given the verdict group, Then Arrow keys move selection, Space/Enter confirm, and the selected tint equals the outcome tone.
- [ ] Given `status="proposed"`, Then accept/reject appear in the header.
- [ ] Given the append-only invariant test, Then no delete/edit affordance exists.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- DESIGN GAP: proposed, superseded and needs_review variants are derived.
- ASSUMPTION: `proposed` Decisions (Chief proposals awaiting the Owner) are accepted in this header.
