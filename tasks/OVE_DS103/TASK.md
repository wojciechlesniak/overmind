---
id: OVE_DS103
title: Build AgentInspector (canvas right panel) with AgentStateCard and visibility cards
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS017, OVE_DS018, OVE_DS022, OVE_DS025, OVE_DS030, OVE_DS031, OVE_DS032, OVE_DS039, OVE_DS040, OVE_DS066, OVE_DS067]
soft_depends_on: []
provides: ["ui:AgentInspector", "ui:AgentStateCard", "ui:InspectorSection"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:RadioCardGroup", "ui:Button", "ui:Pill", "ui:SkillChip", "ui:SectionLabel", "ui:Card", "ui:Avatar", "ui:ModelPicker", "ui:EmptyState"]
owns: ["packages/ui-kit/src/canvas/AgentInspector/**"]
reads: []
design: design.png
design_source: "Main#canvas/inspector (crop 1150,162,290,738 CSS px); design-state.png = Main (crop 1160,240,270,120); design-visibility.png = Main (crop 1160,355,270,135)"
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 7", "SPECIFICATION 3"]
adr_refs: [28, 7, 3, 25]
---

# OVE_DS103: Build AgentInspector (canvas right panel) with AgentStateCard and visibility cards

## 1. Summary

Builds the 290px right panel of the canvas: compact `AgentProfileHeader`, `AgentStateCard` with evidence, visibility radio-cards (`we wszystkich Workspace'ach` / `tylko w tym Workspace`), Lane block, model block with fallback, Skills chips (drop target), 'Uprawnienia w tym węźle' key/values and 'Otwórz czat z …'; plus empty (no selection), multi-selection and read-only variants.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C6.5 (AgentInspector), C6.3 (compact header), B8 (RadioCardGroup), E31. The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The Inspector shows the Agent behind the selected node: state (hint from CLI/herdr), visibility of this Agent in this Workflow, model per Agent and node (ADR 0007), assigned Skills and the permission intersection for this node (SPEC 11: a node cannot exceed Workspace permissions). A Task-driving node (TOR) also explains its Lane (glossary: Lane).

## 3. Scope (in)

- `AgentInspector` (sections), `AgentStateCard`, `InspectorSection`, variants (node selected, no selection, multi-select, read-only, dynamic Agent), stories.

## 4. Out of scope

- Agent configuration form (OVE_DS068), saving changes (feature -> engine), terminal view (OVE_DS053).

## 5. Detailed requirements

1. `AgentInspectorProps` (all strings supplied):
   ```ts
   interface AgentInspectorProps {
     agent: { name: string; initials: string; hue: AgentHue; subtitle: string /* 'Agent stały · konfiguracja v3' */ };
     state: { state: AgentState; label: string /* 'Skończył · iteracja 2 z 5' */; evidence?: string /* 'Dowód: 4 pliki w worktree, testy 112 z 112' */ };
     visibility: { value: Visibility; options: { value: Visibility; label: string; help: string }[]; onChange?(v: Visibility): void; helper: ReactNode };
     lane?: { badge: string /* 'TOR · Build' */; text: string };
     model: { label: string; fallback?: string; onChange?(): void };
     skills: { id: string; name: string; version: string; visibility: Visibility }[]; skillsHeading: string; onRemoveSkill?(id: string): void;
     permissions: { heading: string; items: { label: string; value: ReactNode }[] };
     openChat?: { label: string; onClick(): void };
     mode: 'edit' | 'view'; selection: 'single' | 'none' | 'multi'; labels: Record<string,string>;
   }
   ```
2. Panel (exact): `SidePanel` right 290, padding 18 19 (mock content x=1169..1422), `overflow-y: auto`, column gap 14, bg `#0F0A18`. Header: compact `AgentProfileHeader` (avatar 48, name 22/700/-0.2, subtitle mono 12 `text-muted` (OVE_DS066)). Sections use `InspectorSection` (`SectionLabel` mono 11 +0.1em `text-muted` + body), spacing 14.
3. `AgentStateCard` (`STAN AGENTA`): `ui:Card` nested r16 padding 14: state line 16/700 in the state tone (`Skończył · iteracja 2 z 5` mint) with SVG glyph, evidence 13/1.45 `text-secondary` (`Dowód: …`, selectable); an `idle` Agent without evidence shows `Brak dowodu pracy`. The text always says it is a hint when the state comes from the CLI (`wg herdr`, `stateLabel` suffix by the feature).
4. Visibility (`WIDOCZNOŚĆ AGENTA`): `ui:RadioCardGroup` compact, two cards side by side (grid 1fr 1fr gap 8, each radius 12 padding 10): public = blue (`PUBLICZNY` mono 11 `#6FA8FF` + `we wszystkich Workspace'ach`), private = violet (`PRYWATNY` + `tylko tutaj`); selected card 1.5px border in ITS colour (E31 colour follows the option) + tint; helper line 13/1.45 `text-secondary` with inline `TOR · Build` in the lane green (`W tym Workflow działa jako TOR · Build: każde Zadanie przechodzi przez niego na Tablicy.`). In `view` mode radios are `aria-disabled` (readonly). Changing visibility to PUBLIC for an Agent with private Skills is refused by the feature with a reason (shown by `error` prop).
5. Model (`MODEL`): row card (padding 12 14, radius 14, bg `#140F20`, 1px `line`) `Claude Code · Opus 5.5` 15/600 + `chevron-down` (E4; the mock shows `chevron-right`) opening the `ModelPicker` via `model.onChange`; below `Zapasowy: Codex CLI · gpt-5.5` 13px `text-secondary`. Skills (`SKILLE · 2`): chips (`ui:SkillChip` = mono 13 name+version + outline `VisibilityBadge`, removable in edit mode with `Usuń Skill X`), plus a dashed drop zone `upuść tu Skill z biblioteki` (`ui:SkillDropZone` from OVE_DS067) in edit mode.
6. Permissions (`UPRAWNIENIA W TYM WĘŹLE`): lines 14/1.6: `Zapis:` + mono path chips `src/` `tests/`, `· Terminal: tak`, `Sieć: nie · git push: wymaga Zgody` (values mark `wymaga Zgody` amber, `nie` muted). It shows the INTERSECTION effective for this node, never wider than Workspace permissions; a footnote `Prośba o więcej: Agent może poprosić o dostęp (Zgoda).` Pinned at the bottom: `Button secondary lg` full width `Otwórz czat z Developerem` (`chat` icon).
7. Variants: `selection='none'` -> `EmptyState` `Wybierz Węzeł, aby zobaczyć Agenta` + short canvas tips; `multi` -> `Zaznaczono 3 Węzły` with only shared actions (`Wyrównaj`, `Usuń` as callbacks supplied via `actions` slot); non-Agent nodes (Gate, Join, Start) show a reduced Inspector via the `children` slot (feature composes); dynamic Agent shows the `DynamicAgentCard` note (OVE_DS066).
8. Keyboard/focus: opening the Inspector from the canvas (`Enter` on a node) moves focus to the panel heading; `Esc` returns focus to the node. Skill chips are removable by `Delete` on focus (edit mode).
9. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
10. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
11. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
12. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
13. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
14. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
15. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the full 290px panel for `Developer` (Dv avatar, `Agent stały · konfiguracja v3`, `STAN AGENTA` mint `Skończył · iteracja 2 z 5` + evidence, visibility cards with `tylko tutaj` selected, helper with TOR · Build, model card with fallback, Skills `TypeScript v4`/`tdd v2`, permissions, `Otwórz czat z Developerem`). `design-state.png` and `design-visibility.png` zoom on the two cards. Not drawn: none-selected, multi, view mode, error on visibility, long names.

## 7. Reuse

Consumes `ui:RadioCardGroup`, `ui:ModelPicker`, `ui:SkillChip`/`ui:SkillDropZone` (OVE_DS067), `AgentProfileHeader` (OVE_DS066), `ui:Card`, `ui:Avatar`, `agentStateTone` (OVE_DS040). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). The Inspector shows permissions but offers no way to widen them (ADR 0003: widening goes through an Access Request/Approval). Changing visibility is an intent: engine validates (a private Agent's private memory/Skills never become public, ADR 0028). Evidence text is untrusted agent output: text only.

## 10. Errors and edge cases

- Agent without model -> `Brak modelu` with a warning icon.
- No Skills -> only the drop zone (edit) or `Brak Skilli` (view).
- Very long agent name -> ellipsis 190px.
- `state` unknown -> neutral.
- Fallback missing -> line hidden.

## 11. Acceptance criteria

- [ ] Given the Developer fixture, Then sections, order and texts match the mock.
- [ ] Given `mode=view`, Then visibility radios and Skill removal are disabled.
- [ ] Given visibility change, Then `onChange(value)` fires and the selected card colour follows the option (E31).
- [ ] Given `selection=none`, Then the empty state shows.
- [ ] Given keyboard, Then all controls reachable and focus moves to the heading on open.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN question E31: colours public blue / private violet in both Agents page and Inspector (default as specified).
- ASSUMPTION E4: model row uses `chevron-down`.
- OPEN: reduced Inspector for non-Agent nodes is composed by the feature.
