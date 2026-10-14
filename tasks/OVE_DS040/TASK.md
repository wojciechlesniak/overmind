---
id: OVE_DS040
title: Shared UI domain types, state maps and small shared composites (DocRefChip, RunLink...)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS017, OVE_DS020, OVE_DS031, OVE_DS039]
soft_depends_on: []
provides: ["ui:UiDomainTypes", "ui:stateMaps", "ui:DocRefChip", "ui:ArtifactChip", "ui:EvidenceList", "ui:RunLink", "ui:InfoNote", "ui:CalloutAmber", "ui:LinkRow", "ui:OriginLine"]
needs: ["ui:tokens", "ui:Icon", "ui:Text", "ui:Pill", "ui:Card", "ui:StatusText", "ui:StatusDot"]
owns: ["packages/ui-kit/src/common/**"]
reads: []
design: design.png
design_source: "Tablica#task-inspector-doc-ref + timeline + evidence (crop 1141,232,279,364 CSS px); design-evidence.png = Decyzje (crop 500,605,912,173); design-footnote.png = Zgody (crop 460,532,952,116)"
spec_refs: ["SPECIFICATION 6", "SPECIFICATION 10"]
adr_refs: [8, 28, 25]
---

# OVE_DS040: Shared UI domain types, state maps and small shared composites (DocRefChip, RunLink...)

## 1. Summary

Creates the display-level domain types (`Visibility`, `AgentState`, `RunState`, `TaskState`, `DecisionStatus`, `DecisionOutcome`, `ApprovalKind`), the single state-to-tone/glyph maps every composite uses, and the small shared composites of inventory C14 (documentation reference chip, artifact chip, evidence list, Run link, info note, amber callout, link row, origin line). All other DS part 2 tasks consume these instead of re-deriving colours per state.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Tablica.dc.html` and its 2x render `_design/views/Tablica.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C14 (shared small composites) and A.1.3 (state-to-colour mapping). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The same state vocabulary (working, waiting for Approval, done, idle, failed, paused) appears in the Chief list, Workflow canvas, Task Board, Tray and Telegram. Without one map each composite would hard-code its own colours (E27, E34). Visibility is always a word, never only a colour (ADR 0028). Glossary: Agent State = `pracuje / czeka na Zgodę / bezczynny / skończył` (herdr state is only a hint, ADR 0026, but the UI vocabulary is the same).

## 3. Scope (in)

- `common/types.ts`: display unions and tone/glyph/label-key maps.
- `DocRefChip`, `ArtifactChip`, `EvidenceList`, `RunLink`, `InfoNote`, `CalloutAmber`, `LinkRow`, `OriginLine` with stories.
- A pure helper `hueForAgentId(id: string): AgentHue` that deterministically maps a Dynamic Agent id to one of the 8 hues (inventory A.1.3 recommendation) so Dynamic Agents get stable colours.

## 4. Out of scope

- Avatar, Pill, StatusText, Card primitives (part 1, needs).
- Formatting of dates/numbers (E32: done by the feature with `Intl pl-PL`; components receive ready strings).
- Task/Decision-specific composites that merely use these chips (OVE_DS063, OVE_DS065).

## 5. Detailed requirements

1. Types (file `common/types.ts`, all exported):
   ```ts
   export type Visibility = 'public' | 'private';
   export type AgentState = 'working' | 'waiting-approval' | 'done' | 'idle' | 'waiting-gate' | 'failed' | 'paused';
   export type RunState = 'running' | 'done' | 'cancelled' | 'escalated' | 'paused' | 'failed';
   export type TaskState = 'unassigned' | 'queued' | 'working' | 'waiting-approval' | 'reviewing' | 'done' | 'accepted' | 'blocked' | 'parked';
   export type DecisionStatus = 'proposed' | 'accepted' | 'rejected' | 'superseded' | 'needs_review';
   export type DecisionOutcome = 'unknown' | 'positive' | 'mixed' | 'negative';
   export type ApprovalKind = 'git-push' | 'new-domain' | 'delete' | 'payment' | 'external-message' | 'budget' | 'access-request' | 'escalation' | 'other';
   export type Tone = 'neutral' | 'mint' | 'amber' | 'lavender' | 'blue' | 'violet' | 'magenta' | 'error';
   export type OriginChannel = 'desktop' | 'telegram' | 'local' | 'chief' | 'owner' | 'import';
   ```
   `Tone` MUST equal the `tone` union of `ui:Pill` (import the type from the primitive if exported, else define here and keep in sync via a type-level test).
