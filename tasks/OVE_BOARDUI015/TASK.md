---
id: OVE_BOARDUI015
title: "Board feature manifest: route, rail item, status badge and navigation links"
area: BOARDUI
kind: feature
size: XS
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH009, OVE_ARCH011, OVE_BOARD013, OVE_BOARDUI006]
soft_depends_on: []
provides: ["lib:board-manifest"]
needs: ["lib:feature-manifest", "lib:i18n-ui", "api:board.view"]
owns: ["apps/desktop/src/features/board/feature.manifest.ts", "apps/desktop/src/features/board/index.ts"]
reads: []
design: none
design_source: ""
spec_refs: []
adr_refs: [11]
---

# OVE_BOARDUI015: Board feature manifest: route, rail item, status badge and navigation links

## 1. Summary

Registers the Board view with the shell: route `/board`, the rail item `Tablica Zadań`, i18n namespaces and the required capabilities, using only the manifest extension point.

## 2. Context

`defineFeature` (OVE_ARCH009) lets the shell build the rail, tabs and routes from `features/*/feature.manifest.ts`. The mock rail item is `Tablica Zadań` (4th rail icon, aria `Tablica Zadań`, active y=224). The Board has no sub-tabs.

## 3. Scope (in)

- `feature.manifest.ts` default export.
- `index.ts` exporting `useBoardDeepLink` helper types for shell link builders (route `/board?task=<id>&filter=<id>`).

## 4. Out of scope

- Rendering of the rail (SHELL), the page itself (OVE_BOARDUI006).

## 5. Detailed requirements

1. Manifest: `id: 'board'`, `titleKey: 'board:nav.title'`, `namespaces: ['board','board-header','board-lanes','board-detail','board-actions','board-deferred','board-create','board-live','board-states']`, `routes: [{ path: '/board', element: () => import('./routes/BoardRoute') }]`, `nav: [{ id: 'board', area: 'rail', labelKey: 'board:nav.label', icon: 'board', order: 40 }]` (icon name from the ui-kit icon set; the mock uses the kanban glyph), `requiresCapabilities: ['api:board.view']`.
2. No `statusItems` and no `commands` in MVP (a command `Add Task` can come later).
3. The rail item order 40 matches the shell order Workspaces(10) Chief(20) Workflow(30) Board(40) Decisions(50) | Agents(60) | Settings(bottom); the order numbers are taken from the SHELL convention (reported).
4. Deep links: export a pure helper `boardHref({ taskId?, filter? })` from `index.ts` for other features to build links THROUGH `lib:route-links` (features must not import each other, so the helper is registered with the shell's route table, not imported across features).
5. A unit test validates the manifest with `defineFeature` and that all namespaces have EN and PL files with the same keys.

## 6. Design notes

N/A, functionality only (hooks, mappers and wiring; the visual result is defined by the ui-kit components named in section 7).

## 7. Reuse

`defineFeature` (OVE_ARCH009). Nothing else.

## 8. Architecture and code placement

Layer: UI (`apps/desktop`). Folder `apps/desktop/src/features/board/` (feature `board`). Imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` and `apps/desktop/src/shared/*`; never another feature (rule `BOUNDARY_FEATURE_CROSS_IMPORT`, OVE_ARCH002). Dependency direction: region/component -> hook -> api-client; mappers are pure functions with no React and no I/O (easy to unit test). Presentational pieces come from ui-kit and are not re-implemented. Files: `feature.manifest.ts`, `index.ts`. Layer: composition metadata only, no logic.

## 9. Security and safety

The manifest declares `requiresCapabilities` so the shell hides the Board if the engine lacks the API (fail closed rather than showing a broken view). No data is read. All text that originates from Agents, Chief, repositories, documents, CLI output or imports is untrusted. It is rendered only as React text nodes through ui-kit components: no `dangerouslySetInnerHTML`, no Markdown-to-HTML, no `eval`. Links are produced only through `toSafeHref` / `<SafeLink>` (OVE_BOARDUI002). The UI never decides authorisation: it shows what the engine returned and sends only the Owner's intent. The gateway derives actor and channel from the local session token, so request bodies built here MUST NOT contain `actor`, `channel`, `principal`, `local` or `workspaceId` where the route contract forbids them. Security-relevant results are never shown optimistically: the UI changes state only after the engine answered (fail closed). Error messages shown to the Owner use `renderMessage` with `errors:` keys and never echo raw server text, stack traces, secrets or absolute host paths outside the Owner's own Workspace.

## 10. Errors and edge cases

- Namespace file missing in one language: the i18n lint fails the build.
- Capability missing at runtime: the shell shows the route as unavailable (SHELL behaviour).
- Route path collision: `collectFeatures` throws.

## 11. Acceptance criteria

- [ ] Given the shell collects manifests, Then `/board` resolves lazily to `BoardRoute` and a rail item `Tablica Zadań` appears with order 40.
- [ ] Given `pnpm i18n:check`, Then all listed namespaces are complete in EN and PL.
- [ ] Given a unit test, Then `defineFeature` validation passes.

## 12. Test plan

Vitest: `feature.manifest.test.ts` (schema, namespaces exist, order), `pnpm i18n:check`. Command: `pnpm --filter @overmind/desktop test features/board/feature.manifest`.

## 13. Parallelization notes

Tiny; depends on the route file only. Do not edit shell files.

## 14. Open questions and assumptions

- ASSUMPTION: icon id `board` exists in the ui-kit icon set (OVE_DS009 includes the kanban glyph); if named differently the linker maps it.
