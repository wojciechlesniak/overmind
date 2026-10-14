---
id: OVE_BOARDUI003
title: "Feature region slots: defineRegion and auto-discovered view regions"
area: BOARDUI
kind: infra
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009]
soft_depends_on: []
provides: ["lib:feature-regions"]
needs: ["lib:feature-manifest"]
owns: ["apps/desktop/src/shared/regions/**"]
reads: []
design: none
design_source: ""
spec_refs: []
adr_refs: []
---

# OVE_BOARDUI003: Feature region slots: defineRegion and auto-discovered view regions

## 1. Summary

Adds a tiny helper that lets several tasks contribute regions (list column, main, detail panel) to one feature route without editing a shared file: each region is a file `regions/<name>.region.tsx` discovered by `import.meta.glob`. This is the conflict-free composition point for the Board, Decisions, Agents, Skills and Approvals views.

## 2. Context

CONVENTIONS 5 requires extension points instead of shared files. A view such as the Board is built by many small tasks (header, lanes, detail panel, dialogs). If they all edited `BoardRoute.tsx` they would conflict. The same idea as `feature.manifest.ts` (OVE_ARCH009) is applied one level down: the route owner declares slots; region files register themselves.

## 3. Scope (in)

- `defineRegion({ slot, order, id, Component })`, `collectRegions(modules)` and `<RegionSlot name=... modules=... props=...>`.
- Validation of unique ids and stable ordering by `order` then `id`.
- Dev error boundary per region so one failing region does not blank the page.

## 4. Out of scope

- Layout (ui:PageLayout, SHELL).
- Any concrete region (owned by the view tasks).

## 5. Detailed requirements

1. `type RegionDef<P> = { id: string; slot: 'list' | 'main' | 'detail' | 'header' | 'overlay'; order: number; Component: React.ComponentType<P> }`; `defineRegion` returns the object after a zod check in dev.
2. `collectRegions(glob: Record<string, { default: RegionDef<any> }>)` returns defs grouped by slot, throws in dev (and logs once in production) on duplicate ids.
3. `<RegionSlot name modules props />` renders the components of one slot in order, each wrapped in an error boundary that renders a small inline error with a retry button (strings from props `labels.regionError`, `labels.retry`).
4. Each region receives the same `props` object (the route passes view context ids and callbacks, never data fetched elsewhere).
5. `overlay` slot regions render dialogs through a portal (ui:Dialog handles portal itself); they are mounted always and open by their own state.
6. Typed: `RegionSlot<P>` generic; stories show two regions and a failing region.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

Pattern of `defineFeature` (OVE_ARCH009). Does not duplicate it: manifests describe routes and nav, regions describe route content.

## 8. Architecture and code placement

Layer: UI shared. `apps/desktop/src/shared/regions/{define-region.ts,collect-regions.ts,RegionSlot.tsx}`. No dependency on any feature. Each feature route does `const modules = import.meta.glob('./regions/*.region.tsx', { eager: true })`.

## 9. Security and safety

No data crosses regions except the props the route passes; a failing region cannot read another's state. Error boundaries must not render error `message` text from thrown values (could contain untrusted data); they show the label and a generic id only. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Two regions with the same id: error in dev/test.
- Region file without default export: error naming the file.
- Region throws during render: boundary shows retry; other regions unaffected.
- Zero regions in a slot: renders nothing.

## 11. Acceptance criteria

- [ ] Given two region files in the same slot, Then they render ordered by `order`.
- [ ] Given a throwing region, Then siblings still render and the retry button remounts it.
- [ ] Given duplicate ids, Then `collectRegions` throws in test mode.

## 12. Test plan

Vitest + Testing Library: `collect-regions.test.ts`, `RegionSlot.test.tsx` including error boundary. Command: `pnpm --filter @overmind/desktop test shared/regions`.

## 13. Parallelization notes

Tiny; can start immediately in parallel with OVE_BOARDUI001/002.

## 14. Open questions and assumptions

- ASSUMPTION: `import.meta.glob` eager mode is acceptable for regions inside a lazily loaded route chunk.
