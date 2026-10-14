---
id: OVE_DS066
title: Build AgentList, AgentRow, AgentProfileHeader and DynamicAgentCard
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS019, OVE_DS020, OVE_DS022, OVE_DS031, OVE_DS033, OVE_DS039, OVE_DS040, OVE_DS057]
soft_depends_on: []
provides: ["ui:AgentList", "ui:AgentRow", "ui:AgentProfileHeader", "ui:DynamicAgentCard"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:ListRow", "ui:Avatar", "ui:VisibilityBadge", "ui:SectionLabel", "ui:Button", "ui:Card", "ui:StatusText"]
owns: ["packages/ui-kit/src/agents/AgentList/**", "packages/ui-kit/src/agents/AgentProfileHeader/**"]
reads: []
design: design.png
design_source: "Agenci#agents/list (crop 72,162,290,738 CSS px); design-header.png = Agenci (crop 390,184,712,56); design-dynamic.png = Agenci, mock scrolled 90px (crop 84,767,265,170)"
spec_refs: ["SPECIFICATION 4"]
adr_refs: [7, 28]
---

# OVE_DS066: Build AgentList, AgentRow, AgentProfileHeader and DynamicAgentCard

## 1. Summary

Builds the Agents list column (permanent Agents with visibility word, model and state, dynamic Agents awaiting acceptance), the `AgentProfileHeader` (large and compact) with Chat link and 'Zapisz jako vN' save button states, and the `DynamicAgentCard`.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Agenci.dc.html` and its 2x render `_design/views/Agenci.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C6.1 (AgentRow), C6.2 (DynamicAgentCard), C6.3 (AgentProfileHeader). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Agent stały is reusable with its own memory; Agent dynamiczny is created by Chief for a Task, private in its Workspace, and after the Owner's acceptance becomes permanent along with its memory, with the Owner choosing visibility (SPEC 4, ADR 0028). Saving a configuration creates a new version (`Zapisz jako v4`); running Runs keep their pinned version (ADR 0002). Model is per Agent (ADR 0007).

## 3. Scope (in)

- The four components and stories incl. dirty/saving/saved states of the save button.

## 4. Out of scope

- Configuration form (OVE_DS068), profile tabs content, deleting confirmation (feature `ui:Dialog`).

## 5. Detailed requirements

1. `AgentRowProps { id: string; name: string; hue: AgentHue; initials: string; visibility: Visibility; visibilityLabel: string; model: string /* 'Claude · Opus 5.5' */; state: AgentState; stateLabel: string; selected?: boolean; onSelect: () => void }`. Button row 265x63: padding 9 10, radius 14, gap 10; avatar 34 (mono 11); text column: line 1 name 14/600 + `VisibilityBadge outline` (E17: 10px/600 minimum, text = colour, the WORD is mandatory), line 2 model mono 11 `text-muted`; right: state word mono 12 coloured by `agentStateTone` with `StatusText` glyph (`skończył`, `pracuje`, `wolny`, `czeka`, `Zgoda` amber). Selected: `bg-surface-sel` + 1px `line-strong`.
2. `AgentListProps { title: string; onCreate: () => void; createLabel: string; permanent: { label: string; items: AgentRowProps[] }; dynamic: { label: string; items: DynamicAgentCardProps[] }; selectedId?: string; loading?: boolean; labels: { list: string; empty: string } }`. Header: `Agenci` 22/700 + `primary-violet` `Button` `Nowy` (h40) right; sections via `SectionLabel` (`STALI · 7`, `DYNAMICZNI · CZEKAJĄ NA AKCEPTACJĘ`, amber tone for the second); permanent rows as a roving-focus list; dynamic cards below. The panel is a SidePanel left 290 (padding 20 21, scroll).
3. `DynamicAgentCardProps { id: string; name: string; reason: string; keep: { label: string; onClick: () => void }; discard: { label: string; onClick: () => void }; busy?: boolean }`: `ui:Card` tone `drop` (1px dashed `#F25FC4`, fill rgba(242,95,196,.05), radius 16), padding 12, gap 10; name 14/700, reason 12px `text-secondary` (4-line clamp, title), buttons row: `primary-magenta` `Zachowaj jako stałego` (h40; the label may wrap to two lines, never truncated) + `secondary` `Usuń` (destructive: the feature confirms; component has no confirm UI). `busy` disables both.
4. `AgentProfileHeaderProps { name: string; hue: AgentHue; initials: string; subtitle: string; size?: 'lg' | 'compact'; chat?: { label: string; href?: string; onClick?: () => void }; save?: { label: string /* 'Zapisz jako v4' */; state: 'clean' | 'dirty' | 'saving' | 'saved' | 'error'; onClick: () => void; stateLabel?: string } }`. `lg`: avatar 56 (mono 18), name 26/700 `title-page` (E7: -0.52px), subtitle mono 12 `text-muted`, actions right (gap 10): `Button secondary` `Czat` with `chat` icon (link or button), `primary-violet` save. `compact` (Workflow Inspector): avatar 48 (mono 16), name 22/700, subtitle mono 11 wrapping, no actions.
5. Save button states (R): `clean` -> disabled with `aria-disabled` and the title text (`Brak zmian`); `dirty` -> enabled violet; `saving` -> spinner + `aria-busy`; `saved` -> 1.5s check glyph + `stateLabel` then returns to `clean` (feature flips state); `error` -> error-tone outline + message in `stateLabel` (`role="alert"`). Unsaved changes are indicated by the label itself, not only by colour.
6. Dynamic Agents have no mock hue: `hue` is supplied by `hueForAgentId` (OVE_DS040).
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Agents list: `Agenci` + `Nowy`, `STALI · 7`, Developer selected (PUBLICZNY outline, `Claude · Opus 5.5`, `skończył`), Codex row `pracuje`, Security PRYWATNY with amber `Zgoda`, PO/Designer/SR/Researcher, then `DYNAMICZNI` and the dashed card `Analityk cen hoteli` (`Zachowaj jako stałego`, `Usuń`). `design-header.png`: profile header (avatar 56, `Developer`, `Agent stały · konfiguracja v3 · utworzył Właściciel`, `Czat`, `Zapisz jako v4`). `design-dynamic.png`: the dynamic card. Not in the mock: dirty/saving/saved/error, hover/focus, empty list, loading, delete confirm.

## 7. Reuse

Consumes `ui:ListRow`, `ui:Avatar`, `ui:VisibilityBadge`, `ui:SectionLabel`, `ui:Button`, `ui:Card` (`drop`), `StatusText`, OVE_DS040 maps and `hueForAgentId`. Uses the same `drop` tone as OVE_DS057.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Visibility is always a word (ADR 0028). The component cannot change visibility or permissions. Delete is only a callback.

## 10. Errors and edge cases

- Unknown model string -> shown as text.
- Agent name empty -> `—`.
- `keep` pressed twice -> second ignored (`busy`).
- `save.state=saving` while navigation -> feature guards unsaved state.

## 11. Acceptance criteria

- [ ] Given the fixtures, Then rows are 63px tall with the avatar/state layout and match `design.png` within tolerance.
- [ ] Given every row, Then a visibility word is present.
- [ ] Given `save.state="dirty"`, Then the button is enabled; `clean` -> disabled; `saving` -> aria-busy.
- [ ] Given the dynamic card at 265px, Then the keep button wraps its label without truncation.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: `Zachowaj jako stałego` leads to a follow-up visibility choice (feature dialog) per ADR 0028.
