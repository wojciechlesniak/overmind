---
id: OVE_WSPACE004
title: Chief summary strip wiring with loading and stale states
area: WSPACE
kind: ui
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_CHIEF007, OVE_DS022, OVE_DS032, OVE_DS059, OVE_WSPACE001, OVE_WSPACE002, OVE_WSPACE003]
soft_depends_on: []
provides: []
needs: ["ui:ChiefSummaryStrip", "ui:Skeleton", "ui:TextLink", "api:chief.summary"]
owns: ["apps/desktop/src/features/workspaces/components/slots/ChiefSummary.slot.tsx", "apps/desktop/src/features/workspaces/components/ChiefSummary/**", "apps/desktop/src/features/workspaces/model/chief-headline.ts"]
reads: []
design: design.png
design_source: "Pulpit#dash/chief-summary (crop 88,160,1016,114 CSS px)"
spec_refs: ["SPECIFICATION 4", "SPECIFICATION 16.13"]
adr_refs: [1, 23]
---

# OVE_WSPACE004: Chief summary strip wiring with loading and stale states

## 1. Summary

Connects `ui:ChiefSummaryStrip` to the Chief summary: shows Chief's one-line status across the non-isolated Workspaces, the eyebrow, and the 'Otwórz czat' link to the Chief chat; handles loading, stale and unavailable data without ever presenting an outdated summary as current.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Spec section 4: on a general progress question Chief answers one sentence per Workspace; the strip shows the overall synthesis. The Telegram '/status' uses the same projector (CHIEF007 parity), so desktop and Telegram agree (criterion 13).

## 3. Scope (in)

- `components/slots/ChiefSummary.slot.tsx` (slot id `chiefSummary`) rendering `ui:ChiefSummaryStrip` from `vm.chief`.
- Composition of the overall sentence (see requirement 2).
- Link to the Chief chat route (`/chief`, owned by CHATUI/SHELL) via the route builder.

## 4. Out of scope

- Chief chat view (CHATUI).
- Generating text with a model: the sentence is assembled from engine rows only.

## 5. Detailed requirements

1. Eyebrow `workspaces:chief.eyebrow` ('CHIEF · SUMMARY' / PL 'CHIEF · PODSUMOWANIE').
2. Overall sentence = the engine-provided `summary.headline` when CHIEF007 supplies it; otherwise the client joins attention facts deterministically: `workspaces:chief.overall` with params `{working, paused, attention}` and the attention count from `summary.attention.approvals + accessRequests`; example PL 'Dwa Workspace\'y pracują, jeden jest wstrzymany. Potrzebuję Cię w 3 sprawach.' Never composed from per-row free text (prompt-injection safe: the headline contains only numbers and Workspace names that are rendered as text).
3. Second line (optional, 14px): the sentence of the most urgent row (state `attention`), e.g. 'QA ma 2 niepowodzenia w kodzie rabatowym, Security czeka na Zgodę.' It is the engine's sentence, rendered as plain text, clamped to 2 lines with a title attribute.
4. Action: `{ label: t('workspaces:chief.openChat'), href: routes.chief() }` ('Otwórz czat').
5. Loading: `loading` prop (avatar + 2 skeleton lines). Stale: when `now - generatedAt > 120 s` or the section status is `stale`, pass `stale={{ label: t('workspaces:chief.stale', {age}) }}` ('Summary from 2 hours ago'). Unavailable (error, no data): the strip shows `workspaces:chief.unavailable` ('Chief summary is not available right now.') with a 'Retry' text button calling `refetch`.
6. Zero Workspaces: the strip is NOT rendered (the empty state of OVE_WSPACE010 shows instead).
7. All Workspaces isolated: Chief has no cross-Workspace summary (CHIEF007); show `workspaces:chief.onlyIsolated` ('All Workspaces are isolated: Chief summarises none of them.').

## 6. Design notes

`design-summary`-style crop in `design.png`: magenta-bordered banner, Chief avatar 44 ('C'), eyebrow mono magenta, 15/1.5 sentence, 'Otwórz czat' link with chevron. Not in the mock: loading, stale, unavailable, only-isolated (derive from `ui:ChiefSummaryStrip` props `loading`, `stale`; unavailable and only-isolated use the same card with the sentence replaced). Copy PL as in the mock for the overall sentence.

## 7. Reuse

- `ui:ChiefSummaryStrip` (OVE_DS059), `ui:Skeleton`, `ui:TextLink`.
- `vm.chief` from OVE_WSPACE001/002.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: the headline and sentences are data produced by the engine from Workspace facts, shown as text; a malicious Task title cannot inject markup or a link. The 'Open chat' link is a route, never a URL from data.

## 10. Errors and edge cases

- Headline longer than 240 chars: clamp 3 lines, full text in `title`.
- `generatedAt` in the future: treated as now.
- Chief disabled (CHIEF config): the engine returns an empty headline; the strip shows the unavailable text.
- Retry pressed during loading: ignored (button disabled).

## 11. Acceptance criteria

- [ ] Given a fresh summary, Then the strip matches `design.png` and the link points to `/chief`.
- [ ] Given `generatedAt` 3 h ago, Then the stale line shows '3 godz.' wording via plural keys.
- [ ] Given the Chief route fails, Then the strip shows the unavailable text and Retry triggers one refetch.
- [ ] Given zero Workspaces, Then no strip is rendered.
- [ ] axe clean, link focusable with visible ring.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `ChiefSummary.slot.test.tsx` (loading, ready, stale, unavailable, onlyIsolated, retry), story per state, visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test components/slots/ChiefSummary`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/components/slots/ChiefSummary.slot.tsx`, `apps/desktop/src/features/workspaces/model/chief-headline.ts` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: CHIEF007 may not return a `headline`; the client composes it from counts as in requirement 2 (keys under `workspaces:chief.*`).
- OPEN: Should the strip be clickable as a whole? Default: only the link.
