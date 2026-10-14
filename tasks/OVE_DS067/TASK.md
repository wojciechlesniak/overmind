---
id: OVE_DS067
title: Build the Skill drag-and-drop kit (payload, drag source, SkillDropZone, keyboard path)
area: DS
kind: ui
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS009, OVE_DS013, OVE_DS017, OVE_DS029, OVE_DS039, OVE_DS040]
soft_depends_on: []
provides: ["ui:SkillDnd", "lib:skillDragPayload", "ui:SkillDropZone", "ui:SkillDragChip"]
needs: ["ui:tokens", "ui:Text", "ui:Icon", "ui:Pill", "ui:Menu", "ui:Button"]
owns: ["packages/ui-kit/src/dnd/**"]
reads: []
design: design.png
design_source: "Main#canvas/skill-item-dragging + drag chip (crop 80,655,225,85 CSS px); design-chip.png = Main (crop 860,698,180,50)"
spec_refs: ["SPECIFICATION 8"]
adr_refs: [28, 12, 3]
---

# OVE_DS067: Build the Skill drag-and-drop kit (payload, drag source, SkillDropZone, keyboard path)

## 1. Summary

Builds the headless drag-and-drop layer for assigning Skills: a validated payload codec, `useSkillDragSource`, `useSkillDropTarget`, a drag-state context, the visual `SkillDragChip` and `SkillDropZone` (dashed magenta), and the mandatory keyboard/menu alternative. It is shared by the Workflow canvas (drop on a node's Skills tab) and the Agent profile (drop zone).

## 2. Context

Part of the Overmind design system (`packages/ui-kit`, area DS, part 2 = composites; part 1 = OVE_DS001..OVE_DS039 delivers tokens, icons, primitives and the story/visual harness). Pixel truth is the static mock `_design/source/Main.dc.html` and its 2x render `_design/views/Main.png`; the anatomy is in `_design/COMPONENT-INVENTORY.md` C11.6/C11.7 (SkillPalette drag states, SkillDragChip) and C6.4 (SkillAssignment drop zone). The normalisations in inventory section E win where the mock disagrees (this task says so where it matters). Product copy in the mocks is Polish (ADR 0017: code and docs English, product UI Polish first). The Owner assigns Skills by dragging them onto the Skills tab of a node (SPEC 8, ADR 0028: works wherever both items are visible; a private Skill on a public Agent only works in its own Workspace). A Skill gives no tool access (ADR 0003, 0012). HTML5 drag-and-drop hides `dataTransfer` contents during `dragover`, so a context store holds the dragged payload while dragging. Dragging is not accessible by itself (WCAG 2.5.7), so every drop target must also be reachable by keyboard.

## 3. Scope (in)

- `skillDragPayload` (types, encode, strict validate), `SkillDragProvider`, `useSkillDragSource`, `useSkillDropTarget`, `SkillDragChip`, `SkillDropZone`, `useSkillAssignMenu` (keyboard path), docs story.

## 4. Out of scope

- Canvas node tile and SkillsTab drop visuals (OVE_DS089, OVE_DS097), the actual assignment use case (SKILL area), cross-window drag.

## 5. Detailed requirements

1. Payload (file `dnd/payload.ts`): `export const SKILL_DRAG_MIME = 'application/x-overmind-skill+json'`;
   ```ts
   interface SkillDragPayload { v: 1; skillId: string; version: string; name: string; visibility: Visibility; ownerWorkspaceId?: string }
   function encodeSkillPayload(p: SkillDragPayload): string
   function parseSkillPayload(raw: string): SkillDragPayload | null   // strict: unknown keys rejected, string lengths <= 200, visibility enum, JSON size <= 1 KiB, v === 1
   ```
   The payload carries ids and display strings ONLY. It is never trusted for authorisation: `canAccept` (below) and the engine re-check against real Skill data by `skillId` (a foreign page/app can put arbitrary data under any MIME).
2. Context: `SkillDragProvider` keeps `{ dragging: SkillDragPayload | null }` in a module-scoped store (`useSyncExternalStore`) set on `dragstart` and cleared on `dragend`/`drop`/`Escape`/window `blur`; safety timeout 30s clears a stuck state. During `dragover` the drop target reads the payload from the store, not from `dataTransfer`.
3. `useSkillDragSource(payload, opts?: { disabled?: boolean; ghostLabel?: string })` returns `{ dragProps: { draggable: true; onDragStart; onDragEnd }; isDragging: boolean }`. `onDragStart`: `dataTransfer.effectAllowed = 'copy'`, sets `SKILL_DRAG_MIME` and a plain-text fallback (`name vN`) and a custom drag image from an off-screen `SkillDragChip` (created, attached, removed in the next frame) via `setDragImage`. The source element stays in place (copy, not move) and shows the dragged style: dashed 1px `#F25FC4`, fill rgba(242,95,196,.06), text `#FFB3E6`, and the helper line (`przeciągasz na Senior Reviewera` once a target is hovered; string supplied by `describeTarget`).
4. `useSkillDropTarget<T>(opts: { targetId: string; canAccept: (p: SkillDragPayload, targetId: string) => { ok: true } | { ok: false; reason: string }; onDrop: (p: SkillDragPayload, targetId: string) => void; accepts?: boolean })` returns `{ dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop }; state: 'idle' | 'armed' | 'over-accept' | 'over-reject'; reason?: string }`. `armed` = a Skill is being dragged somewhere (target could show a subtle hint); `over-accept` when `canAccept.ok`; `over-reject` with `reason`. `onDragOver` calls `preventDefault()` only for accepted drops and sets `dropEffect = 'copy'` (`'none'` for rejected). `onDrop` re-parses the payload from `dataTransfer` (not the store) with `parseSkillPayload`, runs `canAccept` again and only then calls `onDrop`. Enter/leave use a counter to ignore child enter/leave flicker.
5. `SkillDropZone` (Agent profile `upuść tu Skill z biblioteki`): props `{ targetId; canAccept; onDrop; label: string; rejectLabel?: (reason: string) => string; children?: ReactNode }`; visual = 1px dashed `line-strong` (`#5B3E8F`) box radius 12 padding 12 text 12px `text-secondary` idle; `over-accept` = 1px dashed `#F25FC4` + fill rgba(242,95,196,.05) + text `#FFB3E6`; `over-reject` = dashed error `#FF8FA3` + the reason text. Always `role="group"` with the label; the zone is also the container for the assigned chips (children).
6. `SkillDragChip` props `{ name: string; version?: string }`: pill, fill `#F25FC4`, text `ink` mono 13/600, padding 6 12, `transform: rotate(-4deg)`, `glow-drag` (0 12px 30px rgba(242,95,196,.55)), `z-drag` layer; used as the drag image and in the docs story.
7. Keyboard alternative (`useSkillAssignMenu`): returns props for a `Button` (`ghost`, `aria-haspopup="menu"`) that opens a `ui:Menu` listing eligible targets (`{ id, label, disabledReason? }[]` supplied by the feature) for a given Skill; Enter selects and calls the same `onDrop(payload, targetId)` path. Disabled targets show their reason. Every place that has a drop target MUST also render this menu trigger (`Przypisz do…`) - asserted in the canvas/agent-profile stories.
8. Reduced motion: no rotation animation on the chip (static `rotate(-4deg)` is allowed, no transitions); the drag image is static.
9. Cleanup: all listeners are attached via React props (no `document.addEventListener` leaks except the Escape/blur listeners registered while `dragging` is non-null and removed after); the module store has a `resetSkillDragForTests()`.
10. GLOBAL RULE G1 (tokens): every colour, radius, spacing, border, glow and motion value comes from the `--om-*` CSS custom properties / typed `tokens` export of part 1 (`ui:tokens`). No raw hex or rgba literal in component CSS (inventory E12). Values quoted in this task are the token VALUES, for the reviewer.
11. GLOBAL RULE G2 (reuse): the primitives named in `needs` are imported, never re-implemented or copy-styled. If a primitive lacks a variant this task needs, do not patch it: record it in section 14 and use the closest variant (the linker raises it with part 1).
12. GLOBAL RULE G3 (strings): the component contains no user-visible copy. Every visible string and every `aria-label` is a prop (grouped in a typed `labels` object where there are more than two), so `apps/desktop` can feed i18n keys (EN default, PL first translation, OVE_ARCH011). Stories and fixtures use the Polish mock copy verbatim as sample data.
13. GLOBAL RULE G4 (a11y): correct role/name/state, full keyboard operation, the global `:focus-visible` ring (E19, never `outline: none` without replacement), minimum text size 10px (E17), control borders meet 3:1 via `line-control` (E18), state is never conveyed by colour alone (icon or word), animations disabled under `prefers-reduced-motion`.
14. GLOBAL RULE G5 (layout robustness): `box-sizing: border-box`, buttons/inputs `font: inherit` (E9), flex children that hold text get `min-width: 0`; single-line text that can overflow uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` and a `title` (or tooltip) with the full value; multi-line text wraps with `overflow-wrap: anywhere` for paths and ids. Scroll happens inside panels, never on the page (styl-wizualny).
15. GLOBAL RULE G6 (API shape): named export `<Name>` and exported `<Name>Props`; function component; root element forwards `ref` and passes through `className`, `data-*` and native attributes in line with the part 1 convention; controlled where there is interactive state (`value`/`onChange`), with no internal data fetching, no timers other than documented animations, no global state.
16. GLOBAL RULE G7 (stories): Storybook CSF3 file with one story per variant and per state listed here (including the states the mock does not draw), a `Playground` story with controls, fixtures in `<Name>.fixtures.ts` (typed, deterministic, no `Date.now()`/random), and play-function interaction tests for every interactive behaviour.

## 6. Design notes

`design.png`: the Skill palette item mid-drag (dashed magenta border, `review-rubric v1`, helper `przeciągasz na Senior Reviewera`). `design-chip.png`: region of the canvas with the floating magenta chip `review-rubric` rotated -4deg with glow. Drop zone idle/over states for the Agent profile are not in the mock (derive from the same dashed-magenta language: idle dashed `line-strong`, hover magenta). Not in the mock: rejected drop, keyboard menu, drag cancelled.

## 7. Reuse

Consumes `ui:Pill`, `ui:Menu`, `ui:Button`. Provides the DnD primitives consumed by OVE_DS097, OVE_DS089 (SkillsTab drop target), OVE_DS068 (SkillDropZone) and the canvas FlowCanvas interaction layer (OVE_DS096).

## 8. Architecture and code placement

Layer: UI, presentational. Package `packages/ui-kit`, folder owned by this task. Depends only on React, the part 1 tokens and the primitives listed in `needs`; `ui-kit` imports nothing from `apps/*`, `api-client`, `contracts` or any other internal package (CONVENTIONS 6). Props are plain, serialisable view-models, so a feature in `apps/desktop` maps gateway data (the UI only talks to the engine through `api-client`) into them. SRP: one component per file, shared helpers live in the `common` group, never copied. Dependency direction: composite -> primitive -> token, never the reverse. Headless hooks + two small visual components; no dependency on React Flow, the editor or the engine. Native HTML5 DnD (no new dependency: ADR 0019 spirit, SPEC 19.7); a library such as dnd-kit is rejected unless native DnD proves unreliable in WKWebView (see open questions).

## 9. Security and safety

UI-only component with no trust boundary of its own, but its props may carry untrusted data (agent messages, repository paths, CLI output, Telegram text). Therefore: all text is rendered as React text nodes; no `dangerouslySetInnerHTML`/`innerHTML`, no Markdown-to-HTML, no `eval`/`new Function`; link targets are rendered as links only for `https:`/`http:` or app-internal routes (anything else, e.g. `javascript:` or `data:`, is shown as inert text); external links carry `rel="noopener noreferrer"`. The component performs no action itself, it only calls `on*` callbacks; the owning feature enforces Approvals and permissions (ADR 0003). The display must never hide a security-relevant fact (visibility word, expiry, scope 'this Run only', origin channel). Drag payloads can originate outside the app (another window, a web page, a malicious Skill name containing markup): the payload is parsed strictly, size-capped, never rendered as HTML, and never used for authorisation. `canAccept` must verify that the Skill exists and is visible in the target's Workspace (ADR 0028) by id against engine data. A rejected drop produces NO side effect. Skills imported from the internet remain Owner-provided (ADR 0012): the drop does not install anything.

## 10. Errors and edge cases

- Drop of text/plain from another app -> `parseSkillPayload` returns null, `onDrop` not called, state returns to idle.
- Payload with extra keys or oversized -> null.
- Drag cancelled with Escape -> store cleared, targets return to idle.
- Drag leaves the window -> `dragend` may not fire: window `blur`/30s timeout clears.
- Two targets overlapping (node inside group frame) -> only the innermost target (event `stopPropagation` in the handler) reacts.
- `canAccept` throws -> treated as rejected with a generic reason, error logged to console in dev.

## 11. Acceptance criteria

- [ ] Given a valid payload, When dragged over an accepting target, Then `state=="over-accept"` and drop calls `onDrop` once with the parsed payload.
- [ ] Given `canAccept` returns `{ok:false}`, Then `state=="over-reject"`, `dropEffect=="none"` and `onDrop` is never called.
- [ ] Given a drop with a forged payload (`{"v":2}` or 5 KiB), Then nothing is called.
- [ ] Given the keyboard menu, Then selecting a target performs the same `onDrop` path.
- [ ] Given Escape during a drag, Then all targets return to idle.
- [ ] Unit tests cover the codec with a 12-case table.

## 12. Test plan

Vitest + Testing Library for behaviour (props to DOM, keyboard, callbacks); `@storybook/test-runner` plays every story; axe (`@storybook/addon-a11y`) clean on every story in the dark theme; visual test through the part 1 harness (`lib:ui-visual-harness`): screenshot of the primary story compared with `design.png` (tolerance per OVE_TEST005). Commands: `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit test:storybook`, `pnpm --filter @overmind/ui-kit test:visual`. Unit tests with simulated `DragEvent`/`DataTransfer` (a minimal fake since jsdom lacks it) and Playwright component tests for real HTML5 DnD in Chromium AND WebKit (the macOS WKWebView engine) - run once in CI.

## 13. Parallelization notes

The folder is owned exclusively by this task; no edits to other tasks' files. Only conflict hotspot: the generated barrel `packages/ui-kit/src/index.ts` is never hand-edited (regenerate with the part 1 barrel script, OVE_ARCH009 extension-point rule). Runs in parallel with every other DS composite task once its `needs` primitives are merged; stub against the part 1 prop contracts while a primitive is in review.

## 14. Open questions and assumptions

- RISK: native HTML5 DnD in Tauri/WKWebView on macOS needs `dragDropEnabled: false` in the Tauri window config for in-page DnD (otherwise Tauri intercepts file drops). The Tauri shell task (OVE_SETUP010) must set it; recorded as a prerequisite note for the linker.
- ASSUMPTION: no touch support (macOS desktop only).
