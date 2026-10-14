---
id: OVE_DS109
title: "Build ErrorState, LiveRegion and PageGrid primitives"
area: DS
kind: ui
size: S
priority: P1
mvp: true
status: todo
depends_on: [OVE_DS005, OVE_DS006, OVE_DS008, OVE_DS013, OVE_DS022]
soft_depends_on: []
provides: ["ui:ErrorState", "ui:LiveRegion", "ui:PageGrid"]
needs: ["ui:Text", "ui:Button", "ui:VisuallyHidden", "ui:tokens-layout"]
owns: ["packages/ui-kit/src/feedback/ErrorState/**", "packages/ui-kit/src/a11y/LiveRegion/**", "packages/ui-kit/src/layout/PageGrid/**"]
reads: []
design: none
design_source: ""
spec_refs: ["SPECIFICATION 16.8"]
adr_refs: [17]
---

# OVE_DS109: Build ErrorState, LiveRegion and PageGrid primitives

## 1. Summary

Adds three small ui-kit primitives that feature views need and DS did not yet provide: `ErrorState` (calm error panel with retry), `LiveRegion` (polite or assertive announcements) and `PageGrid` (the standard list-plus-detail page grid). They exist once so feature tasks never rebuild them.

## 2. Context

Approvals, Skills, Agents and Discussions views each need an error state, screen reader announcements for live updates and the two-column page grid (OVE_AGUI015, OVE_APPRUI013, OVE_SKUI014, OVE_DISCUI017). COMPONENT-INVENTORY.md section E normalisations apply; styling uses tokens only. The mock files show the visual language (flat surfaces, hairline borders, Polish copy); these three have no dedicated crop, so they are derived from existing tokens.

## 3. Scope (in)

- `ErrorState` props `{ title, description?, onRetry?, retryLabel?, tone?: "neutral"|"danger", compact?: boolean }` built from `Text`, `Button`, `Card`.
- `LiveRegion` props `{ message, politeness?: "polite"|"assertive", clearAfterMs? }` rendering a visually hidden `role=status` or `role=alert` element.
- `PageGrid` props `{ list, detail, listWidth?: number }` implementing the 2-column layout with collapse at narrow widths.
- Stories for every variant and state, axe checks, EN and PL i18n keys for default strings (`ui.errorState.retry`).

## 4. Out of scope

- Feature copy and wiring: the consuming tasks.
- Toasts and banners: other DS tasks.

## 5. Detailed requirements

1. No hard-coded strings: default labels come from i18n keys with EN default and PL translation; the component accepts overrides.
2. `LiveRegion` MUST be mounted once with a stable DOM node and update its text content, so screen readers announce changes; identical consecutive messages are re-announced by clearing for one frame.
3. `LiveRegion` text is plain text only (no HTML) and is capped at 300 characters.
4. `ErrorState` has `role=alert` only when `tone="danger"`; the retry button is focusable and receives focus on request via `autoFocus` prop (default false).
5. `PageGrid` uses CSS grid with tokens from `ui:tokens-layout`; list column default width 360px, detail min width 0, collapses to a single column below 960px with the list first; no fixed pixel values outside tokens.
6. All three respect reduced motion (no animation) and dark and light theme tokens where defined.
7. Visual comparison against the layout in the Approvals and Discussions views within tolerance (OVE_TEST005).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

- `Text`, `Button`, `Card`, `VisuallyHidden`, `tokens-layout`, `a11y-harness`; do not re-implement them.

## 8. Architecture and code placement

Layer: `ui-kit` depends on nothing internal. Components are presentational and props-driven (SRP); composition of other ui-kit parts only through their public exports.

## 9. Security and safety

- Components render caller-supplied strings only as text nodes (never `dangerouslySetInnerHTML`), so error messages from the gateway cannot inject markup.
- `LiveRegion` must not echo secrets; callers pass already-redacted messages (documented in the story).

## 10. Errors and edge cases

- Missing `onRetry` -> no button rendered.
- Very long error description -> wraps and scrolls within the card without breaking layout.
- `PageGrid` with empty detail -> detail column keeps its space and shows the provided placeholder.

## 11. Acceptance criteria

- [ ] Given a `danger` ErrorState, then axe passes and it is announced as an alert.
- [ ] Given two identical LiveRegion messages in a row, then both are announced.
- [ ] Given width 800px, then PageGrid shows one column.
- [ ] Given PL locale, default retry label is Polish.

## 12. Test plan

- Storybook stories per variant, Vitest render tests, axe via `lib:a11y-harness` (OVE_TEST010), visual snapshots. `pnpm --filter @overmind/ui-kit test`, `pnpm --filter @overmind/ui-kit storybook:test`.

## 13. Parallelization notes

Parallel with all DS tasks. New component folders only; the barrel is generated (OVE_ARCH009).

## 14. Open questions and assumptions

- Open: exact PageGrid column widths; default 360px list column from the Approvals mock (ASSUMPTION).
