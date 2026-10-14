---
id: OVE_ENGINE007
title: Version and compatibility handshake (system.version, protocol check, incompatible state)
area: ENGINE
kind: feature
size: S
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH008, OVE_ARCH009, OVE_ENGINE006, OVE_SETUP016]
soft_depends_on: []
provides: ["api:system.version", "lib:compat-handshake", "contract:VersionInfo"]
needs: ["lib:route-module", "contract:ApiVersion", "lib:engine-version-info"]
owns: ["packages/contracts/src/system/version.schema.ts", "packages/gateway/src/routes/engine/system-version.route.ts", "packages/gateway/src/middleware/protocol-check.ts", "packages/api-client/src/handshake/**"]
reads: ["packages/contracts/src/version.ts", "apps/engine/src/version.ts"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 12", "SPECIFICATION 13"]
adr_refs: [5, 9]
---

# OVE_ENGINE007: Version and compatibility handshake

## 1. Summary

The app and the engine are released together but run as separate processes, so an old engine may meet a new window (or the other way round after an update). A handshake makes the mismatch explicit and safe: both sides compare protocol versions and the UI shows an "incompatible version" state instead of failing randomly.

## 2. Context

SETUP010: `ensure-running` exits 30 on incompatible protocol and the shell reports `engine:status incompatible`. SETUP016: version info constants (`__OVERMIND_VERSION__`, `PROTOCOL_VERSION` from contracts). ARCH008: API versions are additive within a major.

## 3. Scope (in)

- `GET /v1/system/version`, `VersionInfo` contract, protocol-check middleware, client-side handshake helper in api-client.

## 4. Out of scope

- Updating the engine binary (SETUP014/017). UI state rendering (SHELL).

## 5. Detailed requirements

1. `VersionInfo` (strict): `{ appVersion: string, protocol: int, apiVersion: {major, minor}, minClientProtocol: int, buildSha: string, nodeVersion: string, platform: 'darwin'|'linux', arch: string, schemaVersion: string /* latest applied migration */ }`. `nodeVersion` and `buildSha` are returned to the owner scope only; agent scope gets `{ protocol, apiVersion }` only.
2. `PROTOCOL_VERSION` is a single integer in `@overmind/contracts` bumped only on a breaking gateway change (rare); `minClientProtocol` is the oldest client the engine still serves (default equals protocol in MVP).
3. Middleware `protocol-check`: if a request carries `X-Overmind-Protocol: n` and `n < minClientProtocol` or `n > protocol`, respond `412 gateway.incompatible_protocol` with `details: { engineProtocol, minClientProtocol }` (numbers); `system.version` and `system.health` are exempt so a mismatching client can still read the reason. Requests without the header are treated as the current protocol (curl, tests).
4. Client helper `performHandshake(client)`: calls `system.version`, compares with its own `PROTOCOL_VERSION`; returns `Result<{ compatible: true } | { compatible: false, reason: 'engine_older'|'engine_newer', engine, client }>`. The api-client calls it on connect and on every reconnect; the UI listens to the result (SHELL).
5. The engine records the first handshake of each client kind (`desktop`, `cli`, `telegram`) in a non-persisted ring (max 20) visible in diagnostics: `{ client, protocol, at }`.
6. Version numbers are never parsed from free text; semver is for display only.

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Version constants from SETUP016 (single definition), `defineRoute`, error `gateway.incompatible_protocol` (registered in `gateway.errors.ts` by ENGINE011).

## 8. Architecture and code placement

Contract `packages/contracts/src/system/`, route in `packages/gateway/src/routes/engine/`, middleware in `packages/gateway/src/middleware/`, client helper in `packages/api-client/src/handshake/`.

## 9. Security and safety

Version disclosure is reconnaissance: restricted to the owner scope. The check fails closed for unknown newer protocols (no guessing). Exempt routes expose no data beyond versions and state.

## 10. Errors and edge cases

- Header malformed (non-integer): 400 `validation.invalid_input`.
- Engine newer than client by one minor: compatible (additive).
- Engine older (app updated, engine not restarted): UI shows "restart the engine"; shell may call `ensure-running` after stopping the old one (ENGINE009 handles replacement of an old engine via `POST /v1/system/shutdown` then start).

## 11. Acceptance criteria

- [ ] `GET /v1/system/version` validates against the schema and hides build details from agent scope.
- [ ] Request with protocol below min returns 412 with numeric details; health still answers.
- [ ] `performHandshake` returns `engine_older`/`engine_newer` correctly in table tests.
- [ ] Single source of `PROTOCOL_VERSION` verified (grep test).

## 12. Test plan

Unit + gateway-under-test tests, contract snapshot. Commands: `pnpm vitest run packages/gateway/src/middleware packages/api-client/src/handshake`.

## 13. Parallelization notes

Small; parallel with ENGINE011.

## 14. Open questions and assumptions

- ASSUMPTION: protocol starts at 1 and equals `minClientProtocol` until the first breaking change.
