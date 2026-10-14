---
id: OVE_ENGINE025
title: Diagnostics endpoint and support bundle with redaction
area: ENGINE
kind: feature
size: M
priority: P1
mvp: true
status: todo
depends_on: [OVE_ARCH004, OVE_ARCH005, OVE_ARCH007, OVE_ARCH009, OVE_ARCH013, OVE_DATA006, OVE_ENGINE006, OVE_ENGINE013]
soft_depends_on: []
provides: ["api:system.diagnostics", "api:system.support_bundle", "usecase:CreateSupportBundle", "port:DiagnosticsContributor"]
needs: ["lib:redaction", "port:AtomicFileWriter", "lib:data-dir", "lib:route-module", "port:Clock"]
owns: ["apps/engine/src/diagnostics/**", "packages/application/src/ports/DiagnosticsContributor.ts", "packages/contracts/src/system/diagnostics.schema.ts", "packages/gateway/src/routes/engine/system-diagnostics*.route.ts", "apps/engine/src/composition/modules/engine-diagnostics.module.ts"]
reads: ["docs/architecture/logging.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 15"]
adr_refs: [10]
---

# OVE_ENGINE025: Diagnostics and support bundle

## 1. Summary

Give the Owner a safe way to see engine internals (stats, versions, integrity findings, recent warnings) and to export a support bundle for an issue report. Everything is redacted; nothing leaves the computer unless the Owner attaches the file.

## 2. Context

SPEC 15 asks for redaction of secrets and personal data in logs and export of reports. ADR 0010: no telemetry. Bugs in an open-source project are reported by the Owner as GitHub issues (ADR 0025); a redacted bundle makes that possible without leaking prompts, paths, tokens or file content.

## 3. Scope (in)

- `DiagnosticsContributor` multi-port, `GET /v1/system/diagnostics`, bundle creation as a zip written to a Owner-chosen location, redaction pipeline, manifest.

## 4. Out of scope

- Contributors from other areas (each adds one). Crash reporting uploads (never). Log rotation (ARCH004).

## 5. Detailed requirements

1. Port: `{ id, collect(ctx): Promise<Result<DiagnosticSection>> }`, `DiagnosticSection = { id, title, data: JsonValue (bounded 64 KiB), redactionApplied: true }`. The engine itself contributes: versions/protocol/platform, lifecycle state history (last 50 transitions), health checks, gateway stats (connections, rate-limit counts, auth failures count), event bus stats, DB info (schema version, file sizes, WAL size, integrity findings, last backup time), config summary (non-secret keys only, values of enums/booleans/numbers), migration list, recent warnings/errors (last 200 log records from a ring buffer, already redacted), handshake ring, uptime.
2. `GET /v1/system/diagnostics` (owner only): returns sections inline; each section passes `redactDeep` again (defence in depth) and a size cap of 256 KiB total.
3. Support bundle: `POST /v1/system/support-bundle` `{ destination: { rootId | path from FileDialog result }, includeLogs: boolean }` (owner, `local: true` required since it writes to a user-chosen location): writes `overmind-support-<date>.zip` containing `manifest.json` (versions, file list with sha256, redaction rules version), `diagnostics.json`, and if `includeLogs` the last 5 MiB of `engine.log` re-redacted. NEVER included: the database, artifacts, session token, config file raw, Keychain refs, prompts, chat texts, Decision texts, Telegram data, environment variables, home directory paths (replaced with `~`), usernames.
4. Destination path is canonicalised and checked by PathGuard against an explicit allow-list of the Owner-selected save location (the path comes from the native save dialog result; the engine verifies it is a new file inside a directory owned by the user and not inside the data directory, `.ssh`, etc.) and written atomically with mode 0600.
5. Redaction: the logging redaction patterns (ARCH004) plus extra bundle rules: absolute paths to `~`, e-mail addresses, IPv4 addresses, 40+ char hex/base64 strings, long digit runs; a final `expectNoSecrets` self-check scans the whole zip contents before it is finalised; any hit aborts with `internal.redaction_failed` (nothing written).
6. Size caps: bundle <= 10 MiB; contributors timeout 3 s each; failures recorded as `section unavailable`.
7. The UI shows the manifest and asks the Owner to review before sharing (SETUI); this task only produces the file and returns `{ path (display form), sizeBytes, sha256, sections }`.
8. Audit event `diagnostics.bundle_created` (id and size only).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Redactor and ring buffer (ARCH004), `AtomicFileWriter` (write), PathGuard (SEC002), zip via a small dependency-free store-only writer (`zip-store.ts`, KISS; no deflate needed) to avoid a new dependency.

## 8. Architecture and code placement

`apps/engine/src/diagnostics/{collector.ts,bundle.ts,zip-store.ts,bundle-redactor.ts}`; port in application; routes in `packages/gateway/src/routes/engine/`.

## 9. Security and safety

The bundle is the one sanctioned way data leaves the app at the Owner's discretion, so exclusion list + double redaction + self-scan are mandatory. `local: true` needed for writing outside the data directory. No network sending. Paths shown only in display form.

## 10. Errors and edge cases

- Destination not writable: `data.permission_denied`.
- Log file huge: only tail read, streaming.
- Redaction false positive hides useful info: acceptable; manifest states rules.
- Secret appears in an unexpected contributor: self-scan aborts.

## 11. Acceptance criteria

- [ ] A planted fake token and `/Users/alice/.ssh/id_rsa` in logs and contributor data never appear in the bundle (corpus test).
- [ ] Bundle excludes the database and session token (manifest asserts the file list).
- [ ] Agent and Telegram callers get 403; a non-local owner call gets `perm.local_approval_required`.
- [ ] A failing contributor yields a section `unavailable`, bundle still created.
- [ ] Bundle larger than 10 MiB is truncated by dropping logs first.

## 12. Test plan

Unit tests for redactor rules, zip writer round trip, self-scan; route tests with gateway-under-test; corpus from SEC003. Commands: `pnpm vitest run apps/engine/src/diagnostics`.

## 13. Parallelization notes

Areas add contributors in their own modules.

## 14. Open questions and assumptions

- ASSUMPTION: store-only zip is acceptable for logs of <= 10 MiB.
