---
id: OVE_DECUI014
title: "Decisions feature manifest: route, rail item and namespaces"
area: DECUI
kind: feature
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_DEC011, OVE_DECUI003]
soft_depends_on: []
provides: ["lib:decisions-manifest"]
needs: ["lib:feature-manifest", "lib:i18n-ui", "api:decision.list"]
owns: ["apps/desktop/src/features/decisions/feature.manifest.ts", "apps/desktop/src/features/decisions/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: []
adr_refs: [8]
---

# OVE_DECUI014: Decisions feature manifest: route, rail item and namespaces

## 1. Summary

Registers the Decision Register with the shell: route `/decisions`, rail item `Rejestr decyzji` and all namespaces.

## 2. Context

Mock rail: 5th icon `Rejestr decyzji` (active y=274). No sub-tabs. See OVE_ARCH009 for `defineFeature`.

## 3. Scope (in)

- `feature.manifest.ts` and `index.ts` (route helper `decisionHref({ id? })` registered with the shell route table).

## 4. Out of scope

- Rail rendering (SHELL).

## 5. Detailed requirements

1. `id: 'decisions'`, `titleKey: 'decisions:nav.title'`, `namespaces: ['decisions','decisions-list','decisions-detail','decisions-outcome','decisions-status','decisions-supersede','decisions-history','decisions-review','decisions-states']`, route `/decisions` lazy `./routes/DecisionsRoute`, nav rail order 50, icon from the ui-kit set (scales glyph), `requiresCapabilities: ['api:decision.list']`.
2. Unit test validates with `defineFeature`; i18n completeness EN/PL for all namespaces.
3. Deep links: other features (Board origin links, Chief chat) navigate to `/decisions?id=<id>` through `lib:route-links`, never by importing this feature.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`defineFeature`.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/decisions/` (feature `decisions`, route `/decisions`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (`BOUNDARY_FEATURE_CROSS_IMPORT`). Region/component -> hook -> api-client; mappers are pure. Presentational pieces come from ui-kit and are not re-implemented. Files: `feature.manifest.ts`, `index.ts`.

## 9. Security and safety

`requiresCapabilities` hides the view if the engine lacks the API (fail closed). All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Missing namespace file: lint fails.
- Order collision: stable by id.

## 11. Acceptance criteria

- [ ] Given the shell, Then `/decisions` resolves and the rail item appears with order 50.
- [ ] Given `pnpm i18n:check`, Then namespaces are complete.

## 12. Test plan

Vitest `feature.manifest.test.ts`; `pnpm i18n:check`.

## 13. Parallelization notes

Depends only on the route file.

## 14. Open questions and assumptions

- ASSUMPTION: icon id `decisions` in the ui-kit icon set.
