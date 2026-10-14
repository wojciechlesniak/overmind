---
id: OVE_DS091
title: Build QualityGate (diamond) and operator nodes IfNode, LoopNode, ParallelNode, ReviewNode
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS017, OVE_DS020, OVE_DS039, OVE_DS087, OVE_DS090]
soft_depends_on: []
provides: ["ui:QualityGate", "ui:IfNode", "ui:LoopNode", "ui:ParallelNode", "ui:ReviewNode"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Port", "ui:Pill"]
owns: ["packages/ui-kit/src/canvas/QualityGate/**", "packages/ui-kit/src/canvas/OperatorNodes/**"]
reads: []
design: design.png
design_source: "Main#canvas/quality-gate (crop 735,765,135,100 CSS px)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [19, 15]
---

# OVE_DS091: Build QualityGate (diamond) and operator nodes IfNode, LoopNode, ParallelNode, ReviewNode

## 1. Summary

Builds the Quality Gate diamond (44px square rotated 45deg, amber, caption `Quality Gate` + criteria line) and, for the palette entries the mock lists but never draws (IF, Loop, Parallel, Review), simple compact operator nodes in the same visual language so the palette can drag real previews.

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.3 (QualityGate; IfNode, LoopNode, ParallelNode, ReviewNode are R). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The quality loop (Build -> QA -> Review) repeats until the Quality Gate passes or the loop limit is hit (SPEC 8: `limit 90 min · 5 iteracji`); on failure the return edge goes back to the Developer with the report. The Gate is the decision point and uses amber because it is a waiting/decision colour, not an error.

## 3. Scope (in)

- `QualityGate`, operator nodes, ports (in left, pass right, fail bottom), states, stories.

## 4. Out of scope

- Gate criteria evaluation (engine), return edge drawing (OVE_DS094).
- Operator semantics (engine WFLOW).

## 5. Detailed requirements

1. `QualityGateProps { caption: string; criteria?: string; state?: SimpleNodeState | 'passed' | 'failed'; selected?: boolean; renderPort? }`. Diamond: a 44x44 `div` (`box-sizing: border-box`, `transform: rotate(45deg)`, `border-radius: 10px`, `border: 2.5px solid #FFB547`, bg `#1A1208`) centred in a 44x44 slot; the rotation applies ONLY to the diamond, not to ports or text. Caption below at `top: 54px`, width 100, centred, mono 12/500 `#EFE9F7` (`Quality Gate`); criteria at `top: 72px`, width 132, centred, mono 11 `#8C80A6` (`testy 100% · 0 krytycznych`), 2-line clamp.
2. Ports (unrotated): input left `(−7, 15)`, `pass` output right `(37+, 15)`, `fail` output bottom `(15, 37+)` with 14px circles like tiles; port roles are labelled (`aria-label` `wejście`, `spełnia`, `nie spełnia`).
3. States: `passed` border mint and `✓`, `failed` border error and `✗`, `active` amber glow (`glow-node-waiting`), `selected` violet ring following the diamond shape (ring drawn on the diamond via `outline-offset`, not the square slot).
4. Operator nodes (R, compact 112x48 pill-rect, radius 14, 2px border in violet `#5B4596`, bg `#160F24`, icon 16 + label mono 12): `IfNode` (`IF`, icon `branch`: two out ports `tak`/`nie`), `LoopNode` (`Loop`, icon `refresh`, in/out + optional iteration label `max 5`), `ParallelNode` (`Parallel`, icon `workflow`, one in, N outs), `ReviewNode` (`Review`, icon `check`, in/out). They reuse the same state set and `renderPort` seam. They are previews/placeholders for MVP editing: richer config lives in the Inspector (OPEN).
5. Sizes exported (`GATE_SLOT = 44`, `OPERATOR_SIZE = {w:112,h:48}`) so the router anchors correctly; the diamond's visual anchor is its centre-left/right/bottom vertex, not the slot box.
6. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
7. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
8. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
9. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
10. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
11. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
12. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the amber diamond with caption `Quality Gate` and `testy 100% · 0 krytycznych` between QA/Security and Senior Reviewer. Operator nodes are NOT drawn in the mock (palette chips only): their look here is derived from StartNode/Join styling and flagged in section 14. Not drawn: passed/failed, selected, ports.

## 7. Reuse

Consumes `ui:Port`, `ui:Pill`, `ui:Icon`; shares `SimpleNodeState` with OVE_DS090. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Canvas boundary (ADR 0018, ADR 0019): the kit component is PURE and presentational. It knows only our own `CanvasModel` types (`canvas/model.ts`) and never imports `@xyflow/react`; only the folder `canvas/flow/**` (OVE_DS095) may import React Flow and wraps these components as custom nodes/edges. The editor only draws and edits a Workflow definition; the engine runtime executes it and the canvas shows state it is given (it never computes run state). Coordinates are WORLD px; screen = world x zoom (mock zoom 0.7 default).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Canvas data (node titles, status text, skill names, edge labels) comes from user/agent text and is untrusted: render as text, clamp length, never HTML. The canvas performs no action itself: edits are emitted as callbacks and the engine validates the Workflow (a client-side valid-looking graph is never trusted). Colour never carries state alone: every state also has a glyph + word (SVG glyph with sr-only text, E21). The Gate result shown (`passed`/`failed`) is engine data; the UI offers no way to override a failed Gate (no `Pass anyway` affordance, ADR 0015).

## 10. Errors and edge cases

- Criteria empty -> caption only.
- Rotated hit-testing: the clickable area is the diamond (use `clip-path`) so neighbours stay clickable.
- Unknown operator state -> idle.

## 11. Acceptance criteria

- [ ] Given the Gate fixture, Then the diamond is 44px, rotated 45deg, amber 2.5px border, with caption and criteria at the specified positions.
- [ ] Given ports, Then labels are exposed to AT and are not rotated.
- [ ] Given `failed`, Then error border and `✗` word appear.
- [ ] Given IF node, Then two labelled output ports exist.
- [ ] Visual match with `design.png` within tolerance.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- DESIGN GAP: operator node visuals (IF/Loop/Parallel/Review) are not in the mock; derived here, needs Owner/design review.
- ASSUMPTION: `branch`, `refresh` icons come from the extra icon pass (UI-06).
