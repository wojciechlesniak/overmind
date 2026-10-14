---
id: OVE_WSPACE009
title: "System status list wiring: engine, isolation, herdr, backup and Telegram rows"
area: WSPACE
kind: ui
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_BACKUP009, OVE_DS022, OVE_DS032, OVE_DS060, OVE_ENGINE006, OVE_ENGINE007, OVE_TG012, OVE_WSPACE001, OVE_WSPACE003]
soft_depends_on: []
provides: []
needs: ["ui:SystemStatusList", "ui:Skeleton", "ui:TextLink", "api:system.health", "api:system.version", "api:backup.status", "api:telegram.status", "lib:api-client-backup", "lib:api-client-telegram"]
owns: ["apps/desktop/src/features/workspaces/api/useSystemStatus.ts", "apps/desktop/src/features/workspaces/model/map-system-rows.ts", "apps/desktop/src/features/workspaces/components/slots/System.slot.tsx"]
reads: []
design: design.png
design_source: "Pulpit#dash/system-status-list (crop 1120,440,320,220 CSS px)"
spec_refs: ["SPECIFICATION 11", "SPECIFICATION 12"]
adr_refs: [5, 20]
---

# OVE_WSPACE009: System status list wiring: engine, isolation, herdr, backup and Telegram rows

## 1. Summary

Feeds `ui:SystemStatusList` with five live rows (Silnik w tle, Izolacja (container), herdr, Kopia zapasowa, Telegram) from the engine health route, backup status and Telegram status, including degraded and error rows with a remedy link.

## 2. Context

The Workspaces dashboard (`Pulpit`, VIEWS section 3) is the home screen: Chief summary strip, a grid of Workspace cards (each with a segmented progress bar from the Task Board), the Notification centre and a System status list in a 320px right column. Spec sections 4, 10, 12; ADR 0010 (one Owner), 0028 (isolated Workspaces: everything private, nothing shared with Chief), 0003. Glossary: Workspace, Isolated Workspace, Chief, Run, Global Pause. Component anatomy lives in `ui:WorkspaceCard` (OVE_DS059) and `ui:NotificationCenter` / `ui:SystemStatusList` (OVE_DS060); this feature only maps engine data to their props and wires interactions. Copy is Polish in the mock; code uses i18n keys in namespace `workspaces` (EN default, PL first translation). Mock region `dash/system-status-list` (five mint rows: 'Silnik w tle · działa · 2 dni', 'Izolacja (container) · 3 kontenery', 'herdr · v0.9.2 · przypięta', 'Kopia zapasowa · dziś 03:00', 'Telegram · połączony'). Isolation unavailable means actions are blocked (fail closed, spec 11), so degraded states must be visible. Sources: `GET /v1/system/health` (ENGINE006, `checks[{id,status,detail}]`, `uptimeSeconds`, `version`), `GET /v1/backup/status` (BACKUP009), `GET /v1/telegram/status` (TG012), version `GET /v1/system/version` (ENGINE007).

## 3. Scope (in)

- `api/useSystemStatus.ts` combining the three routes + push (`system.state_changed`, `backup.status`, `telegram.status`).
- `model/map-system-rows.ts` implementation (type from OVE_WSPACE001).
- `components/slots/System.slot.tsx` (slot id `system`).
- Remedy links (routes) per row.

## 4. Out of scope

- Detailed health page or diagnostics (SETUI OVE_SETUI011).
- Fixing anything automatically (remedies navigate only).

## 5. Detailed requirements

1. Row `engine`: from `health.state`: `ready` -> ok, value `t('system.engine.running',{uptime})` ('running · 2 days', uptime via `formatDuration` words); `degraded` -> warn 'degraded'; `starting|migrating|recovering` -> warn with the state word; `draining|stopped|failed` -> error 'stopped' + remedy none (UI cannot start the engine; show `system.engine.restartHint`). If the health call itself fails (engine unreachable): error row 'not responding' with remedy 'Retry'.
2. Row `isolation`: from `health.checks` entry with id `sandbox` (ASSUMPTION: BOX/ENGINE register check id `sandbox`, detail `{ready:boolean, containers:int}`): ok -> '3 containers' (`system.isolation.containers_one|few|many|other`); status `degraded` -> warn; `failed` -> error 'unavailable' + remedy `{labelKey:'system.remedy.check', route: routes.connections()}` (Connections shows the environment card, OVE_CONNUI011). Missing check -> warn 'unknown'.
3. Row `herdr`: check id `herdr`, detail `{version, pinned:boolean}` -> ok 'v0.9.2 · pinned' / warn 'version differs from pinned' / error 'not running'. Remedy -> Connections.
4. Row `backup`: from backup status `{lastAt,sizeBytes,ok}`: ok -> 'today 03:00' (relative day words via `formatRelative`), `ok:false` -> error 'failed' + remedy to Settings backup section, no backup yet or older than 36 h -> warn 'overdue'.
5. Row `telegram`: status `connected|paired` -> ok 'connected'; `not_configured` -> ok-neutral 'not connected' rendered as `ok` with muted value (it is an optional channel, not a fault); `error|token_invalid` -> error 'error' + remedy to Connections; `disconnected` -> warn.
6. Polling: health every 15 s while visible plus on push events; backup and Telegram on push, otherwise on mount and every 60 s.
7. Card border turns `danger` automatically in the kit when any row is `error` (DS060).
8. Visually hidden status words come from `labels.status` (`ok` 'OK', `warn` 'attention', `error` 'error').
9. All values are built from enums and numbers; free text from `detail` is never shown (health details are bounded scalars, ENGINE006).