2. State maps (`common/stateMaps.ts`), exhaustive `Record`s so adding a union member is a compile error: `agentStateTone` (working -> magenta, waiting-approval -> amber, done -> mint, idle -> neutral, waiting-gate -> neutral, failed -> error, paused -> neutral), `agentStateGlyph` (working `●`, waiting-approval `◆`, done `✓`, idle `○`, waiting-gate `○`, failed `✗`, paused `○`; rendered by `ui:StatusText`, which draws SVG glyphs per E21), `agentStateGlow` (true for working, waiting-approval, done, failed; false for idle/waiting-gate/paused), `runStateTone`, `taskStateTone` (queued neutral, working magenta, waiting-approval amber, reviewing violet, done/accepted mint, blocked error, parked neutral, unassigned neutral), `decisionStatusTone` (accepted mint, proposed lavender, needs_review amber, superseded neutral, rejected error), `decisionOutcomeTone` (positive mint, mixed amber, unknown neutral, negative error), `visibilityTone` (public blue, private violet), `approvalKindTone` (access-request magenta, escalation error, everything else amber). Each map has a unit test that iterates every key.
3. `labelKeys`: for every union member a stable i18n label key string constant (for example `state.working`), exported as `as const` so `apps/desktop` can map keys to translations; components never import translations.
4. `hueForAgentId(id)`: FNV-1a 32-bit hash of the UTF-8 string modulo 8 into the ordered hue list `['qa','security','developer','po','designer','reviewer','researcher','chief']` EXCLUDING `chief` (Chief is never hash-assigned), so effectively modulo 7 over the first seven. Pure, deterministic, unit-tested with 3 fixed vectors.
5. `DocRefChip` props `{ path: string; anchor?: string; onOpen?: () => void; href?: string; size?: 'sm'|'md' }`: 12px `document` icon + mono 11 text in `text-lavender` (#D6C9FF); renders `path` plus `#anchor` as one string (`spec.md#koszyk`); nowrap + end ellipsis + `title` with the full value, `max-width: 100%`; if `onOpen` or `href` is given it is a `button`/`a` with hover underline and focus ring, otherwise a `span`. No path normalisation here (the feature validates paths, SEC002 rules).
6. `ArtifactChip` props `{ name: string; tone?: 'mint'|'magenta'; onOpen?: () => void }`: built on `ui:Pill` (mint = `meta-tone` mint for evidence files such as `unit-report.xml`; magenta = `skill-uses` tint for traces such as `e2e-trace.zip`, as in Task detail). Name ellipsis at 200px max with title.
7. `EvidenceList` props `{ items: { id: string; name: string; onOpen?: () => void }[]; label?: string; max?: number; moreLabel?: (hidden: number) => string }`: optional `SectionLabel` + wrapping row of `ArtifactChip` (gap 6); when `items.length > max` shows a `+N` chip. Empty list renders nothing (the parent decides on an empty-state text).
8. `RunLink` props `{ number: string | number; title?: string; onOpen: () => void; prefix: string }`: text such as `Run #14 · Dostarczanie funkcji` rendered as the primitive text-link style (`text-link` #E9D8FF, underline, 12-13px). `prefix` is the localised word `Run`; the component composes `${prefix} #${number}` and ` · ${title}`.
9. `InfoNote` props `{ children; tone?: 'muted' }`: 12px/1.4 `text-muted`, used for footnotes (e.g. the approval footnote). `CalloutAmber` props `{ children; icon?: IconName; title?: string }`: `ui:Card` tone `callout-amber`, 12/1.45 text in `text-callout-amber` (#E9D2AE, token), radius 14, padding 12 14, `role="note"`.
10. `LinkRow` props `{ label: string; children: ReactNode; onActivate?: () => void }`: label in muted 12px + link content (text-link); used for `Zastępuje: D-03 · Biblioteka dat: moment (Strona fundacji)` and `Pochodzenie: Dyskusja 'Zakres MVP' · Decyzja D-12`. Whole link content is one focusable element; the label is outside it.
11. `OriginLine` props `{ channel: OriginChannel; label: string; detail?: string }`: mono 11 `text-muted` line, e.g. `z Telegrama · tylko Run #13`, `z desktopu`, `przy komputerze`; `channel` only selects a leading 12px icon (`bell`/`telegram-plane` for telegram, none otherwise) and a `data-channel` attribute for tests. The text is always present, so the channel is never conveyed by icon alone.
12. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
13. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
14. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
15. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
16. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
17. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
18. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` shows the Task Board inspector middle section: the Documentation reference card (doc chip `docs/spec.md#koszyk` + quote), the origin link row and the evidence chips (`unit-report.xml`, `e2e-trace.zip`). `design-evidence.png` shows the mint evidence chips of the Decision outcome card. `design-footnote.png` shows the footnote/callout text under the approval actions. Exact values: doc chip mono 11 #D6C9FF; evidence chip = Pill meta-tone mint (12px mono); amber callout 1px rgba(255,181,71,.35) on #1E160A, 12/1.45 #E9D2AE, radius 14. States not in the mock: hover (underline + `bg-surface`), focus (ring), disabled chips (opacity .45), long names (ellipsis), empty evidence (renders nothing).

## 7. Reuse

Consumes `ui:Pill` (chips), `ui:Icon` (`document`), `ui:Text`, `ui:Card` (callout tone), `ui:StatusText`/`ui:StatusDot` (only via the maps). MUST create and then be the only source of the unions and maps listed in `provides`; every other part 2 task imports them from `packages/ui-kit/src/common`. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse.

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). `DocRefChip` shows paths from untrusted documents: never resolve or open them itself; `onOpen` receives control and the feature validates the path against Allowed Directories.

## 10. Errors and edge cases

- Empty `path` -> chip renders nothing and logs a dev-only warning (no throw).
- Path longer than the container -> ellipsis, full value in `title`.
- Unknown enum value arriving at runtime (newer engine) -> maps fall back to `neutral` tone and the raw value as label (additive contracts, SPEC 13), never throw.
- `items` contains duplicate ids -> keyed by id+index, dev warning.

## 11. Acceptance criteria

- [ ] Given every member of each union, When the maps are iterated, Then each has tone, glyph, glow and label key (type-checked and unit-tested).
- [ ] Given `hueForAgentId("agent-x")` called twice, Then the result is identical and never `chief`.
- [ ] Given `DocRefChip` with `onOpen`, When Enter or Space is pressed on the focused chip, Then `onOpen` fires once.
- [ ] Given 6 evidence items and `max=4`, Then 4 chips and a `+2` chip render.
- [ ] Given an unknown `state` string cast into a map lookup, Then neutral fallback renders without error.
- [ ] All stories pass axe; visual match with `design.png` region within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit tests: maps exhaustiveness, `hueForAgentId` vectors, fallback behaviour. Story: `DocRefChip/Default|Interactive|LongPath`, `EvidenceList/Overflow`, `CalloutAmber/WithTitle`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review. This task is the root of part 2: most other tasks depend on it, so it should be merged first together with OVE_DS041.

## 14. Open questions and assumptions

- ASSUMPTION: if part 1 already exports `Tone`/`AgentState` from a primitive, re-export those and delete the local definition (single source of truth). The linker should report duplicate `ui:UiDomainTypes`-like capabilities.
- ASSUMPTION (E10): approval counts use amber; magenta is only for working counts. Encoded in `agentStateTone`.
- OPEN: whether `waiting-gate` ("czeka na Quality Gate") needs its own tone; default neutral as in the mock.
