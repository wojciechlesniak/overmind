---
id: OVE_DS070
title: Build ToolsTable and MemoryPanel (Agent tools intersection, read-only Agent Memory)
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS017, OVE_DS020, OVE_DS022, OVE_DS031, OVE_DS032, OVE_DS039, OVE_DS040, OVE_DS069]
soft_depends_on: []
provides: ["ui:ToolsTable", "ui:MemoryPanel"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Pill", "ui:SectionLabel", "ui:EmptyState", "ui:StatusText"]
owns: ["packages/ui-kit/src/agents/ToolsTable/**", "packages/ui-kit/src/agents/MemoryPanel/**"]
reads: []
design: design.png
design_source: "Agenci, mock scrolled 90px#agents/tools-table (crop 390,746,712,205 CSS px); design-memory.png = Agenci (crop 1130,162,310,738)"
spec_refs: ["SPECIFICATION 10", "SPECIFICATION 11"]
adr_refs: [14, 3, 28]
---

# OVE_DS070: Build ToolsTable and MemoryPanel (Agent tools intersection, read-only Agent Memory)

## 1. Summary

Builds the Agent tools table ('NARZĘDZIA AGENTA · PRZECINANE Z POLITYKĄ WORKSPACE'U': capability, effective value, status) and the read-only Agent Memory panel (310px) with memory entries and the isolated-Workspace note.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Agenci.dc.html` and its 2x render `_design/views/Agenci.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C6.4 (ToolsTable, MemoryPanel). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). Effective permissions are the intersection of Owner, Workspace, Agent, Workflow and Tool policies (ADR 0003), so what the Agent profile shows is the result of that intersection, not the Agent's wish. Agent Memory is read-only for the Owner: behaviour is corrected with Owner Rules, not by editing memory (ADR 0014); memory is separate per Workspace even for public Agents; isolated Workspaces expose nothing (ADR 0028).

## 3. Scope (in)

- `ToolsTable` on top of `DataTable`, `MemoryPanel` with entries, empty and isolation states.

## 4. Out of scope

- Editing memory (not allowed by design), Memory tab full list (later), permission data (PERM).

## 5. Detailed requirements

1. `ToolsTableProps { heading: string; rows: { id: string; capability: string; value: string; status: 'allowed' | 'denied' | 'needs-approval' | 'request'; statusLabel: string }[]; footnote?: ReactNode }`: heading `SectionLabel` (the long label stays in one line with ellipsis at 712px; wraps at narrow widths), then `DataTable` (2 columns: capability 13/600, value mono 12) with a leading status glyph per row: allowed `✓` mint, denied `✗` neutral (`brak`), needs-approval `◆` amber (`wymaga Zgody`), request `◆` amber (`brak · Prośba o dostęp`); value text always states the fact (`tak`, `src/, tests/`, `tak, we własnym worktree`). Container radius 16 as DataTable. `footnote` (`InfoNote`) explains `Wynik przecięcia polityk. Zmiany robisz w Uprawnieniach Workspace'u.` with a link callback.
2. `MemoryPanelProps { title: string; readOnlyLabel: string; note: string; entries: { id: string; title: string; workspace: string; text: string }[]; isolatedNote?: string; loading?: boolean; labels: { empty: string } }`: SidePanel right 310 (padding 21): title 15/700 + `Pill` `tylko podgląd`; note 12px `text-secondary` (`Pamięci nie edytujesz. Zachowanie Agenta korygujesz Regułami Właściciela.`); entries as `ui:Card` default radius 14 padding 12: title 13/600, workspace tag mono 11 (pill `meta` tone lavender), text 12px/1.45 `text-secondary` (5-line clamp + title); isolated note: `Card` nested with `lock` icon and text (`Workspace „Projekt klienta (NDA)” jest izolowany, więc jego pamięci tu nie widać.`). Empty: `EmptyState` `Ten Agent nie ma jeszcze pamięci.`
3. There is NO edit/delete/add control in `MemoryPanel` and the props have no mutation callbacks (ADR 0014); a test asserts the absence like in OVE_DS064.
4. Memory entries are LLM-written summaries: they are text only, never rendered as Markdown/HTML, and clamp does not remove access to the full text (title attribute; a feature may open a full view).
5. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
6. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
7. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
8. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
9. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
10. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
11. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the tools table (rows Terminal w kontenerze `tak`, Zapis plików `src/, tests/`, Sieć `brak · Prośba o dostęp`, git commit `tak, we własnym worktree`, git push `wymaga Zgody`). `design-memory.png`: Memory panel (`tylko podgląd`, three entries `Koszyk z rabatami` `rezerwacje`, `Model danych rezerwacji`, `Formularz kontaktowy` `fundacja`, isolated note with lock). Not in the mock: empty, loading, tool status glyphs (derived), many entries scroll.

## 7. Reuse

Consumes `DataTable` (OVE_DS069), `ui:Card`, `ui:Pill`, `ui:SectionLabel`, `ui:EmptyState`, `StatusText`, `InfoNote` (OVE_DS040).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The tools table must never imply broader rights than the intersection: the engine supplies the effective values; the table shows `Prośba o dostęp` for denied capabilities (the only path is an Access Request, ADR 0003). Memory content could carry stale or injected text: shown inert.

## 10. Errors and edge cases

- Unknown status -> neutral glyph, raw statusLabel.
- No rows -> table hidden, `EmptyState` `Brak narzędzi (zablokowane polityką)`.
- Entry text > 1000 chars -> clamp.
- `isolatedNote` set and no entries -> only the note and the empty state.

## 11. Acceptance criteria

- [ ] Given the fixtures, Then both match their crops within tolerance.
- [ ] Given the memory props, Then no interactive control other than text-selection exists (query for buttons returns zero).
- [ ] Given status `needs-approval`, Then the glyph is `◆` and the word `wymaga Zgody` is present.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Absence test: `MemoryPanel` has no buttons/inputs.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- ASSUMPTION: tool statuses beyond the mock (`needs-approval`, `request`) use amber with `◆`.
