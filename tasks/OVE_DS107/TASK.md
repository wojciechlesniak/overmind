---
id: OVE_DS107
title: Visual regression part 3 for the canvas page, wizard steps, Tray and Telegram
area: DS
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS039, OVE_DS041, OVE_DS043, OVE_DS044, OVE_DS045, OVE_DS052, OVE_DS073, OVE_DS074, OVE_DS085, OVE_DS086, OVE_DS095, OVE_DS096, OVE_DS097, OVE_DS098, OVE_DS099, OVE_DS100, OVE_DS101, OVE_DS102, OVE_DS103]
soft_depends_on: []
provides: ["lib:visualPagesC"]
needs: ["ui:tokens", "ui:Text", "ui:Icon"]
owns: ["packages/ui-kit/src/pages/c/**", "packages/ui-kit/tests/visual/c/**"]
reads: ["OVE_TEST005"]
design: design.png
design_source: "Main#all/main+kreator+tray+telegram (crop 0,0,1440,900 CSS px); design-kreator-folder.png = Kreator-Folder (crop 0,0,1440,900); design-kreator-polaczenia.png = Kreator-Polaczenia (crop 0,0,1440,900); design-tray.png = Tray (crop 0,0,1440,900); design-telegram.png = Telegram (crop 0,0,1440,900)"
spec_refs: ["SPECIFICATION 8", "SPECIFICATION 14"]
adr_refs: [17, 18]
---

# OVE_DS107: Visual regression part 3 for the canvas page, wizard steps, Tray and Telegram

## 1. Summary

Assembles and verifies the remaining page stories: the Workflow canvas (`Main`) rendered both statically and through the React Flow adapter, the two wizard steps (Kreator-Folder, Kreator-Polaczenia), the Tray popover (380x560) and the Telegram chat (390x844).

## 2. Context

The canvas page is the most complex composition (left palette, header, supervision strip, stage with nodes/edges/frame/overlays, inspector). It must match the mock in both rendering modes: the static `CanvasStage` and the interactive `FlowCanvas` (ADR 0018: React Flow behind our components must not change the pixels). Wizard, Tray and Telegram have their own viewport sizes.

## 3. Scope (in)

- `Pages/Main` (static) and `Pages/MainInteractive` (React Flow adapter) with the full mock model (6 agents, join, discussion, loop frame, gate, return edge, save node).
- `Pages/KreatorFolder`, `Pages/KreatorPolaczenia` (scrolled main column), `Pages/Tray` (380x560), `Pages/Telegram` (390x844).
- Visual comparison with PNGs, exceptions file, fixes in composition.
- A canvas fixture file `canvas/fixtures/deliveryWorkflow.ts` (the exact node/edge/group model of the mock, world coordinates from the mock HTML) reused by stories of all canvas tasks.

## 4. Out of scope

- Other pages (OVE_DS105, OVE_DS106).

## 5. Detailed requirements

1. Canvas model fixture (world px, from the mock HTML): start (10,162); Product Owner (110,70), Designer (110,230) agent-public; join ring (374,193) with caption `join · wszyscy`; discussion `Zakres MVP` (440,150, 240x112); save-decisions pill; loop frame rect (12,402,1096,348) `Pętla jakości · Build → QA → Review · iteracja 2 z 5` / `limit 90 min · 5 iteracji`; Developer lane-build (50,520) selected; QA lane-qa working; Security agent-private waiting-approval; Quality Gate diamond; Senior Reviewer lane-review as drop target; edges incl. active segment and the dashed amber return edge with label. Ids stable, viewport `{x:8,y:12,zoom:.7}`.
2. Static vs interactive parity: both stories screenshot within the same tolerance of `Main.png` AND within 0.3% of each other (test compares the two renders directly) so the React Flow adapter cannot drift.
3. Overlays in place: validation badge top-right, legend card, toolbar bottom-left, minimap bottom-right, inspector (Developer), supervision strip, workflow header, left panel (Skill list with the dragging item + palette chips).
4. Wizard pages: `KreatorFolder` (step 1; Back hidden per E24 recorded as exception) and `KreatorPolaczenia` (step 2; main column scrolls, footer sticky per E2): compare first viewport, plus the scrolled state to the bottom against a generated scrolled mock render. Tray: popover at 380x560 with internal scroll (E3 exception: Quit visible). Telegram: 390x844 frame.
5. Interaction smoke on `MainInteractive`: pan/zoom via controller changes label `70%` -> `80%`; selecting the Developer tile updates the Inspector; dragging the `review-rubric` item over Senior Reviewer shows `upuść → 1 skill` (play function).
6. Same determinism, tolerance and CI reporting as OVE_DS105.
7. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
8. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
9. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
10. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
11. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
12. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
13. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png` = the canvas view (Main); extras: Kreator-Folder, Kreator-Polaczenia, Tray, Telegram (their own sizes are cropped at full view: 1440x900 for the wizard, the Tray and Telegram PNGs are smaller). Targets of the comparison.

## 7. Reuse

Reuses all canvas, wizard, tray and Telegram components; defines the shared canvas fixture. Capability naming and prop names follow part 1 (`ui:<ComponentName>`). New reusable pieces created here are listed in `provides` and must be consumed by later tasks instead of being copied.

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Dev/test composition only; the interactive story imports `FlowCanvas` from `canvas/flow` (allowed: it is a kit entry point).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Fictional fixtures. The drag test uses synthetic events with our MIME only.

## 10. Errors and edge cases

- React Flow measures nodes asynchronously -> wait for `.react-flow__node` measured state before screenshots.
- Edge routes differ by 1px between engines -> tolerance, not masking.
- Tray/Telegram viewport sizes differ -> per-story viewport.

## 11. Acceptance criteria

- [ ] `Pages/Main` and `Pages/MainInteractive` are within tolerance of `Main.png` and of each other.
- [ ] Wizard, Tray and Telegram stories are within tolerance of their PNGs after documented exceptions.
- [ ] Interaction smoke tests pass.
- [ ] `deliveryWorkflow.ts` fixture is used by at least the canvas stories of tasks OVE_DS088, OVE_DS094, OVE_DS100.

## 12. Test plan

Playwright via the part 1 harness; Storybook play functions for the smoke tests.

## 13. Parallelization notes

Parallel with the other visual tasks; owns the canvas fixture file other canvas stories may import after it lands (they keep local mini fixtures meanwhile).

## 14. Open questions and assumptions

- ASSUMPTION: exact node world coordinates are taken from the mock HTML (ids stable).
