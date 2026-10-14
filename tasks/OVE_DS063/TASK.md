---
id: OVE_DS063
title: Build Timeline, ProvenanceBlock and TaskDetail panel
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS022, OVE_DS031, OVE_DS032, OVE_DS039, OVE_DS040, OVE_DS061]
soft_depends_on: []
provides: ["ui:Timeline", "ui:ProvenanceBlock", "ui:TaskDetail"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Button", "ui:SectionLabel", "ui:EmptyState", "ui:Skeleton"]
owns: ["packages/ui-kit/src/board/TaskDetail/**", "packages/ui-kit/src/data/Timeline/**"]
reads: []
design: design.png
design_source: "Tablica#board/task-inspector (crop 1120,117,320,783 CSS px)"
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10"]
adr_refs: [11, 16, 8]
---

# OVE_DS063: Build Timeline, ProvenanceBlock and TaskDetail panel

## 1. Summary

Builds the 320px Task detail panel (title, documentation provenance block with the quoted fragment, origin link to the Discussion/Decision, history timeline, evidence artifacts, actions) and the reusable vertical `Timeline`.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Tablica.dc.html` and its 2x render `_design/views/Tablica.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C5.4 (TaskDetail), C5.7 (Timeline). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Provenance is the discipline of the product: every Task shows which part of the Project Documentation it follows (ADR 0016) and, if it came from a Discussion, the Decision (D-12). Evidence (reports, traces) are Artifacts, not agent claims (ADR 0026, SPEC 7 Quality Gate).

## 3. Scope (in)

- `Timeline` (generic), `ProvenanceBlock`, `TaskDetail`, empty (no selection) and loading states.

## 4. Out of scope

- Data (BOARDUI), chat navigation, parking a Task (callbacks only).

## 5. Detailed requirements

1. `TimelineItem { id: string; time: string; text: ReactNode; tone?: Tone; current?: boolean }`; `Timeline props { items: TimelineItem[]; 'aria-label': string }`: `<ol>`; each item grid `[16px dot] [1fr]`, 8px dot coloured by `tone` (`current` = magenta with glow and `aria-current="step"`), 1px `line-subtle` connector between dots, time in mono 11 `text-muted`, text 13px `text-primary`; gap 10. Newest last (chronological). Tones used for Task history: done mint, failed error, working magenta (`teraz`).
2. `ProvenanceBlockProps { label: string /* 'WYNIKA Z DOKUMENTACJI' */; doc: { path: string; anchor?: string; onOpen?: () => void }; quote?: string; commit?: string }`: `SectionLabel` + `ui:Card` default radius 14 padding 12: `DocRefChip` (mono 12, interactive when `onOpen`), quote 13/1.45 `text-body-soft` in typographic quotes (the quote is displayed as text, max 400 chars with ellipsis + title), optional git ref line mono 11 muted (`main @ 4f2c9a1`). If the `doc` is missing the block renders a WARNING variant (amber callout `Zadanie bez odnośnika do Dokumentacji`) because that state violates ADR 0016.
3. `TaskDetailProps`:
   ```ts
   interface TaskDetailProps {
     id: string; laneLabel: string;                   // 'T-31 · tor QA' (mono 11)
     title: string;                                   // 20/700/25px
     provenance: ProvenanceBlockProps;
     origin?: { label: string; link: ReactNode };      // 'POCHODZENIE' LinkRow: Dyskusja „Zakres MVP” · Decyzja D-12
     history: TimelineItem[]; historyLabel: string;    // 'PRZEBIEG'
     evidence?: { items: { id: string; name: string; onOpen?: () => void }[]; label: string };   // 'DOWODY · ARTEFAKTY'
     actions: { chat?: { label: string; onClick: () => void }; park?: { label: string; onClick: () => void } };
     loading?: boolean;
   }
   ```
   Panel (SidePanel right 320, padding 21): sections gap 16; actions pinned to the bottom (`margin-top: auto`, at y=834 in the mock): chat = `Button` `secondary` with violet outline tone (1px #5B3E8F, text #D6C9FF, icon `chat`), park = `Button ghost`/`secondary`. `ui:EmptyState` when no Task is selected (`Wybierz Zadanie, aby zobaczyć szczegóły.`).
4. Evidence chips: OVE_DS040 `EvidenceList` (mint `unit-report.xml`, magenta tint `e2e-trace.zip`); each opens through `onOpen` (feature opens Artifact preview). Artifact names are untrusted text.
5. Park action is reversible state change owned by Chief/engine rules; the button only calls `park.onClick` (feature confirms).
6. `loading`: skeleton blocks of the same heights (title 2 lines, quote 3 lines, 4 timeline rows). Panel scrolls inside (`overflow:auto`), actions row sticky at the bottom with a top border on overflow.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Task inspector for T-31 (`T-31 · tor QA`, title `Koszyk z kodami rabatowymi`, doc card with quote `„Kod rabatowy obniża cenę przed podatkiem i nie łączy się z innymi promocjami.”`, `POCHODZENIE Dyskusja „Zakres MVP” · Decyzja D-12`, `PRZEBIEG` with 4 coloured rows, `DOWODY · ARTEFAKTY` chips, `Czat z QA` and `Odłóż`). Not in the mock: empty selection, loading, missing doc warning, many history items (scroll), Timeline connector styling (the mock draws plain rows; the connector is the inventory R).

## 7. Reuse

Consumes OVE_DS040 `DocRefChip`, `EvidenceList`, `LinkRow`, `RunLink`; `ui:Card`, `ui:SectionLabel`, `ui:Button`, `ui:EmptyState`, `ui:Skeleton`. `Timeline` is reused later by Decision/Agent version history (`ui:Timeline`).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The quote is from documents in the repository: untrusted text, never rendered as Markdown/HTML. The doc path is not opened here.

## 10. Errors and edge cases

- History empty -> section hidden.
- Quote missing -> only the chip shown.
- Very long title -> wraps (max 4 lines then ellipsis).
- Doc missing -> warning block (see 3).
- Evidence list > 6 -> `+N` chip (EvidenceList).

## 11. Acceptance criteria

- [ ] Given the T-31 fixture, Then the panel matches `design.png` within tolerance and actions are pinned at the bottom.
- [ ] Given no doc reference, Then the amber warning block is shown instead of the card.
- [ ] Given `Timeline` items, Then the DOM is an ordered list and the current item has `aria-current="step"`.
- [ ] Given no selection, Then the empty state shows.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: the doc-less warning variant (not in the mock) follows from ADR 0016.