## 6. Design notes

`design.png`: heading 'System' and a nested card with five rows (6px mint dot + 13px label + mono 12 value). Derived states (DS060 fixtures): warn amber dot, error red dot + inline remedy `TextLink`, danger card border. Not in the mock: loading skeleton rows, polling failure.

## 7. Reuse

- `ui:SystemStatusList` (OVE_DS060), `ui:Skeleton`, `ui:TextLink`.
- `lib:api-client` for system health/version, `lib:api-client-backup`, `lib:api-client-telegram`.
- Row type of OVE_WSPACE001.

## 8. Architecture and code placement

Layer: UI (adapter side of Clean Architecture). Folder `apps/desktop/src/features/workspaces/` with `api/` (hooks over `@overmind/api-client`; the ONLY place that calls the gateway), `model/` (pure mappers and view-model types, no React, no I/O), `components/` (connected components composing ui-kit), `routes/` (lazy route elements). Dependencies: this task imports only `@overmind/ui-kit`, `@overmind/api-client`, `@overmind/contracts` (types/schemas) and its own feature folder (CONVENTIONS 6); never `apps/engine`, never another feature's internals (cross-feature use goes through the exported capability named in `needs`). SRP: mappers are pure and unit-tested; hooks own fetching and subscriptions; components own composition only. OCP: new rows/kinds are added by extending a registry/map in `model/`, not by editing switch statements in components.

## 9. Security and safety

The UI is a thin client: authorisation is enforced by the engine (ADR 0003); the UI never decides a permission and never sends `principal`, `channel`, `actor` or `local` fields (the gateway derives them from the transport, PERM008). Everything rendered from the engine (names, paths, summaries, CLI text, justification texts) is untrusted data: React text nodes only, no `dangerouslySetInnerHTML`, no Markdown/HTML parsing, no `eval`; links only from known route builders. Errors are shown from i18n keys of `error.code`, never from raw server text. No secret, token, proof id or CLI output is written to `console`, localStorage or the DOM beyond what the task says; the UI keeps no copy of the gateway token (injected by the Tauri shell, ENGINE022). Fail closed: when a call fails or its result is unknown the control stays in its safer state and the failure is shown. Specific: this panel is how the Owner learns that isolation is unavailable (fail closed): a missing or failed `sandbox` check MUST be shown as error/warn, never as ok by default (deny by default for status display: unknown != ok). Health detail from the engine is bounded scalars; no path or version string from an untrusted source is rendered beyond `version` (semver validated by regex before display).

## 10. Errors and edge cases

- Health route 503 during start: rows show 'starting' warn, no error flash for < 3 s.
- `checks` contains unknown ids: ignored.
- Version string not semver: shown as '?'.
- Backup route 403 (should not happen on desktop): row error 'not available'.
- All three routes failing: engine row error, the others warn 'unknown'.

## 11. Acceptance criteria

- [ ] Given all healthy fixtures, Then the list matches `design.png` (five mint rows).
- [ ] Given `sandbox` check failed, Then the isolation row is error with a focusable remedy link and the card shows the danger border.
- [ ] Given a missing `sandbox` check, Then the row is warn 'unknown', not ok.
- [ ] Given backup `ok:false`, Then error 'failed' and remedy to Settings.
- [ ] Given the engine unreachable, Then the engine row is error 'not responding'.

## 12. Test plan

Vitest + Testing Library for hooks, mappers and components (`@testing-library/user-event` for keyboard); a Storybook story per state with typed fixtures; Playwright against the mock gateway (OVE_TEST004) for the flows below; axe + keyboard checks (OVE_TEST010); visual comparison with `design.png` (OVE_TEST005) for UI tasks. Tests to write: `map-system-rows.test.ts` (truth tables per row, unknown != ok), `useSystemStatus.test.tsx` (polling, push, partial failure), `System.slot.test.tsx`, stories `System/Healthy|Degraded|Error|Loading`, visual vs `design.png`. Commands: `pnpm --filter @overmind/desktop test system`, `pnpm typecheck`, `pnpm lint`.

## 13. Parallelization notes

Owns only `apps/desktop/src/features/workspaces/api/useSystemStatus.ts`, `apps/desktop/src/features/workspaces/model/map-system-rows.ts`, `apps/desktop/src/features/workspaces/components/slots/System.slot.tsx` (note: `model/map-system-rows.ts` is listed in OVE_WSPACE001 as a type-only export; this task owns the implementation file and OVE_WSPACE001 owns only `dashboard.types.ts`)` (plus colocated tests, stories, fixtures and its i18n namespace file). Conflict hotspots: none by design; routes, nav and strings enter through `feature.manifest.ts` and `locales/<lang>/<ns>.json` (ARCH009), never through shared files.  Runs in parallel with every task whose `depends_on` it does not share; when an upstream capability is still in review, code against the contract types and use the mock gateway of OVE_TEST004.

## 14. Open questions and assumptions

- ASSUMPTION: health check ids `sandbox` and `herdr` with the details above; BOX/PROV owners must register them (gap in the final report).
- OPEN: containers count source (health detail vs Sandbox list).
