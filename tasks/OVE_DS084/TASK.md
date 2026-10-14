---
id: OVE_DS084
title: Build DiscussionResultPanel (positions, draft Decision, tiebreak, actions)
area: DS
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS016, OVE_DS017, OVE_DS022, OVE_DS031, OVE_DS039, OVE_DS040, OVE_DS083]
soft_depends_on: []
provides: ["ui:DiscussionResultPanel", "ui:PositionRow"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Card", "ui:Pill", "ui:Button", "ui:SectionLabel", "ui:Avatar", "ui:DocRefChip", "ui:InfoNote"]
owns: ["packages/ui-kit/src/discussion/DiscussionResultPanel/**"]
reads: []
design: design.png
design_source: "Dyskusja#disc/positions-panel + outcome-draft (crop 1130,117,310,783 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [8, 15, 25]
---

# OVE_DS084: Build DiscussionResultPanel (positions, draft Decision, tiebreak, actions)

## 1. Summary

Builds the 310px right panel of a Discussion: positions summary (stance counts and rows), the draft Decision card (dashed violet) with the tasks that appear after approval, the no-agreement tiebreak note, and the actions `Zatwierdź wynik` / `Zakończ teraz`.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Dyskusja.dc.html` and its 2x render `_design/views/Dyskusja.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C10.4 (DiscussionResultPanel). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). A Discussion ends in a proposed Decision; only the Owner approves it, and it then becomes an append-only Decision with follow-up Tasks on the Board (SPEC 8, ADR 0008, ADR 0011). If Agents do not agree the tiebreak rule says the Owner decides (note is shown). Approve is a consequential action: it writes the Decision and creates Tasks.

## 3. Scope (in)

- `DiscussionResultPanel`, `PositionRow`, draft card, tiebreak note, action row with approve/end states, stories (draft, no draft yet, approved, ended).

## 4. Out of scope

- Writing the Decision (DEC feature), the Discussion thread (OVE_DS083).

## 5. Detailed requirements

1. `DiscussionResultPanelProps`:
   ```ts
   interface PositionRowData { id: string; agent: { name: string; hue: AgentHue; initials: string }; stance: 'agree'|'no-preference'|'conditional'|'disagree'; label: string; detail?: string }
   interface DiscussionResultPanelProps {
     heading: string; counts: { stance: PositionRowData['stance']; label: string; count: number }[]; positions: PositionRowData[];
     draft?: { eyebrow: string /* 'DECYZJA (PROPOZYCJA)' */; title: string; rationale?: string; tasksHeading: string; tasks: { id: string; title: string; doc?: { path: string; anchor?: string } }[] };
     tiebreakNote?: string; status: 'open' | 'approved' | 'ended';
     onApprove?(): void; onEndNow?(): void; labels: { approve: string; endNow: string; approved: string; ended: string };
   }
   ```
2. Panel: aside 310 (`SidePanel` right), padding 21, column gap 18, scroll inside (G5). Heading `Stanowiska` 15/700 + stance count chips (`StancePill` with count, wrap). Position rows (height 48): Avatar 28 + name 13/600 + stance pill + one-line detail ellipsis.
3. Draft card: `ui:Card` tone `drop-violet` (dashed 1.5px violet `rgba(155,123,255,.6)`, bg `rgba(155,123,255,.05)`, radius 16, padding 14, gap 10): eyebrow `SectionLabel` `DECYZJA (PROPOZYCJA)`, title 15/700, rationale 13/1.45 muted, then `ZADANIA PO ZATWIERDZENIU` label and a list (id mono 11 `T-?` placeholder or `nowe`, title 13px, `DocRefChip` per task; max 6 + `+N`). The draft is explicitly labelled as a proposal in words.
4. Tiebreak note: `InfoNote` 12px in a muted bordered box (`Brak zgody: o wyniku decydujesz Ty.`), shown only if supplied.
5. Actions row (bottom, sticky, gap 10): `Button primary-violet lg` `Zatwierdź wynik` (flex 1) and `Button secondary lg` `Zakończ teraz`. `status=approved` replaces actions with a mint `Pill` `zatwierdzono` and a link to the Decision (feature slot); `ended` shows `zakończono bez wyniku`. Approve is disabled when no `draft` (reason text), and while a request is in flight (`busy` prop, `aria-busy`, double activation ignored).
6. Both actions are keyboard reachable; the order is positions, draft, note, actions. No destructive styling; approving needs no extra dialog in the component, but `onApprove` is only emitted once per `open` status.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the right panel: stance counts and rows (PO mint, Designer grey, ...), the dashed violet draft Decision with `ZADANIA PO ZATWIERDZENIU` (doc chips), the tiebreak note, the violet `Zatwierdź wynik` and secondary `Zakończ teraz`. Not drawn: no draft, approved/ended, busy, many tasks.

## 7. Reuse

Consumes `ui:Card`, `ui:Pill`/`StancePill` (OVE_DS083), `ui:Button`, `ui:SectionLabel`, `ui:Avatar`, `DocRefChip`, `InfoNote` (OVE_DS040). Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). The draft Decision is a proposal generated by Agents: text only. Approve is a state-changing Owner action: single-fire, no auto-approve on timers, and never offered when `status != open`. A Decision created by approval is append-only (ADR 0008): the panel offers no edit/delete after approval.

## 10. Errors and edge cases

- No positions -> `Brak stanowisk` line.
- Tasks empty -> tasks block hidden, approve still allowed (decision without tasks).
- `status` unknown -> treated as `open` but actions disabled.

## 11. Acceptance criteria

- [ ] Given `draft` undefined, Then approve is disabled with a visible reason.
- [ ] Given `status=approved`, Then the action buttons are gone and the mint pill shows.
- [ ] Given a double click on approve, Then `onApprove` fires once while `busy`.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- OPEN: whether `Zakończ teraz` asks for confirmation (default: feature dialog, because it forfeits the proposed Decision).
