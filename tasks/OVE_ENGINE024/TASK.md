---
id: OVE_ENGINE024
title: Engine configuration wiring - ConfigService, hot reload, config routes and change events
area: ENGINE
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH005, OVE_ARCH009, OVE_ARCH010, OVE_ENGINE002, OVE_ENGINE013]
soft_depends_on: []
provides: ["api:config.get", "api:config.update", "event:config.changed", "lib:config-hot-reload"]
needs: ["port:ConfigStore", "port:EventBus", "lib:route-module", "lib:config"]
owns: ["apps/engine/src/config/**", "packages/contracts/src/config/config.routes.ts", "packages/contracts/src/events/config.changed.event.ts", "packages/gateway/src/routes/engine/config-*.route.ts", "apps/engine/src/composition/modules/engine-config.module.ts"]
reads: ["packages/contracts/src/config/app-config.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 12"]
adr_refs: [10]
---

# OVE_ENGINE024: Engine configuration wiring

## 1. Summary

Expose the validated `AppConfig` (ARCH005) to the app: read the effective configuration, update allowed fields with validation, apply hot-reloadable settings without restart (log level, notification sound), flag fields that need a restart, and emit `config.changed`.

## 2. Context

ARCH005 delivers the schema, `ConfigStore` and file adapter; other areas add sections (`config/sections/<area>.config.ts`). SETUI edits settings in the UI (parallelism limit 1-10, backup time, locale). Config contains no secrets and telemetry is literal false.

## 3. Scope (in)

- `ConfigService` (application-level wrapper), routes, change events, hot-reload registry, restart-required marking, protection of security-relevant fields.

## 4. Out of scope

- The store and schema (ARCH005). Settings UI (SETUI). Secrets (Keychain).

## 5. Detailed requirements

1. Routes (scope owner): `GET /v1/config` returns `{ config: AppConfig, restartRequired: string[], readOnly: boolean, source: 'file'|'defaults'|'recovered' }`; `PATCH /v1/config` accepts a `DeepPartial<AppConfig>` validated strictly (unknown keys rejected), with `expectedRevision` (hash of current config) for optimistic concurrency (`data.version_conflict`).
2. Field policy table (in code and docs): each config path declares `reload: 'hot' | 'restart'`, `mutable: boolean`, `expandsPermissions: boolean`. Hot: `logging.level`, `logging.diagnosticMode`, `notifications.sound`, `engine.maxParallelAgents`, `locale`. Restart: `gateway.*`, `engine.shutdownGraceSeconds`, `backup.time` (BACKUP re-reads at next schedule, treated hot by BACKUP). Immutable via API: `telemetry` (literal false), `gateway.socketPathOverride`.
3. `diagnosticMode` is bounded: setting it true sets `diagnosticModeUntil = now + 1h` automatically (max 24 h) and returns to false afterwards (timer on `Clock`); it only relaxes redaction-safe verbosity (never disables redaction).
4. Hot apply: `ConfigService` publishes `config.changed {paths: string[]}` (persisted, `audit: true` for changes of `engine.maxParallelAgents` and logging diagnostic mode); consumers (Logger, scheduler, NOTIF) subscribe through their modules. A consumer failing to apply logs `error` and the value stays stored (reported in `restartRequired`).
5. Read-only mode: when the file has a newer `schemaVersion` than supported (ARCH005 req. 7), `PATCH` returns `config.newer_version` and `readOnly: true`.
6. Recovery notice: if the store reports `recovered`, a one-time event `config.recovered` is emitted after the bus is ready; GET shows `source: 'recovered'` until the Owner dismisses via `POST /v1/config/acknowledge-recovery`.
7. Validation order: schema -> field policy -> cross-field rules (for example `maxParallelAgents` between 1 and 10; backup time `HH:MM`) -> persist atomically through `ConfigStore.update` (keeps `.bak`) -> publish.
8. Telegram/agents cannot reach these routes (owner scope). `PATCH` of a field marked `expandsPermissions` (none in MVP, reserved) would require `local: true`.
9. Secrets guard: a request containing keys that match the deny-regex of ARCH005 (token, secret, key, password) is rejected `validation.invalid_input` even if the schema were extended later.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

`ConfigStore`, `AppConfig`, `defineConfigSection` (ARCH005), `EventBus`, `defineRouteModule`.

## 8. Architecture and code placement

`apps/engine/src/config/{config-service.ts,field-policy.ts,hot-reload.ts}`, routes in `packages/gateway/src/routes/engine/`, module `engine-config.module.ts`. Policy table lives with the engine (it is a runtime concern), section schemas stay with their areas; a section may export its field policy through `config/sections/<area>.policy.ts` collected by the barrel generator.

## 9. Security and safety

No secrets in config (schema + deny-regex). Owner-only. Changes audited. Diagnostic mode time-boxed and never disables redaction. Immutable telemetry flag prevents data exfiltration switches (ADR 0010).

## 10. Errors and edge cases

- Concurrent edits: revision mismatch -> conflict.
- Disk full on write: `data.disk_full`, old config retained.
- Invalid value from hand-edited file at startup: handled by ARCH005 recovery.
- Changing `maxParallelAgents` below running count: applies to new starts only.

## 11. Acceptance criteria

- [ ] PATCH `logging.level` takes effect without restart and emits `config.changed`.
- [ ] PATCH of `telemetry` or an unknown key returns 400.
- [ ] `restartRequired` lists `gateway.*` changes.
- [ ] Diagnostic mode returns to false after an hour on a fake clock.
- [ ] Newer-version file yields read-only behaviour.

## 12. Test plan

Unit tests for policy table and revision; route tests via gateway-under-test; hot-reload subscriber tests with `FakeClock`. Commands: `pnpm vitest run apps/engine/src/config`.

## 13. Parallelization notes

Areas supply policies via `config/sections/<area>.policy.ts`; no edits here.

## 14. Open questions and assumptions

- ASSUMPTION: policy per path kept in code with section-provided extensions.
