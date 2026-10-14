---
id: OVE_PROV020
title: Implement the Connection repository, SQLite table and Connection use cases
area: PROV
kind: feature
size: M
priority: P0
mvp: true
status: todo
depends_on: [OVE_ARCH007, OVE_ARCH010, OVE_ARCH012, OVE_BOX009, OVE_DATA001, OVE_DATA002, OVE_DATA003, OVE_DATA007, OVE_PERM009, OVE_PERM020, OVE_PROV001, OVE_PROV002]
soft_depends_on: [OVE_BOX009]
provides: ["port:ConnectionRepository", "table:connections", "adapter:SqliteConnectionRepository", "lib:memory-connection-repo", "usecase:SaveConnection", "usecase:GetConnection", "usecase:ListConnections", "usecase:SetConnectionStatus", "usecase:RemoveConnection"]
needs: ["contract:Connection", "contract:SecretRef", "port:SqliteDatabase", "lib:repository-base", "lib:migration-runner", "port:UnitOfWork", "port:EventBus", "port:Clock", "port:IdGenerator", "usecase:AppendAudit", "usecase:RequireLocalProof", "lib:credential-volumes", "lib:define-event"]
owns:
  - packages/application/src/prov/connections/**
  - packages/application/src/ports/ConnectionRepository.ts
  - packages/adapters/sqlite/src/prov/connections/**
  - packages/adapters/sqlite/migrations/V202610150090__OVE_PROV020__connections.sql
reads: ["packages/contracts/src/connection/", "docs/SPECIFICATION.md"]
design: none
design_source: ""
spec_refs: ["SPECIFICATION 9", "SPECIFICATION 14"]
adr_refs: [7, 10, 22]
---

# OVE_PROV020: Implement the Connection repository, SQLite table and Connection use cases

## 1. Summary

Persist the `Connection` entity (one row per CLI, the local Ollama, and the Telegram link) and offer the use cases the rest of the system needs: save, read, list, set status with change events, and remove a Connection with the Owner's confirmation. Connections hold references only (`secretRef`), never tokens, and the CLI logins stay in the credential volumes that Overmind never reads.

## 2. Context

The Connection contract and `connection.status_changed` event are PROV002: `type: 'cli'|'ollama'|'telegram'`, `status: unknown|not_installed|needs_login|ready|degraded|limit_reached|error|disabled`, `statusDetail { code, messageKey }`, `models: ModelInfo[]`, `secretRef` (null for cli and ollama, required for telegram), `endpoint` (ollama, loopback), `lastCheckedAt`, `limitResetText`. Consumers: model selection (PROV003), detection/test (PROV022), login (PROV014), limits (PROV018), routes (PROV021), Telegram pairing (TG, via `SaveConnection`), health reader (PROV025). Removing a CLI Connection deletes that CLI's login volume after the Owner confirms (BOX009 `deleteVolume` requires an approval token; the UI warns that the login will be lost).

## 3. Scope (in)

- `ConnectionRepository` port, SQLite implementation, in-memory fake and migration.
- Use cases `SaveConnection`, `GetConnection`, `ListConnections`, `SetConnectionStatus`, `RemoveConnection`.
- Status change events and audit.

## 4. Out of scope

- Contracts and routes (PROV002, PROV021), detection and tests (PROV022), login (PROV014), Telegram token storage (TG, Keychain), the Connections UI (CONNUI).

## 5. Detailed requirements

1. **Table (`V202610150090__OVE_PROV020__connections.sql`):** `connections(id PK 'cn_<ulid>', type TEXT, provider_id TEXT, display_name TEXT, status TEXT, status_detail_code TEXT NULL, status_detail_key TEXT NULL, version TEXT NULL, models_json TEXT NOT NULL DEFAULT '[]', secret_ref TEXT NULL, endpoint TEXT NULL, last_checked_at TEXT NULL, limit_reset_text TEXT NULL, created_at TEXT, updated_at TEXT)`; unique index on `(type, provider_id)` for `cli` and `ollama` (one Connection per CLI and per local Ollama); CHECK constraints mirror the contract invariants (`type='cli'` implies `secret_ref IS NULL`; `type='telegram'` implies `secret_ref IS NOT NULL`).
2. **Port:** `findById`, `findByProvider(providerId)`, `list(filter?)`, `insert`, `update(id, patch, expectedUpdatedAt)` (optimistic concurrency), `delete(id)`. All reads validate rows with the contract schema and drop unknown fields; a row failing validation is reported as `connection.corrupt` in logs and excluded from lists (never crashes).
3. **`SaveConnection`:** upsert by `(type, providerId)`; validates the invariants (zod), `endpoint` loopback rule (re-checked here), `displayName` length, `secretRef` shape (`SecretRef` from ARCH012: an id, never a secret value); strips status fields that only detection may set when called from a route (callers choose a `source: 'detection'|'owner'|'system'`); writes audit `provider.connection_saved`.
4. **`SetConnectionStatus`:** `{ connectionId, status, detail?, version?, models?, limitResetText?, checkedAt }`; a no-change call writes nothing; a change updates the row and publishes `connection.status_changed { connectionId, from, to, at }` (PROV002 event, persisted); allowed transitions are unrestricted except `disabled` is left only by an Owner action (`source: 'owner'`).
5. **`RemoveConnection`:** only for `cli` and `telegram` types (`ollama` rows are removable too, without volume); requires local proof (`RequireLocalProof`, PERM009, action `provider.remove_connection`, Owner desktop only); refuses while any Agent session on that Connection is live (`provider.busy`); for CLI Connections calls `credentialVolumes.deleteVolume` only when the Owner explicitly chose "also sign out" (separate flag in the request, second proof for `sandbox.delete_credentials`); Telegram secret removal is TG's concern (the row is removed here after TG revoked the secret reference). Audit `provider.connection_removed`.
6. **Models and secrets:** `models` stores what detection reported; `secretRef` values are never printed in logs (redactor knows the `SecretRef` format).
7. **Seed behaviour:** no rows are created at install; detection (PROV022) or the wizard creates them. `ListConnections` returns an empty list on first run, not an error.
8. **Backup/export:** rows contain no secrets and are included in the normal database backup (BACKUP). Credential volumes are outside the data directory by design (BOX009) and not part of backups.
9. **Fake:** `lib:memory-connection-repo` implements the same port for tests, enforcing the same invariants and optimistic locking (shared contract suite in PROV024).

## 6. Design notes

N/A, functionality only.

## 7. Reuse

Contracts and event (PROV002), `repository-base`, `UnitOfWork`, migration runner (DATA), `RequireLocalProof` (PERM009), `AppendAudit` (PERM020), `deleteVolume` (BOX009), ids (ARCH007).

## 8. Architecture and code placement

Port `packages/application/src/ports/ConnectionRepository.ts`; use cases `packages/application/src/prov/connections/{save.ts,get.ts,list.ts,set-status.ts,remove.ts,fake-repo.ts}`; adapter `packages/adapters/sqlite/src/prov/connections/connection-repository.sqlite.ts`; one migration. Application depends on the port only; SQL stays in the adapter.

## 9. Security and safety

Connections never contain credentials: CLI logins live in the CLI volumes, Telegram tokens in the Keychain by reference. Removal is Owner-only with local proof and a second proof for deleting a login volume (a Telegram message or an Agent can never remove or disable a Connection; `disabled` is Owner-set). The endpoint rule (loopback only) is enforced at save and at read (a tampered row with another host is flagged `degraded` with `endpoint_invalid` and not used). Status fields are system-written; routes cannot set `ready` directly.

## 10. Errors and edge cases

- Concurrent status updates from detection and login: optimistic lock retry once, last writer after merge wins only if its `checkedAt` is newer.
- Duplicate save for the same provider: update, not duplicate (unique index).
- Corrupt row: excluded and logged, never thrown.
- Removing a Connection with live sessions: refused.
- Database restored from backup: statuses are stale; detection re-runs at startup (PROV022).
- `models_json` huge (hostile CLI output): capped at 200 models and 4 KiB per model on write.

## 11. Acceptance criteria

- [ ] Migration applies cleanly and enforces the CHECK invariants (inserting a `cli` row with a `secret_ref` fails).
- [ ] `SetConnectionStatus` publishes exactly one `connection.status_changed` per real change and none for a no-op.
- [ ] `RemoveConnection` without valid local proof fails; with a live session returns `provider.busy`; `ollama` removal needs no volume action.
- [ ] A non-loopback endpoint is rejected at save and neutralised at read.
- [ ] The in-memory fake passes the same repository contract suite as SQLite (PROV024).
- [ ] No log or audit line contains a `secretRef` value or any token-like string.

## 12. Test plan

Repository contract tests on SQLite and memory implementations; use case tests with fakes and `FakeClock`; migration test through the migration runner; negative tests for hostile `models_json`. Commands: `pnpm vitest run packages/application/src/prov/connections packages/adapters/sqlite/src/prov/connections`.

## 13. Parallelization notes

Early dependency for PROV003 (soft), PROV014, PROV018, PROV021, PROV022, PROV025. Migration file unique. Hotspot: none.

## 14. Open questions and assumptions

- ASSUMPTION: one Connection per CLI and per Ollama (not per account); multiple subscriptions per CLI are post-MVP.
- ASSUMPTION: the Telegram Connection row is created by TG at pairing time through `SaveConnection` (source `system`).
